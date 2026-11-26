/**
 * WHIP, by hand.
 *
 * It is small: POST an SDP offer, get an SDP answer plus a Location
 * header, DELETE that location when you're done. There is no SDK
 * worth the bytes, and writing it out means the error paths are ours
 * — a broadcast that fails needs to say *why* to the person sitting
 * in front of it.
 *
 * Only publishing lives here. Viewers watch over HLS, which is a
 * plain <video> and a manifest, so there is no WHEP client to keep.
 *
 * ── WHY NOT TRICKLE ICE ──
 *
 * The spec allows PATCHing candidates as they're gathered. We instead
 * wait for gathering to complete and send one full offer, because
 * MediaMTX answers with its own candidates immediately and the extra
 * round trips buy nothing on a two-party call. The wait is capped so
 * a network where gathering never completes still connects.
 *
 * ── THE AUTHORIZATION HEADER ──
 *
 * The grant token goes in `Authorization: Bearer`. MediaMTX forwards
 * it to our auth hook as `token`. It is never in the URL: a URL ends
 * up in history, in referrers and in the media server's access log.
 */

const GATHER_TIMEOUT_MS = 3000;

/* ── codecs ───────────────────────────────────────────────────────
 *
 * THIS IS THE BIT THAT WAS MISSING, AND IT COST US A BLACK PICTURE.
 *
 * The browser picks the video codec unless it is told otherwise, and
 * Chrome offers VP8 first. MediaMTX answered with VP8, accepted it
 * happily, and then could not put it into HLS — the HLS muxer takes
 * H.264 or H.265 video, nothing else, and it does not transcode. The
 * Opus audio went through fine, so viewers heard everything and saw a
 * black rectangle, and MediaMTX reported the path as `["Opus","VP8"]`
 * and perfectly healthy.
 *
 * So: put H.264 at the front of the offer.
 *
 * Two details that matter.
 *
 *  • PACKETIZATION MODE 1. Mode 0 sends one NAL unit per packet and
 *    cannot fragment, so anything above a small frame breaks. Pion
 *    (what MediaMTX is built on) expects mode 1. Browsers advertise
 *    both, and the mode is only visible in `sdpFmtpLine`.
 *
 *  • CONSTRAINED BASELINE (42e01f) FIRST among the mode-1 entries.
 *    It is the profile every HLS player, including Safari and iOS,
 *    is required to support. High profile plays in most places and
 *    fails in exactly the places that are hardest to debug.
 *
 * The rest of the codec list is kept, in its original order, after
 * the H.264 entries: preference, not exclusion. If H.264 negotiation
 * somehow fails we would rather have a VP8 connection the server-side
 * check can then reject with a clear message, than no connection and
 * no explanation.
 */

const H264 = /h264/i;

function rankH264(codec: RTCRtpCodec): number {
  const fmtp = codec.sdpFmtpLine ?? "";
  // Unusable with MediaMTX — sorted last among H.264 entries.
  if (!/packetization-mode=1/.test(fmtp)) return 2;
  // Constrained baseline: the one every HLS player must support.
  if (/profile-level-id=42e01f/i.test(fmtp)) return 0;
  return 1;
}

/**
 * Can this browser send H.264 at all?
 *
 * Chrome, Edge and Safari: yes. Firefox: yes, once its OpenH264 plugin
 * has downloaded. Some Linux Chromium builds are compiled without it
 * and genuinely cannot — and on those, a browser broadcast can never
 * be watched over HLS, so it is worth saying so before someone talks
 * to an empty room for ten minutes.
 */
export function canSendH264(): boolean {
  if (typeof RTCRtpSender === "undefined" || !RTCRtpSender.getCapabilities) return true;
  const caps = RTCRtpSender.getCapabilities("video");
  if (!caps) return true; // unknown — let the server-side check decide
  return caps.codecs.some((c) => H264.test(c.mimeType) && /packetization-mode=1/.test(c.sdpFmtpLine ?? ""));
}

/**
 * The preferred order, as a pure function of the browser's
 * capabilities — separated out so the rule can be tested without a
 * browser that happens to ship an H.264 encoder.
 *
 * Returns null when there is nothing to prefer, so the caller can
 * leave the transceiver alone rather than reordering it into the same
 * order it already had.
 */
export function orderVideoCodecs<T extends RTCRtpCodec>(codecs: readonly T[]): T[] | null {
  const h264 = codecs.filter((c) => H264.test(c.mimeType));
  if (h264.length === 0) return null;
  // Stable within each rank: the browser's own order is a reasonable
  // tie-break, and reordering more than necessary risks upsetting
  // hardware-encoder selection.
  const ranked = h264
    .map((c, i) => ({ c, i, r: rankH264(c) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
  return [...ranked, ...codecs.filter((c) => !H264.test(c.mimeType))];
}

/** Put H.264 at the front of a video transceiver's offer. */
function preferH264(tx: RTCRtpTransceiver): void {
  if (typeof tx.setCodecPreferences !== "function") return;
  const caps = RTCRtpSender.getCapabilities?.("video");
  if (!caps?.codecs?.length) return;

  const ordered = orderVideoCodecs(caps.codecs);
  if (!ordered) return;

  try {
    tx.setCodecPreferences(ordered);
  } catch {
    // A browser that refuses the list is no worse off than before it
    // was asked; the server-side track check is the backstop.
  }
}

export class StreamError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "StreamError";
  }
}

/** A live WHIP connection, and the one thing you do to it. */
export interface StreamHandle {
  pc: RTCPeerConnection;
  close: () => Promise<void>;
}

function iceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    // Capped: some networks never reach "complete", and a half-
    // gathered offer still connects far more often than no offer.
    const timer = setTimeout(done, GATHER_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

async function exchange(
  url: string,
  token: string,
  offer: RTCSessionDescriptionInit,
): Promise<{ answer: string; location: string | null }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: `Bearer ${token}`,
      },
      body: offer.sdp ?? "",
    });
  } catch (err) {
    throw new StreamError(
      "Couldn't reach the streaming server. Check your connection and try again.",
      err,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new StreamError("Your place in this session has expired. Rejoin to continue.");
  }
  if (res.status === 404) {
    throw new StreamError("That session isn't open on the streaming server.");
  }
  if (!res.ok) {
    throw new StreamError(`The streaming server refused the connection (${res.status}).`);
  }

  const answer = await res.text();
  if (!answer.trim()) throw new StreamError("The streaming server sent an empty reply.");

  // Location is relative to the request URL, per the WHIP spec.
  const raw = res.headers.get("Location");
  const location = raw ? new URL(raw, url).toString() : null;
  return { answer, location };
}

function attachClose(pc: RTCPeerConnection, location: string | null, token: string): StreamHandle {
  let closed = false;
  return {
    pc,
    close: async () => {
      if (closed) return;
      closed = true;
      // Tell the server first — a DELETE that lands after the peer
      // connection is gone still frees the path.
      if (location) {
        await fetch(location, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        }).catch(() => undefined);
      }
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
    },
  };
}

/** Publish a local stream to a MediaMTX path. */
export async function publish(
  url: string,
  token: string,
  stream: MediaStream,
  opts: { iceServers?: RTCIceServer[] } = {},
): Promise<StreamHandle> {
  const pc = new RTCPeerConnection({ iceServers: opts.iceServers ?? [] });

  // sendonly on purpose: this peer connection is one direction. The
  // other direction is a separate WHEP connection, because MediaMTX
  // treats publishing and reading as two unrelated things.
  for (const track of stream.getTracks()) {
    const tx = pc.addTransceiver(track, { direction: "sendonly", streams: [stream] });
    // Before createOffer — setCodecPreferences only affects an offer
    // that has not been generated yet.
    if (track.kind === "video") preferH264(tx);
  }

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await iceComplete(pc);

    const { answer, location } = await exchange(
      url,
      token,
      pc.localDescription ?? offer,
    );
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    return attachClose(pc, location, token);
  } catch (err) {
    pc.close();
    throw err instanceof StreamError
      ? err
      : new StreamError("Couldn't start your camera stream.", err);
  }
}

/**
 * Ask for the camera and microphone, and say something useful when
 * the browser says no.
 *
 * The three failures below are the ones people actually hit, and the
 * generic "getUserMedia failed" leaves them stuck on a screen they
 * were probably nervous about opening in the first place.
 */
export async function getLocalMedia(opts: { video: boolean; audio: boolean }): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new StreamError(
      "This browser can't use your camera. Try Chrome, Edge, Firefox or Safari.",
    );
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: opts.video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: opts.audio ? { echoCancellation: true, noiseSuppression: true } : false,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new StreamError(
        "Your browser blocked access to the camera and microphone. Allow it in the address bar, then try again.",
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new StreamError("No camera or microphone was found on this device.");
    }
    if (name === "NotReadableError") {
      throw new StreamError(
        "Something else is already using the camera. Close other video apps and try again.",
      );
    }
    throw new StreamError("Couldn't start your camera.", err);
  }
}

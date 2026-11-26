"use client";

/**
 * The email confirmation gate.
 *
 * WHO IS LOOKING AT THIS. Someone who just signed up and now cannot
 * get in. That is a frustrating place to be, and the page has to earn
 * the interruption rather than assert it — so it says what to do
 * first, why it matters second, and never implies the person is the
 * problem. The reason this gate exists is a spam script, not them.
 *
 * It also watches for the confirmation happening somewhere else. Most
 * people open the link on their phone while this tab sits on a laptop,
 * and a page that makes them find the refresh button after they have
 * already done what it asked is a page that wasted their time.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

type Note = { tone: "ok" | "bad"; text: string } | null;

export function VerifyGate({ email }: { email: string }) {
  const t = useT();
  const router = useRouter();

  const [resending, setResending] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changeNote, setChangeNote] = useState<Note>(null);

  /* ── has it happened somewhere else? ───────────────────────── */

  // Guards against a second navigation while the first is in flight —
  // React can fire the focus handler and the interval in the same tick.
  const done = useRef(false);

  const recheck = useCallback(async () => {
    if (done.current) return;
    const res = await fetch("/api/user/auth/refresh-verified", {
      method: "POST",
    }).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json().catch(() => null)) as { verified?: boolean } | null;
    if (d?.verified) {
      done.current = true;
      router.replace("/");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    void recheck();
    // Focus is the one that actually fires in practice: the person
    // comes back from their mail app and the tab wakes up.
    const onFocus = () => void recheck();
    window.addEventListener("focus", onFocus);
    // The slow poll is the backstop for a second window left open.
    // Fifteen seconds, not one — nobody is waiting on a stopwatch.
    const timer = setInterval(() => void recheck(), 15_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [recheck]);

  /* ── resend ────────────────────────────────────────────────── */

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setNote(null);
    const res = await fetch("/api/user/auth/resend-verification", {
      method: "POST",
    }).catch(() => null);
    setResending(false);
    if (!res) {
      setNote({ tone: "bad", text: t("auth.networkShort", "Network error. Check your connection.") });
      return;
    }
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setNote(
      res.ok
        ? { tone: "ok", text: `Sent again to ${email}. It can take a minute.` }
        : {
            tone: "bad",
            text: serverText(t, d?.error) || t("verify.sendFailed", "Couldn't send that. Try again shortly."),
          },
    );
  };

  /* ── wrong address ─────────────────────────────────────────── */

  const changeAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setChangeNote(null);
    const res = await fetch("/api/user/auth/pending-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, currentPassword: password }),
    }).catch(() => null);
    setSaving(false);
    if (!res) {
      setChangeNote({
        tone: "bad",
        text: t("auth.networkShort", "Network error. Check your connection."),
      });
      return;
    }
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setChangeNote({ tone: "bad", text: serverText(t, d?.error) || t("settings.couldNotDoThat", "Couldn't do that.") });
      return;
    }
    setPassword("");
    setChangeNote({
      tone: "ok",
      text: `Sent a confirmation link to ${newEmail}. Open it and you're in — the address only changes once you do.`,
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-6 shadow-card sm:p-8">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand)]">
          <MailIcon />
        </span>

        <h1 className="mt-5 text-[27px] font-semibold leading-tight tracking-[-0.02em]">
          {t("verify.title", "Confirm your email to continue")}
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[color:var(--color-text-muted)]">
          {t(
            "verify.subtitle",
            "We sent a link to {email}. Open it and you're in — this page notices on its own, so you can click it on your phone and come back here.",
            { email },
          )}
        </p>

        <ol className="mt-7 space-y-4">
          <Step n={1} title={t("verify.step1", "Open the email from us")}>
            {t(
              "verify.step1Body",
              "Subject line has WorldWeCare in it. It usually lands within a minute.",
            )}
          </Step>
          <Step n={2} title={t("verify.step2", "Not there? Look in spam or promotions")}>
            {t(
              "verify.step2Body",
              "This is where it goes most often. Marking it “not spam” also means the next one — a reply, a password reset — reaches you.",
            )}
          </Step>
          <Step n={3} title={t("verify.step3", "Click the link")}>
            {t("verify.step3Body", "That is the whole thing. No code to copy, nothing to fill in.")}
          </Step>
        </ol>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <Button onClick={resend} loading={resending} size="lg">
            {resending ? t("auth.sending", "Sending…") : t("verify.resend", "Send it again")}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setChanging((v) => !v)}
          >
            {t("verify.wrongAddress", "Wrong address?")}
          </Button>
        </div>

        {note && <Note note={note} />}

        {changing && (
          <form
            onSubmit={changeAddress}
            className="mt-5 space-y-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-4"
          >
            <p className="text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
              {t(
                "verify.changeBlurb",
                "Type the right address and your password. We'll send the link there instead — the address on the account only changes once you open it.",
              )}
            </p>
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("settings.emailPlaceholder", "you@example.com")}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <PasswordInput
              autoComplete="current-password"
              placeholder={t("verify.yourPassword", "Your password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={saving} className="w-full">
              {saving ? t("auth.sending", "Sending…") : t("verify.sendThere", "Send the link there")}
            </Button>
            {changeNote && <Note note={changeNote} />}
          </form>
        )}
      </div>

      {/* ── why ─────────────────────────────────────────────── */}

      <section className="mt-6 rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-6 sm:p-8">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
          {t("verify.whyTitle", "Why we ask before letting you in")}
        </h2>
        <dl className="mt-4 space-y-4 text-[14px] leading-relaxed">
          <Reason title={t("verify.why1", "It is how you get back in")}>
            {t(
              "verify.why1Body",
              "A forgotten password is reset by email. If the address on the account was never confirmed, there is no way back to it — not for you, and not for us on your behalf.",
            )}
          </Reason>
          <Reason title={t("verify.why2", "It is what keeps the rooms real")}>
            {t(
              "verify.why2Body",
              "A script recently made thousands of accounts here in a day. Confirming an address is the cheapest thing we can ask that a script cannot do at scale, and it is the difference between a room full of people and a room full of adverts.",
            )}
          </Reason>
          <Reason title={t("verify.why3", "It is how we reach you about something that matters")}>
            {t(
              "verify.why3Body",
              "A reply to your post, a moderation decision, a sign-in from somewhere new. Never marketing.",
            )}
          </Reason>
          <Reason title={t("verify.why4", "It does not make you less anonymous")}>
            {t(
              "verify.why4Body",
              "Your email is never shown — not on your profile, not on a post, not to anyone you message. Posting anonymously works exactly the same afterwards.",
            )}
          </Reason>
        </dl>
      </section>

      {/* Sign out lives in the header now, so this is just the
          "none of this is working" door. */}
      <p className="mt-6 text-center text-[13px] text-[color:var(--color-text-muted)]">
        {t("verify.stuck", "None of this working?")}{" "}
        <Link href="/contact" className="font-medium text-[color:var(--color-brand)] hover:underline">
          {t("verify.contactUs", "Tell us and we'll sort it out")}
        </Link>
        .
      </p>
    </div>
  );
}

/* ── bits ────────────────────────────────────────────────────── */

function Note({ note }: { note: NonNullable<Note> }) {
  return (
    <p
      role="status"
      className={`mt-4 rounded-[10px] px-3 py-2 text-[13px] leading-relaxed ${
        note.tone === "ok"
          ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)]"
          : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
      }`}
    >
      {note.text}
    </p>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-tint)] text-[12.5px] font-bold text-[color:var(--color-brand)]">
        {n}
      </span>
      <div>
        <p className="text-[14.5px] font-semibold leading-snug">{title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
          {children}
        </p>
      </div>
    </li>
  );
}

function Reason({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-[color:var(--color-text)]">{title}</dt>
      <dd className="mt-1 text-[color:var(--color-text-muted)]">{children}</dd>
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3.8 7.2l7.1 5.2a2 2 0 002.2 0l7.1-5.2" />
    </svg>
  );
}

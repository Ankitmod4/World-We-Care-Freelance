import type { NextConfig } from "next";
import { BODY_LIMIT_CONFIG } from "./src/lib/upload-limits";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep server console + errors readable during early development.
  logging: {
    fetches: { fullUrl: false },
  },
  images: {
    // Placeholder — add domains here as image hosts are added.
    remotePatterns: [],
  },
  // Video uploads stream through here. Next SILENTLY TRUNCATES a body
  // past this limit rather than erroring, so it is deliberately set a
  // margin ABOVE the admin-editable cap: the size check in
  // video-upload.ts should be what rejects an oversized upload, with a
  // real error message, never this.
  //
  // Build-time only — raise it with MAX_UPLOAD_BODY_MB and rebuild.
  // Despite the name it applies to all Next request body parsing, not
  // just middleware. Not in the public types, hence the cast.
  experimental: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    middlewareClientMaxBodySize: BODY_LIMIT_CONFIG as any,
  },
};

export default nextConfig;

/**
 * POST /api/user/auth/logout — clears the community session cookie.
 * Redirects to `/` when submitted from a plain <form> (no JS path).
 */

import { NextResponse } from "next/server";
import { clearUserCookie } from "@/lib/user-auth";

export async function POST(request: Request) {
  await clearUserCookie();
  // If the caller was a <form action> on the frontend nav, send them
  // back home. XHR callers can ignore the redirect.
  const referer = request.headers.get("referer");
  const url = new URL("/", referer ?? "http://localhost");
  return NextResponse.redirect(url, 303);
}

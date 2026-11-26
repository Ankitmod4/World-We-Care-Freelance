import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in" };

/**
 * /admin/login — public route. If an admin session already exists
 * we bounce straight to the dashboard instead of re-prompting.
 * Uses the ?next= query param to restore an admin's intended
 * destination after auth (set by middleware when they were
 * redirected here).
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const existing = await getCurrentAdmin();
  if (existing) {
    redirect(next && next.startsWith("/admin") ? next : "/admin");
  }

  return (
    <main className="min-h-screen hero-sky flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[color:var(--color-surface)] shadow-[var(--shadow-elevated)]">
            <Logo />
          </div>
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">
            WorldWeCare admin
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-muted)]">
            Sign in to manage the community.
          </p>
        </div>

        <div className="card-elevated p-7">
          <AdminLoginForm nextPath={next && next.startsWith("/admin") ? next : "/admin"} />
        </div>

        <p className="mt-6 text-center text-[12px] text-[color:var(--color-text-subtle)]">
          Not an admin? Go to the{" "}
          <a href="/" className="text-[color:var(--color-brand)] hover:underline">
            community site
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="16" cy="16" r="14" fill="var(--color-brand)" />
      <path
        d="M10 20c1.2-2.8 3.4-4.5 6-4.5s4.8 1.7 6 4.5M13 12.5a3 3 0 116 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

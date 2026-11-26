import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";

/**
 * Server-side gate for every /admin route except /admin/login.
 * Middleware already blocks unauthenticated users; this layout adds
 * the row-level check (isActive) that the edge middleware cannot do
 * without a DB round-trip, and hydrates the admin session for the
 * topbar. Any admin whose row was disabled mid-session is bounced
 * back to /login here.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentAdmin();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-[color:var(--color-surface-muted)] flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar displayName={session.displayName} email={session.email} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

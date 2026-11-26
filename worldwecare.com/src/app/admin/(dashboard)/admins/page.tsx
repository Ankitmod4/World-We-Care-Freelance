import type { Metadata } from "next";
import { AdminsListClient } from "./client";

export const metadata: Metadata = { title: "Admins" };

export default function AdminsPage() {
  return <AdminsListClient />;
}

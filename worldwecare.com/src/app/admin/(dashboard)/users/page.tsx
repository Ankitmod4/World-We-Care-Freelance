import type { Metadata } from "next";
import { UsersListClient } from "./client";

export const metadata: Metadata = { title: "Users" };

export default function UsersListPage() {
  return <UsersListClient />;
}

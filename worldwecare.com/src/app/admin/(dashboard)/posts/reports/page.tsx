import type { Metadata } from "next";
import { ReportsClient } from "./client";

export const metadata: Metadata = { title: "Reports queue" };

export default function ReportsPage() {
  return <ReportsClient />;
}

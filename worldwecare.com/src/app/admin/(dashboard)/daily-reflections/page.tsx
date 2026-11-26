import type { Metadata } from "next";
import { DailyReflectionsClient } from "./client";
export const metadata: Metadata = { title: "Daily reflections" };
export default function DailyReflectionsPage() { return <div className="p-4 sm:p-6 lg:p-8"><DailyReflectionsClient /></div>; }

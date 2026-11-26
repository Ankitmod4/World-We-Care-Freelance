/**
 * Small utility helpers shared across the app.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class strings without accidental duplicates. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Card primitive. Applies the Apple-style surface (soft border,
 * ultra-light shadow) that shows up on 90% of admin surfaces.
 */

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  elevated,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(elevated ? "card-elevated" : "card", className)}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pt-6 pb-4", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-[17px] font-semibold tracking-[-0.01em] text-[color:var(--color-text)]",
        className,
      )}
      {...rest}
    />
  );
}

export function CardDescription({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-sm text-[color:var(--color-text-muted)] mt-1",
        className,
      )}
      {...rest}
    />
  );
}

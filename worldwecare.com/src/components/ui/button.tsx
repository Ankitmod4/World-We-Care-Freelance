/**
 * Apple-flavored button primitive.
 *
 * Variants:
 *   • primary   — filled with the theme's brand, subtle brand shadow
 *   • secondary — the card surface with a soft border; tappable, quiet
 *   • ghost     — no background, hover-only tint
 *   • danger    — red for destructive confirms
 *
 * Note the label colours: `--color-on-brand` and `--color-on-danger`,
 * never `text-white`. In dark mode the fills lighten and white on
 * them fails AA — see note 4 in src/lib/theming.ts.
 *
 * Sizes:
 *   • sm  — 32px tall, compact chrome
 *   • md  — 40px tall (default)
 *   • lg  — 48px tall, primary CTAs
 */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] shadow-[var(--shadow-brand)] " +
    "hover:bg-[color:var(--color-brand-hover)] active:scale-[0.98]",
  secondary:
    "bg-[color:var(--color-surface)] text-[color:var(--color-text)] border border-[color:var(--color-border)] " +
    "hover:bg-[color:var(--color-surface-hover)] active:scale-[0.98]",
  ghost:
    "bg-transparent text-[color:var(--color-text)] " +
    "hover:bg-[color:var(--color-surface-hover)]",
  danger:
    "bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)] " +
    "hover:brightness-95 active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[10px]",
  md: "h-10 px-4 text-sm rounded-[12px]",
  lg: "h-12 px-5 text-[15px] rounded-[14px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", loading, disabled, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium",
          "transition-[transform,background-color,box-shadow] duration-150",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...rest}
      >
        {loading && (
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
          />
        )}
        {children}
      </button>
    );
  },
);

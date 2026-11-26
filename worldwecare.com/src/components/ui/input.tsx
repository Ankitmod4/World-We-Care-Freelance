/**
 * Apple-flavored text input. Slightly larger than a bootstrap input,
 * subtle inner shadow, sky-blue focus ring.
 */

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "block w-full h-11 px-3.5 text-[14.5px] text-[color:var(--color-text)]",
        "bg-[color:var(--color-surface)] rounded-[12px] border border-[color:var(--color-border)]",
        "placeholder:text-[color:var(--color-text-subtle)]",
        "shadow-[inset_0_1px_1px_var(--shadow-tint-weak)]",
        "transition-shadow duration-150",
        "focus:outline-none focus:border-[color:var(--color-brand)]",
        "focus:ring-4 focus:ring-[color:var(--color-brand-soft)]",
        invalid &&
          "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)] focus:ring-[color:var(--color-danger-soft)]",
        className,
      )}
      {...rest}
    />
  );
});

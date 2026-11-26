import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "block w-full px-3.5 py-2.5 text-[14px] text-[color:var(--color-text)]",
          "bg-[color:var(--color-surface)] rounded-[12px] border border-[color:var(--color-border)]",
          "placeholder:text-[color:var(--color-text-subtle)]",
          "shadow-[inset_0_1px_1px_var(--shadow-tint-weak)]",
          "transition-shadow duration-150 leading-relaxed",
          "focus:outline-none focus:border-[color:var(--color-brand)]",
          "focus:ring-4 focus:ring-[color:var(--color-brand-soft)]",
          invalid &&
            "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)] focus:ring-[color:var(--color-danger-soft)]",
          className,
        )}
        {...rest}
      />
    );
  },
);

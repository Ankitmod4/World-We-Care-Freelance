"use client";

/**
 * A password field with a reveal toggle.
 *
 * Toggling `type` between "password" and "text" is the standard way to
 * do this, and password managers handle it — what breaks them is
 * rendering two separate inputs and swapping which one is mounted, so
 * this deliberately keeps one input and changes its type.
 *
 * Details that matter:
 *
 *  • `type="button"`, or the toggle submits the form.
 *  • The button stays keyboard-reachable. It is a real control, and a
 *    person typing a long password on a phone keyboard is exactly who
 *    needs it.
 *  • `aria-pressed` carries the state, and the label says what the next
 *    press will do — "Show password" / "Hide password".
 *  • It never reveals on its own. The field re-renders as dots on every
 *    mount, so a revealed password cannot survive a navigation.
 */

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "./input";
import { useT } from "@/components/site/locale-context";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, invalid, ...rest }, ref) {
    const t = useT();
    const [shown, setShown] = useState(false);
    const hint = shown
      ? t("password.hide", "Hide password")
      : t("password.show", "Show password");

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={shown ? "text" : "password"}
          invalid={invalid}
          // Room for the button, so a long password never runs under it.
          className={["pr-11", className].filter(Boolean).join(" ")}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          aria-label={hint}
          title={hint}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[12px] text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text)] focus-visible:text-[color:var(--color-text)]"
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    );
  },
);

function EyeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.9 5.8A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-3.2 4M6.4 7.6A16.6 16.6 0 002.5 12S6 18.5 12 18.5c1.4 0 2.6-.35 3.7-.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 10a2.8 2.8 0 004 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

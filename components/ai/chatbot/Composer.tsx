"use client";

import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface ComposerHandle {
  /** Prefill the input (e.g. from a rebook / suggested-prompt chip) and focus it. */
  setText: (text: string) => void;
  focus: () => void;
}

export interface ComposerProps {
  /** True while an earlier message is still in flight. */
  disabled: boolean;
  /** Seconds remaining on a rate-limit cooldown (0 = none). */
  cooldownTime: number;
  canBook: boolean;
  onSend: (text: string) => void;
}

/**
 * Isolated message composer. Holds its OWN input state so typing only
 * re-renders this small component — not the whole chat panel (which was the
 * source of the typing lag). Calls `onSend(text)` on Enter / Send click.
 * Parents prefill it via the `setText` imperative handle.
 */
export const Composer = memo(
  forwardRef<ComposerHandle, ComposerProps>(function Composer(
    { disabled, cooldownTime, canBook, onSend },
    ref
  ) {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const blocked = disabled || cooldownTime > 0;

    useImperativeHandle(
      ref,
      () => ({
        setText: (text: string) => {
          setValue(text);
          inputRef.current?.focus();
        },
        focus: () => inputRef.current?.focus(),
      }),
      []
    );

    // Re-focus the input as soon as it becomes usable again (after a send/cooldown).
    useEffect(() => {
      if (!blocked) inputRef.current?.focus();
    }, [blocked]);

    const submit = () => {
      const trimmed = value.trim();
      if (!trimmed || blocked) return;
      onSend(trimmed);
      setValue("");
    };

    return (
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit();
          }}
          placeholder={
            cooldownTime > 0
              ? "Please wait a moment..."
              : canBook
              ? "Ask me anything or describe your booking..."
              : "Ask me anything — I can look things up and take you to the right page..."
          }
          disabled={blocked}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all"
        />
        <button
          onClick={submit}
          disabled={blocked || !value.trim()}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all ${
            cooldownTime > 0
              ? "bg-amber-600 cursor-not-allowed opacity-80"
              : "bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
          }`}
        >
          {cooldownTime > 0 ? `Wait ${cooldownTime}s` : disabled ? "Sending..." : "Send"}
        </button>
      </div>
    );
  })
);

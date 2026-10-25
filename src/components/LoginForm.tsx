"use client";

import { useState, useTransition } from "react";
import { signInWithMagicLink } from "@/lib/actions";

export function LoginForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex w-full max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await signInWithMagicLink(fd);
          if (result.error) setError(result.error);
          else setMessage("Vérifie ta boîte mail pour le lien magique.");
        });
      }}
    >
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Courriel
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="toi@ecole.edu"
          className="mt-1 w-full border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      </label>
      {error ? (
        <p className="font-mono text-[11px] text-[var(--accent)]">{error}</p>
      ) : null}
      {message ? (
        <p className="font-mono text-[11px] text-[var(--ok)]">{message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--ink)] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--paper)] transition hover:bg-[var(--accent)] disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Envoyer le lien magique"}
      </button>
    </form>
  );
}

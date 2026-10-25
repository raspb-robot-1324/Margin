"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument } from "@/lib/actions";

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await uploadDocument(fd);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".html,text/html"
        required
        className="block w-full font-mono text-xs text-[var(--ink-soft)] file:mr-3 file:border file:border-[var(--line)] file:bg-white file:px-3 file:py-2 file:font-mono file:text-[11px] file:uppercase file:tracking-wider file:text-[var(--ink)] hover:file:border-[var(--accent)]"
      />
      {error ? (
        <p className="font-mono text-[11px] text-[var(--accent)]">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--ink)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--paper)] transition hover:bg-[var(--accent)] disabled:opacity-50"
      >
        {pending ? "Import…" : "Importer le HTML"}
      </button>
    </form>
  );
}

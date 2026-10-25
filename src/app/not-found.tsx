import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-20">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        404
      </p>
      <h1 className="mt-2 font-display text-4xl text-[var(--ink)]">
        Introuvable
      </h1>
      <p className="mt-3 text-[var(--ink-soft)]">
        Ce document ou ce lien de partage n’existe pas, ou le lien a été
        révoqué.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--accent)]"
      >
        ← Retour à Margin
      </Link>
    </div>
  );
}

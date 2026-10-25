import Link from "next/link";
import { redirect } from "next/navigation";
import { UploadForm } from "@/components/UploadForm";
import { signOut } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/types";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  const docs = (documents || []) as DocumentRow[];

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-5 py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Table de relecture
          </p>
          <h1 className="font-display text-5xl tracking-tight text-[var(--ink)]">
            Margin
          </h1>
          <p className="mt-2 max-w-md text-[var(--ink-soft)]">
            Dépose un HTML, garde le design, partage un lien secret. Ton mentor
            commente sans compte.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] text-[var(--muted)]">
            {profile?.email || "Connecté"}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <section className="mb-12 border border-[var(--line)] bg-white/70 p-5">
        <h2 className="font-display text-2xl text-[var(--ink)]">
          Nouveau document
        </h2>
        <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
          .html uniquement · max 5 Mo · le CSS reste dans le fichier · essai{" "}
          <a
            href="/sample-journal.html"
            className="text-[var(--accent)] underline-offset-2 hover:underline"
            download
          >
            sample-journal.html
          </a>
        </p>
        <div className="mt-4">
          <UploadForm />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            Bibliothèque
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            {docs.length} doc{docs.length === 1 ? "" : "s"}
          </span>
        </div>

        {docs.length === 0 ? (
          <p className="border border-dashed border-[var(--line)] bg-white/40 px-4 py-8 font-mono text-xs text-[var(--muted)]">
            Aucun document. Importe ton journal HTML pour commencer.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-white/70">
            {docs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/d/${doc.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-[var(--paper-deep)]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--ink)]">
                      {doc.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      v{doc.current_version} · modifié le{" "}
                      {new Date(doc.updated_at).toLocaleDateString("fr-CA")}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
                    Ouvrir →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

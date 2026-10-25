"use client";

import { useMemo, useState } from "react";
import type { Anchor, CommentRow } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  open: "ouvert",
  resolved: "résolu",
  orphaned: "orphelin",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "auteur",
  guest: "invité",
};

type Props = {
  comments: CommentRow[];
  canResolve?: boolean;
  selection?: Anchor | null;
  defaultAuthor: string;
  onAuthorChange?: (name: string) => void;
  onSubmit: (input: {
    body: string;
    authorName: string;
    anchor: Anchor | null;
    parentId: string | null;
  }) => Promise<void>;
  onResolve?: (commentId: string, status: "open" | "resolved") => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onFocus?: (commentId: string, anchor: Anchor | null) => void;
  guestMode?: boolean;
};

export function CommentRail({
  comments,
  canResolve,
  selection,
  defaultAuthor,
  onAuthorChange,
  onSubmit,
  onResolve,
  onDelete,
  onFocus,
  guestMode,
}: Props) {
  const [author, setAuthor] = useState(defaultAuthor);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const roots = useMemo(() => {
    const list = comments.filter((c) => !c.parent_id);
    const filtered =
      filter === "open"
        ? list.filter((c) => c.status === "open" || c.status === "orphaned")
        : list;
    return filtered.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [comments, filter]);

  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_id) continue;
      const arr = map.get(c.parent_id) || [];
      arr.push(c);
      map.set(c.parent_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    return map;
  }, [comments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!author.trim()) {
      setError("Indique ton nom d’abord.");
      return;
    }
    if (!body.trim()) {
      setError("Écris un commentaire.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        body: body.trim(),
        authorName: author.trim(),
        anchor: replyTo ? null : selection || null,
        parentId: replyTo,
      });
      setBody("");
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de publier.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-[var(--line)] bg-[var(--paper)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl tracking-wide text-[var(--ink)]">
            Marge
          </h2>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            {roots.length} fil{roots.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={`font-mono text-[10px] uppercase tracking-wider ${
              filter === "open" ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
            onClick={() => setFilter("open")}
          >
            Ouverts
          </button>
          <button
            type="button"
            className={`font-mono text-[10px] uppercase tracking-wider ${
              filter === "all" ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
            onClick={() => setFilter("all")}
          >
            Tous
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {roots.length === 0 ? (
          <p className="px-1 font-mono text-xs leading-relaxed text-[var(--muted)]">
            {guestMode
              ? "Sélectionne du texte dans le document, puis laisse une note ici."
              : "Pas encore de commentaires. Sélectionne du texte pour annoter, ou laisse une note générale."}
          </p>
        ) : (
          <ul className="space-y-3">
            {roots.map((c) => (
              <li
                key={c.id}
                className={`rounded-sm border border-[var(--line)] bg-white p-3 ${
                  c.status === "orphaned" ? "opacity-60" : ""
                } ${c.status === "resolved" ? "opacity-70" : ""}`}
              >
                <button
                  type="button"
                  className={`w-full text-left ${
                    c.anchor?.selectedText
                      ? "cursor-pointer rounded-sm hover:bg-[var(--paper-deep)]"
                      : "cursor-default"
                  }`}
                  onClick={() => {
                    if (!c.anchor?.selectedText) return;
                    onFocus?.(c.id, c.anchor);
                  }}
                  title={
                    c.anchor?.selectedText
                      ? "Aller au passage surligné"
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
                      {c.author_name}
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {ROLE_LABEL[c.author_role] || c.author_role}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-[var(--muted)]">
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                  {c.anchor?.selectedText ? (
                    <p className="mt-1 border-l-2 border-[var(--accent)] pl-2 font-mono text-[11px] italic text-[var(--ink-soft)] underline-offset-2 hover:underline">
                      « {c.anchor.selectedText.slice(0, 120)}
                      {c.anchor.selectedText.length > 120 ? "…" : ""} »
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-snug text-[var(--ink)]">
                    {c.body}
                  </p>
                </button>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)]"
                    onClick={() => setReplyTo(c.id)}
                  >
                    Répondre
                  </button>
                  {canResolve ? (
                    <button
                      type="button"
                      className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)]"
                      onClick={() =>
                        onResolve?.(
                          c.id,
                          c.status === "resolved" ? "open" : "resolved",
                        )
                      }
                    >
                      {c.status === "resolved" ? "Rouvrir" : "Résoudre"}
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] hover:underline"
                      onClick={async () => {
                        if (!confirm("Supprimer ce commentaire ?")) return;
                        await onDelete(c.id);
                      }}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>

                {(repliesByParent.get(c.id) || []).map((r) => (
                  <div
                    key={r.id}
                    className="mt-2 border-l border-[var(--line)] pl-3"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
                      {r.author_name}
                    </div>
                    <p className="mt-1 text-sm text-[var(--ink)]">{r.body}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--line)] bg-[var(--paper-deep)] p-3"
      >
        {selection && !replyTo ? (
          <p className="mb-2 border-l-2 border-[var(--accent)] pl-2 font-mono text-[11px] text-[var(--ink-soft)]">
            Sur : « {selection.selectedText.slice(0, 80)}
            {selection.selectedText.length > 80 ? "…" : ""} »
          </p>
        ) : null}
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-[var(--muted)]">
              Réponse au fil
            </span>
            <button
              type="button"
              className="font-mono text-[10px] uppercase text-[var(--accent)]"
              onClick={() => setReplyTo(null)}
            >
              Annuler
            </button>
          </div>
        ) : null}

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Ton nom
          </span>
          <input
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              onAuthorChange?.(e.target.value);
            }}
            className="mt-1 w-full border border-[var(--line)] bg-white px-2 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            maxLength={80}
            required
          />
        </label>

        <label className="mt-2 block">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Commentaire
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none border border-[var(--line)] bg-white px-2 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            placeholder={
              selection
                ? "Note sur cette sélection…"
                : "Note générale (ou sélectionne du texte d’abord)…"
            }
            required
          />
        </label>

        {error ? (
          <p className="mt-2 font-mono text-[11px] text-[var(--accent)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full bg-[var(--ink)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--paper)] transition hover:bg-[var(--accent)] disabled:opacity-50"
        >
          {busy ? "Publication…" : "Publier"}
        </button>
      </form>
    </aside>
  );
}

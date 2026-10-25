"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CommentRail } from "@/components/CommentRail";
import { DocumentFrame } from "@/components/DocumentFrame";
import type { Anchor, CommentRow } from "@/lib/types";

type Props = {
  token: string;
  title: string;
  version: number;
  html: string;
  initialComments: CommentRow[];
};

const NAME_KEY = "margin-guest-name";

export function ShareWorkspace({
  token,
  title,
  version,
  html,
  initialComments,
}: Props) {
  const [comments, setComments] = useState(initialComments);
  const [selection, setSelection] = useState<Anchor | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [focusAnchor, setFocusAnchor] = useState<Anchor | null>(null);
  const DEFAULT_GUEST = "Céline Charette";
  const [name, setName] = useState(DEFAULT_GUEST);

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    // Prefer mentor default; ignore old generic "Invité" / "Guest" leftovers
    if (stored && stored !== "Invité" && stored !== "Guest") {
      setName(stored);
    } else {
      setName(DEFAULT_GUEST);
      localStorage.setItem(NAME_KEY, DEFAULT_GUEST);
    }
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--paper)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Partagé · lecture + commentaires
          </p>
          <h1 className="truncate font-display text-2xl leading-none tracking-wide text-[var(--ink)]">
            {title}
          </h1>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
          v{version}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 border-b border-[var(--line)] lg:border-b-0">
          <DocumentFrame
            html={html}
            reloadKey={0}
            mode="share"
            focusCommentId={focusId}
            focusNonce={focusNonce}
            focusAnchor={focusAnchor}
            onSelection={setSelection}
            onHighlightClick={(id) => {
              const c = comments.find((x) => x.id === id);
              setFocusId(id);
              setFocusAnchor(c?.anchor ?? null);
              setFocusNonce((n) => n + 1);
            }}
          />
        </div>

        <CommentRail
          comments={comments}
          selection={selection}
          defaultAuthor={name}
          guestMode
          onAuthorChange={(n) => {
            setName(n);
            localStorage.setItem(NAME_KEY, n);
          }}
          onSubmit={async ({ body, authorName, anchor, parentId }) => {
            const supabase = createClient();
            const { data, error } = await supabase.rpc("add_share_comment", {
              p_token: token,
              p_author_name: authorName,
              p_body: body,
              p_anchor: anchor,
              p_parent_id: parentId,
              p_version: version,
            });
            if (error) throw new Error(error.message);
            const comment = data as CommentRow;
            setComments((prev) => [...prev, comment]);
            localStorage.setItem(NAME_KEY, authorName);
          }}
          onDelete={async (commentId) => {
            const supabase = createClient();
            const { data, error } = await supabase.rpc("delete_share_comment", {
              p_token: token,
              p_comment_id: commentId,
              p_author_name: name,
            });
            if (error) throw new Error(error.message);
            if (!data) {
              throw new Error(
                "Tu ne peux supprimer que tes propres commentaires.",
              );
            }
            setComments((prev) =>
              prev.filter((c) => c.id !== commentId && c.parent_id !== commentId),
            );
            if (focusId === commentId) {
              setFocusId(null);
              setFocusAnchor(null);
              setFocusNonce((n) => n + 1);
            }
          }}
          onFocus={(id, anchor) => {
            setFocusId(id);
            setFocusAnchor(anchor);
            setFocusNonce((n) => n + 1);
          }}
        />
      </div>
    </div>
  );
}

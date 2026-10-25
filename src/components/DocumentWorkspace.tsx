"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useTransition } from "react";
import {
  addOwnerComment,
  deleteComment,
  ensureShareLink,
  revokeShareLinks,
  saveDocumentVersion,
  setCommentStatus,
  deleteDocument,
} from "@/lib/actions";
import { CommentRail } from "@/components/CommentRail";
import {
  DocumentFrame,
  type DocumentFrameHandle,
} from "@/components/DocumentFrame";
import type { Anchor, CommentRow } from "@/lib/types";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs text-[var(--muted)]">
      Chargement de l’éditeur…
    </div>
  ),
});

type Props = {
  documentId: string;
  title: string;
  version: number;
  html: string;
  comments: CommentRow[];
  shareToken: string | null;
  ownerName: string;
  appUrl: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function DocumentWorkspace({
  documentId,
  title,
  version,
  html: initialHtml,
  comments: initialComments,
  shareToken: initialToken,
  ownerName,
  appUrl,
}: Props) {
  const frameRef = useRef<DocumentFrameHandle>(null);
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [html, setHtml] = useState(initialHtml);
  const [savedHtml, setSavedHtml] = useState(initialHtml);
  const [reloadKey, setReloadKey] = useState(0);
  const [docTitle, setDocTitle] = useState(title);
  const [docVersion, setDocVersion] = useState(version);
  const [comments, setComments] = useState(initialComments);
  const [shareToken, setShareToken] = useState(initialToken);
  const [shareUrlShown, setShareUrlShown] = useState<string | null>(null);
  const [isJournal, setIsJournal] = useState(false);
  const [selection, setSelection] = useState<Anchor | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [focusAnchor, setFocusAnchor] = useState<Anchor | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = html !== savedHtml;

  const shareUrl = shareToken ? `${appUrl}/s/${shareToken}` : null;

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveDocumentVersion(documentId, html);
      if (result.error) {
        setStatus(result.error);
        return;
      }
      setSavedHtml(html);
      if (result.version) setDocVersion(result.version);
      if (result.title) setDocTitle(result.title);
      setStatus(`Enregistré · v${result.version}`);
    });
  }

  function copyShare() {
    setStatus(null);
    setShareUrlShown(null);
    startTransition(async () => {
      const result = await ensureShareLink(documentId);
      if (result.error || !result.token) {
        setStatus(result.error || "Impossible de créer le lien.");
        return;
      }
      setShareToken(result.token);
      const url = `${appUrl}/s/${result.token}`;
      const copied = await copyText(url);
      if (copied) {
        setStatus("Lien de partage copié.");
      } else {
        setShareUrlShown(url);
        setStatus("Presse-papiers bloqué — copie le lien ci-dessous.");
      }
    });
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeShareLinks(documentId);
      if (result.error) {
        setStatus(result.error);
        return;
      }
      setShareToken(null);
      setShareUrlShown(null);
      setStatus("Liens de partage révoqués.");
    });
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--paper)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <a
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Bibliothèque
        </a>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl leading-none tracking-wide text-[var(--ink)]">
            {docTitle}
          </h1>
          {dirty ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
              Non enregistré
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === "preview" && isJournal ? (
            <button
              type="button"
              onClick={() => frameRef.current?.addPeriod()}
              className="border border-[var(--accent)] bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
            >
              + Rencontre
            </button>
          ) : null}

          <div className="flex border border-[var(--line)]">
            <button
              type="button"
              onClick={() => {
                setReloadKey((k) => k + 1);
                setTab("preview");
              }}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
                tab === "preview"
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "bg-white text-[var(--muted)]"
              }`}
            >
              Aperçu
            </button>
            <button
              type="button"
              onClick={() => setTab("source")}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
                tab === "source"
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "bg-white text-[var(--muted)]"
              }`}
            >
              Source
            </button>
          </div>

          <button
            type="button"
            disabled={!dirty || pending}
            onClick={save}
            className="bg-[var(--ink)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--paper)] disabled:opacity-40"
          >
            Enregistrer
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={copyShare}
            className="border border-[var(--line)] bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--ink)] hover:border-[var(--accent)]"
          >
            Partager
          </button>
          {shareToken ? (
            <button
              type="button"
              disabled={pending}
              onClick={revoke}
              className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
            >
              Révoquer
            </button>
          ) : null}
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
            onClick={() => {
              if (confirm("Supprimer ce document définitivement ?")) {
                startTransition(async () => {
                  await deleteDocument(documentId);
                });
              }
            }}
          >
            Supprimer
          </button>
        </div>
      </header>

      {status || shareUrlShown ? (
        <div className="border-b border-[var(--line)] bg-[var(--paper-deep)] px-4 py-2 font-mono text-[11px] text-[var(--ink-soft)]">
          {status ? <div>{status}</div> : null}
          {(shareUrlShown ||
            (shareUrl && status?.includes("copié"))) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={shareUrlShown || shareUrl || ""}
                className="min-w-[16rem] flex-1 border border-[var(--line)] bg-white px-2 py-1 text-[var(--ink)]"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="border border-[var(--line)] bg-white px-2 py-1 uppercase tracking-wider text-[var(--ink)]"
                onClick={async () => {
                  const url = shareUrlShown || shareUrl;
                  if (!url) return;
                  const ok = await copyText(url);
                  setStatus(
                    ok
                      ? "Lien de partage copié."
                      : "Sélectionne le lien et copie-le (⌘C).",
                  );
                }}
              >
                Copier
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 border-b border-[var(--line)] lg:border-b-0">
          {tab === "preview" ? (
            <DocumentFrame
              ref={frameRef}
              html={html}
              reloadKey={reloadKey}
              mode="owner"
              documentId={documentId}
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
              onHtmlChange={setHtml}
              onJournalDetected={setIsJournal}
            />
          ) : (
            <Monaco
              height="100%"
              defaultLanguage="html"
              theme="vs"
              value={html}
              onChange={(v) => setHtml(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
              }}
            />
          )}
        </div>

        <CommentRail
          comments={comments}
          canResolve
          selection={selection}
          defaultAuthor={ownerName}
          onSubmit={async ({ body, authorName, anchor, parentId }) => {
            const result = await addOwnerComment({
              documentId,
              body,
              authorName,
              version: docVersion,
              anchor,
              parentId,
            });
            if (result.error || !result.comment) {
              throw new Error(result.error || "Échec");
            }
            setComments((prev) => [...prev, result.comment!]);
          }}
          onResolve={async (commentId, next) => {
            const result = await setCommentStatus(commentId, documentId, next);
            if (result.error) throw new Error(result.error);
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, status: next } : c,
              ),
            );
            if (next === "resolved" && focusId === commentId) {
              setFocusId(null);
              setFocusAnchor(null);
              setFocusNonce((n) => n + 1);
            }
          }}
          onDelete={async (commentId) => {
            const result = await deleteComment(commentId, documentId);
            if (result.error) throw new Error(result.error);
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

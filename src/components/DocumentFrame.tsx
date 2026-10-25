"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { prepareHtmlForFrame } from "@/lib/html";
import { uploadScreenshot } from "@/lib/media";
import type { Anchor } from "@/lib/types";

export type DocumentFrameHandle = {
  addPeriod: () => void;
};

type Props = {
  html: string;
  reloadKey: number;
  mode: "owner" | "share";
  /** Required for Storage uploads when mode is owner */
  documentId?: string;
  focusCommentId?: string | null;
  focusNonce?: number;
  focusAnchor?: Anchor | null;
  onSelection?: (anchor: Anchor | null) => void;
  onHighlightClick?: (commentId: string) => void;
  onHtmlChange?: (html: string) => void;
  onJournalDetected?: (isJournal: boolean) => void;
};

export const DocumentFrame = forwardRef<DocumentFrameHandle, Props>(
  function DocumentFrame(
    {
      html,
      reloadKey,
      mode,
      documentId,
      focusCommentId = null,
      focusNonce = 0,
      focusAnchor = null,
      onSelection,
      onHighlightClick,
      onHtmlChange,
      onJournalDetected,
    },
    ref,
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const pendingShotId = useRef<string | null>(null);
    const focusAnchorRef = useRef<Anchor | null>(focusAnchor);
    focusAnchorRef.current = focusAnchor;
    const [uploading, setUploading] = useState(false);

    const focusIdKey = focusCommentId ?? "";
    const focusTick = focusNonce;

    const srcDoc = useMemo(
      () => prepareHtmlForFrame(html, mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [reloadKey, mode],
    );

    useImperativeHandle(ref, () => ({
      addPeriod() {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "margin:add-period" },
          "*",
        );
      },
    }));

    useEffect(() => {
      function onMessage(event: MessageEvent) {
        if (event.source !== iframeRef.current?.contentWindow) return;
        const data = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "margin:selection") {
          onSelection?.(data.payload as Anchor);
        }
        if (data.type === "margin:clear-selection") {
          onSelection?.(null);
        }
        if (data.type === "margin:click-highlight") {
          onHighlightClick?.(String(data.commentId || ""));
        }
        if (data.type === "margin:html-changed" && typeof data.html === "string") {
          onHtmlChange?.(data.html);
        }
        if (data.type === "margin:capabilities") {
          onJournalDetected?.(Boolean(data.journal));
        }
        if (data.type === "margin:request-image" && mode === "owner") {
          pendingShotId.current = String(data.shotId || "");
          fileRef.current?.click();
        }
      }

      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [mode, onHighlightClick, onHtmlChange, onJournalDetected, onSelection]);

    useEffect(() => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      if (!focusIdKey) {
        win.postMessage({ type: "margin:clear-highlights" }, "*");
        return;
      }
      win.postMessage(
        {
          type: "margin:focus",
          commentId: focusIdKey,
          anchor: focusAnchorRef.current,
        },
        "*",
      );
    }, [focusIdKey, focusTick]);

    return (
      <div className="relative h-full w-full">
        {uploading ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-[var(--ink)]/80 px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-white">
            Upload vers Storage…
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          aria-hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const shotId = pendingShotId.current;
            e.target.value = "";
            pendingShotId.current = null;
            if (!file || !shotId) return;
            if (!documentId) {
              alert("Document inconnu — impossible d’uploader.");
              return;
            }
            setUploading(true);
            try {
              const result = await uploadScreenshot(file, documentId);
              if ("error" in result) {
                alert(result.error);
                return;
              }
              iframeRef.current?.contentWindow?.postMessage(
                {
                  type: "margin:image-result",
                  shotId,
                  dataUrl: result.url,
                },
                "*",
              );
            } finally {
              setUploading(false);
            }
          }}
        />
        <iframe
          key={reloadKey}
          ref={iframeRef}
          title="Aperçu du document"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
          srcDoc={srcDoc}
        />
      </div>
    );
  },
);

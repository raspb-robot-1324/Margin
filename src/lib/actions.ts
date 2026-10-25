"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { assertHtmlSize, extractTitle } from "@/lib/html";
import type { Anchor, CommentRow, CommentStatus } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    redirect("/login");
  }
  return { supabase, userId: data.claims.sub as string };
}

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return { error: "Le courriel est requis." };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }
  return { ok: true as const };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function uploadDocument(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Choisis un fichier HTML." };
  }
  if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
    return { error: "Seuls les fichiers .html sont acceptés." };
  }

  const html = await file.text();
  let byteSize: number;
  try {
    byteSize = assertHtmlSize(html);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fichier trop volumineux." };
  }

  const title = extractTitle(html, file.name.replace(/\.html?$/i, "") || "Untitled");
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      owner_id: userId,
      title,
      current_version: 1,
    })
    .select("id")
    .single();

  if (docError || !doc) {
    return { error: docError?.message || "Impossible de créer le document." };
  }

  const storagePath = `${userId}/${doc.id}/1.html`;
  const { error: verError } = await supabase.from("document_versions").insert({
    document_id: doc.id,
    version: 1,
    storage_path: storagePath,
    byte_size: byteSize,
    content: html,
  });

  if (verError) {
    await supabase.from("documents").delete().eq("id", doc.id);
    return { error: verError.message };
  }

  // Best-effort storage mirror (optional)
  await supabase.storage.from("documents").upload(storagePath, html, {
    contentType: "text/html",
    upsert: true,
  });

  revalidatePath("/");
  redirect(`/d/${doc.id}`);
}

export async function saveDocumentVersion(documentId: string, html: string) {
  const { supabase, userId } = await requireUser();
  let byteSize: number;
  try {
    byteSize = assertHtmlSize(html);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fichier trop volumineux." };
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("owner_id", userId)
    .single();

  if (docError || !doc) {
    return { error: "Document introuvable." };
  }

  const nextVersion = doc.current_version + 1;
  const title = extractTitle(html, doc.title);
  const storagePath = `${userId}/${documentId}/${nextVersion}.html`;

  const { error: verError } = await supabase.from("document_versions").insert({
    document_id: documentId,
    version: nextVersion,
    storage_path: storagePath,
    byte_size: byteSize,
    content: html,
  });

  if (verError) {
    return { error: verError.message };
  }

  const { error: updError } = await supabase
    .from("documents")
    .update({
      current_version: nextVersion,
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (updError) {
    return { error: updError.message };
  }

  await supabase.storage.from("documents").upload(storagePath, html, {
    contentType: "text/html",
    upsert: true,
  });

  // Mark unmatched comment anchors as orphaned
  const { data: comments } = await supabase
    .from("comments")
    .select("id, anchor, status")
    .eq("document_id", documentId)
    .eq("status", "open");

  if (comments?.length) {
    const orphanIds = comments
      .filter((c) => {
        const anchor = c.anchor as Anchor | null;
        if (!anchor?.selectedText) return false;
        return !html.includes(anchor.selectedText);
      })
      .map((c) => c.id);

    if (orphanIds.length) {
      await supabase
        .from("comments")
        .update({ status: "orphaned" })
        .in("id", orphanIds);
    }
  }

  revalidatePath(`/d/${documentId}`);
  revalidatePath("/");
  return { ok: true as const, version: nextVersion, title };
}

export async function deleteDocument(documentId: string) {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("owner_id", userId);

  if (error) {
    return { error: error.message };
  }
  revalidatePath("/");
  redirect("/");
}

export async function ensureShareLink(documentId: string) {
  const { supabase, userId } = await requireUser();

  const { data: owned } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!owned) {
    return { error: "Document introuvable." };
  }

  const { data: existing } = await supabase
    .from("share_links")
    .select("*")
    .eq("document_id", documentId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { token: existing.token };
  }

  const token = nanoid(24);
  const { data, error } = await supabase
    .from("share_links")
    .insert({ document_id: documentId, token })
    .select("token")
    .single();

  if (error || !data) {
    return { error: error?.message || "Impossible de créer le lien de partage." };
  }

  revalidatePath(`/d/${documentId}`);
  return { token: data.token };
}

export async function revokeShareLinks(documentId: string) {
  const { supabase, userId } = await requireUser();

  const { data: owned } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!owned) {
    return { error: "Document introuvable." };
  }

  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("document_id", documentId)
    .is("revoked_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/d/${documentId}`);
  return { ok: true as const };
}

export async function addOwnerComment(input: {
  documentId: string;
  body: string;
  authorName: string;
  version: number;
  anchor?: Anchor | null;
  parentId?: string | null;
}) {
  const { supabase, userId } = await requireUser();
  const body = input.body.trim();
  const authorName = input.authorName.trim() || "Owner";
  if (!body) return { error: "Le commentaire ne peut pas être vide." };

  const { data: owned } = await supabase
    .from("documents")
    .select("id")
    .eq("id", input.documentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!owned) return { error: "Document introuvable." };

  const { data, error } = await supabase
    .from("comments")
    .insert({
      document_id: input.documentId,
      version: input.version,
      parent_id: input.parentId || null,
      author_name: authorName.slice(0, 80),
      author_role: "owner",
      body: body.slice(0, 5000),
      anchor: input.anchor || null,
      status: "open",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message || "Impossible d’ajouter le commentaire." };
  }

  revalidatePath(`/d/${input.documentId}`);
  return { comment: data as CommentRow };
}

export async function setCommentStatus(
  commentId: string,
  documentId: string,
  status: CommentStatus,
) {
  const { supabase, userId } = await requireUser();

  const { data: owned } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!owned) return { error: "Document introuvable." };

  const { error } = await supabase
    .from("comments")
    .update({ status })
    .eq("id", commentId)
    .eq("document_id", documentId);

  if (error) return { error: error.message };

  revalidatePath(`/d/${documentId}`);
  return { ok: true as const };
}

export async function deleteComment(commentId: string, documentId: string) {
  const { supabase, userId } = await requireUser();

  const { data: owned } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!owned) return { error: "Document introuvable." };

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("document_id", documentId);

  if (error) return { error: error.message };

  revalidatePath(`/d/${documentId}`);
  return { ok: true as const };
}

export async function renameDocument(documentId: string, title: string) {
  const { supabase, userId } = await requireUser();
  const clean = title.trim().slice(0, 120) || "Untitled";
  const { error } = await supabase
    .from("documents")
    .update({ title: clean, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("owner_id", userId);

  if (error) return { error: error.message };
  revalidatePath(`/d/${documentId}`);
  revalidatePath("/");
  return { ok: true as const, title: clean };
}

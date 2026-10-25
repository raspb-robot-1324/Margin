import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFor(type: string, filename: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] || "jpg";
}

/** Upload a screenshot to the public `media` bucket; returns a public HTTPS URL. */
export async function uploadScreenshot(
  file: File,
  documentId: string,
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED.has(file.type) && !file.type.startsWith("image/")) {
    return { error: "Format d’image non supporté." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Image trop lourde (max 5 Mo)." };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Connecte-toi pour uploader des images." };
  }

  const ext = extFor(file.type, file.name);
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${user.id}/${documentId}/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  if (!data?.publicUrl) {
    return { error: "Impossible d’obtenir l’URL publique." };
  }

  return { url: data.publicUrl };
}

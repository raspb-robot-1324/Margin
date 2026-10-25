import { notFound, redirect } from "next/navigation";
import { DocumentWorkspace } from "@/components/DocumentWorkspace";
import { createClient } from "@/lib/supabase/server";
import type { CommentRow, DocumentRow, DocumentVersionRow } from "@/lib/types";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DocumentPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!doc) notFound();

  const document = doc as DocumentRow;

  const { data: version } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", id)
    .eq("version", document.current_version)
    .maybeSingle();

  const ver = version as DocumentVersionRow | null;
  if (!ver?.content) notFound();

  const { data: comments } = await supabase
    .from("comments")
    .select("*")
    .eq("document_id", id)
    .order("created_at", { ascending: true });

  const { data: share } = await supabase
    .from("share_links")
    .select("token")
    .eq("document_id", id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();

  const ownerName =
    profile?.display_name ||
    profile?.email?.split("@")[0] ||
    "Owner";

  return (
    <DocumentWorkspace
      documentId={document.id}
      title={document.title}
      version={document.current_version}
      html={ver.content}
      comments={(comments || []) as CommentRow[]}
      shareToken={share?.token ?? null}
      ownerName={ownerName}
      appUrl={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
    />
  );
}

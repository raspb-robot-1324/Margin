import { notFound } from "next/navigation";
import { ShareWorkspace } from "@/components/ShareWorkspace";
import { createClient } from "@/lib/supabase/server";
import type { CommentRow, SharedDocument } from "@/lib/types";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("resolve_share_token", {
    p_token: token,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    notFound();
  }

  const row = (Array.isArray(data) ? data[0] : data) as SharedDocument;
  if (!row?.content) notFound();

  const { data: comments } = await supabase.rpc("list_share_comments", {
    p_token: token,
  });

  return (
    <ShareWorkspace
      token={token}
      title={row.title}
      version={row.current_version}
      html={row.content}
      initialComments={(comments || []) as CommentRow[]}
    />
  );
}

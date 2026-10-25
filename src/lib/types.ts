export type AuthorRole = "owner" | "guest";
export type CommentStatus = "open" | "resolved" | "orphaned";

export type Anchor = {
  selectedText: string;
  startPath: string;
  startOffset: number;
  endPath: string;
  endOffset: number;
};

export type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  current_version: number;
  created_at: string;
  updated_at: string;
};

export type DocumentVersionRow = {
  id: string;
  document_id: string;
  version: number;
  storage_path: string;
  byte_size: number;
  content: string | null;
  created_at: string;
};

export type ShareLinkRow = {
  id: string;
  document_id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
};

export type CommentRow = {
  id: string;
  document_id: string;
  version: number;
  parent_id: string | null;
  author_name: string;
  author_role: AuthorRole;
  body: string;
  anchor: Anchor | null;
  status: CommentStatus;
  created_at: string;
};

export type SharedDocument = {
  document_id: string;
  title: string;
  current_version: number;
  content: string | null;
  share_link_id: string;
};

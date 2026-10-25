-- Margin schema (already applied to Supabase project "Margin")
-- Re-run on a fresh project via SQL editor if needed.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  current_version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  storage_path text not null,
  byte_size int not null default 0,
  content text,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

alter table public.document_versions enable row level security;

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.share_links enable row level security;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  parent_id uuid references public.comments(id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('owner', 'guest')),
  body text not null,
  anchor jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'orphaned')),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

-- RPCs: resolve_share_token, list_share_comments, add_share_comment
-- (security definer — see applied migration on the live project)

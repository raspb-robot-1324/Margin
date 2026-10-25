# Margin

Share HTML documents with CSS intact. You edit when signed in. Mentors open a secret link, read the real layout, and leave comments — no account required.

## Stack

- Next.js App Router
- Supabase Auth (magic link), Postgres, Storage
- Monaco editor (owner source view)

## Setup

1. Copy env:

```bash
cp .env.example .env.local
```

2. Fill values from your Supabase project (Dashboard → Project Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (local: `http://localhost:3000`)

3. Auth redirect URLs (Dashboard → Authentication → URL Configuration):

- Site URL: `http://localhost:3000` (and your Vercel URL in production)
- Redirect URLs: `http://localhost:3000/auth/callback`, `https://YOUR_DOMAIN/auth/callback`

4. Database: migrations for tables, RLS, storage bucket, and share RPCs are already applied on the Margin Supabase project. To re-apply on a fresh project, run the SQL from the conversation history / Supabase dashboard SQL editor (profiles, documents, document_versions, share_links, comments, resolve_share_token, list_share_comments, add_share_comment).

5. Install & run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with magic link, upload an `.html` file (try the Study Rink journal).

## Deploy (Vercel)

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add NEXT_PUBLIC_APP_URL
npx vercel --prod
```

Then set `NEXT_PUBLIC_APP_URL` to the production URL and add that URL + `/auth/callback` in Supabase Auth settings.

## Roles

| Role | How | Capabilities |
|------|-----|----------------|
| Owner | Magic link | Upload, edit HTML, share/revoke links, resolve comments |
| Mentor | `/s/[token]` | View faithful render, comment on selections, reply |

## Notes

- HTML is stored in `document_versions.content` (also mirrored to Storage when possible).
- Share access uses security-definer RPCs keyed by token (no public table reads).
- Re-saving a document marks comment anchors as `orphaned` if the selected text disappeared.

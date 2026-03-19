# RevLens

A multi-tenant B2B revenue intelligence platform that gives sales teams AI-powered insights from call recordings and deal activity.

## Features

- **AI Call Analysis** — Upload recordings (mp3/mp4/m4a/wav/webm); automatic Whisper transcription and GPT-4o extraction of objections, buying signals, risks, action items, and coaching insights
- **Pipeline Kanban** — Drag-and-drop deal board with optimistic UI and live stage updates
- **Dashboard** — Pipeline value, open deals, call volume, and at-risk deal alerts
- **CRM Import** — CSV upload for accounts, contacts, and opportunities with Zod validation, idempotent upserts by crmId, and per-row error reporting
- **Admin Panel** — Invite management, user roles, and encrypted OpenAI key configuration
- **Role-based access** — Admin / Manager / Rep scoping enforced at middleware and query layer

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 App Router + TypeScript |
| Auth | NextAuth.js v4 (credentials + Google OAuth, invite-only signup) |
| Database | Prisma 7 + Supabase Postgres (20-model schema) |
| Storage | Supabase Storage (private bucket, signed URLs) |
| AI | OpenAI Whisper (transcription) + GPT-4o (structured analysis) |
| Background jobs | Inngest (event-driven, no Redis required) |
| UI | Tailwind CSS + Radix UI + Lucide |
| Testing | Vitest (13 tests) |

## AI Pipeline

```
Upload audio
    │
    ▼
Supabase Storage + Call record (pending)
    │
    ▼  [Inngest: call/uploaded]
Whisper transcription → Transcript record (transcribing)
    │
    ▼  [Inngest: call/transcribed]
GPT-4o analysis → objections, buying signals, risks,
                  action items, coaching insights (analyzing)
    │
    ▼  [Inngest: call/analyzed]
Opportunity health score updated (done)
```

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (free tier works)
- OpenAI API key
- Inngest account (free tier works) or Inngest CLI for local dev

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase Postgres session pooler connection string |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for local) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `OPENAI_API_KEY` | OpenAI API key (or set per-org via Admin UI) |
| `ENCRYPTION_SECRET` | `openssl rand -base64 32` (must decode to 32 bytes) |
| `INNGEST_EVENT_KEY` | Inngest event key (leave empty for local dev) |
| `INNGEST_SIGNING_KEY` | Inngest signing key (leave empty for local dev) |
| `ALLOW_BOOTSTRAP_SIGNUP` | `true` for first admin creation, then set to `false` |

### 3. Push the database schema

```bash
npx prisma generate
npx prisma db push
```

### 4. Run the dev servers

```bash
npm run dev                   # Next.js on :3000
npx inngest-cli@latest dev    # Inngest on :8288 (separate terminal)
```

### 5. Create the first admin account

```bash
curl -X POST http://localhost:3000/api/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"orgName":"Acme","name":"Your Name","email":"you@example.com","password":"yourpassword"}'
```

Set `ALLOW_BOOTSTRAP_SIGNUP=false` after this. All subsequent signups require an admin invite.

## Project Structure

```
app/
  (app)/          # Authenticated app routes
    dashboard/    # Stats cards + at-risk deals table
    pipeline/     # Drag-and-drop Kanban board
    calls/        # Upload, list, and AI-analyzed call detail
    admin/        # Invites, users, CRM import, OpenAI key
  auth/           # Sign-in / sign-up pages
  api/
    auth/         # NextAuth handler
    bootstrap/    # First org + admin creation
    calls/upload/ # Audio upload + Inngest trigger
    crm/import/   # CSV import endpoint
    inngest/      # Inngest serve handler
    invites/      # Invite CRUD
    opportunities/[id]/stage/  # Kanban stage update
    admin/openai-key/          # Encrypted key storage
components/
  auth/           # Sign-in / sign-up forms
  admin/          # Invite form, user list, OpenAI key form
  calls/          # Upload dropzone
  crm/            # Import form with error reporting
  layout/         # Sidebar, theme provider
  pipeline/       # Kanban board
inngest/
  client.ts
  functions/
    transcribe-call.ts   # Whisper → Transcript
    analyze-call.ts      # GPT-4o → structured insights
    score-opportunity.ts # Health score update
lib/
  auth.ts         # NextAuth config, getSession, requireSession
  crm-import.ts   # Zod validation + CSV upsert logic
  db.ts           # Prisma helpers (org-scoped, role-aware)
  prisma.ts       # Prisma client singleton (Prisma 7 + adapter-pg)
  secrets.ts      # AES-256-GCM encrypt/decrypt
  storage.ts      # Supabase Storage helpers
  types.ts        # SessionUser, UserScope
prisma/
  schema.prisma   # 20-model schema
tests/
  api/            # Vitest integration tests (13 passing)
```

## Scripts

```bash
npm run dev     # Start Next.js dev server
npm run build   # Production build
npm run test    # Run Vitest tests
npm run lint    # ESLint
```

## License

MIT

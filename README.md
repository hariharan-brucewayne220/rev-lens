# RevLens

A multi-tenant B2B revenue intelligence platform that gives sales teams AI-powered insights from call recordings, CRM data, and deal activity.

## Features

- **AI Call Analysis** — Upload call recordings; get automatic transcription (Whisper), scoring, and key moment extraction (GPT-4o)
- **Pipeline Kanban** — Drag-and-drop deal board with live stage updates
- **Dashboard** — Win-rate trends, at-risk deals, rep performance at a glance
- **Account Workspace** — Full timeline of calls, emails, and notes per account
- **Forecast** — AI-generated revenue projections with narrative summaries
- **Renewals Tracker** — Churn risk scoring and renewal pipeline visibility
- **Team Analytics** — Rep-level call quality, talk-ratio, and deal velocity metrics
- **CRM Import** — CSV upload with smart field mapping (native integrations planned for v2)
- **Role-based access** — Admin / Manager / Rep scoping throughout

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 App Router + TypeScript |
| Auth | NextAuth.js (credentials + Google OAuth, invite-only signup) |
| Database | Prisma + Supabase Postgres |
| Storage | Supabase Storage (private bucket, signed URLs) |
| AI | OpenAI Whisper (transcription) + GPT-4o (analysis & scoring) |
| Background jobs | Inngest (serverless, no Redis) |
| UI | Tailwind CSS + shadcn/ui + Recharts |
| Testing | Vitest + Testing Library + Playwright |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- OpenAI API key
- Inngest account (free tier works)
- Google OAuth credentials (optional, for Google sign-in)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase Postgres connection string |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret — `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ENCRYPTION_SECRET` | 32-byte hex key for AES-256 secrets — `openssl rand -hex 32` |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `INNGEST_SIGNING_KEY` | Inngest signing key |
| `ALLOW_BOOTSTRAP_SIGNUP` | Set `true` to allow first admin signup |

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, `ALLOW_BOOTSTRAP_SIGNUP=true` lets you create the initial admin account. Set it to `false` afterward — all subsequent signups require an invite.

## Project Structure

```
app/
  (app)/          # Authenticated app routes
    dashboard/    # KPIs and at-risk deals
    pipeline/     # Kanban deal board
    accounts/     # Account workspace
    calls/        # Call recordings and AI review
    forecast/     # Revenue forecast + AI narrative
    renewals/     # Churn risk and renewal pipeline
    team/         # Rep analytics
    admin/        # User management and org settings
  auth/           # Sign-in / sign-up pages
  api/            # API routes (REST + Inngest webhook)
components/       # Shared UI components
lib/
  db.ts           # Prisma helpers (org-scoped, role-aware)
  secrets.ts      # AES-256-GCM encrypt/decrypt
  storage.ts      # Supabase Storage helpers
  auth.ts         # NextAuth config
  ai/             # Whisper, GPT-4o analysis, scoring, forecasting
  crm/            # CSV parser and upsert logic
inngest/          # Background job functions
prisma/           # Schema and migrations
tests/            # Vitest unit/integration + Playwright E2E
```

## Scripts

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
npm run test      # Vitest unit tests
```

## License

MIT

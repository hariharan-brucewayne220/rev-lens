# RevLens — Design Spec
**Date:** 2026-03-10
**Status:** Approved

---

## Overview

RevLens is a multi-tenant B2B revenue intelligence platform for sales teams. It ingests call recordings and CRM exports, transcribes and analyzes them with AI, and surfaces deal health scores, churn risks, coaching insights, and forecast narratives to sales reps and managers.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) + TypeScript | Full-stack, SSR/RSC, one repo |
| Database | Supabase Postgres (free tier) | Via Prisma ORM |
| File Storage | Supabase Storage | Call recordings, CRM exports; private bucket + signed URLs |
| Auth | NextAuth.js | Credentials + Google OAuth, JWT sessions, HTTP-only cookies |
| Background Jobs | Inngest (free tier) | Transcription, AI analysis, weekly summaries |
| AI — Transcription | OpenAI Whisper | Speaker-labeled transcript segments |
| AI — Analysis | OpenAI GPT-4o | Deal summaries, objections, risks, coaching, scoring |
| UI | Tailwind CSS + shadcn/ui + Recharts | Dark mode default, light mode toggle |
| Hosting | Vercel Hobby (free) | Serverless functions + edge middleware |
| CRM Integration | CSV upload v1; native Salesforce/HubSpot v2 | Adaptable provider pattern |

---

## 2. Architecture

**Pattern:** Next.js monolith + Inngest background worker layer.

```
/app                    → All pages (React Server Components by default)
/app/api               → API routes (auth, upload, CRM import, AI triggers)
/lib                   → Shared logic (db client, auth helpers, ai helpers, validators)
/lib/db.ts             → Typed Prisma query helper — enforces orgId scoping on all queries
/inngest               → Background job functions
/prisma                → Schema + migrations
/components            → UI components
/components/ui         → shadcn/ui base components
```

**Request flow:**
1. User action (upload, import) → API route validates session + org scope → stores file → triggers Inngest event
2. Inngest worker picks up event → calls OpenAI → writes results to DB
3. UI polls job status via `/api/calls/[id]/status` (polling every 3s) until `Call.status = done`

**Rep data scoping:**
All data-fetching API routes and Server Components receive `session.user.orgId` and `session.user.role`. For `role = rep`, every query additionally filters by `ownerId = session.user.id`. This is enforced in `/lib/db.ts` typed query helpers — not left to individual route implementations.

---

## 3. Data Model

All tables include `orgId` for row-level multi-tenancy. All Prisma queries scoped via `/lib/db.ts` helper that enforces `where: { orgId }` (and additionally `ownerId` for rep role).

```prisma
Organization {
  id, name, plan, timezone,        // timezone: IANA string e.g. "America/New_York"
  config Json,                      // non-sensitive UI/feature config (theme, defaults)
  encryptedSecrets Json?,           // AES-256-GCM encrypted blob: {openAiKey?, crmOAuthTokens?}
                                    // decrypted only in server/Inngest context via /lib/secrets.ts
  createdAt
}

User {
  id, orgId, email, name,
  role: admin | manager | rep,
  createdAt
}

Invite {
  id, orgId, email, role,
  token String @unique,             // secure random token, 24h TTL
  acceptedAt DateTime?,
  createdAt
}

Account {
  id, orgId, name, industry, website, crmId
}

Contact {
  id, orgId, accountId, name, email, title, phone
}

Opportunity {
  id, orgId, accountId, ownerId,
  name, stage, amount, closeDate,
  healthScore Int?,                 // 0–100, null until first scoring
  forecastCategory: commit | best_case | pipeline | omitted,  // set by manager or AI
  crmId
}

ForecastNarrative {
  id, orgId,
  weekOf DateTime,
  content,                          // AI-generated forecast summary paragraph
  totalCommit Decimal,
  totalBestCase Decimal,
  totalPipeline Decimal,
  generatedAt DateTime
}

CRMImport {
  id, orgId, importedBy,
  entityType: account | contact | opportunity,
  fileName,
  rowsTotal Int,
  rowsSuccess Int,
  rowsFailed Int,
  errorRows Json,                   // [{rowNumber, error, rawData}]
  status: processing | done | failed,
  createdAt
}

Call {
  id, orgId,
  opportunityId String?,            // nullable — rep can upload before associating to a deal
  ownerId,
  audioUrl,                         // Supabase Storage path (not a signed URL — signed on demand)
  duration Int?,                    // seconds, populated after transcription
  status: pending | transcribing | analyzing | done | failed,
  summary String?,                  // populated by analyze-call job
  failureReason String?,
  createdAt
}

Transcript {
  id, callId,
  segments Json                     // Prisma type: Json
                                    // shape: [{speaker: string, text: string, startMs: number, endMs: number}]
}

Objection {
  id, orgId, callId, opportunityId,
  text, category String,            // e.g. "pricing", "timing", "competitor", "technical"
  createdAt
}

CompetitorMention {
  id, orgId, callId, opportunityId,
  competitorName, context String,   // surrounding quote from transcript
  createdAt
}

BuyingSignal {
  id, orgId, callId, opportunityId,
  text, signalType String,          // e.g. "asked_about_timeline", "requested_references", "budget_confirmed"
  createdAt
}

Proposal {
  id, orgId, opportunityId, title,
  fileUrl,                          // Supabase Storage path
  createdAt
}

ActionItem {
  id, orgId, callId, opportunityId,
  text,
  assignedToRole String,            // "rep" | "prospect" | "unknown" — from AI
  ownerId String?,                  // resolved to User.id if assignedToRole = "rep"; null otherwise
  dueDate DateTime?,
  done Boolean @default(false),
  createdAt
}

Risk {
  id, orgId, opportunityId, callId,
  type String,                      // e.g. "no_contact", "champion_left", "competitor_threat", "budget_freeze"
  severity: low | medium | high | critical,
  description,
  createdAt
}

Renewal {
  id, orgId, accountId, opportunityId,
  arr Decimal,
  renewalDate DateTime,
  churnRiskScore Int?,              // 0–100, populated by score-renewal job
  status: active | at_risk | churned | renewed,
  createdAt
}

CoachingInsight {
  id, orgId, callId, userId,
  content,
  category String                   // e.g. "discovery", "objection_handling", "closing", "talk_ratio"
}

ObjectionCluster {
  id, orgId,
  theme,                            // e.g. "pricing vs competitors"
  count Int,
  examples Json,                    // string[]
  weekOf DateTime
}

WeeklyManagerSummary {
  id, orgId,
  weekOf DateTime,
  content,
  generatedAt DateTime
}
```

---

## 4. Pages & Routes

```
/                           → redirect → /dashboard
/auth/signin                → NextAuth sign-in
/auth/signup                → Invite-token signup only (see Section 6 for gating)

/dashboard                  → Stats, AI insights, recent calls, at-risk deals
/pipeline                   → Kanban by deal stage, drag-to-update stage
/accounts                   → Account list with search/filter
/accounts/[id]              → Account workspace: contacts, opps, calls, proposals, activity timeline
                               (activity timeline assembled from createdAt across Call, ActionItem, Risk,
                                Renewal, Proposal records for this account — no separate table needed)
/calls                      → Call list with transcription status badges
/calls/[id]                 → Call review: transcript, summary, objections, buying signals,
                               competitor mentions, action items, coaching insight
/forecast                   → Commit / best case / pipeline chart (from Opportunity.forecastCategory + amount)
                               + AI narrative (from ForecastNarrative, generated weekly by forecast-narrative job)
/renewals                   → Churn risk table sorted by score, ARR, days to renewal
/team                       → Rep analytics: call volume, deal health by rep, coaching themes
/admin                      → Org settings, user management, invites, CRM import, OpenAI key config
```

**Role gating:**
- `rep` — own deals and calls only (enforced in `/lib/db.ts` helpers)
- `manager` — full team view
- `admin` — manager access + `/admin` settings
- Middleware (`/middleware.ts`) enforces `/team` requires `manager|admin`, `/admin` requires `admin`
- All other routes enforce auth (no unauthenticated access)

---

## 5. AI Pipeline (Inngest Jobs)

### `transcribe-call`
Triggered when call upload completes.
1. Download audio from Supabase Storage (server-side path → no signed URL needed)
2. Send to OpenAI Whisper → transcript with timestamps + speaker labels
3. Parse into `[{speaker, text, startMs, endMs}]` segments
4. Save to `Transcript.segments` (Json); update `Call.duration`, `Call.status = analyzing`
5. Trigger `analyze-call`

### `analyze-call`
Triggered after transcription.
GPT-4o receives transcript segments with a structured output prompt (JSON mode). Returns:
```json
{
  "summary": "string",
  "objections": [{"text": "string", "category": "string"}],
  "competitorMentions": [{"competitorName": "string", "context": "string"}],
  "buyingSignals": [{"text": "string", "signalType": "string"}],
  "actionItems": [{"text": "string", "assignedToRole": "rep|prospect|unknown", "dueDateHint": "string|null"}],
  "risks": [{"type": "string", "severity": "low|medium|high|critical", "description": "string"}],
  "coachingNote": {"content": "string", "category": "string"}
}
```
All fields written to their respective tables. `Call.summary` written. `Call.status = done`.
`coachingNote` → one `CoachingInsight` record with `userId = call.ownerId`.
`actionItems[].assignedToRole = "rep"` → `ActionItem.ownerId = call.ownerId`; otherwise `ownerId = null`.
Trigger `score-opportunity` and `score-renewal` (if opportunity has a linked renewal).

### `score-opportunity`
Triggered after `analyze-call` or on-demand from `/pipeline`.
1. Aggregate signals for the opportunity: days since last contact, unresolved objections count, competitor mentions, champion risk, stage age vs avg, buying signals count
2. GPT-4o scores 0–100 with reasoning summary
3. Update `Opportunity.healthScore`

### `score-renewal`
Triggered after `analyze-call` when `Opportunity` has a linked `Renewal`, or on-demand from `/renewals`.
1. Fetch renewal ARR, days to renewal date, associated risk signals, last call summary
2. GPT-4o scores churn risk 0–100
3. Update `Renewal.churnRiskScore` and `Renewal.status` (at_risk if score > 60)

### `cluster-objections`
Weekly batch (Sunday midnight UTC).
1. Fetch all `Objection` records created in past 7 days per org
2. GPT-4o groups by theme, returns `[{theme, count, examples[]}]`
3. Upsert `ObjectionCluster` records for the week

### `forecast-narrative`
Triggered weekly (Sunday midnight UTC) alongside `cluster-objections`.
1. Aggregate `Opportunity` records by `forecastCategory` for each org
2. GPT-4o generates a 2–3 paragraph forecast narrative (risks, opportunities, close probability commentary)
3. Save to `ForecastNarrative` with totals per category

### `weekly-manager-summary`
Cron scheduling: Inngest cron runs **every hour** (not once). Each run fans out to all orgs and checks whether the current UTC time corresponds to Monday 7:00–8:00 in `Organization.timezone`. Only orgs in that window get a summary generated. This covers all IANA timezones.
**v1 scope note:** Default timezone is `America/New_York` if `Organization.timezone` is unset. Admins set timezone in `/admin`.
1. Fetch week's pipeline delta, risk changes, new calls, objection clusters, rep activity
2. GPT-4o generates manager digest
3. Save to `WeeklyManagerSummary`

---

## 6. Security

### Signup Gating
`/auth/signup` is **invite-only**. Flow:
1. Admin creates invite in `/admin` → `Invite` record created (secure random token, 24h TTL)
2. Token sent to invitee via in-app copy link (email out of scope v1)
3. `/auth/signup?token=<token>` validates token, pre-fills email, creates user on submit
4. First org can be created by a super-admin bootstrap route (disabled in production via env flag)

### Tenant Isolation
Every API route extracts `orgId` from `session.user` (server-side only). `/lib/db.ts` exports typed query helpers that enforce `where: { orgId }`. Direct Prisma client is not exported — all data access goes through these helpers.

### File Access
Recordings stored in private Supabase bucket by path (not pre-signed URL stored in DB). Signed URLs generated on demand via `/api/calls/[id]/audio` endpoint (15-min TTL). The call review page fetches a fresh signed URL on load and refreshes it every 10 minutes via a client-side interval.

### Upload Validation
File type allowlist: mp3, mp4, m4a, wav, webm. Max 500MB. Validated using `file-type` library (reads magic bytes, not just extension) before storage write.

### CSV Sanitization
All CSV fields validated through Zod schemas before any DB write. Unknown columns ignored. Malformed rows collected and returned as an error report to the user.

### Prompt Injection Guard
User-supplied strings (deal names, contact names, company names) inserted into GPT-4o prompts are wrapped in XML delimiters and preceded by a system instruction not to treat delimiter content as instructions.

### Rate Limiting
Vercel Edge middleware rate-limits:
- `/api/calls/upload` — 10 req/min per user
- `/api/crm/import` — 5 req/min per user
- `/api/calls/[id]/analyze` — 20 req/min per org

### Secrets Storage
`Organization.encryptedSecrets` stores sensitive keys (OpenAI API key, future CRM OAuth tokens) as an AES-256-GCM encrypted JSON blob using a server-side `ENCRYPTION_SECRET` env variable. All encryption/decryption is handled by `/lib/secrets.ts`. Secrets are decrypted only within server or Inngest job context and never returned to the client.

### Auth
HTTP-only cookies, CSRF protection via NextAuth, no tokens in localStorage. All sensitive operations require re-validation of session freshness (< 1h old).

---

## 7. Testing Strategy

### Unit Tests (Vitest)
- `/lib/db.ts` query helpers — orgId scoping cannot be bypassed
- AI response parsers — Zod schema validation on GPT-4o structured output
- CSV import parser — empty fields, encoding issues, duplicate crmId deduplication
- Prompt builder — injection guard wrapping correctness
- `score-opportunity` signal aggregation logic

### Integration Tests (Vitest + isolated test DB)
- API routes: auth flow, file upload validation (type, size), CRM import upsert
- Inngest job functions with mocked OpenAI responses → assert correct DB state
- `/api/calls/[id]/audio` — signed URL generation, session validation
- Invite flow: create invite → consume token → user created with correct role

### E2E Tests (Playwright)
- Auth: signup via invite token → signin → signout
- Call upload → poll status → call review page renders transcript + AI outputs
- Pipeline: drag deal to new stage → verify DB updated → health score visible
- Role gating: rep cannot see another rep's deals on `/pipeline` or `/calls`
- Role gating: rep redirected away from `/team` and `/admin`
- Admin: create invite link → use link to sign up → new user can sign in

---

## 8. CRM Integration (Adaptable)

### v1 — CSV Upload
- Separate upload flows for Accounts, Contacts, Opportunities
- Zod schema per entity type with strict field validation
- Upsert by `crmId` field (deduplication across imports)
- Import history tracked in `CRMImport` table; `/admin` shows list with row-level error reporting

### v2 — Native integrations (pluggable provider pattern)
```ts
interface CRMProvider {
  fetchAccounts(orgId: string): Promise<Account[]>
  fetchOpportunities(orgId: string): Promise<Opportunity[]>
  pushActionItems(items: ActionItem[]): Promise<void>
}
// Planned implementations: SalesforceProvider, HubSpotProvider
```
OAuth tokens stored encrypted in `Organization.encryptedSecrets` (same AES-256-GCM pattern, via `/lib/secrets.ts`).

---

## 9. Proposals

`Proposal` records link a document (PDF/docx uploaded to Supabase Storage) to an `Opportunity`. Visible in `/accounts/[id]` account workspace under the opportunity timeline. Upload via the account workspace UI. Not yet AI-analyzed in v1 (future: proposal gap analysis vs transcript).

---

## 10. Out of Scope (v1)

- Real-time / live call recording (transcription is post-call upload only)
- Native Salesforce / HubSpot OAuth sync
- Email delivery (invite links are copy-paste; weekly summary is in-app only)
- Mobile app
- Custom AI model fine-tuning
- Proposal AI analysis

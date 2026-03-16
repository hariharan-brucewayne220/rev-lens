# RevLens Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-tenant B2B revenue intelligence platform for sales teams with AI-powered call analysis, deal health scoring, and forecast intelligence.

**Architecture:** Next.js 14 App Router monolith with Inngest background workers for AI jobs. All data is tenant-scoped via orgId enforced in /lib/db.ts helpers. Role-based access (admin/manager/rep) enforced in middleware and query helpers.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Supabase (Postgres + Storage), NextAuth.js, Inngest, OpenAI (Whisper + GPT-4o), Tailwind CSS, shadcn/ui, Recharts, Vitest, Playwright

---

## Chunk 1: Foundation

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.local`, `.env.example`, `.gitignore`

- [ ] **Step 1: Create the Next.js app**

```bash
cd /mnt/d/claude-projects/RevLens
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --use-npm
```

Expected: Project scaffolded with `app/`, `components/`, `public/`, `package.json`.

- [ ] **Step 2: Install all dependencies**

```bash
npm install @prisma/client @supabase/supabase-js next-auth@4 \
  inngest @inngest/next \
  openai \
  zod \
  papaparse \
  file-type \
  bcryptjs \
  next-themes \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs \
  @radix-ui/react-tooltip @radix-ui/react-select @radix-ui/react-badge \
  @radix-ui/react-avatar @radix-ui/react-separator \
  class-variance-authority clsx tailwind-merge lucide-react \
  recharts \
  @hello-pangea/dnd \
  date-fns

npm install -D prisma vitest @vitejs/plugin-react \
  @playwright/test playwright \
  @types/papaparse \
  @types/bcryptjs \
  vite-tsconfig-paths \
  @testing-library/react @testing-library/jest-dom \
  msw
```

Expected: `node_modules/` populated, no peer dep errors.

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 4: Create `.env.local`**

> ⚠️ **STOP: Fill in all values before proceeding.** Steps after this (Prisma push, Supabase Storage) will fail with placeholder values. Get your Supabase project URL/keys from supabase.com, generate NEXTAUTH_SECRET and ENCRYPTION_SECRET with `openssl rand -base64 32`, and add your OpenAI API key.

```bash
cat > .env.local << 'EOF'
# Database — get from Supabase project Settings > Database > Connection string
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

# NextAuth — generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="REPLACE_WITH_GENERATED_SECRET"

# Google OAuth (optional — leave empty to skip Google sign-in)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Supabase — get from project Settings > API
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="REPLACE_WITH_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="REPLACE_WITH_SERVICE_ROLE_KEY"

# OpenAI
OPENAI_API_KEY="sk-REPLACE_WITH_YOUR_KEY"

# Encryption — generate: openssl rand -base64 32 (must decode to exactly 32 bytes)
ENCRYPTION_SECRET="REPLACE_WITH_GENERATED_SECRET"

# Inngest — get from app.inngest.com (leave empty for local dev, Inngest dev server handles it)
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""

# Bootstrap — allows first org creation; set to "false" in production
ALLOW_BOOTSTRAP_SIGNUP="true"
EOF
```

Verify no placeholders remain before proceeding:
```bash
grep -E 'REPLACE_WITH|YOUR_' .env.local && echo "⚠️  Still has placeholders" || echo "✅ All values set"
```

- [ ] **Step 5: Create `.env.example`** (safe to commit — empty values)

```bash
sed 's/=".*/=""/' .env.local > .env.example
# Fix the ALLOW_BOOTSTRAP_SIGNUP line which needs a non-empty default
sed -i 's/ALLOW_BOOTSTRAP_SIGNUP=""/ALLOW_BOOTSTRAP_SIGNUP="true"/' .env.example
```

Expected: `.env.example` has all keys with empty string values (except ALLOW_BOOTSTRAP_SIGNUP).

- [ ] **Step 6: Update `.gitignore`**

Ensure `.env.local` is in `.gitignore` (Next.js adds it by default). Also add:

```
.env.local
.env.*.local
.superpowers/
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with all dependencies"
```

---

### Task 2: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the full schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  admin
  manager
  rep
}

enum CallStatus {
  pending
  transcribing
  analyzing
  done
  failed
}

enum RiskSeverity {
  low
  medium
  high
  critical
}

enum RenewalStatus {
  active
  at_risk
  churned
  renewed
}

enum ForecastCategory {
  commit
  best_case
  pipeline
  omitted
}

enum CRMEntityType {
  account
  contact
  opportunity
}

enum CRMImportStatus {
  processing
  done
  failed
}

model Organization {
  id               String    @id @default(cuid())
  name             String
  plan             String    @default("free")
  timezone         String    @default("America/New_York")
  config           Json      @default("{}")
  encryptedSecrets Json?
  createdAt        DateTime  @default(now())

  users              User[]
  invites            Invite[]
  accounts           Account[]
  contacts           Contact[]
  opportunities      Opportunity[]
  calls              Call[]
  proposals          Proposal[]
  objections         Objection[]
  competitorMentions CompetitorMention[]
  buyingSignals      BuyingSignal[]
  actionItems        ActionItem[]
  risks              Risk[]
  renewals           Renewal[]
  coachingInsights   CoachingInsight[]
  objectionClusters  ObjectionCluster[]
  weeklyManagerSummaries WeeklyManagerSummary[]
  forecastNarratives ForecastNarrative[]
  crmImports         CRMImport[]
}

model User {
  id        String    @id @default(cuid())
  orgId     String
  email     String
  name      String
  role      UserRole  @default(rep)
  password  String?   // hashed, null if Google OAuth only
  createdAt DateTime  @default(now())

  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, email])
}

model Invite {
  id         String    @id @default(cuid())
  orgId      String
  email      String
  role       UserRole  @default(rep)
  token      String    @unique @default(cuid())
  acceptedAt DateTime?
  expiresAt  DateTime
  createdAt  DateTime  @default(now())

  org        Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
}

model Account {
  id        String   @id @default(cuid())
  orgId     String
  name      String
  industry  String?
  website   String?
  crmId     String?

  org       Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contacts  Contact[]
  opportunities Opportunity[]
  renewals  Renewal[]

  @@unique([orgId, crmId])
}

model Contact {
  id        String   @id @default(cuid())
  orgId     String
  accountId String
  name      String
  email     String?
  title     String?
  phone     String?

  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  account   Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model Opportunity {
  id               String           @id @default(cuid())
  orgId            String
  accountId        String
  ownerId          String
  name             String
  stage            String
  amount           Decimal          @db.Decimal(12, 2)
  closeDate        DateTime
  healthScore      Int?
  forecastCategory ForecastCategory @default(pipeline)
  crmId            String?
  createdAt        DateTime         @default(now())

  org           Organization    @relation(fields: [orgId], references: [id], onDelete: Cascade)
  account       Account         @relation(fields: [accountId], references: [id])
  calls              Call[]
  actionItems        ActionItem[]
  risks              Risk[]
  renewals           Renewal[]
  objections         Objection[]
  competitorMentions CompetitorMention[]
  buyingSignals      BuyingSignal[]
  proposals          Proposal[]

  @@unique([orgId, crmId])
}

model Call {
  id            String     @id @default(cuid())
  orgId         String
  opportunityId String?
  ownerId       String
  audioPath     String     // Supabase Storage path (NOT a signed URL)
  duration      Int?       // seconds
  status        CallStatus @default(pending)
  summary       String?
  failureReason String?
  createdAt     DateTime   @default(now())

  org          Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  opportunity  Opportunity?   @relation(fields: [opportunityId], references: [id])
  transcript   Transcript?
  objections   Objection[]
  competitorMentions CompetitorMention[]
  buyingSignals BuyingSignal[]
  actionItems  ActionItem[]
  risks        Risk[]
  coachingInsights CoachingInsight[]
}

model Transcript {
  id       String @id @default(cuid())
  callId   String @unique
  segments Json   // [{speaker: string, text: string, startMs: number, endMs: number}]

  call     Call   @relation(fields: [callId], references: [id], onDelete: Cascade)
}

model Objection {
  id            String   @id @default(cuid())
  orgId         String
  callId        String
  opportunityId String?
  text          String
  category      String   // "pricing" | "timing" | "competitor" | "technical" | "other"
  createdAt     DateTime @default(now())

  org         Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  call        Call          @relation(fields: [callId], references: [id], onDelete: Cascade)
  opportunity Opportunity?  @relation(fields: [opportunityId], references: [id])
}

model CompetitorMention {
  id             String   @id @default(cuid())
  orgId          String
  callId         String
  opportunityId  String?
  competitorName String
  context        String
  createdAt      DateTime @default(now())

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  call        Call         @relation(fields: [callId], references: [id], onDelete: Cascade)
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])
}

model BuyingSignal {
  id            String   @id @default(cuid())
  orgId         String
  callId        String
  opportunityId String?
  text          String
  signalType    String
  createdAt     DateTime @default(now())

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  call        Call         @relation(fields: [callId], references: [id], onDelete: Cascade)
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])
}

model Proposal {
  id            String   @id @default(cuid())
  orgId         String
  opportunityId String
  title         String
  filePath      String
  createdAt     DateTime @default(now())

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  opportunity Opportunity  @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
}

model ActionItem {
  id               String    @id @default(cuid())
  orgId            String
  callId           String
  opportunityId    String?
  text             String
  assignedToRole   String    // "rep" | "prospect" | "unknown"
  ownerId          String?   // resolved User.id if assignedToRole = "rep"
  dueDate          DateTime?
  done             Boolean   @default(false)
  createdAt        DateTime  @default(now())

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  call        Call         @relation(fields: [callId], references: [id], onDelete: Cascade)
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])
}

model Risk {
  id            String       @id @default(cuid())
  orgId         String
  opportunityId String
  callId        String?
  type          String
  severity      RiskSeverity
  description   String
  createdAt     DateTime     @default(now())

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  opportunity Opportunity  @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  call        Call?        @relation(fields: [callId], references: [id])
}

model Renewal {
  id             String        @id @default(cuid())
  orgId          String
  accountId      String
  opportunityId  String?
  arr            Decimal       @db.Decimal(12, 2)
  renewalDate    DateTime
  churnRiskScore Int?
  status         RenewalStatus @default(active)
  createdAt      DateTime      @default(now())

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  account     Account      @relation(fields: [accountId], references: [id])
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])
}

model CoachingInsight {
  id       String @id @default(cuid())
  orgId    String
  callId   String
  userId   String
  content  String
  category String // "discovery" | "objection_handling" | "closing" | "talk_ratio"

  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  call Call         @relation(fields: [callId], references: [id], onDelete: Cascade)
}

model ObjectionCluster {
  id       String   @id @default(cuid())
  orgId    String
  theme    String
  count    Int
  examples Json     // string[]
  weekOf   DateTime

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, theme, weekOf])
}

model WeeklyManagerSummary {
  id          String   @id @default(cuid())
  orgId       String
  weekOf      DateTime
  content     String
  generatedAt DateTime @default(now())

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, weekOf])
}

model ForecastNarrative {
  id             String   @id @default(cuid())
  orgId          String
  weekOf         DateTime
  content        String
  totalCommit    Decimal  @db.Decimal(12, 2)
  totalBestCase  Decimal  @db.Decimal(12, 2)
  totalPipeline  Decimal  @db.Decimal(12, 2)
  generatedAt    DateTime @default(now())

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, weekOf])
}

model CRMImport {
  id          String          @id @default(cuid())
  orgId       String
  importedBy  String
  entityType  CRMEntityType
  fileName    String
  rowsTotal   Int             @default(0)
  rowsSuccess Int             @default(0)
  rowsFailed  Int             @default(0)
  errorRows   Json            @default("[]")
  status      CRMImportStatus @default(processing)
  createdAt   DateTime        @default(now())

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Generate Prisma client and push schema**

```bash
npx prisma generate
npx prisma db push
```

Expected: `✔ Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add full Prisma schema for all RevLens entities"
```

---

### Task 3: Secrets Library

**Files:**
- Create: `lib/secrets.ts`
- Create: `tests/unit/lib/secrets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/lib/secrets.test.ts
import { describe, it, expect } from 'vitest'
import { encryptSecrets, decryptSecrets } from '@/lib/secrets'

describe('secrets', () => {
  it('round-trips encrypt/decrypt correctly', () => {
    const data = { openAiKey: 'sk-test-123', crmToken: 'tok_abc' }
    const encrypted = encryptSecrets(data)
    expect(typeof encrypted).toBe('string')
    expect(encrypted).not.toContain('sk-test-123')
    const decrypted = decryptSecrets(encrypted)
    expect(decrypted).toEqual(data)
  })

  it('returns null for null input', () => {
    expect(decryptSecrets(null)).toBeNull()
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptSecrets({ key: 'value' })
    const tampered = encrypted.slice(0, -4) + 'XXXX'
    expect(() => decryptSecrets(tampered)).toThrow()
  })
})
```

- [ ] **Step 2: Set up Vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

```typescript
// tests/setup.ts
process.env.ENCRYPTION_SECRET = 'dGVzdC1zZWNyZXQtMzItYnl0ZXMtbG9uZy1rZXkh'
process.env.DATABASE_URL = 'postgresql://test'
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/unit/lib/secrets.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/secrets'`

- [ ] **Step 4: Implement `lib/secrets.ts`**

```typescript
// lib/secrets.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) throw new Error('ENCRYPTION_SECRET env var is not set')
  const buf = Buffer.from(secret, 'base64')
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_SECRET must be 32 bytes when base64-decoded (got ${buf.length})`)
  }
  return buf
}

export function encryptSecrets(data: Record<string, unknown>): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const plaintext = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv(12) + authTag(16) + ciphertext — all base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptSecrets(encoded: string | null | undefined): Record<string, unknown> | null {
  if (!encoded) return null
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/unit/lib/secrets.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/secrets.ts tests/ vitest.config.ts
git commit -m "feat: add AES-256-GCM secrets encryption library with tests"
```

---

### Task 4: Database Query Helpers

**Files:**
- Create: `lib/prisma.ts`
- Create: `lib/db.ts`
- Create: `lib/types.ts`
- Create: `tests/unit/lib/db.test.ts`

- [ ] **Step 1: Create shared types**

```typescript
// lib/types.ts
export type UserRole = 'admin' | 'manager' | 'rep'

export interface SessionUser {
  id: string
  orgId: string
  email: string
  name: string
  role: UserRole
}

export interface OrgScope {
  orgId: string
}

export interface UserScope extends OrgScope {
  userId: string
  role: UserRole
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/unit/lib/db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({
  default: {
    opportunity: { findMany: mockFindMany, findFirst: mockFindFirst },
    call: { findMany: mockFindMany },
  },
}))

import { getOpportunities, getCalls } from '@/lib/db'

describe('db helpers — org scoping', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getOpportunities always includes orgId in where clause', async () => {
    mockFindMany.mockResolvedValue([])
    await getOpportunities({ orgId: 'org1', userId: 'u1', role: 'rep' })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org1' }) })
    )
  })

  it('getOpportunities scopes to ownerId for rep role', async () => {
    mockFindMany.mockResolvedValue([])
    await getOpportunities({ orgId: 'org1', userId: 'u1', role: 'rep' })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'u1' }) })
    )
  })

  it('getOpportunities does NOT scope to ownerId for manager role', async () => {
    mockFindMany.mockResolvedValue([])
    await getOpportunities({ orgId: 'org1', userId: 'u1', role: 'manager' })
    const call = mockFindMany.mock.calls[0][0]
    expect(call.where).not.toHaveProperty('ownerId')
  })

  it('getCalls always includes orgId', async () => {
    mockFindMany.mockResolvedValue([])
    await getCalls({ orgId: 'org2', userId: 'u2', role: 'manager' })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org2' }) })
    )
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/unit/lib/db.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create Prisma singleton**

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

- [ ] **Step 5: Implement `lib/db.ts`**

```typescript
// lib/db.ts
import prisma from '@/lib/prisma'
import type { UserScope } from '@/lib/types'

function repFilter(scope: UserScope) {
  return scope.role === 'rep' ? { ownerId: scope.userId } : {}
}

// ── Opportunities ──────────────────────────────────────────────
export async function getOpportunities(scope: UserScope) {
  return prisma.opportunity.findMany({
    where: { orgId: scope.orgId, ...repFilter(scope) },
    include: { account: true },
    orderBy: { closeDate: 'asc' },
  })
}

export async function getOpportunity(scope: UserScope, id: string) {
  return prisma.opportunity.findFirst({
    where: { id, orgId: scope.orgId, ...repFilter(scope) },
    include: { account: { include: { contacts: true } }, risks: true, actionItems: true },
  })
}

export async function updateOpportunityStage(scope: UserScope, id: string, stage: string) {
  // Verify ownership before update
  const opp = await getOpportunity(scope, id)
  if (!opp) throw new Error('Not found')
  return prisma.opportunity.update({ where: { id }, data: { stage } })
}

// ── Calls ──────────────────────────────────────────────────────
export async function getCalls(scope: UserScope, filters?: { opportunityId?: string }) {
  return prisma.call.findMany({
    where: { orgId: scope.orgId, ...repFilter(scope), ...filters },
    orderBy: { createdAt: 'desc' },
    include: { opportunity: true },
  })
}

export async function getCall(scope: UserScope, id: string) {
  return prisma.call.findFirst({
    where: { id, orgId: scope.orgId, ...repFilter(scope) },
    include: {
      transcript: true,
      objections: true,
      competitorMentions: true,
      buyingSignals: true,
      actionItems: true,
      coachingInsights: true,
    },
  })
}

// ── Accounts ───────────────────────────────────────────────────
export async function getAccounts(scope: UserScope) {
  return prisma.account.findMany({
    where: { orgId: scope.orgId },
    include: { _count: { select: { opportunities: true, contacts: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function getAccount(scope: UserScope, id: string) {
  return prisma.account.findFirst({
    where: { id, orgId: scope.orgId },
    include: {
      contacts: true,
      opportunities: {
        where: repFilter(scope),
        include: { risks: true },
      },
      renewals: true,
    },
  })
}

// ── Risks ──────────────────────────────────────────────────────
export async function getRiskyOpportunities(scope: UserScope) {
  return prisma.opportunity.findMany({
    where: {
      orgId: scope.orgId,
      ...repFilter(scope),
      risks: { some: { severity: { in: ['high', 'critical'] } } },
    },
    include: { risks: true, account: true },
    orderBy: { healthScore: 'asc' },
  })
}

// ── Renewals ───────────────────────────────────────────────────
export async function getRenewals(scope: UserScope) {
  return prisma.renewal.findMany({
    where: { orgId: scope.orgId },
    include: { account: true, opportunity: true },
    orderBy: { churnRiskScore: 'desc' },
  })
}

// ── Team (manager/admin only) ──────────────────────────────────
export async function getRepStats(scope: UserScope) {
  if (scope.role === 'rep') throw new Error('Forbidden')
  const users = await prisma.user.findMany({
    where: { orgId: scope.orgId, role: 'rep' },
  })
  const repIds = users.map((u) => u.id)

  const [callCounts, dealHealthAggs] = await Promise.all([
    prisma.call.groupBy({
      by: ['ownerId'],
      where: { orgId: scope.orgId, ownerId: { in: repIds } },
      _count: { id: true },
    }),
    prisma.opportunity.groupBy({
      by: ['ownerId'],
      where: { orgId: scope.orgId, ownerId: { in: repIds } },
      _avg: { healthScore: true },
      _count: { id: true },
    }),
  ])

  return users.map((u) => ({
    ...u,
    callCount: callCounts.find((c) => c.ownerId === u.id)?._count.id ?? 0,
    avgHealthScore: dealHealthAggs.find((d) => d.ownerId === u.id)?._avg.healthScore ?? null,
    dealCount: dealHealthAggs.find((d) => d.ownerId === u.id)?._count.id ?? 0,
  }))
}

// ── Dashboard aggregates ───────────────────────────────────────
export async function getDashboardStats(scope: UserScope) {
  const [pipelineAgg, callCount, atRisk] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { orgId: scope.orgId, ...repFilter(scope) },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.call.count({
      where: { orgId: scope.orgId, ...repFilter(scope) },
    }),
    getRiskyOpportunities(scope),
  ])

  return {
    pipelineValue: pipelineAgg._sum.amount ?? 0,
    openDeals: pipelineAgg._count,
    callCount,
    atRiskCount: atRisk.length,
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/unit/lib/db.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/db.ts lib/prisma.ts lib/types.ts tests/
git commit -m "feat: add typed DB query helpers with org/role scoping"
```

---

### Task 5: Supabase Storage Helper

**Files:**
- Create: `lib/storage.ts`
- Create: `tests/unit/lib/storage.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/lib/storage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpload = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockDownload = vi.fn()
const mockRemove = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
        download: mockDownload,
        remove: mockRemove,
      }),
    },
  }),
}))

// Set required env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

import { uploadRecording, getSignedUrl, downloadRecording } from '@/lib/storage'

describe('storage helpers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploadRecording returns the path on success', async () => {
    mockUpload.mockResolvedValue({ error: null })
    const result = await uploadRecording('org1/call1.mp3', Buffer.from('data'), 'audio/mpeg')
    expect(result).toBe('org1/call1.mp3')
    expect(mockUpload).toHaveBeenCalledWith('org1/call1.mp3', expect.any(Buffer), expect.objectContaining({ contentType: 'audio/mpeg' }))
  })

  it('uploadRecording throws on Supabase error', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'bucket not found' } })
    await expect(uploadRecording('path', Buffer.from(''), 'audio/mpeg')).rejects.toThrow('Upload failed')
  })

  it('getSignedUrl returns the signed URL string', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.url/file' }, error: null })
    const url = await getSignedUrl('org1/call1.mp3')
    expect(url).toBe('https://signed.url/file')
  })

  it('getSignedUrl throws on error', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'not found' } })
    await expect(getSignedUrl('missing.mp3')).rejects.toThrow('Signed URL failed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/lib/storage.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/storage'`

- [ ] **Step 3: Implement `lib/storage.ts`**

```typescript
// lib/storage.ts
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'recordings'
const SIGNED_URL_TTL = 900 // 15 minutes in seconds

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL env var is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function uploadRecording(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getServiceClient()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return path
}

export async function getSignedUrl(path: string): Promise<string> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`)
  return data.signedUrl
}

export async function downloadRecording(path: string): Promise<Buffer> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Download failed: ${error?.message}`)
  return Buffer.from(await data.arrayBuffer())
}

export async function deleteRecording(path: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`Delete failed: ${error.message}`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/lib/storage.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts tests/unit/lib/storage.test.ts
git commit -m "feat: add Supabase Storage helper with tests"
```

---

---

## Chunk 2: Auth & Org Management

### Task 6: NextAuth Configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Implement `lib/auth.ts`**

```typescript
// lib/auth.ts
import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { compare, hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import type { SessionUser } from '@/lib/types'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findFirst({
          where: { email: credentials.email.toLowerCase() },
        })
        if (!user?.password) return null
        const valid = await compare(credentials.password, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name, orgId: user.orgId, role: user.role }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: reject if user hasn't been invited (no DB record)
      if (account?.provider === 'google') {
        const existing = await prisma.user.findFirst({ where: { email: user.email! } })
        if (!existing) return '/auth/signin?error=not_invited'
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Credentials provider — user object already has our fields
        token.id = user.id
        token.orgId = (user as SessionUser).orgId
        token.role = (user as SessionUser).role
      }
      if (account?.provider === 'google' && !token.orgId) {
        // Google OAuth — look up our DB record to get orgId + role
        const dbUser = await prisma.user.findFirst({ where: { email: token.email! } })
        if (dbUser) {
          token.id = dbUser.id
          token.orgId = dbUser.orgId
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        email: token.email!,
        name: token.name!,
        orgId: token.orgId as string,
        role: token.role as SessionUser['role'],
      }
      return session
    },
  },
}

// Typed server session helper — use this in Server Components and API routes
export async function getSession(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as SessionUser) ?? null
}

// Throws if not authenticated — use in API routes
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new Error('Unauthorized')
  return user
}

export { hash as hashPassword }
```

- [ ] **Step 2: Create NextAuth route handler**

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 3: Extend NextAuth types**

```typescript
// types/next-auth.d.ts
import type { SessionUser } from '@/lib/types'

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    orgId: string
    role: SessionUser['role']
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts app/api/auth/ types/
git commit -m "feat: configure NextAuth with credentials and Google providers"
```

---

### Task 7: Middleware (Auth + Role Enforcement) + API Rate Limiter

**Files:**
- Create: `middleware.ts`
- Create: `lib/rate-limit.ts`

> **Note on rate limiting:** Vercel Edge middleware runs in isolated V8 isolates — in-memory state is not shared across requests. Rate limiting is therefore implemented in individual API route handlers (Node.js runtime, single process per instance) rather than Edge middleware. Middleware handles auth and role enforcement only.

- [ ] **Step 1: Create rate-limit helper (for use in API routes, not Edge middleware)**

```typescript
// lib/rate-limit.ts
// In-process sliding window rate limiter for Node.js API routes.
// Works correctly on Vercel because each serverless function instance
// maintains its own counter. This limits burst within a single instance;
// for distributed rate limiting across instances, replace with Upstash Redis.

const store = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}
```

- [ ] **Step 2: Create middleware (auth + role enforcement only)**

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Role enforcement for protected sections
    if (pathname.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    if (pathname.startsWith('/team') && token?.role === 'rep') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public routes — no auth required
        const pub = ['/auth/', '/api/auth/', '/api/bootstrap']
        if (pub.some((p) => req.nextUrl.pathname.startsWith(p))) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts lib/rate-limit.ts
git commit -m "feat: add auth middleware with role gating, API rate-limit helper"
```

---

### Task 8: Sign-in Page

**Files:**
- Create: `app/auth/signin/page.tsx`
- Create: `components/auth/signin-form.tsx`

- [ ] **Step 1: Create sign-in form component**

```tsx
// components/auth/signin-form.tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

export function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    params.get('error') === 'not_invited' ? 'This email is not registered. Contact your admin.' : null
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', {
      email: email.toLowerCase(),
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create sign-in page**

```tsx
// app/auth/signin/page.tsx
import { SignInForm } from '@/components/auth/signin-form'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-content">
      <div className="w-full max-w-sm mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold text-slate-100">RevLens</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Welcome back</h1>
        <p className="text-slate-400 mb-8 text-sm">Sign in to your account</p>
        <SignInForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/auth/ components/auth/
git commit -m "feat: add sign-in page with credentials form"
```

---

### Task 9: Invite-Only Signup

**Files:**
- Create: `app/api/invites/route.ts`
- Create: `app/api/invites/[token]/route.ts`
- Create: `app/auth/signup/page.tsx`
- Create: `components/auth/signup-form.tsx`

- [ ] **Step 1: Create invite API — create invite**

```typescript
// app/api/invites/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role } = await req.json()
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
  }

  // Check not already a member
  const existing = await prisma.user.findFirst({ where: { orgId: user.orgId, email } })
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  const invite = await prisma.invite.create({
    data: {
      orgId: user.orgId,
      email: email.toLowerCase(),
      role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  })

  const signupUrl = `${process.env.NEXTAUTH_URL}/auth/signup?token=${invite.token}`
  return NextResponse.json({ token: invite.token, signupUrl })
}

export async function GET(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const invites = await prisma.invite.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invites)
}
```

- [ ] **Step 2: Create invite token validation API**

```typescript
// app/api/invites/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({ where: { token: params.token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
  }
  return NextResponse.json({ email: invite.email, role: invite.role })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({ where: { token: params.token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
  }

  const { name, password } = await req.json()
  if (!name || !password || password.length < 8) {
    return NextResponse.json({ error: 'name and password (min 8 chars) required' }, { status: 400 })
  }

  const hashed = await hashPassword(password, 12)

  await prisma.$transaction([
    prisma.user.create({
      data: {
        orgId: invite.orgId,
        email: invite.email,
        name,
        role: invite.role,
        password: hashed,
      },
    }),
    prisma.invite.update({
      where: { token: params.token },
      data: { acceptedAt: new Date() },
    }),
  ])

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create signup form component**

```tsx
// components/auth/signup-form.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

interface Props {
  token: string
  email: string
  role: string
}

export function SignupForm({ token, email, role }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/invites/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create account')
      setLoading(false)
      return
    }

    // Auto sign-in after account creation
    await signIn('credentials', { email, password, redirect: false })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg px-3 py-2 text-sm text-indigo-300">
        Invited as <strong>{role}</strong> · {email}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Your name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Full name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="At least 8 characters"
        />
      </div>
      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create signup page**

```tsx
// app/auth/signup/page.tsx
import { notFound } from 'next/navigation'
import { SignupForm } from '@/components/auth/signup-form'

export default async function SignupPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token
  if (!token) notFound()

  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/invites/${token}`)
  if (!res.ok) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">This invite link is invalid or has expired.</p>
          <a href="/auth/signin" className="mt-4 text-indigo-400 text-sm underline block">
            Sign in instead
          </a>
        </div>
      </div>
    )
  }

  const { email, role } = await res.json()

  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold text-slate-100">RevLens</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Create your account</h1>
        <p className="text-slate-400 mb-8 text-sm">You've been invited to join RevLens</p>
        <SignupForm token={token} email={email} role={role} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/invites/ app/auth/signup/ components/auth/signup-form.tsx
git commit -m "feat: invite-only signup flow with token validation"
```

---

### Task 10: Bootstrap Route (First Org Setup)

**Files:**
- Create: `app/api/bootstrap/route.ts`

- [ ] **Step 1: Create bootstrap API**

This route creates the first organization + admin user. Disabled in production via env flag.

```typescript
// app/api/bootstrap/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (process.env.ALLOW_BOOTSTRAP_SIGNUP !== 'true') {
    return NextResponse.json({ error: 'Bootstrap is disabled' }, { status: 403 })
  }

  const count = await prisma.organization.count()
  if (count > 0) {
    return NextResponse.json({ error: 'Organization already exists' }, { status: 409 })
  }

  const { orgName, adminName, adminEmail, adminPassword } = await req.json()
  if (!orgName || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (adminPassword.length < 8) {
    return NextResponse.json({ error: 'Password min 8 characters' }, { status: 400 })
  }

  const hashed = await hashPassword(adminPassword, 12)

  const org = await prisma.organization.create({ data: { name: orgName } })
  await prisma.user.create({
    data: {
      orgId: org.id,
      email: adminEmail.toLowerCase(),
      name: adminName,
      role: 'admin',
      password: hashed,
    },
  })

  return NextResponse.json({ success: true, orgId: org.id })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/bootstrap/
git commit -m "feat: add bootstrap route for first org/admin creation"
```

---

### Task 11: App Shell Layout

**Files:**
- Create: `components/layout/theme-provider.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/topbar.tsx`
- Create: `app/(app)/layout.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create theme provider**

```tsx
// components/layout/theme-provider.tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
    </NextThemesProvider>
  )
}
```

- [ ] **Step 2: Update root layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RevLens',
  description: 'Revenue intelligence for sales teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create sidebar component**

```tsx
// components/layout/sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, GitBranch, Building2, Phone,
  TrendingUp, AlertTriangle, Users, Settings, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pipeline', icon: GitBranch, label: 'Pipeline' },
  { href: '/accounts', icon: Building2, label: 'Accounts' },
  { href: '/calls', icon: Phone, label: 'Calls' },
  { href: '/forecast', icon: TrendingUp, label: 'Forecast' },
  { href: '/renewals', icon: AlertTriangle, label: 'Renewals' },
  { href: '/team', icon: Users, label: 'Team' },
]

export function Sidebar({ userInitials }: { userInitials: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-14 flex-shrink-0 bg-[#0f1117] border-r border-[#1e2130] flex flex-col items-center py-4 gap-1">
      <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm mb-4">
        R
      </Link>

      {navItems.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          title={label}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            pathname.startsWith(href)
              ? 'bg-[#1e2130] text-indigo-400'
              : 'text-slate-500 hover:bg-[#1e2130] hover:text-slate-300'
          )}
        >
          <Icon size={18} />
        </Link>
      ))}

      <div className="mt-auto flex flex-col items-center gap-2">
        <Link
          href="/admin"
          title="Settings"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#1e2130] hover:text-slate-300 transition-colors"
        >
          <Settings size={18} />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          title="Sign out"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#1e2130] hover:text-slate-300 transition-colors"
        >
          <LogOut size={18} />
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center text-[10px] font-bold text-white">
          {userInitials}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create `lib/utils.ts`** (shadcn cn helper)

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Create app layout**

```tsx
// app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()
  if (!user) redirect('/auth/signin')

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-screen bg-[#0a0c14] overflow-hidden">
      <Sidebar userInitials={initials} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Create root redirect**

```tsx
// app/page.tsx
import { redirect } from 'next/navigation'
export default function Root() {
  redirect('/dashboard')
}
```

- [ ] **Step 7: Commit**

```bash
git add app/ components/layout/ lib/utils.ts
git commit -m "feat: add app shell with sidebar, theme provider, and auth layout"
```


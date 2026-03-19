import { inngest } from '@/inngest/client'
import prisma from '@/lib/prisma'
import OpenAI from 'openai'
import { decryptSecrets } from '@/lib/secrets'
import { z } from 'zod'

const analysisSchema = z.object({
  summary: z.string().default(''),
  objections: z.array(z.object({
    text: z.string(),
    category: z.string().transform((v) => {
      const map: Record<string, string> = { pricing: 'pricing', cost: 'pricing', roi: 'pricing', timing: 'timing', competitor: 'competitor', technical: 'technical' }
      return map[v.toLowerCase()] ?? 'other'
    }),
  })).default([]),
  competitorMentions: z.array(z.object({
    competitorName: z.string(),
    context: z.string(),
  })).default([]),
  buyingSignals: z.array(z.object({
    text: z.string(),
    signalType: z.string(),
  })).default([]),
  actionItems: z.array(z.object({
    text: z.string(),
    assignedToRole: z.string().transform((v) => {
      if (v === 'rep' || v === 'prospect') return v
      return 'unknown'
    }),
  })).default([]),
  risks: z.array(z.object({
    type: z.string(),
    severity: z.string().transform((v) => {
      if (['low', 'medium', 'high', 'critical'].includes(v.toLowerCase())) return v.toLowerCase()
      return 'medium'
    }),
    description: z.string(),
  })).default([]),
  coachingInsights: z.array(z.object({
    content: z.string(),
    category: z.string(),
  })).default([]),
  healthScoreDelta: z.number().min(-20).max(20).default(0),
})

type Analysis = z.infer<typeof analysisSchema>

async function getOpenAIClient(orgId: string): Promise<OpenAI> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  const secrets = decryptSecrets(org?.encryptedSecrets as string | null)
  const apiKey = (secrets?.openAiKey as string) || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No OpenAI API key configured')
  return new OpenAI({ apiKey })
}

const SYSTEM_PROMPT = `You are a sales intelligence analyst. Analyze the provided call transcript and return ONLY a JSON object with exactly this structure:

{
  "summary": "2-3 sentence summary of the call",
  "objections": [
    { "text": "exact objection text", "category": "pricing|timing|competitor|technical|other" }
  ],
  "competitorMentions": [
    { "competitorName": "name", "context": "how they were mentioned" }
  ],
  "buyingSignals": [
    { "text": "signal description", "signalType": "budget_confirmed|timeline_set|champion_identified|next_steps_agreed|other" }
  ],
  "actionItems": [
    { "text": "action description", "assignedToRole": "rep|prospect|unknown" }
  ],
  "risks": [
    { "type": "risk type", "severity": "low|medium|high|critical", "description": "description" }
  ],
  "coachingInsights": [
    { "content": "coaching tip", "category": "talk_ratio|discovery|objection_handling|closing|rapport" }
  ],
  "healthScoreDelta": 0
}

Rules:
- All arrays may be empty [] if nothing applies
- healthScoreDelta is an integer from -20 to +20
- Return ONLY the JSON object, no markdown, no explanation`

export const analyzeCall = inngest.createFunction(
  { id: 'analyze-call', retries: 2 },
  { event: 'call/transcribed' },
  async ({ event, step }) => {
    const { callId, orgId } = event.data as { callId: string; orgId: string }

    const analysis = await step.run('analyze-with-gpt4o', async () => {
      const [call, transcript] = await Promise.all([
        prisma.call.findUnique({
          where: { id: callId },
          include: { opportunity: true },
        }),
        prisma.transcript.findUnique({ where: { callId } }),
      ])

      if (!call || !transcript) throw new Error(`Call ${callId} or transcript not found`)

      const segments = transcript.segments as Array<{ speaker: string; text: string }>
      const transcriptText = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n')

      const openai = await getOpenAIClient(orgId)

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Opportunity: ${call.opportunity?.name ?? 'Unknown'}\n\nTranscript:\n${transcriptText}`,
          },
        ],
        temperature: 0.2,
      })

      const raw = JSON.parse(response.choices[0].message.content ?? '{}')

      // Normalize: GPT-4o sometimes returns arrays of strings instead of objects
      const normalized = {
        summary: raw.summary ?? '',
        objections: (raw.objections ?? []).map((o: unknown) =>
          typeof o === 'string' ? { text: o, category: 'other' } : o
        ),
        competitorMentions: (raw.competitorMentions ?? []).map((c: unknown) =>
          typeof c === 'string' ? { competitorName: c, context: '' } : c
        ),
        buyingSignals: (raw.buyingSignals ?? []).map((b: unknown) =>
          typeof b === 'string' ? { text: b, signalType: 'other' } : b
        ),
        actionItems: (raw.actionItems ?? []).map((a: unknown) =>
          typeof a === 'string' ? { text: a, assignedToRole: 'unknown' } : a
        ),
        risks: (raw.risks ?? []).map((r: unknown) =>
          typeof r === 'string' ? { type: 'other', severity: 'medium', description: r } : r
        ),
        coachingInsights: (raw.coachingInsights ?? []).map((c: unknown) =>
          typeof c === 'string' ? { content: c, category: 'other' } : c
        ),
        healthScoreDelta: raw.healthScoreDelta ?? 0,
      }

      const parsed = analysisSchema.safeParse(normalized)
      if (!parsed.success) {
        console.error('Analysis schema mismatch:', JSON.stringify(parsed.error.issues))
        console.error('Raw GPT response:', JSON.stringify(raw))
        // Return safe defaults rather than failing
        return {
          summary: raw.summary ?? '',
          objections: [],
          competitorMentions: [],
          buyingSignals: [],
          actionItems: [],
          risks: [],
          coachingInsights: [],
          healthScoreDelta: 0,
        } as Analysis
      }
      return parsed.data
    })

    await step.run('persist-insights', async () => {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: { opportunityId: true, ownerId: true },
      })
      if (!call) return

      const { opportunityId, ownerId } = call

      await Promise.all([
        prisma.call.update({
          where: { id: callId },
          data: { summary: analysis.summary, status: 'done' },
        }),
        ...analysis.objections.map((o) =>
          prisma.objection.create({
            data: { orgId, callId, opportunityId, text: o.text, category: o.category },
          })
        ),
        ...analysis.competitorMentions.map((c) =>
          prisma.competitorMention.create({
            data: { orgId, callId, opportunityId, competitorName: c.competitorName, context: c.context },
          })
        ),
        ...analysis.buyingSignals.map((b) =>
          prisma.buyingSignal.create({
            data: { orgId, callId, opportunityId, text: b.text, signalType: b.signalType },
          })
        ),
        ...analysis.actionItems.map((a) =>
          prisma.actionItem.create({
            data: {
              orgId,
              callId,
              opportunityId,
              text: a.text,
              assignedToRole: a.assignedToRole,
              ownerId: a.assignedToRole === 'rep' ? ownerId : null,
            },
          })
        ),
        ...analysis.risks.map((r) =>
          opportunityId
            ? prisma.risk.create({
                data: {
                  orgId,
                  callId,
                  opportunityId,
                  type: r.type,
                  severity: r.severity,
                  description: r.description,
                },
              })
            : Promise.resolve()
        ),
        ...analysis.coachingInsights.map((c) =>
          prisma.coachingInsight.create({
            data: { orgId, callId, userId: ownerId, content: c.content, category: c.category },
          })
        ),
      ])
    })

    // Chain into opportunity scoring if linked to an opportunity
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { opportunityId: true },
    })
    if (call?.opportunityId) {
      await step.sendEvent('trigger-scoring', {
        name: 'call/analyzed',
        data: { opportunityId: call.opportunityId, healthScoreDelta: analysis.healthScoreDelta },
      })
    }
  }
)

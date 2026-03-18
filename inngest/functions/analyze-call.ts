import { inngest } from '@/inngest/client'
import prisma from '@/lib/prisma'
import OpenAI from 'openai'
import { decryptSecrets } from '@/lib/secrets'
import { z } from 'zod'

const analysisSchema = z.object({
  summary: z.string(),
  objections: z.array(z.object({
    text: z.string(),
    category: z.enum(['pricing', 'timing', 'competitor', 'technical', 'other']),
  })),
  competitorMentions: z.array(z.object({
    competitorName: z.string(),
    context: z.string(),
  })),
  buyingSignals: z.array(z.object({
    text: z.string(),
    signalType: z.string(),
  })),
  actionItems: z.array(z.object({
    text: z.string(),
    assignedToRole: z.enum(['rep', 'prospect', 'unknown']),
  })),
  risks: z.array(z.object({
    type: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
  })),
  coachingInsights: z.array(z.object({
    content: z.string(),
    category: z.string(),
  })),
  healthScoreDelta: z.number().min(-20).max(20),
})

type Analysis = z.infer<typeof analysisSchema>

async function getOpenAIClient(orgId: string): Promise<OpenAI> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  const secrets = decryptSecrets(org?.encryptedSecrets as string | null)
  const apiKey = (secrets?.openAiKey as string) || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No OpenAI API key configured')
  return new OpenAI({ apiKey })
}

const SYSTEM_PROMPT = `You are a sales intelligence analyst. Analyze the provided call transcript and extract structured insights.

For healthScoreDelta: rate the call's impact on deal health from -20 (very negative) to +20 (very positive).
For objection categories use: pricing, timing, competitor, technical, other.
For buying signals include: budget confirmed, timeline set, champion identified, next steps agreed, etc.
For coaching insights use categories: talk_ratio, discovery, objection_handling, closing, rapport.
Return only valid JSON matching the schema. Arrays may be empty if nothing applies.`

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
      const parsed = analysisSchema.safeParse(raw)
      if (!parsed.success) {
        // Return safe defaults if schema mismatch
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

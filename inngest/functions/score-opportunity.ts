import { inngest } from '@/inngest/client'
import prisma from '@/lib/prisma'

export const scoreOpportunity = inngest.createFunction(
  { id: 'score-opportunity', retries: 1 },
  { event: 'call/analyzed' },
  async ({ event, step }) => {
    const { opportunityId, healthScoreDelta } = event.data as {
      opportunityId: string
      healthScoreDelta: number
    }

    await step.run('update-health-score', async () => {
      const opp = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { healthScore: true },
      })
      if (!opp) return

      const current = opp.healthScore ?? 50
      const next = Math.max(0, Math.min(100, current + healthScoreDelta))
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { healthScore: next },
      })
    })
  }
)

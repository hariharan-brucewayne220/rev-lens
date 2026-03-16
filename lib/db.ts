import prisma from '@/lib/prisma'
import type { UserScope } from '@/lib/types'

function repFilter(scope: UserScope) {
  return scope.role === 'rep' ? { ownerId: scope.userId } : {}
}

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
  const opp = await getOpportunity(scope, id)
  if (!opp) throw new Error('Not found')
  return prisma.opportunity.update({ where: { id }, data: { stage } })
}

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

export async function getRenewals(scope: UserScope) {
  return prisma.renewal.findMany({
    where: { orgId: scope.orgId },
    include: { account: true, opportunity: true },
    orderBy: { churnRiskScore: 'desc' },
  })
}

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
    callCount: callCounts.find((c: { ownerId: string; _count: { id: number } }) => c.ownerId === u.id)?._count.id ?? 0,
    avgHealthScore: dealHealthAggs.find((d: { ownerId: string; _avg: { healthScore: number | null }; _count: { id: number } }) => d.ownerId === u.id)?._avg.healthScore ?? null,
    dealCount: dealHealthAggs.find((d: { ownerId: string; _avg: { healthScore: number | null }; _count: { id: number } }) => d.ownerId === u.id)?._count.id ?? 0,
  }))
}

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

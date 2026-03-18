import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { transcribeCall } from '@/inngest/functions/transcribe-call'
import { analyzeCall } from '@/inngest/functions/analyze-call'
import { scoreOpportunity } from '@/inngest/functions/score-opportunity'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [transcribeCall, analyzeCall, scoreOpportunity],
})

import { inngest } from '@/inngest/client'
import { downloadRecording } from '@/lib/storage'
import prisma from '@/lib/prisma'
import OpenAI from 'openai'
import { decryptSecrets } from '@/lib/secrets'
import { toFile } from 'openai'

async function getOpenAIClient(orgId: string): Promise<OpenAI> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  const secrets = decryptSecrets(org?.encryptedSecrets as string | null)
  const apiKey = (secrets?.openAiKey as string) || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No OpenAI API key configured')
  return new OpenAI({ apiKey })
}

export const transcribeCall = inngest.createFunction(
  { id: 'transcribe-call', retries: 2 },
  { event: 'call/uploaded' },
  async ({ event, step }) => {
    const { callId, orgId, audioPath } = event.data as {
      callId: string
      orgId: string
      audioPath: string
    }

    await step.run('mark-transcribing', async () => {
      await prisma.call.update({
        where: { id: callId },
        data: { status: 'transcribing' },
      })
    })

    const segments = await step.run('transcribe', async () => {
      const buffer = await downloadRecording(audioPath)
      const openai = await getOpenAIClient(orgId)

      const ext = audioPath.split('.').pop() ?? 'mp3'
      const audioFile = await toFile(buffer, `audio.${ext}`, { type: `audio/${ext}` })

      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      })

      return (response.segments ?? []).map((seg) => ({
        speaker: 'unknown',
        text: seg.text.trim(),
        startMs: Math.round((seg.start ?? 0) * 1000),
        endMs: Math.round((seg.end ?? 0) * 1000),
      }))
    })

    await step.run('save-transcript', async () => {
      await prisma.transcript.create({
        data: { callId, segments },
      })
      const duration = segments.length > 0 ? Math.round(segments[segments.length - 1].endMs / 1000) : null
      await prisma.call.update({
        where: { id: callId },
        data: { status: 'analyzing', duration },
      })
    })

    // Chain into analysis
    await step.sendEvent('trigger-analysis', {
      name: 'call/transcribed',
      data: { callId, orgId },
    })
  }
)

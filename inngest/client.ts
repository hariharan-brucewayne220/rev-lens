import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'revlens',
  eventKey: process.env.INNGEST_EVENT_KEY || 'local',
})

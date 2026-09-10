export type ProviderSettings = {
  sttBaseUrl: string
  sttModel: string
  llmBaseUrl: string
  llmModel: string
  apiKey: string
  candidateSpeaker: string
  answerSentences: 2 | 3
  chunkSeconds: number
}

export type TranscriptSegment = {
  text: string
  speaker?: string
  final: boolean
}

export type PrepDocument = {
  id: string
  name: string
  text: string
  addedAt: number
}

export type AppStatus = 'setup' | 'connecting' | 'listening' | 'thinking' | 'paused' | 'error'

export const DEFAULT_SETTINGS: ProviderSettings = {
  sttBaseUrl: 'https://api.openai.com/v1',
  sttModel: 'gpt-4o-transcribe-diarize',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModel: 'gpt-5.6-luna',
  apiKey: '',
  candidateSpeaker: '',
  answerSentences: 3,
  chunkSeconds: 4,
}

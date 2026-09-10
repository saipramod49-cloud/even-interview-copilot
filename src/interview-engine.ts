import { semanticPrepContext } from './documents'
import { generateAnswer } from './providers'
import type { PrepDocument, ProviderSettings, TranscriptSegment } from './types'

export type EngineCallbacks = {
  onQuestion: (question: string, speaker?: string) => void
  onAnswer: (answer: string) => void
  onThinking: () => void
  onError: (error: Error) => void
}

export class InterviewEngine {
  private conversation: TranscriptSegment[] = []
  private lastQuestion = ''
  private answerRequest?: AbortController

  constructor(
    private settings: ProviderSettings,
    private documents: PrepDocument[],
    private callbacks: EngineCallbacks,
  ) {}

  update(settings: ProviderSettings, documents: PrepDocument[]) {
    this.settings = settings
    this.documents = documents
  }

  async accept(segment: TranscriptSegment) {
    if (!segment.final || !segment.text.trim()) return
    this.conversation.push(segment)
    this.conversation = this.conversation.slice(-16)

    const question = extractQuestion(segment.text)
    if (!question || normalize(question) === normalize(this.lastQuestion)) return
    if (this.settings.candidateSpeaker && segment.speaker === this.settings.candidateSpeaker) return

    this.lastQuestion = question
    this.callbacks.onQuestion(question, segment.speaker)
    this.callbacks.onThinking()
    this.answerRequest?.abort()
    this.answerRequest = new AbortController()

    try {
      const answer = await generateAnswer(
        question,
        await semanticPrepContext(question, this.documents, this.settings),
        this.conversation.slice(-8).map(item => `${item.speaker || 'speaker'}: ${item.text}`).join('\n'),
        this.settings,
        this.answerRequest.signal,
      )
      this.callbacks.onAnswer(answer)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') this.callbacks.onError(error as Error)
    }
  }
}

export function extractQuestion(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim()
  const candidates = clean.split(/(?<=[?.!])\s+/).filter(Boolean)
  const question = [...candidates].reverse().find(sentence => isQuestion(sentence))
  if (question) return question.slice(0, 420)
  return isQuestion(clean) ? clean.slice(0, 420) : null
}

function isQuestion(text: string) {
  if (text.endsWith('?')) return true
  return /^(what|why|how|when|where|who|which|can|could|would|will|do|did|have|has|are|is|tell me|walk me|describe|explain|give me)\b/i.test(text)
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function formatForGlasses(markdown: string) {
  return markdown
    .replace(/\*\*([^*]+)\*\*/g, (_, keyword: string) => keyword.toUpperCase())
    .replace(/[*_#`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 620)
}

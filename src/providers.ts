import type { ProviderSettings, TranscriptSegment } from './types'

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function headers(settings: ProviderSettings): HeadersInit {
  return settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}
}

export async function transcribePcm(
  pcm: Uint8Array,
  settings: ProviderSettings,
  signal?: AbortSignal,
): Promise<TranscriptSegment[]> {
  const wav = pcmToWav(pcm)
  const body = new FormData()
  body.append('file', new Blob([wav], { type: 'audio/wav' }), 'g2-audio.wav')
  body.append('model', settings.sttModel)
  body.append('response_format', settings.sttModel.includes('diarize') ? 'diarized_json' : 'verbose_json')
  if (settings.sttModel.includes('diarize')) body.append('chunking_strategy', 'auto')
  body.append('language', 'en')

  const response = await fetch(endpoint(settings.sttBaseUrl, '/audio/transcriptions'), {
    method: 'POST', headers: headers(settings), body, signal,
  })
  if (!response.ok) throw new Error(`Speech service returned ${response.status}: ${await response.text()}`)
  const data = await response.json() as {
    text?: string
    segments?: Array<{ text?: string; speaker?: string | number; final?: boolean }>
  }
  if (data.segments?.length) {
    return data.segments
      .filter(segment => segment.text?.trim())
      .map(segment => ({
        text: segment.text!.trim(),
        speaker: segment.speaker === undefined ? undefined : String(segment.speaker),
        final: segment.final ?? true,
      }))
  }
  return data.text?.trim() ? [{ text: data.text.trim(), final: true }] : []
}

export async function generateAnswer(
  question: string,
  context: string,
  recentConversation: string,
  settings: ProviderSettings,
  signal?: AbortSignal,
): Promise<string> {
  const instructions = `You are a discreet interview response coach for a candidate with about two years of experience. Answer directly in natural, simple language the candidate can understand at a glance and say aloud. Use uploaded resume/prep evidence first for personal or project questions, and use web search only to strengthen current technical or industry context. Never invent the candidate's experience, tools, metrics, or ownership. Keep the complete response at 100 words or fewer. Write 2-3 short sentences, then on a new line write KEYWORDS: followed by 3-5 short **bold keywords** separated by |. Do not include URLs, citations, preambles, or clarification questions unless the question is genuinely impossible to interpret.`
  const input = `INTERVIEW QUESTION:\n${question}\n\nRELEVANT RESUME/PREP NOTES:\n${context || '(No relevant notes uploaded.)'}\n\nRECENT CONVERSATION:\n${recentConversation || '(None)'}`
  const response = await fetch(endpoint(settings.llmBaseUrl, '/responses'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers(settings) },
    signal,
    body: JSON.stringify({
      model: settings.llmModel,
      instructions,
      input,
      tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
      tool_choice: 'auto',
      max_output_tokens: 220,
      store: false,
    }),
  })
  if (!response.ok) throw new Error(`Language model returned ${response.status}: ${await response.text()}`)
  const data = await response.json() as {
    output_text?: string
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  }
  const answer = (data.output_text || data.output
    ?.flatMap(item => item.content ?? [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text ?? '')
    .join('\n'))?.trim()
  if (!answer) throw new Error('The language model returned an empty answer.')
  return capWords(answer, 100)
}

function capWords(value: string, maxWords: number) {
  const words = value.split(/\s+/)
  return words.length <= maxWords ? value : `${words.slice(0, maxWords).join(' ')}…`
}

function pcmToWav(pcm: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16_000, true)
  view.setUint32(28, 32_000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  new Uint8Array(buffer, 44).set(pcm)
  return buffer
}

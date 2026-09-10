import { readPrepFile } from './documents'
import { connectGlasses } from './glasses'
import { formatForGlasses, InterviewEngine } from './interview-engine'
import { transcribePcm } from './providers'
import { loadDocuments, loadSettings, saveDocuments, saveSettings } from './storage'
import type { PrepDocument, ProviderSettings } from './types'
import { mountUi } from './ui'

let settings = loadSettings()
let documents = loadDocuments()
let glasses: Awaited<ReturnType<typeof connectGlasses>> | undefined
let running = false
let pcmParts: Uint8Array[] = []
let pcmBytes = 0
let transcriptionBusy = false

const engine = new InterviewEngine(settings, documents, {
  onQuestion(question, speaker) {
    ui.setQuestion(question, speaker)
  },
  onThinking() {
    ui.setStatus('thinking', 'Drafting')
    glasses?.setStatus('thinking')
  },
  onAnswer(answer) {
    const lensAnswer = formatForGlasses(answer)
    ui.setAnswer(lensAnswer)
    ui.setStatus('listening', 'Listening')
    glasses?.setAnswer(lensAnswer)
    glasses?.setStatus('listening')
  },
  onError(error) {
    ui.setStatus('error', 'Answer error')
    ui.setAnswer(error.message)
    glasses?.setStatus('model error')
  },
})

const ui = mountUi(settings, documents, {
  onSave(next) {
    settings = next
    saveSettings(settings)
    engine.update(settings, documents)
    ui.setStatus(running ? 'listening' : 'setup', 'Saved')
  },
  onStart: start,
  onStop: stop,
  async onFiles(files) {
    ui.setStatus('connecting', 'Reading files')
    const results = await Promise.allSettled(files.map(readPrepFile))
    const added = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [`${files[index].name}: ${(result.reason as Error).message}`] : [])
    if (added.length) {
      documents = [...documents, ...added]
      saveDocuments(documents)
      engine.update(settings, documents)
      ui.renderDocuments(documents)
    }
    if (failed.length) {
      ui.setStatus('error', `${added.length} added; ${failed[0]}`)
    } else {
      ui.setStatus(running ? 'listening' : 'setup', `${added.length} added`)
    }
  },
  onRemoveDocument(id) {
    documents = documents.filter(document => document.id !== id)
    saveDocuments(documents)
    engine.update(settings, documents)
    ui.renderDocuments(documents)
  },
})

async function start() {
  if (running) return
  running = true
  ui.setStatus('connecting', 'Connecting to G2')
  try {
    glasses ??= await connectGlasses(onAudio, () => {
      running = !running
      ui.setStatus(running ? 'listening' : 'paused', running ? 'Listening' : 'Paused')
    })
    await glasses.setListening(true)
    ui.setStatus('listening', 'Listening')
  } catch (error) {
    running = false
    ui.setStatus('error', 'G2 connection failed')
    ui.setAnswer((error as Error).message)
  }
}

function stop() {
  running = false
  pcmParts = []
  pcmBytes = 0
  glasses?.setListening(false)
  ui.setStatus('paused', 'Paused')
}

function onAudio(pcm: Uint8Array) {
  pcmParts.push(new Uint8Array(pcm))
  pcmBytes += pcm.byteLength
  const targetBytes = Math.round(settings.chunkSeconds * 32_000)
  if (pcmBytes >= targetBytes && !transcriptionBusy) void flushAudio()
}

async function flushAudio() {
  transcriptionBusy = true
  const audio = join(pcmParts, pcmBytes)
  const overlapBytes = Math.min(12_800, audio.byteLength)
  pcmParts = [audio.slice(audio.byteLength - overlapBytes)]
  pcmBytes = overlapBytes
  try {
    const segments = await transcribePcm(audio, settings)
    for (const segment of segments) await engine.accept(segment)
  } catch (error) {
    ui.setStatus('error', 'Transcription error')
    ui.setAnswer((error as Error).message)
    glasses?.setStatus('speech error')
  } finally {
    transcriptionBusy = false
    if (running && pcmBytes >= Math.round(settings.chunkSeconds * 32_000)) void flushAudio()
  }
}

function join(parts: Uint8Array[], length: number) {
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

window.addEventListener('beforeunload', () => glasses?.close())

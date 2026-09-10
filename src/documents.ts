import type { PrepDocument } from './types'

const MAX_DOCUMENT_CHARS = 120_000

export async function readPrepFile(file: File): Promise<PrepDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  let text = ''

  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.mjs',
      import.meta.url,
    ).toString()
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '))
    }
    text = pages.join('\n')
  } else if (extension === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    text = result.value
  } else {
    text = await file.text()
  }

  text = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, MAX_DOCUMENT_CHARS)
  if (!text) throw new Error(`No readable text found in ${file.name}`)

  return {
    id: crypto.randomUUID(),
    name: file.name,
    text,
    addedAt: Date.now(),
  }
}

export function relevantPrepContext(question: string, documents: PrepDocument[]): string {
  const terms = new Set(
    question.toLowerCase().match(/[a-z0-9+#.]{3,}/g)?.filter(term => !STOP_WORDS.has(term)) ?? [],
  )
  const chunks = documents.flatMap(document =>
    document.text
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
      .reduce<string[]>((parts, paragraph) => {
        const last = parts.at(-1)
        if (last && last.length + paragraph.length < 900) parts[parts.length - 1] = `${last} ${paragraph}`
        else if (paragraph.trim()) parts.push(paragraph.trim())
        return parts
      }, [])
      .map(text => ({ source: document.name, text })),
  )

  return chunks
    .map(chunk => ({
      ...chunk,
      score: [...terms].reduce((score, term) => score + (chunk.text.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)
    .slice(0, 5)
    .map(chunk => `[${chunk.source}] ${chunk.text}`)
    .join('\n\n')
    .slice(0, 5_500)
}

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'would', 'could', 'should', 'have', 'with', 'that', 'this',
  'your', 'about', 'from', 'into', 'tell', 'give', 'example', 'please', 'were', 'been', 'they',
])

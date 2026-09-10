import type { AppStatus, PrepDocument, ProviderSettings } from './types'

export type UiActions = {
  onSave: (settings: ProviderSettings) => void
  onStart: () => void
  onStop: () => void
  onFiles: (files: File[]) => void
  onRemoveDocument: (id: string) => void
}

export function mountUi(settings: ProviderSettings, documents: PrepDocument[], actions: UiActions) {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <main class="shell">
      <header class="hero"><div><div class="eyebrow">EVEN G2</div><h1>Interview Copilot</h1></div><span id="status" class="status setup">Setup</span></header>
      <section class="answer-card"><div class="label">Lens answer</div><p id="answer">Ready for your next interview question.</p><div id="question" class="question">No question detected yet.</div></section>
      <section class="controls"><button id="start" class="primary">Start listening</button><button id="stop" disabled>Pause</button></section>
      <details open><summary>Phone cloud connection</summary><div class="preset-row"><button id="openai-preset">Use phone-only OpenAI setup</button><button id="local-preset">Use local/custom setup</button></div><div class="form-grid">
        <label>Speech endpoint<input id="stt-url" value="${escapeHtml(settings.sttBaseUrl)}"></label>
        <label>Speech model<input id="stt-model" value="${escapeHtml(settings.sttModel)}"></label>
        <label>LLM endpoint<input id="llm-url" value="${escapeHtml(settings.llmBaseUrl)}"></label>
        <label>LLM model<input id="llm-model" value="${escapeHtml(settings.llmModel)}"></label>
        <label>API key <span>(optional)</span><input id="api-key" type="password" value="${escapeHtml(settings.apiKey)}" autocomplete="off"></label>
        <label>My speaker ID <span>(optional)</span><input id="candidate-speaker" value="${escapeHtml(settings.candidateSpeaker)}" placeholder="e.g. SPEAKER_01"></label>
        <label>Answer length<select id="sentences"><option value="2" ${settings.answerSentences === 2 ? 'selected' : ''}>2 sentences</option><option value="3" ${settings.answerSentences === 3 ? 'selected' : ''}>3 sentences</option></select></label>
      </div><button id="save">Save settings</button><p class="hint">Phone-only mode uses the phone's cellular data or Wi-Fi—no laptop is needed. An OpenAI API key with billing enabled is required; a ChatGPT subscription alone does not provide API access.</p></details>
      <details open><summary>Resume & prep notes <span id="doc-count">${documents.length}</span></summary>
        <label class="drop">Add PDF, DOCX, TXT, or Markdown<input id="files" type="file" multiple accept=".pdf,.docx,.txt,.md"></label>
        <div id="documents"></div>
      </details>
      <section class="privacy"><strong>Session privacy</strong><span>Audio is sent only to your configured speech endpoint. Documents stay in this app's local storage; only relevant excerpts accompany a detected question.</span></section>
    </main>`
  injectStyles()

  const byId = <T extends HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!
  const readSettings = (): ProviderSettings => ({
    sttBaseUrl: byId<HTMLInputElement>('stt-url').value.trim(),
    sttModel: byId<HTMLInputElement>('stt-model').value.trim(),
    llmBaseUrl: byId<HTMLInputElement>('llm-url').value.trim(),
    llmModel: byId<HTMLInputElement>('llm-model').value.trim(),
    apiKey: byId<HTMLInputElement>('api-key').value.trim(),
    candidateSpeaker: byId<HTMLInputElement>('candidate-speaker').value.trim(),
    answerSentences: Number(byId<HTMLSelectElement>('sentences').value) as 2 | 3,
    chunkSeconds: settings.chunkSeconds,
  })
  byId('save').onclick = () => actions.onSave(readSettings())
  byId('openai-preset').onclick = () => {
    byId<HTMLInputElement>('stt-url').value = 'https://even-interview-copilot.onrender.com/v1'
    byId<HTMLInputElement>('stt-model').value = 'gpt-4o-transcribe-diarize'
    byId<HTMLInputElement>('llm-url').value = 'https://even-interview-copilot.onrender.com/v1'
    byId<HTMLInputElement>('llm-model').value = 'gpt-5.6-luna'
  }
  byId('local-preset').onclick = () => {
    byId<HTMLInputElement>('stt-url').value = 'http://127.0.0.1:8000/v1'
    byId<HTMLInputElement>('stt-model').value = 'Systran/faster-whisper-small.en'
    byId<HTMLInputElement>('llm-url').value = 'http://127.0.0.1:11434/v1'
    byId<HTMLInputElement>('llm-model').value = 'qwen2.5:7b-instruct'
  }
  byId('start').onclick = () => { actions.onSave(readSettings()); actions.onStart() }
  byId('stop').onclick = actions.onStop
  byId<HTMLInputElement>('files').onchange = event => actions.onFiles([...((event.target as HTMLInputElement).files ?? [])])

  const renderDocuments = (docs: PrepDocument[]) => {
    byId('doc-count').textContent = String(docs.length)
    byId('documents').innerHTML = docs.map(doc => `<div class="doc"><span>${escapeHtml(doc.name)}</span><button data-remove="${doc.id}" aria-label="Remove ${escapeHtml(doc.name)}">Remove</button></div>`).join('') || '<p class="hint">No preparation material added yet.</p>'
    document.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(button => {
      button.onclick = () => actions.onRemoveDocument(button.dataset.remove!)
    })
  }
  renderDocuments(documents)

  return {
    readSettings,
    renderDocuments,
    setStatus(kind: AppStatus, text: string) {
      const element = byId('status')
      element.className = `status ${kind}`
      element.textContent = text
      byId<HTMLButtonElement>('start').disabled = ['connecting', 'listening', 'thinking'].includes(kind)
      byId<HTMLButtonElement>('stop').disabled = !['connecting', 'listening', 'thinking'].includes(kind)
    },
    setQuestion(text: string, speaker?: string) {
      byId('question').textContent = `${speaker ? `${speaker} · ` : ''}${text}`
    },
    setAnswer(text: string) { byId('answer').textContent = text },
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
}

function injectStyles() {
  const style = document.createElement('style')
  style.textContent = `
    :root{color-scheme:dark;font:15px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0c100d;color:#edf5ee}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -10%,#234529 0,transparent 35%),#0c100d;min-height:100vh}.shell{width:min(760px,100%);margin:auto;padding:28px 18px 56px}.hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.eyebrow,.label{color:#69ef78;font-size:11px;font-weight:750;letter-spacing:.15em}.hero h1{margin:2px 0;font-size:28px;letter-spacing:-.03em}.status{border:1px solid #3f5142;border-radius:999px;padding:5px 11px;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.status.listening{color:#6dff81;border-color:#42b851}.status.thinking{color:#ffe37b;border-color:#7d7136}.status.error{color:#ff968d;border-color:#8f4540}.answer-card,details,.privacy{background:rgba(25,32,27,.92);border:1px solid #334037;border-radius:16px;padding:18px;margin:12px 0;box-shadow:0 14px 35px rgba(0,0,0,.18)}.answer-card{min-height:190px;border-color:#426249}.answer-card p{font-size:21px;line-height:1.45;margin:14px 0;color:white}.question{padding-top:12px;border-top:1px solid #334037;color:#91a595;font-size:13px}.controls,.preset-row{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin:14px 0}.preset-row{grid-template-columns:1fr 1fr}.preset-row button:first-child{border-color:#58c968;color:#79ee87}button,.drop{border:1px solid #46564a;background:#202a22;color:#edf5ee;border-radius:10px;padding:11px 14px;font-weight:650;cursor:pointer}.primary{background:#5cf071;color:#071509;border-color:#5cf071}button:disabled{opacity:.4;cursor:not-allowed}summary{cursor:pointer;font-weight:720;display:flex;justify-content:space-between}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}label{display:flex;flex-direction:column;gap:5px;color:#cbd8cd;font-size:12px}label span{color:#758678;font-weight:400}input,select{width:100%;background:#0f1511;border:1px solid #3c4b3f;color:#f4fff5;border-radius:8px;padding:10px;font:inherit}.hint{color:#849487;font-size:12px}.drop{margin-top:15px;align-items:center;border-style:dashed}.drop input{border:0;padding:7px;background:transparent}.doc{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #2c382f}.doc button{padding:5px 8px;font-size:11px;background:transparent}.privacy{display:flex;gap:14px;font-size:12px;color:#94a598}.privacy strong{color:#69ef78;white-space:nowrap}@media(max-width:620px){.form-grid,.preset-row{grid-template-columns:1fr}.answer-card p{font-size:18px}.privacy{flex-direction:column;gap:5px}}
  `
  document.head.appendChild(style)
}

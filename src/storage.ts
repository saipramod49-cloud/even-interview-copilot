import { DEFAULT_SETTINGS, type PrepDocument, type ProviderSettings } from './types'

const SETTINGS_KEY = 'interview-copilot:settings:v1'
const DOCS_KEY = 'interview-copilot:documents:v1'

export function loadSettings(): ProviderSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: ProviderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadDocuments(): PrepDocument[] {
  try {
    const value = JSON.parse(localStorage.getItem(DOCS_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function saveDocuments(documents: PrepDocument[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(documents))
}

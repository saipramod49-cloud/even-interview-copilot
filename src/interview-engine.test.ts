import { describe, expect, it } from 'vitest'
import { extractQuestion, formatForGlasses } from './interview-engine'

describe('question detection', () => {
  it('extracts the last question from a transcript chunk', () => {
    expect(extractQuestion('Thanks for joining. Tell me about a difficult project you led.'))
      .toBe('Tell me about a difficult project you led.')
  })

  it('does not treat an ordinary statement as a question', () => {
    expect(extractQuestion('I led the migration and reduced latency by thirty percent.')).toBeNull()
  })
})

describe('lens formatting', () => {
  it('turns emphasized keywords into high-contrast uppercase text', () => {
    expect(formatForGlasses('I used **stakeholder alignment** to deliver it.'))
      .toBe('I used STAKEHOLDER ALIGNMENT to deliver it.')
  })
})

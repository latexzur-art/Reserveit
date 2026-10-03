import { describe, it, expect } from 'vitest'
import { pickChatModel } from '@/app/api/ai/chat/_lib/llm'

const FLASH = 'deepseek/deepseek-v4-flash'

describe('pickChatModel', () => {
  it('defaults to the flash model when no env override is set', () => {
    expect(pickChatModel({}, { emitRound: false })).toBe(FLASH)
    expect(pickChatModel({}, { emitRound: true })).toBe(FLASH)
  })

  it('honours AI_MODEL as the base model for non-critical rounds', () => {
    expect(pickChatModel({ AI_MODEL: 'x/base' }, { emitRound: false })).toBe('x/base')
  })

  it('routes the committing (emit) round to AI_STRONG_MODEL when configured', () => {
    const env = { AI_MODEL: 'x/base', AI_STRONG_MODEL: 'x/strong' }
    expect(pickChatModel(env, { emitRound: true })).toBe('x/strong')
    expect(pickChatModel(env, { emitRound: false })).toBe('x/base')
  })

  it('is a no-op (base model) on the emit round when no strong model is configured', () => {
    expect(pickChatModel({ AI_MODEL: 'x/base' }, { emitRound: true })).toBe('x/base')
  })
})

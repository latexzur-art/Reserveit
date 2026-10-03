import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Composer } from '@/components/ai/chatbot/Composer'

describe('Composer', () => {
  it('sends trimmed text on Enter and clears the input', () => {
    const onSend = vi.fn()
    render(<Composer disabled={false} cooldownTime={0} canBook onSend={onSend} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  book the AVR  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('book the AVR')
    expect(input.value).toBe('')
  })

  it('sends on Send-button click', () => {
    const onSend = vi.fn()
    render(<Composer disabled={false} cooldownTime={0} canBook onSend={onSend} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'what is free friday' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledWith('what is free friday')
  })

  it('does not send while an earlier message is still in flight', () => {
    const onSend = vi.fn()
    render(<Composer disabled cooldownTime={0} canBook onSend={onSend} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows the cooldown countdown and refuses to send', () => {
    const onSend = vi.fn()
    render(<Composer disabled={false} cooldownTime={42} canBook onSend={onSend} />)
    expect(screen.getByRole('button', { name: /wait 42s/i })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })
})

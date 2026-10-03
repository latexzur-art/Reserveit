import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MessageContent } from '@/components/ai/chatbot/MessageContent'

describe('MessageContent Component', () => {
  it('renders standard text with bold and italic inline formatting', () => {
    render(<MessageContent content="Here is **bold text** and *italic text*." />)
    
    expect(screen.getByText('bold text')).toBeInTheDocument()
    expect(screen.getByText('italic text')).toBeInTheDocument()
  })

  it('renders markdown tables as structured HTML tables', () => {
    const markdownTable = `
Here are today's class schedules:

| Time | Course | Section | Instructor | Room |
|---|---|---|---|---|
| 08:00-10:00 | **CITE1004** — Intro to Computing | BSCS1A1 | Jerald Reyes | Room 303 |
| 10:30-12:00 | **GEDC1002** — Contemporary World | BSCS1A1 | Maria Santos | Room 403 |
`

    render(<MessageContent content={markdownTable} />)

    expect(screen.getByText("Here are today's class schedules:")).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('CITE1004')).toBeInTheDocument()
    expect(screen.getByText('Jerald Reyes')).toBeInTheDocument()
  })

  it('blocks javascript: URLs in markdown links', () => {
    render(<MessageContent content="[click here](javascript:alert(1))" />)
    const link = screen.getByText('click here')
    expect(link.closest('a')).toHaveAttribute('href', '#')
  })

  it('allows safe http URLs in markdown links', () => {
    render(<MessageContent content="[visit site](https://example.com)" />)
    const link = screen.getByText('visit site')
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com')
  })

  it('allows safe relative URLs in markdown links', () => {
    render(<MessageContent content="[go to page](/admin/building/settings)" />)
    const link = screen.getByText('go to page')
    expect(link.closest('a')).toHaveAttribute('href', '/admin/building/settings')
  })

  it('blocks data: URLs in markdown links', () => {
    render(<MessageContent content="[click](data:text/html,<script>alert(1)</script>)" />)
    const link = screen.getByText('click')
    expect(link.closest('a')).toHaveAttribute('href', '#')
  })
})

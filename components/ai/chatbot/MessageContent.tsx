"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"

interface MessageContentProps {
  content: string
  className?: string
}

interface TableData {
  headers: string[]
  rows: string[][]
}

type ContentBlock =
  | { type: "text"; content: string }
  | { type: "table"; table: TableData }

/**
 * Parses inline markdown: **bold**, *italics*, and [link text](url).
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return []

  // Tokenize bold (**text**), italics (*text*), and links ([text](url))
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (!part) return null

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={index} className="italic text-slate-300">
          {part.slice(1, -1)}
        </em>
      )
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      const [, linkText, url] = linkMatch
      const safeUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') ? url : '#'
      return (
        <a
          key={index}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline font-medium"
        >
          {linkText}
        </a>
      )
    }

    return <span key={index}>{part}</span>
  })
}

/**
 * Parses raw message text into distinct blocks (text paragraphs vs markdown tables).
 */
function parseMessageBlocks(rawText: string): ContentBlock[] {
  if (!rawText) return []

  const lines = rawText.split("\n")
  const blocks: ContentBlock[] = []
  let currentTextLines: string[] = []
  let inTable = false
  let tableLines: string[] = []

  const isTableLine = (line: string) => {
    const trimmed = line.trim()
    return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|")
  }

  const isSeparatorLine = (line: string) => {
    const trimmed = line.trim()
    return (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      /^\|[\s:-|-]+\|$/.test(trimmed)
    )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isTableLine(line)) {
      if (!inTable) {
        // Flush any preceding text block
        if (currentTextLines.length > 0) {
          const textContent = currentTextLines.join("\n").trim()
          if (textContent) {
            blocks.push({ type: "text", content: textContent })
          }
          currentTextLines = []
        }
        inTable = true
      }
      tableLines.push(line.trim())
    } else {
      if (inTable) {
        // Flush collected table lines
        if (tableLines.length >= 2) {
          const parsedTable = parseTableLines(tableLines)
          if (parsedTable) {
            blocks.push({ type: "table", table: parsedTable })
          } else {
            blocks.push({ type: "text", content: tableLines.join("\n") })
          }
        } else {
          blocks.push({ type: "text", content: tableLines.join("\n") })
        }
        tableLines = []
        inTable = false
      }
      currentTextLines.push(line)
    }
  }

  // Flush remaining blocks
  if (inTable && tableLines.length >= 2) {
    const parsedTable = parseTableLines(tableLines)
    if (parsedTable) {
      blocks.push({ type: "table", table: parsedTable })
    } else {
      blocks.push({ type: "text", content: tableLines.join("\n") })
    }
  } else if (tableLines.length > 0) {
    currentTextLines.push(...tableLines)
  }

  if (currentTextLines.length > 0) {
    const textContent = currentTextLines.join("\n").trim()
    if (textContent) {
      blocks.push({ type: "text", content: textContent })
    }
  }

  return blocks
}

function parseTableLines(lines: string[]): TableData | null {
  if (lines.length < 2) return null

  // Header row
  const headerCells = lines[0]
    .split("|")
    .map((c) => c.trim())
    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)

  if (headerCells.length === 0) return null

  // Data rows (skip separator lines matching |---|---|)
  const dataRows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^\|[\s:-|-]+\|$/.test(line)) continue // separator row

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)

    if (cells.length > 0) {
      dataRows.push(cells)
    }
  }

  return { headers: headerCells, rows: dataRows }
}

export function MessageContent({ content, className }: MessageContentProps) {
  const blocks = useMemo(() => parseMessageBlocks(content), [content])

  return (
    <div className={cn("space-y-3 w-full text-sm leading-relaxed", className)}>
      {blocks.map((block, bIdx) => {
        if (block.type === "text") {
          const lines = block.content.split("\n")
          return (
            <div key={bIdx} className="space-y-1.5 whitespace-pre-wrap">
              {lines.map((line, lIdx) => {
                const trimmed = line.trim()
                if (trimmed.startsWith("---")) {
                  return <hr key={lIdx} className="border-white/10 my-2" />
                }
                if (trimmed.startsWith("### ")) {
                  return (
                    <h3
                      key={lIdx}
                      className="text-sm font-bold text-white tracking-tight mt-2 mb-1"
                    >
                      {parseInlineMarkdown(trimmed.slice(4))}
                    </h3>
                  )
                }
                if (trimmed.startsWith("## ")) {
                  return (
                    <h2
                      key={lIdx}
                      className="text-base font-black text-white tracking-tight mt-2 mb-1"
                    >
                      {parseInlineMarkdown(trimmed.slice(3))}
                    </h2>
                  )
                }
                return (
                  <p key={lIdx} className="min-h-[1.2em]">
                    {parseInlineMarkdown(line)}
                  </p>
                )
              })}
            </div>
          )
        }

        if (block.type === "table") {
          return (
            <div
              key={bIdx}
              className="my-3 overflow-x-auto rounded-xl border border-white/15 bg-slate-900/80 shadow-md scrollbar-thin"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/90 border-b border-white/10 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    {block.table.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2.5 whitespace-nowrap">
                        {parseInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {block.table.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={cn(
                        "transition-colors hover:bg-white/5",
                        rIdx % 2 === 1 ? "bg-white/[0.02]" : "bg-transparent"
                      )}
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2.5 whitespace-nowrap">
                          {parseInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

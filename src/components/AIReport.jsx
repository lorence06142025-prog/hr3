import { Fragment } from 'react'

// Preprocessor to clean glued markdown headings and normalize block spacing
function cleanMarkdown(text = '') {
  if (!text) return ''
  return text
    // Normalize any glued headings onto newlines: e.g. "# Attendance Analysis" or "## Attendance Analysis"
    .replace(/(^|[^\n])\s*(#{1,3})\s*/g, '$1\n\n$2 ')
    // Normalize inline bold list items "1. **Title**:"
    .replace(/(\s+)(\d+\.\s+\*\*)/g, '\n$2')
    .trim()
}

// Render inline Markdown: **bold** -> <strong>, plus fallback for `#text#` or `##text##` style bold.
function renderInline(text) {
  if (!text) return null
  // Strip any accidental leading/trailing stray # or ## symbols from inline title text
  const cleanStr = text.replace(/^#{1,3}\s*/, '').replace(/\s*#{1,3}$/, '')
  const parts = cleanStr.split(/(\*\*[^*]+\*\*|##[^#\n]+##|#[^#\n]+#)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('##') && part.endsWith('##') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2).trim()}</strong>
    }
    if (part.startsWith('#') && part.endsWith('#') && part.length > 2) {
      return <strong key={index}>{part.slice(1, -1).trim()}</strong>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

// Render a block of lines, grouping consecutive `- ` / `* ` / `1. ` lines into a list.
function renderContent(content, keyPrefix) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  const elements = []
  let listItems = []
  let isNumbered = false

  const flushList = key => {
    if (listItems.length) {
      if (isNumbered) {
        elements.push(
          <ol key={key} className="ai-report-ol">
            {listItems.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
          </ol>,
        )
      } else {
        elements.push(
          <ul key={key} className="ai-report-ul">
            {listItems.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
          </ul>,
        )
      }
      listItems = []
      isNumbered = false
    }
  }

  lines.forEach((line, index) => {
    // Strip accidental leading '#' from body lines
    const sanitized = line.replace(/^#{1,3}\s*/, '')
    if (!sanitized || /^#{1,3}$/.test(sanitized)) return

    const bulletMatch = sanitized.match(/^[-*]\s+(.*)$/)
    const numMatch = sanitized.match(/^(\d+)\.\s+(.*)$/)
    if (bulletMatch) {
      if (isNumbered) flushList(`${keyPrefix}-list-${index}`)
      listItems.push(bulletMatch[1])
    } else if (numMatch) {
      if (!isNumbered && listItems.length) flushList(`${keyPrefix}-list-${index}`)
      isNumbered = true
      listItems.push(numMatch[2])
    } else {
      flushList(`${keyPrefix}-list-${index}`)
      elements.push(<p key={`${keyPrefix}-p-${index}`} className="ai-report-paragraph">{renderInline(sanitized)}</p>)
    }
  })
  flushList(`${keyPrefix}-list-end`)

  return elements
}

export default function AIReport({ insights = [], content = '', title = '' }) {
  const source = content?.trim() || insights?.map(insight => insight.summary).join('\n\n') || ''
  const reportTitle = title || ''
  const rawBlocks = cleanMarkdown(source).split(/\n\s*\n/).filter(Boolean)

  return (
    <article className="ai-report" aria-label="AI analytics report">
      {reportTitle && (
        <header className="ai-report-header">
          <h2>{reportTitle}</h2>
        </header>
      )}

      {rawBlocks.length > 0 ? (
        rawBlocks.map((block, blockIndex) => {
          const trimmed = block.trim()
          const key = `b-${blockIndex}`

          // Ignore standalone '#' or '##' artifacts
          if (/^#{1,3}$/.test(trimmed)) return null

          // Check if block is a heading: starts with '#', '##', or '###'
          const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/s)
          if (headingMatch) {
            const rawTitle = headingMatch[2].trim()
            const [firstLine, ...bodyLines] = rawTitle.split('\n')
            const cleanTitle = firstLine.replace(/#{1,3}$/, '').trim()
            const bodyText = bodyLines.join('\n').trim()

            // Skip if cleanTitle is empty or matches reportTitle
            if (!cleanTitle || cleanTitle === reportTitle) {
              return bodyText ? renderContent(bodyText, key) : null
            }

            return (
              <section key={key} className="ai-report-section">
                <h3 className="ai-report-section-title">
                  {renderInline(cleanTitle)}
                </h3>
                {bodyText ? renderContent(bodyText, `${key}-body`) : null}
              </section>
            )
          }

          return (
            <section key={key} className="ai-report-section">
              {renderContent(trimmed, key)}
            </section>
          )
        })
      ) : (
        <div className="insight-empty">
          <b>No report available</b>
          <p>Generate a report to view structured AI analytics.</p>
        </div>
      )}
    </article>
  )
}

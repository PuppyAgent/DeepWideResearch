import { CSSProperties, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

type ComponentsStyle = {
  p?: CSSProperties
  h1?: CSSProperties
  h2?: CSSProperties
  h3?: CSSProperties
  ul?: CSSProperties
  ol?: CSSProperties
  li?: CSSProperties
  link?: CSSProperties
  table?: CSSProperties
  thead?: CSSProperties
  tr?: CSSProperties
  th?: CSSProperties
  td?: CSSProperties
}

export interface MarkdownRendererProps {
  content: string
  componentsStyle?: ComponentsStyle
  onLinkEnter?: (href: string, e: React.MouseEvent) => void
  onLinkLeave?: (e: React.MouseEvent) => void
  onLinkMove?: (href: string, e: React.MouseEvent) => void
}

export default function MarkdownRenderer({
  content,
  componentsStyle,
  onLinkEnter,
  onLinkLeave,
  onLinkMove
}: MarkdownRendererProps) {
  const defaultStyles: ComponentsStyle = {
    p: { margin: '12px 0', lineHeight: '1.6', wordBreak: 'break-word', overflowWrap: 'break-word' },
    h1: { fontSize: '24px', fontWeight: 700, lineHeight: '1.6', margin: '32px 0 16px 0' },
    h2: { fontSize: '20px', fontWeight: 700, lineHeight: '1.6', margin: '24px 0 12px 0' },
    h3: { fontSize: '17px', fontWeight: 600, lineHeight: '1.6', margin: '16px 0 8px 0' },
    ul: { margin: '8px 0', paddingLeft: '20px' },
    ol: { margin: '8px 0', paddingLeft: '20px' },
    li: { margin: '4px 0' },
    link: { color: '#4a90e2', textDecoration: 'underline', textDecorationColor: '#4a90e2', transition: 'all 0.2s ease', cursor: 'pointer', fontWeight: 500, wordBreak: 'break-word', overflowWrap: 'break-word', display: 'inline', maxWidth: '100%' },
    table: { borderCollapse: 'collapse', width: '100%', margin: '12px 0', fontSize: '14px', border: '1px solid #3a3a3a', backgroundColor: '#1a1a1a', borderRadius: '6px', overflow: 'hidden' },
    thead: { backgroundColor: '#2a2a2a' },
    tr: { borderBottom: '1px solid #2a2a2a' },
    th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #3a3a3a', borderRight: '1px solid #3a3a3a', fontWeight: 600, color: '#e0e0e0', backgroundColor: '#2a2a2a' },
    td: { padding: '8px 12px', borderBottom: '1px solid #2a2a2a', borderRight: '1px solid #2a2a2a', color: '#d2d2d2', verticalAlign: 'top' }
  }
  // Ensure citation badge styles exist globally
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('citation-styles')) return
    const style = document.createElement('style')
    style.id = 'citation-styles'
    style.textContent = `
      .citation-reference {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #4a90e2;
        color: #ffffff;
        font-size: 10px;
        font-weight: 600;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        margin: 0 2px;
        vertical-align: middle;
        line-height: 1;
        cursor: pointer;
        transition: none;
        text-decoration: none;
      }
      .citation-reference:hover {}
    `
    document.head.appendChild(style)
  }, [])

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      skipHtml={false}
      components={{
        p: ({ children, ...props }) => (
          <p style={componentsStyle?.p ?? defaultStyles.p} {...props}>{children}</p>
        ),
        h1: ({ ...props }) => (<h1 style={componentsStyle?.h1 ?? defaultStyles.h1} {...props} />),
        h2: ({ ...props }) => (<h2 style={componentsStyle?.h2 ?? defaultStyles.h2} {...props} />),
        h3: ({ ...props }) => (<h3 style={componentsStyle?.h3 ?? defaultStyles.h3} {...props} />),
        ul: ({ ...props }) => (<ul style={componentsStyle?.ul ?? defaultStyles.ul} {...props} />),
        ol: ({ ...props }) => (<ol style={componentsStyle?.ol ?? defaultStyles.ol} {...props} />),
        li: ({ ...props }) => (<li style={componentsStyle?.li ?? defaultStyles.li} {...props} />),
        a: ({ href, children, ...props }) => {
          const text = typeof children === 'string'
            ? children
            : Array.isArray(children) && children.length === 1 && typeof children[0] === 'string'
            ? children[0]
            : null

          const isCitation = !!text && /^\d+$/.test(text.trim())

          if (isCitation) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="citation-reference"
                onMouseEnter={(e) => { if (href && onLinkEnter) onLinkEnter(href, e) }}
                onMouseLeave={(e) => { if (onLinkLeave) onLinkLeave(e) }}
                onMouseMove={(e) => { if (href && onLinkMove) onLinkMove(href, e) }}
                {...props}
              >
                {text}
              </a>
            )
          }

          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={componentsStyle?.link ?? defaultStyles.link}
              onMouseEnter={(e) => { if (href && onLinkEnter) onLinkEnter(href, e) }}
              onMouseLeave={(e) => { if (onLinkLeave) onLinkLeave(e) }}
              onMouseMove={(e) => { if (href && onLinkMove) onLinkMove(href, e) }}
              {...props}
            >
              {children}
            </a>
          )
        },
        table: ({ ...props }) => (<table style={componentsStyle?.table ?? defaultStyles.table} {...props} />),
        thead: ({ ...props }) => (<thead style={componentsStyle?.thead ?? defaultStyles.thead} {...props} />),
        tbody: ({ ...props }) => (<tbody {...props} />),
        tr: ({ ...props }) => (<tr style={componentsStyle?.tr ?? defaultStyles.tr} {...props} />),
        th: ({ ...props }) => (<th style={componentsStyle?.th ?? defaultStyles.th} {...props} />),
        td: ({ ...props }) => (<td style={componentsStyle?.td ?? defaultStyles.td} {...props} />)
      }}
    >
      {content}
    </ReactMarkdown>
  )
}



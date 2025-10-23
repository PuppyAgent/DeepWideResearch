import { CSSProperties } from 'react'
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
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      skipHtml={false}
      components={{
        p: ({ children, ...props }) => (
          <p style={componentsStyle?.p} {...props}>{children}</p>
        ),
        h1: ({ ...props }) => (<h1 style={componentsStyle?.h1} {...props} />),
        h2: ({ ...props }) => (<h2 style={componentsStyle?.h2} {...props} />),
        h3: ({ ...props }) => (<h3 style={componentsStyle?.h3} {...props} />),
        ul: ({ ...props }) => (<ul style={componentsStyle?.ul} {...props} />),
        ol: ({ ...props }) => (<ol style={componentsStyle?.ol} {...props} />),
        li: ({ ...props }) => (<li style={componentsStyle?.li} {...props} />),
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={componentsStyle?.link}
            onMouseEnter={(e) => { if (href && onLinkEnter) onLinkEnter(href, e) }}
            onMouseLeave={(e) => { if (onLinkLeave) onLinkLeave(e) }}
            onMouseMove={(e) => { if (href && onLinkMove) onLinkMove(href, e) }}
            {...props}
          >
            {children}
          </a>
        ),
        table: ({ ...props }) => (<table style={componentsStyle?.table} {...props} />),
        thead: ({ ...props }) => (<thead style={componentsStyle?.thead} {...props} />),
        tbody: ({ ...props }) => (<tbody {...props} />),
        tr: ({ ...props }) => (<tr style={componentsStyle?.tr} {...props} />),
        th: ({ ...props }) => (<th style={componentsStyle?.th} {...props} />),
        td: ({ ...props }) => (<td style={componentsStyle?.td} {...props} />)
      }}
    >
      {content}
    </ReactMarkdown>
  )
}



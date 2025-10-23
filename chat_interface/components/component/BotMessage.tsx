import { Copy, Check } from 'lucide-react'
import { CSSProperties, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../types'

const StyleManager = {
  injected: new Set<string>(),
  inject(id: string, css: string) {
    if (typeof document === 'undefined') return
    if (this.injected.has(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.head.appendChild(style)
    this.injected.add(id)
  }
}

export interface BotMessageProps {
  message: Message
  showAvatar?: boolean
  isTyping?: boolean
  streamingStatus?: string  // For status updates like "thinking", "using tools", etc.
  streamingHistory?: string[] // 📜 完整的状态历史记录
  isStreaming?: boolean      // For report content streaming
}

export default function BotMessage({ message, showAvatar = true, isTyping = false, streamingStatus, streamingHistory = [], isStreaming = false }: BotMessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    StyleManager.inject('puppychat-animations', `
      @keyframes pulse {
        0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
        40% { transform: scale(1); opacity: 1; }
      }
      @keyframes textFlash {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
      }
      @keyframes fadeInOut {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }
    `)
    
    // Inject citation styles
    StyleManager.inject('citation-styles', `
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
        transition: all 0.2s ease;
      }
      .citation-reference:hover {
        background: #5aa0f2;
        color: #ffffff;
        transform: scale(1.1);
      }
    `)
  }, [])

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message.content)
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea')
        textarea.value = message.content
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const styles: { [key: string]: CSSProperties } = {
    container: { 
      display: 'flex', 
      flexDirection: 'column',  // 改为垂直布局
      alignItems: 'flex-start', 
      gap: '0px', 
      width: '100%'
    },
    messageWrapper: { 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'flex-start', 
      width: '100%', 
      minWidth: 0,
      padding: '12px 16px',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.05)'  // 非常浅的边框，几乎看不见
    },
    content: { fontSize: '16px', color: '#d2d2d2', whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0, textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'break-word', width: '100%' },
    h1: { fontSize: '20px', fontWeight: 700, lineHeight: '1.6', margin: '0 0 6px 0' },
    h2: { fontSize: '18px', fontWeight: 700, lineHeight: '1.6', margin: '0 0 4px 0' },
    h3: { fontSize: '17px', fontWeight: 600, lineHeight: '1.6', margin: '0 0 3px 0' },
    link: {
      color: '#4a90e2',
      textDecoration: 'underline',
      textDecorationColor: '#4a90e2',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      fontWeight: 500,
      wordBreak: 'break-word' as const,
      overflowWrap: 'break-word' as const,
      display: 'inline',
      maxWidth: '100%'
    },
    table: { 
      borderCollapse: 'collapse', 
      width: '100%', 
      margin: '12px 0', 
      fontSize: '14px', 
      border: '1px solid #3a3a3a',
      backgroundColor: '#1a1a1a',
      borderRadius: '6px',
      overflow: 'hidden'
    },
    thead: { backgroundColor: '#2a2a2a' },
    th: { 
      padding: '10px 12px', 
      textAlign: 'left', 
      borderBottom: '2px solid #3a3a3a', 
      borderRight: '1px solid #3a3a3a',
      fontWeight: 600, 
      color: '#e0e0e0',
      backgroundColor: '#2a2a2a'
    },
    td: { 
      padding: '8px 12px', 
      borderBottom: '1px solid #2a2a2a', 
      borderRight: '1px solid #2a2a2a',
      color: '#d2d2d2',
      verticalAlign: 'top'
    },
    tr: { 
      borderBottom: '1px solid #2a2a2a'
    },
    metaBar: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px', 
      marginTop: '6px',  // 在消息框下方留一点间距
      marginLeft: '4px',  // 稍微缩进对齐
      opacity: isHovered ? 0.6 : 0, 
      transition: 'opacity 0.2s ease', 
      justifyContent: 'flex-start' 
    },
    timestamp: { fontSize: '14px', color: '#a0a0a0' },
    copyButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', color: '#a0a0a0', cursor: 'pointer' },
    typingDots: { display: 'flex', alignItems: 'center', gap: '8px', height: '20px' },
    dot: { width: '8px', height: '8px', backgroundColor: '#4a90e2', borderRadius: '50%', animation: 'pulse 1s infinite' },
    statusStreaming: { 
      fontSize: '14px', 
      color: 'transparent',
      marginBottom: '8px',
      padding: 0,
      background: 'linear-gradient(90deg, #444 0%, #444 30%, #ddd 50%, #444 70%, #444 100%)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      backgroundSize: '200% 100%',
      animation: 'textFlash 2s linear infinite',
      transition: 'opacity 0.3s ease-in-out'
    },
    reportStreaming: {
      fontSize: '16px',
      color: '#d2d2d2',
      lineHeight: '1.6',
      whiteSpace: 'pre-wrap',
      transition: 'opacity 0.3s ease-in-out',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      width: '100%'
    }
  }

  return (
    <div 
      style={styles.container}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.messageWrapper}>
        {isTyping ? (
          <div style={styles.typingDots}>
            <div style={{ ...styles.dot, animationDelay: '0s' }}></div>
            <div style={{ ...styles.dot, animationDelay: '0.3s' }}></div>
            <div style={{ ...styles.dot, animationDelay: '0.6s' }}></div>
          </div>
        ) : (
          <>
            {/* 📜 历史步骤记录 - 时间线样式 */}
            {streamingHistory && streamingHistory.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px', width: '100%' }}>
                {streamingHistory.map((step, index) => {
                  // 如果不是streaming状态，所有步骤都是已完成的
                  const isCurrentStep = isStreaming && index === streamingHistory.length - 1
                  const isCompleted = !isCurrentStep
                  const isLastItem = index === streamingHistory.length - 1
                  
                  return (
                    <div 
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        position: 'relative'
                      }}
                    >
                      {/* 左侧时间线容器 */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        paddingTop: '5px'
                      }}>
                        {/* 圆点 */}
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: isCompleted ? '#888' : 'transparent', // 实心灰色 vs 空心灰色
                          border: isCompleted ? 'none' : '2px solid #888',
                          flexShrink: 0,
                          zIndex: 1
                        }} />
                        
                        {/* 连接线 - 除了最后一项都显示 */}
                        {!isLastItem && (
                          <div style={{
                            width: '2px',
                            height: '20px',
                            backgroundColor: '#666',
                            opacity: 0.4,
                            marginTop: '2px'
                          }} />
                        )}
                      </div>
                      
                      {/* 步骤文本 */}
                      <div
                        style={{
                          fontSize: '14px',
                          color: 'transparent',
                          padding: 0,
                          backgroundImage: isCompleted
                            ? 'linear-gradient(90deg, #999 0%, #999 100%)' // 已完成：静态浅灰色
                            : 'linear-gradient(90deg, #888 0%, #888 30%, #fff 50%, #888 70%, #888 100%)', // 进行中：滚动渐变
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          backgroundSize: isCompleted ? '100% 100%' : '200% 100%',
                          animation: isCompleted ? 'none' : 'textFlash 2s linear infinite',
                          transition: 'opacity 0.3s ease-in-out',
                          opacity: isCompleted ? 0.8 : 1,
                          lineHeight: '1.6',
                          flex: 1
                        }}
                      >
                        {step}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            
            {/* Message content - with or without report streaming */}
            {/* Show content when: 
                1. No streaming status (normal message)
                2. Content is different from the last history item (avoid duplication)
                3. Streaming report content (longer content indicates it's a report, not a status message)
            */}
            {message.content && (
              // Don't show if it's the same as the last history item (avoid duplication)
              streamingHistory.length === 0 || 
              message.content !== streamingHistory[streamingHistory.length - 1] ||
              message.content.length > 100  // If content is long, it's likely a report
            ) && (
              <div style={isStreaming ? styles.reportStreaming : styles.content}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml={false}
                  components={{
                  p: ({ children, ...props }) => {
                    // Skip empty paragraphs
                    if (!children || (typeof children === 'string' && children.trim() === '')) {
                      return null
                    }
                    
                    // Process children to enhance citation references
                    const processChildren = (child: React.ReactNode): React.ReactNode => {
                      if (typeof child === 'string') {
                        const parts = child.split(/(\[\d+\])/g)
                        return parts.map((part, i) => {
                          const match = part.match(/^\[(\d+)\]$/)
                          if (match) {
                            return <span key={i} className="citation-reference">{match[1]}</span>
                          }
                          return part
                        })
                      }
                      return child
                    }
                    
                    const enhancedChildren = Array.isArray(children) 
                      ? children.map(processChildren)
                      : processChildren(children)
                    
                    return <p style={{ margin: '4px 0', lineHeight: '1.6', wordBreak: 'break-word', overflowWrap: 'break-word' }} {...props}>{enhancedChildren}</p>
                  },
                  h1: ({ ...props }) => (<div role="heading" aria-level={1} style={styles.h1} {...props} />),
                  h2: ({ ...props }) => (<div role="heading" aria-level={2} style={styles.h2} {...props} />),
                  h3: ({ ...props }) => (<div role="heading" aria-level={3} style={styles.h3} {...props} />),
                  ul: ({ ...props }) => (<ul style={{ margin: '4px 0', paddingLeft: '20px' }} {...props} />),
                  ol: ({ ...props }) => (<ol style={{ margin: '4px 0', paddingLeft: '20px' }} {...props} />),
                  li: ({ ...props }) => (<li style={{ margin: '2px 0' }} {...props} />),
                  br: () => null,  // 忽略单独的 <br> 标签，避免额外空行
                  a: ({ href, children, ...props }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                  table: ({ ...props }) => (<table style={styles.table} {...props} />),
                  thead: ({ ...props }) => (<thead style={styles.thead} {...props} />),
                  tbody: ({ ...props }) => (<tbody {...props} />),
                  tr: ({ ...props }) => (<tr style={styles.tr} {...props} />),
                  th: ({ ...props }) => (<th style={styles.th} {...props} />),
                  td: ({ ...props }) => (<td style={styles.td} {...props} />)
                }}
              >
                {message.content}
              </ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>

      {/* Meta bar - 时间戳和复制按钮显示在消息框外面 */}
      {!isTyping && (
        <div style={styles.metaBar}>
          <div style={styles.timestamp}>
            {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={styles.copyButton} title={copied ? 'Copied' : 'Copy message'} onClick={handleCopy}>
            {copied ? (
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check style={{ width: '12px', height: '12px', color: '#000000' }} />
              </div>
            ) : (
              <Copy style={{ width: '14px', height: '14px' }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

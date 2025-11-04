import { Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Message, SourceItem } from '../types'

// Runtime CSS injection removed; animations and tooltip styles live in globals.css

export type ActionStepStatus = 'pending' | 'running' | 'completed' | 'error'

export interface ActionStep {
  id?: string
  text: string
  status?: ActionStepStatus
}

export interface BotMessageProps {
  message: Message
  actionSteps?: ActionStep[]
}

export default function BotMessage({ message, actionSteps }: BotMessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hoveredUrl, setHoveredUrl] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  // Add global mouse move listener to detect when mouse leaves link areas
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!hoveredUrl) return
      
      // Check if mouse is over any link element
      const target = e.target as HTMLElement
      const isOverLink = target.tagName === 'A' || target.closest('a')
      
      if (!isOverLink) {
        setHoveredUrl(null)
      }
    }
    
    document.addEventListener('mousemove', handleGlobalMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [hoveredUrl])

  // No-op: CSS is provided via globals.css

  const handleCopy = async () => {
    try {
      const copyPayload = message.content || ''
      if (!copyPayload) return
      await navigator.clipboard.writeText(copyPayload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const handleLinkHover = (url: string, event: React.MouseEvent) => {
    setHoveredUrl(url)
    // Position tooltip relative to the link element
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    // Position below the link with some offset
    const x = rect.left
    const y = rect.bottom + 8
    setTooltipPosition({ x, y })
  }

  const handleLinkLeave = () => {
    setHoveredUrl(null)
  }

  // Extract domain from URL for favicon
  const getFaviconUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
    } catch {
      return null
    }
  }

// styles object removed; inline styles are used directly below

  // 极简：仅使用显式 props
  const resolvedActionSteps: ActionStep[] = Array.isArray(actionSteps) ? actionSteps : []
  const contentToRender = message.content || ''
  const shouldShowContent = contentToRender.length > 0
  const sources: SourceItem[] = Array.isArray(message.sources) ? message.sources : []
  const stepsBefore: ActionStep[] = resolvedActionSteps.length > 1 ? resolvedActionSteps.slice(0, -1) : []
  const lastStep: ActionStep | null = resolvedActionSteps.length > 0 ? resolvedActionSteps[resolvedActionSteps.length - 1] : null

  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0px', width: '100%' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', minWidth: 0, padding: '16px 20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <>
            {/* 📜 执行步骤记录 - 时间线样式 */}
            {stepsBefore.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px', width: '100%' }}>
                {stepsBefore.map((step, index) => {
                  const isLastItem = index === resolvedActionSteps.length - 1
                  const status: ActionStepStatus | undefined = step.status
                  const isCompleted = status === 'completed'
                  const isRunning = status === 'running'
                  const isPending = status === 'pending'
                  const isError = status === 'error'
                  return (
                    <div 
                      key={step.id ?? `action-step-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
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
                        paddingTop: '7px'
                      }}>
                        {/* 圆点 */}
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: isCompleted ? '#888' : (isError ? 'rgba(255, 107, 107, 0.35)' : 'transparent'), // 实心灰色 vs 空心灰色
                          border: isCompleted ? 'none' : (isError ? '2px solid #ff6b6b' : (isRunning ? '2px solid #888' : '2px solid #888')),
                          flexShrink: 0,
                          zIndex: 1,
                          animation: isRunning ? 'breathe 2s ease-in-out infinite' : 'none',
                          transformOrigin: 'center'
                        }} />
                        
                        {/* 连接线 - 除了最后一项都显示 */}
                        {!isLastItem && (
                          <div style={{
                            width: '2px',
                            height: '16px',
                            backgroundColor: '#666',
                            opacity: 0.4,
                            marginTop: '6px'
                          }} />
                        )}
                      </div>
                      
                      {/* 步骤文本 */}
                      <div
                        style={{
                          fontSize: '14px',
                          color: 'transparent',
                          WebkitTextFillColor: 'transparent',
                          padding: 0,
                          backgroundImage: isError
                            ? 'linear-gradient(90deg, #ff7b7b 0%, #ff9b9b 100%)'
                            : isCompleted
                              ? 'linear-gradient(90deg, #999 0%, #999 100%)'
                              : 'linear-gradient(90deg, #888 0%, #888 48%, #fff 50%, #888 52%, #888 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          backgroundSize: isRunning ? '200% 100%' : '100% 100%',
                          animation: isRunning ? 'textFlash 2s linear infinite' : 'none',
                          transition: 'opacity 0.3s ease-in-out',
                          opacity: isCompleted ? 0.8 : (isPending ? 0.7 : 1),
                          lineHeight: '1.6',
                          flex: 1
                        }}
                      >
                        {step.text}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {/* 🔗 信息源卡片 - 简洁卡片样式（favicon + url preview + service + query） */}
            {sources.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '10px',
                  width: '100%',
                  marginBottom: '12px'
                }}
              >
                {sources.map((src, idx) => {
                  let domain = ''
                  try {
                    const u = new URL(src.url)
                    domain = u.hostname.replace(/^www\./, '')
                  } catch {}
                  const favicon = getFaviconUrl(src.url)
                  const mcpLogo = (() => {
                    const s = (src.service || '').toLowerCase()
                    if (s === 'tavily') return '/tavilylogo.png'
                    if (s === 'exa') return '/exalogo.png'
                    return ''
                  })()
                  const queryPreview = (src.query || '').slice(0, 80)
                  const isCardHovered = hoveredUrl === src.url
                  return (
                    <a
                      key={`${src.url}-${idx}`}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      onMouseEnter={(e) => handleLinkHover(src.url, e)}
                      onMouseLeave={(e) => { e.stopPropagation(); handleLinkLeave() }}
                      style={{ textDecoration: 'none', width: '100%', display: 'block', minWidth: 0, overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          padding: '12px',
                          border: `1px solid ${isCardHovered ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.12)'}`,
                          background: isCardHovered ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.02)',
                          borderRadius: '12px',
                          transition: 'border-color 0.15s ease, background-color 0.15s ease',
                          minWidth: 0,
                          overflow: 'hidden'
                        }}
                      >
                        {/* Top row: favicon + domain */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, width: '100%' }}>
                          {favicon && (
                            <img
                              src={favicon}
                              alt="favicon"
                              style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, opacity: 0.9 }}
                            />
                          )}
                          <div style={{ fontSize: '14px', color: '#d2d2d2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', flex: 1 }}>
                            {domain || src.url}
                          </div>
                        </div>

                        {/* Bottom bar: left = "query" (lighter, italic) | right = MCP logo */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, minWidth: 0, width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            {queryPreview && (
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic', maxWidth: '100%' }}>
                                {`"${queryPreview}"`}
                              </span>
                            )}
                          </div>
                          {mcpLogo && (
                            <img
                              src={mcpLogo}
                              alt={`${src.service} logo`}
                              style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, opacity: 0.95 }}
                            />
                          )}
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}

            {/* 📌 最新进度（单行） - 放在信息源网格下方 */}
            {lastStep && (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px', marginBottom: '12px', width: '100%' }}>
                {(() => {
                  const status: ActionStepStatus | undefined = lastStep.status
                  const isCompleted = status === 'completed'
                  const isRunning = status === 'running'
                  const isPending = status === 'pending'
                  const isError = status === 'error'
                  return (
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        position: 'relative'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        paddingTop: '7px'
                      }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: isCompleted ? '#888' : (isError ? 'rgba(255, 107, 107, 0.35)' : 'transparent'),
                          border: isCompleted ? 'none' : (isError ? '2px solid #ff6b6b' : (isRunning ? '2px solid #888' : '2px solid #888')),
                          flexShrink: 0,
                          zIndex: 1,
                          animation: isRunning ? 'breathe 2s ease-in-out infinite' : 'none',
                          transformOrigin: 'center'
                        }} />
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          color: 'transparent',
                          WebkitTextFillColor: 'transparent',
                          padding: 0,
                          backgroundImage: isError
                            ? 'linear-gradient(90deg, #ff7b7b 0%, #ff9b9b 100%)'
                            : isCompleted
                              ? 'linear-gradient(90deg, #999 0%, #999 100%)'
                              : 'linear-gradient(90deg, #888 0%, #888 48%, #fff 50%, #888 52%, #888 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          backgroundSize: isRunning ? '200% 100%' : '100% 100%',
                          animation: isRunning ? 'textFlash 2s linear infinite' : 'none',
                          transition: 'opacity 0.3s ease-in-out',
                          opacity: isCompleted ? 0.8 : (isPending ? 0.7 : 1),
                          lineHeight: '1.6',
                          flex: 1
                        }}
                      >
                        {lastStep.text}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
            
            {/* Message content */}
            {shouldShowContent && (
              <div style={{ fontSize: '16px', color: '#d2d2d2', whiteSpace: 'normal', lineHeight: '1.6', margin: 0, textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'break-word', width: '100%' }}>
                <MarkdownRenderer
                  content={(contentToRender || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')}
                  onLinkEnter={(href, e) => { e.stopPropagation(); handleLinkHover(href, e) }}
                  onLinkLeave={(e) => { e.stopPropagation(); handleLinkLeave() }}
                  onLinkMove={(href, e) => {
                    if (hoveredUrl && href) {
                      const target = e.currentTarget as HTMLElement
                      const rect = target.getBoundingClientRect()
                      const x = rect.left
                      const y = rect.bottom + 8
                      setTooltipPosition({ x, y })
                    }
                  }}
                />
              </div>
            )}

          </>
      </div>

      {/* Meta bar - 时间戳和复制按钮显示在消息框外面 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', marginLeft: '4px', opacity: isHovered ? 0.6 : 0, transition: 'opacity 0.2s ease', justifyContent: 'flex-start' }}>
        <div style={{ fontSize: '14px', color: '#a0a0a0' }}>
          {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', color: '#a0a0a0', cursor: 'pointer' }} title={copied ? 'Copied' : 'Copy message'} onClick={handleCopy}>
          {copied ? (
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check style={{ width: '12px', height: '12px', color: '#000000' }} />
            </div>
          ) : (
            <Copy style={{ width: '14px', height: '14px' }} />
          )}
        </div>
      </div>

      {/* Link Tooltip */}
      {hoveredUrl && (
        <div
          className="link-tooltip"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
          }}
        >
          {getFaviconUrl(hoveredUrl) && (
            <img 
              src={getFaviconUrl(hoveredUrl) || ''} 
              alt="favicon"
              className="favicon"
            />
          )}
          <div className="url-text">{hoveredUrl}</div>
        </div>
      )}
    </div>
  )
}

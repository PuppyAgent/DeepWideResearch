'use client'

import React from 'react'
import MCPBar, { type McpConfigValue } from './MCPBar'

export interface NewChatLandingProps {
  researchParams: { deep: number; wide: number }
  onResearchParamsChange: (value: { deep: number; wide: number }) => void
  mcpConfig: McpConfigValue
  onMcpConfigChange: (value: McpConfigValue) => void
  placeholder?: string
  disabled?: boolean
  onSendMessage?: (message: string, onStreamUpdate?: (content: string, isStreaming?: boolean, statusHistory?: string[]) => void) => Promise<string> | string
  externalIsTyping?: boolean
  externalIsStreaming?: boolean
  messagesMaxWidth?: number | string
}

export default function NewChatLanding({
  researchParams,
  onResearchParamsChange,
  mcpConfig,
  onMcpConfigChange,
  placeholder = 'Ask anything about your research topic...',
  disabled = false,
  onSendMessage,
  externalIsTyping,
  externalIsStreaming,
  messagesMaxWidth = '900px'
}: NewChatLandingProps) {
  const [inputValue, setInputValue] = React.useState('')
  const [isFocused, setIsFocused] = React.useState(false)
  const [logoEntered, setLogoEntered] = React.useState(false)
  const fullBrandText = 'Open Deep Wide Research'
  const [brandTextDisplayed, setBrandTextDisplayed] = React.useState('')
  const [isDeepWideHover, setIsDeepWideHover] = React.useState(false)
  const deepBlocksRef = React.useRef<HTMLSpanElement>(null)
  const wideBlocksRef = React.useRef<HTMLSpanElement>(null)

  const isBusy = !!externalIsTyping || !!externalIsStreaming

  const handleSend = async () => {
    if (!inputValue.trim() || disabled || !onSendMessage) return
    const current = inputValue
    setInputValue('')
    await onSendMessage(current)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  React.useEffect(() => {
    // Animate logo slide-in and brand text typing on mount
    setLogoEntered(false)
    setBrandTextDisplayed('')

    const enterTimer = setTimeout(() => {
      setLogoEntered(true)
    }, 0)

    let index = 0
    const typingSpeedMs = 18
    const typeTimer = setInterval(() => {
      if (index < fullBrandText.length) {
        setBrandTextDisplayed(fullBrandText.slice(0, index + 1))
        index += 1
      } else {
        clearInterval(typeTimer)
      }
    }, typingSpeedMs)

    return () => {
      clearTimeout(enterTimer)
      clearInterval(typeTimer)
    }
  }, [])

  const BAR_LEN = 12
  const STEPS = 4
  const makeBarLine = (label: 'Deep' | 'Wide', v: number) => {
    const filled = Math.round(v * BAR_LEN)
    const empty = Math.max(0, BAR_LEN - filled)
    return `${label.toUpperCase()}: ${'█'.repeat(filled)}${'░'.repeat(empty)} ${Math.round(v * 100)}%`
  }

  const makeBlocks = (v: number) => {
    const filled = Math.round(v * BAR_LEN)
    const empty = Math.max(0, BAR_LEN - filled)
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{ width: '100%', maxWidth: messagesMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Brand header */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom:"48px",
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#e5e5e5', whiteSpace: 'pre' }}>{brandTextDisplayed}</div>
            <img 
              src="/SimpleDWlogo.svg" 
              alt="Deep Wide Research" 
              width={48} 
              height={48} 
              style={{ 
                opacity: logoEntered ? 0.95 : 0,
                transform: logoEntered ? 'translateX(0)' : 'translateX(32px)',
                transition: 'transform 0.35s ease-out, opacity 0.35s ease-out'
              }} 
            />
          </div>
          {/* Settings row (MCP only) */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px',
            marginRight:"90px",
            marginLeft:"90px",
            paddingLeft: '32px',
            paddingRight: '32px'
          }}>
            <MCPBar value={mcpConfig} onChange={onMcpConfigChange} />
          </div>

          {/* Centered search-style input */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            border: isFocused ? '2px solid #4a90e2' : '2px solid #3a3a3a',
            borderRadius: '32px',
            paddingLeft:"16px",
            paddingRight:"16px",
            paddingBottom:"16px",
            paddingTop:"8px",
            backgroundColor: '#2a2a2a',
            boxShadow: isFocused
              ? 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06), 0 0 0 2px rgba(74, 144, 226, 0.15)'
              : 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease',
            width: '100%',
            maxWidth: '720px',
            margin: '0 auto'
          }}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              style={{
                flex: 1,
                height: 'auto',
                padding: '8px',
                resize: 'none',
                outline: 'none',
                fontSize: '16px',
                lineHeight: '1.5',
                fontFamily: 'inherit',
                backgroundColor: 'transparent',
                color: '#e5e5e5',
                border: 'none',
                minHeight: '72px',
                boxSizing: 'border-box',
                maxHeight: '200px',
                overflowY: 'auto'
              }}
              rows={1}
              className="puppychat-textarea"
            />
            {/* Controls row: Deep/Wide bars (left) + Send button (right) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                data-deepwide-inline-trigger
                onMouseEnter={() => setIsDeepWideHover(true)}
                onMouseLeave={() => setIsDeepWideHover(false)}
                style={{ fontSize: '12px', color: isDeepWideHover ? '#e5e5e5' : '#888', fontFamily: 'inherit, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', lineHeight: '1.5', whiteSpace: 'pre', cursor: 'pointer', userSelect: 'none', transition: 'color 150ms ease' }}
                title="Adjust Deep × Wide"
              >
                <div
                  onClick={(e) => {
                    const targetSpan = deepBlocksRef.current
                    if (!targetSpan) return
                    const barRect = targetSpan.getBoundingClientRect()
                    let xWithin = e.clientX - barRect.left
                    xWithin = Math.max(0, Math.min(barRect.width - 1, xWithin))
                    const bucketPx = barRect.width / STEPS
                    const stepIndex = Math.floor(xWithin / bucketPx)
                    const next = (stepIndex + 1) / STEPS
                    onResearchParamsChange({ deep: next, wide: researchParams.wide })
                  }}
                >
                  <span style={{ fontFamily: 'inherit', fontWeight: 700 }}>DEEP:</span>
                  <span style={{ margin: '0 6px' }} />
                  <span ref={deepBlocksRef} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                    {makeBlocks(researchParams.deep)}
                  </span>
                  <span style={{ fontFamily: 'inherit' }}> {Math.round(researchParams.deep * 100)}%</span>
                </div>
                <div
                  style={{ marginTop: '1px' }}
                  onClick={(e) => {
                    const targetSpan = wideBlocksRef.current
                    if (!targetSpan) return
                    const barRect = targetSpan.getBoundingClientRect()
                    let xWithin = e.clientX - barRect.left
                    xWithin = Math.max(0, Math.min(barRect.width - 1, xWithin))
                    const bucketPx = barRect.width / STEPS
                    const stepIndex = Math.floor(xWithin / bucketPx)
                    const next = (stepIndex + 1) / STEPS
                    onResearchParamsChange({ deep: researchParams.deep, wide: next })
                  }}
                >
                  <span style={{ fontFamily: 'inherit', fontWeight: 700 }}>WIDE:</span>
                  <span style={{ margin: '0 6px' }} />
                  <span ref={wideBlocksRef} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                    {makeBlocks(researchParams.wide)}
                  </span>
                  <span style={{ fontFamily: 'inherit' }}> {Math.round(researchParams.wide * 100)}%</span>
                </div>
              </div>
              <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isBusy || disabled}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                flexShrink: 0,
                backgroundColor: inputValue.trim() && !isBusy ? '#4a90e2' : '#3a3a3a',
                color: '#ffffff',
                boxShadow: inputValue.trim() && !isBusy ? '0 4px 12px rgba(74, 144, 226, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
                opacity: !inputValue.trim() || isBusy ? 0.3 : 1
              }}
            >
              {isBusy ? (
                <svg className="puppychat-spin" style={{ height: '24px', width: '24px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg style={{ width: '24px', height: '20px' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4L12 16M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              )}
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



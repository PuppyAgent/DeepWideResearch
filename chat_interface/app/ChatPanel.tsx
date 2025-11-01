'use client'

import React from 'react'
import ChatInterface, { type ChatInterfaceProps } from '../components/component/ChatInterface'
import DeepWideButton from './DeepWideButton'
import MCPBar, { type McpConfigValue } from './MCPBar'
import NewChatLanding from './NewChatLanding'

export interface ChatPanelProps extends Omit<ChatInterfaceProps, 'variant' | 'aboveInput'> {
  researchParams: { deep: number; wide: number }
  onResearchParamsChange: (value: { deep: number; wide: number }) => void
  mcpConfig: McpConfigValue
  onMcpConfigChange: (value: McpConfigValue) => void
}

export default function ChatPanel({
  researchParams,
  onResearchParamsChange,
  mcpConfig,
  onMcpConfigChange,
  style,
  messagesMaxWidth = '900px',
  placeholder = 'Type your message...',
  disabled = false,
  onSendMessage,
  ...chatProps
}: ChatPanelProps) {
  const [inputValue, setInputValue] = React.useState('')
  const [isFocused, setIsFocused] = React.useState(false)
  const [isTyping, setIsTyping] = React.useState(false)
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [streamingStatus, setStreamingStatus] = React.useState('')
  const [streamingHistory, setStreamingHistory] = React.useState<string[]>([])
  const [hasSentFirstMessage, setHasSentFirstMessage] = React.useState(false)

  const handleSend = async () => {
    if (!inputValue.trim() || disabled || !onSendMessage) return
    const current = inputValue
    setInputValue('')
    setIsTyping(true)
    // Show immediate placeholder while waiting for first chunk
    setIsStreaming(true)
    setStreamingStatus('Connecting…')
    setStreamingHistory([])
    if (!hasSentFirstMessage) setHasSentFirstMessage(true)
    try {
      await onSendMessage(current, (content: string, streaming: boolean = true, statusHistory?: string[]) => {
        if (streaming) {
          setIsTyping(false)
          setIsStreaming(true)
          setStreamingStatus(content || '')
          if (statusHistory) setStreamingHistory(statusHistory)
        } else {
          setIsStreaming(false)
          setStreamingStatus(content || '')
          if (statusHistory) setStreamingHistory(statusHistory)
        }
      })
    } finally {
      setIsTyping(false)
      setIsStreaming(false)
      setStreamingStatus('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const inputStyles = {
    container: {
      padding: '20px 8px',
      borderBottomLeftRadius: '16px',
      borderBottomRightRadius: '16px',
      backgroundColor: 'transparent'
    },
    inner: {
      width: '100%',
      maxWidth: messagesMaxWidth,
      margin: '0 auto'
    },
    wrapper: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '12px',
      border: isFocused ? '2px solid #4a90e2' : '2px solid #3a3a3a',
      borderRadius: '20px',
      padding: '8px',
      backgroundColor: '#2a2a2a',
      boxShadow: isFocused 
        ? 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06), 0 0 0 2px rgba(74, 144, 226, 0.15)' 
        : 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      transition: 'all 0.3s ease'
    },
    textarea: {
      flex: 1,
      height: 'auto',
      padding: '8px',
      resize: 'none' as const,
      outline: 'none',
      fontSize: '16px',
      lineHeight: '1.5',
      fontFamily: 'inherit',
      backgroundColor: 'transparent',
      color: '#e5e5e5',
      border: 'none',
      minHeight: '40px',
      boxSizing: 'border-box' as const,
      maxHeight: '200px',
      overflowY: 'auto' as const
    },
    sendButton: {
      width: '40px',
      height: '40px',
      borderRadius: '12px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      flexShrink: 0
    }
  }

  const isNewChat = !chatProps.initialMessages || chatProps.initialMessages.length === 0
  const showNewChatLanding = isNewChat && !hasSentFirstMessage

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', ...(style || {}) }}>
      {showNewChatLanding ? (
        <NewChatLanding
          researchParams={researchParams}
          onResearchParamsChange={onResearchParamsChange}
          mcpConfig={mcpConfig}
          onMcpConfigChange={onMcpConfigChange}
          placeholder={placeholder}
          disabled={disabled}
          onSendMessage={onSendMessage}
          externalIsTyping={isTyping}
          externalIsStreaming={isStreaming}
          messagesMaxWidth={messagesMaxWidth}
        />
      ) : (
        <>
          <ChatInterface
            {...chatProps}
            messagesMaxWidth={messagesMaxWidth}
            placeholder={placeholder}
            disabled={disabled}
            variant="main"
            style={{ flex: 1, minHeight: 0 }}
            externalIsTyping={isTyping}
            externalIsStreaming={isStreaming}
            externalStreamingStatus={streamingStatus}
            externalStreamingHistory={streamingHistory}
            disableWelcomeMessage
            aboveInput={
              <div style={{
                width: '100%',
                maxWidth: messagesMaxWidth,
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <DeepWideButton value={researchParams} onChange={onResearchParamsChange} />
                </div>
                <div style={{ width: '1px', height: '24px', background: '#2a2a2a' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MCPBar value={mcpConfig} onChange={onMcpConfigChange} />
                </div>
              </div>
            }
          />

          {/* Composer */}
          <div style={inputStyles.container}>
            <div style={inputStyles.inner}>
              <div style={inputStyles.wrapper as React.CSSProperties}>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={placeholder}
                  style={inputStyles.textarea}
                  className="puppychat-textarea"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping || isStreaming || disabled}
                  style={{
                    ...inputStyles.sendButton,
                    backgroundColor: inputValue.trim() && !isTyping && !isStreaming ? '#4a90e2' : '#3a3a3a',
                    color: '#ffffff',
                    boxShadow: inputValue.trim() && !isTyping && !isStreaming ? '0 4px 12px rgba(74, 144, 226, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
                    opacity: !inputValue.trim() || isTyping || isStreaming ? 0.3 : 1
                  }}
                >
                  {isTyping || isStreaming ? (
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
        </>
      )}
    </div>
  )
}



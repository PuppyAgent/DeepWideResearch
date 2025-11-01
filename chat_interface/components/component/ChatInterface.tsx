'use client'

import { useState, useRef, useEffect } from 'react'
import BotMessage from './BotMessage'
import UserMessage from './UserMessage'
import './puppychat.module.css'
// NOTE: do not import app-level UI into SDK component

// Export Message interface
export interface Message {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: Date
  streamingHistory?: string[]  // 临时UI状态，不持久化
}

// Add component Props interface
export interface ChatInterfaceProps {
  onSendMessage?: (message: string, onStreamUpdate?: (content: string, isStreaming?: boolean, statusHistory?: string[]) => void) => Promise<string> | string
  initialMessages?: Message[]
  placeholder?: string
  className?: string
  disabled?: boolean
  welcomeMessage?: string
  variant?: 'main' | 'bubble' | 'sidebar'
  // Optional area above the input for user-defined components (toolbar, filters, etc.)
  aboveInput?: React.ReactNode
  // Optional slots in the header for user-defined components
  // Constrain the visible width of message content while allowing the scroll container to span full width
  messagesMaxWidth?: number | string
  // Allow parent to control container layout (e.g., height: '100%')
  style?: React.CSSProperties
  // Parent-driven streaming indicator (optional overrides)
  externalStreamingStatus?: string
  externalStreamingHistory?: string[]
  externalIsStreaming?: boolean
  externalIsTyping?: boolean
  // Suppress default welcome message and typing effect when true
  disableWelcomeMessage?: boolean
}

// Style injections removed; replaced with CSS module import above

export default function ChatInterface({
  onSendMessage,
  initialMessages,
  placeholder = "Type your message...",
  className = "",
  disabled = false,
  welcomeMessage = "Hello! I am PuppyChat AI assistant. How can I help you?",
  variant = 'main',
  aboveInput,
  messagesMaxWidth = '900px',
  style,
  externalStreamingStatus,
  externalStreamingHistory,
  externalIsStreaming,
  externalIsTyping,
  disableWelcomeMessage
}: ChatInterfaceProps = {}) {
  // Create default initial messages using welcomeMessage
  const defaultInitialMessages = [
    {
      id: '1',
      content: welcomeMessage,
      sender: 'bot' as const,
      timestamp: new Date()
    }
  ]

  const [messages, setMessages] = useState<Message[]>(() => {
    console.log('🎬 ChatInterface initializing with messages:', initialMessages?.length || 0)
    if (disableWelcomeMessage) {
      return initialMessages ?? []
    }
    return initialMessages || defaultInitialMessages
  })
  const [isTyping, setIsTyping] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState<string>('')
  const [streamingHistory, setStreamingHistory] = useState<string[]>([])
  const [completedStreamingHistory, setCompletedStreamingHistory] = useState<string[]>([]) // 保存完成后的历史 // 📜 存储所有历史步骤
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Welcome message streaming effect
  const [displayedWelcome, setDisplayedWelcome] = useState('')
  const [isStreamingWelcome, setIsStreamingWelcome] = useState(false)

  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior })
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    // On initial load or session switch, jump to bottom directly (no animation)
    if (isInitialLoad) {
      scrollToBottom('auto')
      setIsInitialLoad(false)
    } else {
      // Use smooth scroll for new messages
      scrollToBottom('smooth')
    }
  }, [messages])

  // 🔧 Sync changes to initialMessages (when parent component updates)
  useEffect(() => {
    console.log('🔄 ChatInterface useEffect triggered, initialMessages:', initialMessages?.length)
    if (initialMessages !== undefined) {
      // Mark as initial load state, trigger direct jump (no animation)
      setIsInitialLoad(true)
      
      if (initialMessages.length === 0) {
        if (disableWelcomeMessage) {
          console.log('➡️ Welcome suppressed, setting empty messages')
          setMessages([])
        } else {
        console.log('➡️ Setting default welcome message')
        // If empty array passed, indicates new session, reset to default welcome message
        setMessages(defaultInitialMessages)
        }
      } else {
        console.log('➡️ Setting messages from initialMessages:', initialMessages.length)
        // Directly update to new messages
        setMessages(initialMessages)
        
        // 🔧 Clear typing/streaming state, avoid showing duplicate messages
        // Only clear typing indicator when the last message is a bot message
        const lastMessage = initialMessages[initialMessages.length - 1]
        if (lastMessage && lastMessage.sender === 'bot') {
          setIsTyping(false)
          setIsStreaming(false)
          setStreamingStatus('')
          setStreamingHistory([])
        }
      }
    }
  }, [initialMessages])

  // CSS moved to puppychat.module.css

  // Update fade classes based on scroll position and content size
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return

    const updateFade = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const atTop = scrollTop <= 1
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1
      const canScroll = scrollHeight > clientHeight + 1

      el.classList.remove('fade-bottom-only', 'fade-top-only', 'fade-none')

      if (!canScroll) {
        el.classList.add('fade-none')
        return
      }

      if (atTop && !atBottom) {
        el.classList.add('fade-bottom-only')
        return
      }

      if (atBottom && !atTop) {
        el.classList.add('fade-top-only')
        return
      }

      // in the middle: default both fades via base class
    }

    updateFade()
    el.addEventListener('scroll', updateFade)
    window.addEventListener('resize', updateFade)

    return () => {
      el.removeEventListener('scroll', updateFade)
      window.removeEventListener('resize', updateFade)
    }
  }, [messages.length, isTyping, isStreaming])

  // Input removed: no textarea auto-resize needed

  // Welcome message streaming effect - triggered when showing default welcome
  useEffect(() => {
    const shouldShowWelcome = messages.length === 1 && messages[0].sender === 'bot' && !isTyping
    if (disableWelcomeMessage || !shouldShowWelcome) {
      setIsStreamingWelcome(false)
      setDisplayedWelcome('')
      return
    }

    const fullMessage = welcomeMessage
    setIsStreamingWelcome(true)
    setDisplayedWelcome('')

    let currentIndex = 0
    const typingSpeed = 8 // ms per character

    const typeInterval = setInterval(() => {
      if (currentIndex < fullMessage.length) {
        setDisplayedWelcome(fullMessage.slice(0, currentIndex + 1))
        currentIndex++
      } else {
        clearInterval(typeInterval)
        setIsStreamingWelcome(false)
      }
    }, typingSpeed)

    return () => {
      clearInterval(typeInterval)
    }
  }, [messages.length, isTyping, welcomeMessage])

  // Input removed: sending handled by parent composer


  

  // Inline styles object
  const effectiveBorderWidth = variant === 'main' ? 0 : 1

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      borderRadius: '16px',
      border: `${effectiveBorderWidth}px solid #2a2a2a`,
      boxShadow: 'none'
    },
    header: {
      display: 'none',
      color: 'white',
      padding: '12px 32px',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: 'none',
      boxShadow: 'none'
    },
    messagesContainer: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '24px',
      backgroundColor: 'transparent',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '16px',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      overscrollBehavior: 'contain' as const
    },
    toolbarContainer: {
      padding: '20px 8px'
    }
  }

  

  return (
    <div style={{ ...styles.container, ...(style || {}) }} className={className} aria-hidden="true" data-nosnippet data-variant={variant}>
      {/* Header removed: page-level header is used instead */}

      {/* Messages */}
      <div ref={messagesContainerRef} style={styles.messagesContainer} className="puppychat-messages puppychat-history">
        <div style={{ width: '100%', maxWidth: messagesMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((message, index) => {
            // If it's the welcome message and we're streaming it, show the partial content
            const isWelcomeMessage = index === 0 && message.sender === 'bot' && messages.length === 1
            const displayContent = (isWelcomeMessage && isStreamingWelcome) ? displayedWelcome : message.content
            
            return message.sender === 'bot' ? (
              <BotMessage
                key={message.id}
                message={{ ...message, content: displayContent }}
                showAvatar={false}
                isStreaming={isWelcomeMessage && isStreamingWelcome}
                streamingHistory={message.streamingHistory || []}  // 显示保存的时间线
              />
            ) : (
              <UserMessage
                key={message.id}
                message={message}
                showAvatar={false}
              />
            )
          })}
          
          
          
          {(((externalIsTyping ?? isTyping) || (externalIsStreaming ?? isStreaming))) && (
            <BotMessage 
              message={{
                id: 'typing',
                content: (externalStreamingStatus ?? streamingStatus) || '',
                sender: 'bot',
                timestamp: new Date()
              }}
              isTyping={(externalIsTyping ?? isTyping) && !(externalIsStreaming ?? isStreaming)}
              streamingStatus={(externalIsStreaming ?? isStreaming) ? (externalStreamingStatus ?? streamingStatus) : undefined}
              streamingHistory={externalStreamingHistory ?? streamingHistory} 
              isStreaming={externalIsStreaming ?? isStreaming}
              showAvatar={false}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Above-input custom area */}
      {aboveInput && (
        <div style={styles.toolbarContainer}>
          {aboveInput}
        </div>
      )}

      
    </div>
  )
}

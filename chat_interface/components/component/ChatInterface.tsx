'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Trash2 } from 'lucide-react'
import BotMessage from './BotMessage'
import UserMessage from './UserMessage'
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
  title?: string
  className?: string
  disabled?: boolean
  width?: string | number
  height?: string | number
  welcomeMessage?: string
  showAvatar?: boolean
  recommendedQuestions?: string[]
  showRecommendedQuestions?: boolean
  showHeader?: boolean
  borderWidth?: number
  backgroundColor?: string
  bg?: string
  variant?: 'main' | 'bubble' | 'sidebar'
  headerIcon?: string | React.ReactNode
  headerIconSize?: number
  showHeaderIcon?: boolean
  // Optional area above the input for user-defined components (toolbar, filters, etc.)
  aboveInput?: React.ReactNode
  // Optional slots in the header for user-defined components
  headerLeft?: React.ReactNode
  headerRight?: React.ReactNode
  // Control visibility of built-in input area
  showInput?: boolean
  // Constrain the visible width of message content while allowing the scroll container to span full width
  messagesMaxWidth?: number | string
}

// Add a global identifier to avoid adding styles repeatedly
const STYLE_ID = 'puppychat-animations'

// Add the same StyleManager at the top of the file
const StyleManager = {
  injected: new Set<string>(),
  
  inject(id: string, css: string) {
    if (typeof document === 'undefined') return // SSR compatible
    if (this.injected.has(id)) return
    
    const style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.head.appendChild(style)
    this.injected.add(id)
  }
}

export default function ChatInterface({
  onSendMessage,
  initialMessages,
  placeholder = "Type your message...",
  title = "PuppyChat",
  className = "",
  disabled = false,
  width = '80vw',
  height = '800px',
  welcomeMessage = "Hello! I am PuppyChat AI assistant. How can I help you?",
  showAvatar = true,
  recommendedQuestions = [
    "What are your use cases?",
    "How can I get started?",
    "What are your pricing options?"
  ],
  showRecommendedQuestions = true,
  showHeader = true,
  borderWidth = 16,
  backgroundColor = '#0D0D0D',
  bg,
  variant = 'main',
  headerIcon,
  headerIconSize = 26,
  showHeaderIcon = true,
  aboveInput,
  headerLeft,
  headerRight,
  showInput = true,
  messagesMaxWidth = '900px'
}: ChatInterfaceProps = {}) {
  const resolvedBg = bg ?? backgroundColor
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
    return initialMessages || defaultInitialMessages
  })
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState<string>('')
  const [streamingHistory, setStreamingHistory] = useState<string[]>([])
  const [completedStreamingHistory, setCompletedStreamingHistory] = useState<string[]>([]) // 保存完成后的历史 // 📜 存储所有历史步骤
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Welcome message streaming effect
  const [displayedWelcome, setDisplayedWelcome] = useState('')
  const [isStreamingWelcome, setIsStreamingWelcome] = useState(false)
  const [visibleQuestionsCount, setVisibleQuestionsCount] = useState(0)

  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
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
        console.log('➡️ Setting default welcome message')
        // If empty array passed, indicates new session, reset to default welcome message
        setMessages(defaultInitialMessages)
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

  // Inject spin animation
  useEffect(() => {
    StyleManager.inject('puppychat-spin-animation', `
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `)
  }, [])

  // Inject textarea placeholder styles, ensure consistent font with body text
  useEffect(() => {
    StyleManager.inject('puppychat-textarea-placeholder', `
      .puppychat-textarea::placeholder {
        font-family: inherit;
      }
    `)
  }, [])

  // Inject scrollbar styles: hidden by default, show on hover or scroll
  useEffect(() => {
    StyleManager.inject('puppychat-scrollbar-styles', `
      /* Firefox */
      .puppychat-messages, .puppychat-textarea {
        scrollbar-color: transparent transparent;
        scrollbar-width: thin;
        transition: scrollbar-color 0.3s ease;
      }

      .puppychat-messages:hover, .puppychat-textarea:hover,
      .puppychat-messages:active, .puppychat-textarea:active {
        scrollbar-color: rgba(100, 100, 100, 0.7) transparent;
      }

      /* WebKit (Chrome, Safari, Edge) */
      .puppychat-messages::-webkit-scrollbar,
      .puppychat-textarea::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .puppychat-messages::-webkit-scrollbar-track,
      .puppychat-textarea::-webkit-scrollbar-track {
        background: transparent;
      }

      .puppychat-messages::-webkit-scrollbar-thumb,
      .puppychat-textarea::-webkit-scrollbar-thumb {
        background-color: transparent;
        border-radius: 8px;
        transition: background-color 0.3s ease;
      }

      /* Show scrollbar when hovering container */
      .puppychat-messages:hover::-webkit-scrollbar-thumb,
      .puppychat-textarea:hover::-webkit-scrollbar-thumb {
        background-color: rgba(100, 100, 100, 0.5);
      }

      /* More visible when hovering scrollbar itself */
      .puppychat-messages::-webkit-scrollbar-thumb:hover,
      .puppychat-textarea::-webkit-scrollbar-thumb:hover {
        background-color: rgba(120, 120, 120, 0.9);
      }

      /* Dark scrollbar variant for overlays/lists */
      .puppychat-scrollbar-dark {
        scrollbar-color: rgba(70, 70, 70, 0.95) transparent; /* Firefox */
        scrollbar-width: thin;
      }
      .puppychat-scrollbar-dark::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .puppychat-scrollbar-dark::-webkit-scrollbar-track {
        background: transparent;
      }
      .puppychat-scrollbar-dark::-webkit-scrollbar-thumb {
        background-color: rgba(70, 70, 70, 0.95);
        border-radius: 8px;
      }
      .puppychat-scrollbar-dark::-webkit-scrollbar-thumb:hover {
        background-color: rgba(90, 90, 90, 1);
      }

      @keyframes slideInFromRight {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `)
  }, [])

  // Inject fade-at-edges styles for chat history area (scoped to chat only)
  useEffect(() => {
    StyleManager.inject('puppychat-fade-edges', `
      .puppychat-history {
        --fade-size: 32px;
        /* smoother multi-stop easing: closer to edge = darker (more mask) */
        -webkit-mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0,
          rgba(0, 0, 0, 0.1) calc(var(--fade-size) * 0.25),
          rgba(0, 0, 0, 0.4) calc(var(--fade-size) * 0.55),
          rgba(0, 0, 0, 0.75) calc(var(--fade-size) * 0.85),
          rgba(0, 0, 0, 1) var(--fade-size),
          rgba(0, 0, 0, 1) calc(100% - var(--fade-size)),
          rgba(0, 0, 0, 0.75) calc(100% - (var(--fade-size) * 0.85)),
          rgba(0, 0, 0, 0.4) calc(100% - (var(--fade-size) * 0.55)),
          rgba(0, 0, 0, 0.1) calc(100% - (var(--fade-size) * 0.25)),
          rgba(0, 0, 0, 0) 100%
        );
        mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0,
          rgba(0, 0, 0, 0.1) calc(var(--fade-size) * 0.25),
          rgba(0, 0, 0, 0.4) calc(var(--fade-size) * 0.55),
          rgba(0, 0, 0, 0.75) calc(var(--fade-size) * 0.85),
          rgba(0, 0, 0, 1) var(--fade-size),
          rgba(0, 0, 0, 1) calc(100% - var(--fade-size)),
          rgba(0, 0, 0, 0.75) calc(100% - (var(--fade-size) * 0.85)),
          rgba(0, 0, 0, 0.4) calc(100% - (var(--fade-size) * 0.55)),
          rgba(0, 0, 0, 0.1) calc(100% - (var(--fade-size) * 0.25)),
          rgba(0, 0, 0, 0) 100%
        );
      }

      /* Only fade bottom when scrolled to top */
      .puppychat-history.fade-bottom-only {
        -webkit-mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 1) 0,
          rgba(0, 0, 0, 1) calc(100% - var(--fade-size)),
          rgba(0, 0, 0, 0.75) calc(100% - (var(--fade-size) * 0.85)),
          rgba(0, 0, 0, 0.4) calc(100% - (var(--fade-size) * 0.55)),
          rgba(0, 0, 0, 0.1) calc(100% - (var(--fade-size) * 0.25)),
          rgba(0, 0, 0, 0) 100%
        );
        mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 1) 0,
          rgba(0, 0, 0, 1) calc(100% - var(--fade-size)),
          rgba(0, 0, 0, 0.75) calc(100% - (var(--fade-size) * 0.85)),
          rgba(0, 0, 0, 0.4) calc(100% - (var(--fade-size) * 0.55)),
          rgba(0, 0, 0, 0.1) calc(100% - (var(--fade-size) * 0.25)),
          rgba(0, 0, 0, 0) 100%
        );
      }

      /* Only fade top when scrolled to bottom */
      .puppychat-history.fade-top-only {
        -webkit-mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0,
          rgba(0, 0, 0, 0.1) calc(var(--fade-size) * 0.25),
          rgba(0, 0, 0, 0.4) calc(var(--fade-size) * 0.55),
          rgba(0, 0, 0, 0.75) calc(var(--fade-size) * 0.85),
          rgba(0, 0, 0, 1) var(--fade-size),
          rgba(0, 0, 0, 1) 100%
        );
        mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0,
          rgba(0, 0, 0, 0.1) calc(var(--fade-size) * 0.25),
          rgba(0, 0, 0, 0.4) calc(var(--fade-size) * 0.55),
          rgba(0, 0, 0, 0.75) calc(var(--fade-size) * 0.85),
          rgba(0, 0, 0, 1) var(--fade-size),
          rgba(0, 0, 0, 1) 100%
        );
      }

      /* No fade when content doesn't overflow */
      .puppychat-history.fade-none {
        -webkit-mask-image: none;
        mask-image: none;
      }
    `)
  }, [])

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

  // Auto-adjust textarea height based on content (hug content)
  const autoResizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    autoResizeTextarea()
  }, [inputValue])

  // Also auto-adjust on initial mount to avoid small initial height
  useEffect(() => {
    autoResizeTextarea()
  }, [])

  // Welcome message streaming effect - triggered when showing default welcome
  useEffect(() => {
    const shouldShowWelcome = messages.length === 1 && messages[0].sender === 'bot' && !isTyping
    if (!shouldShowWelcome) {
      setIsStreamingWelcome(false)
      setDisplayedWelcome('')
      setVisibleQuestionsCount(0)
      return
    }

    const fullMessage = welcomeMessage
    setIsStreamingWelcome(true)
    setDisplayedWelcome('')
    setVisibleQuestionsCount(0)

    let currentIndex = 0
    const typingSpeed = 8 // ms per character

    const typeInterval = setInterval(() => {
      if (currentIndex < fullMessage.length) {
        setDisplayedWelcome(fullMessage.slice(0, currentIndex + 1))
        currentIndex++
      } else {
        clearInterval(typeInterval)
        setIsStreamingWelcome(false)
        // Start showing questions one by one after welcome finishes
        let questionIndex = 0
        const questionInterval = setInterval(() => {
          if (questionIndex < recommendedQuestions.length) {
            setVisibleQuestionsCount(questionIndex + 1)
            questionIndex++
          } else {
            clearInterval(questionInterval)
          }
        }, 150) // 150ms delay between each question
      }
    }, typingSpeed)

    return () => {
      clearInterval(typeInterval)
    }
  }, [messages.length, isTyping, welcomeMessage, recommendedQuestions.length])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || disabled) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    setIsTyping(true)

    try {
      let response: string
      if (onSendMessage) {
        // Create streaming callback
        const onStreamUpdate = (content: string, streaming: boolean = true, statusHistory: string[] = []) => {
          if (streaming) {
            setIsTyping(false)  // Close typing state
            setStreamingStatus(content)
            setStreamingHistory(statusHistory) // 📜 更新完整的历史步骤
            setIsStreaming(true)
          } else {
            // 完成时：保存时间线历史，但清空临时streaming状态
            setIsStreaming(false)
            setStreamingStatus('')
            setCompletedStreamingHistory(statusHistory) // 保存完整的时间线历史
            setStreamingHistory([]) // 清空当前streaming历史
          }
        }
        
        response = await onSendMessage(currentInput, onStreamUpdate)
        
        // 在消息添加完成后，将完成的时间线附加到最后一条bot消息
        if (completedStreamingHistory.length > 0) {
          setMessages(prev => {
            const newMessages = [...prev]
            const lastBotIndex = newMessages.findIndex((m, i) => m.sender === 'bot' && i === newMessages.length - 1)
            if (lastBotIndex !== -1) {
              newMessages[lastBotIndex] = {
                ...newMessages[lastBotIndex],
                streamingHistory: completedStreamingHistory
              }
            }
            return newMessages
          })
          // 清空已使用的历史
          setCompletedStreamingHistory([])
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500))
        response = `I received your message: "${currentInput}". This is a simulated response.`
        
        // Only add message if there's no onSendMessage callback (standalone mode)
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response,
          sender: 'bot',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, something went wrong. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
      setIsStreaming(false)
      setStreamingStatus('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        content: welcomeMessage,
        sender: 'bot',
        timestamp: new Date()
      }
    ])
  }

  const handleRecommendedQuestionClick = async (question: string) => {
    if (disabled || isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: question,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)

    try {
      let response: string
      if (onSendMessage) {
        // Create streaming callback
        const onStreamUpdate = (content: string, streaming: boolean = true, statusHistory: string[] = []) => {
          if (streaming) {
            setIsTyping(false)  // Close typing state
            setStreamingStatus(content)
            setStreamingHistory(statusHistory) // 📜 更新完整的历史步骤
            setIsStreaming(true)
          } else {
            // 完成时：保存时间线历史，但清空临时streaming状态
            setIsStreaming(false)
            setStreamingStatus('')
            setCompletedStreamingHistory(statusHistory) // 保存完整的时间线历史
            setStreamingHistory([]) // 清空当前streaming历史
          }
        }
        
        response = await onSendMessage(question, onStreamUpdate)
        
        // 在消息添加完成后，将完成的时间线附加到最后一条bot消息
        if (completedStreamingHistory.length > 0) {
          setMessages(prev => {
            const newMessages = [...prev]
            const lastBotIndex = newMessages.findIndex((m, i) => m.sender === 'bot' && i === newMessages.length - 1)
            if (lastBotIndex !== -1) {
              newMessages[lastBotIndex] = {
                ...newMessages[lastBotIndex],
                streamingHistory: completedStreamingHistory
              }
            }
            return newMessages
          })
          // 清空已使用的历史
          setCompletedStreamingHistory([])
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500))
        response = `I received your question: "${question}". This is a simulated response.`
        
        // Only add message if there's no onSendMessage callback (standalone mode)
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response,
          sender: 'bot',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, something went wrong. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
      setIsStreaming(false)
      setStreamingStatus('')
    }
  }

  // Inline styles object
  const effectiveBorderWidth = variant === 'main' ? 0 : 1
  const isTransparentBg = typeof resolvedBg === 'string' && resolvedBg.toLowerCase() === 'transparent'

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      borderRadius: '16px',
      border: `${effectiveBorderWidth}px solid #2a2a2a`,
      background: resolvedBg,
      boxShadow: 'none',
      width: width,
      height: height
    },
    header: {
      display: showHeader ? 'flex' : 'none',
      color: 'white',
      padding: '12px 32px',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: 'none',
      backgroundColor: typeof resolvedBg === 'string' ? undefined : undefined,
      background: resolvedBg,
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
      borderTopLeftRadius: showHeader ? '0px' : '16px',
      borderTopRightRadius: showHeader ? '0px' : '16px'
    },
    toolbarContainer: {
      padding: '0 32px'
    },
    inputContainer: {
      padding: '20px 32px',
      borderBottomLeftRadius: '16px',
      borderBottomRightRadius: '16px',
      backgroundColor: 'transparent'
    },
    inputWrapper: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '12px',
      border: isFocused ? '2px solid #4a90e2' : '2px solid #3a3a3a',
      borderRadius: '16px',
      padding: '8px',
      backgroundColor: isTransparentBg ? 'transparent' : '#2a2a2a',
      boxShadow: isFocused 
        ? 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06), 0 0 0 2px rgba(74, 144, 226, 0.15)' 
        : 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      transition: 'all 0.3s ease'
    },
    gridWrapper: {
      display: 'flex',
      alignItems: 'flex-end',
      paddingLeft: '4px',
      paddingRight: '4px'
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
      borderRadius: '50%',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      flexShrink: 0
    }
  }

  const recommendedQuestionsStyle = {
    padding: '16px 24px',
    borderBottom: '1px solid #2a2a2a',
    backgroundColor: 'rgba(26, 26, 26, 0.3)'
  }

  const questionButtonStyle = {
    display: 'inline-block',
    margin: '4px 8px 4px 0',
    padding: '8px 12px',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    border: '1px solid rgba(74, 144, 226, 0.3)',
    borderRadius: '16px',
    color: '#4a90e2',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const
  }

  const questionButtonHoverStyle = {
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderColor: '#4a90e2'
  }

  // Check if we should show recommended questions (only when there's just the welcome message)
  const shouldShowRecommendedQuestions = showRecommendedQuestions && 
    messages.length === 1 && 
    messages[0].sender === 'bot' && 
    !isTyping

  return (
    <div style={styles.container} className={className} aria-hidden="true" data-nosnippet data-variant={variant}>
      {/* Header */}
      {showHeader && (
        <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: `${headerIconSize}px` }}>
          {headerLeft && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {headerLeft}
            </div>
          )}
          {showHeaderIcon && (
            <>
              {headerIcon ? (
                typeof headerIcon === 'string' ? (
                  <img 
                    src={headerIcon} 
                    alt="Chat Icon" 
                    style={{ 
                      width: `${headerIconSize}px`,
                      height: `${headerIconSize}px`,
                      objectFit: 'contain'
                    }} 
                  />
                ) : (
                  <div style={{ width: `${headerIconSize}px`, height: `${headerIconSize}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {headerIcon}
                  </div>
                )
              ) : (
                <Bot style={{ width: `${headerIconSize}px`, height: `${headerIconSize}px`, color: '#8b8b8b' }} />
              )}
            </>
          )}
            <div>
            <div style={{ fontSize: '14px', fontWeight: 'normal', color: '#8b8b8b', margin: 0, height: `${headerIconSize}px`, lineHeight: `${headerIconSize}px` }}>{title}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {headerRight && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {headerRight}
              </div>
            )}
            <button
              onClick={clearChat}
              style={{
                width: '26px',
                height: '26px',
                padding: '0',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#8b8b8b',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Clear chat history"
            >
              <Trash2 style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>
      )}

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
          
          {/* Recommended Questions in Message Area */}
          {shouldShowRecommendedQuestions && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              marginTop: '20px',
              alignItems: 'flex-end'
            }}>
              {recommendedQuestions.slice(0, visibleQuestionsCount).map((question, index) => (
                <div
                  key={index}
                  onClick={() => handleRecommendedQuestionClick(question)}
                  style={{
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(74, 144, 226, 0.05))',
                    border: '1px solid rgba(74, 144, 226, 0.3)',
                    borderRadius: '28px',
                    color: '#4a90e2',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    maxWidth: '75%',
                    backdropFilter: 'blur(10px)',
                    position: 'relative',
                    overflow: 'hidden',
                    userSelect: 'none',
                    boxShadow: '0 2px 8px rgba(74, 144, 226, 0.1)',
                    fontWeight: '500',
                    animation: 'slideInFromRight 300ms ease-out forwards',
                    animationDelay: `${index * 50}ms`,
                    opacity: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(74, 144, 226, 0.15))'
                    e.currentTarget.style.borderColor = 'rgba(74, 144, 226, 0.5)'
                    e.currentTarget.style.color = '#357abd'
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(74, 144, 226, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(74, 144, 226, 0.05))'
                    e.currentTarget.style.borderColor = 'rgba(74, 144, 226, 0.3)'
                    e.currentTarget.style.color = '#4a90e2'
                    e.currentTarget.style.transform = 'translateY(0px) scale(1)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.1)'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translateY(0px) scale(0.98)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.2)'
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(74, 144, 226, 0.25)'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease'
                  }} />
                  <span style={{ 
                    position: 'relative', 
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {question}
                    <span style={{
                      fontSize: '10px',
                      opacity: 0.7,
                      marginLeft: '4px'
                    }}>
                      ↗
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {(isTyping || isStreaming) && (
            <BotMessage 
              message={{
                id: 'typing',
                content: streamingStatus || '',
                sender: 'bot',
                timestamp: new Date()
              }}
              isTyping={isTyping && !isStreaming}
              streamingStatus={isStreaming ? streamingStatus : undefined}
              streamingHistory={streamingHistory} 
              isStreaming={isStreaming}
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

      {/* Input */}
      {showInput && (
        <div style={styles.inputContainer}>
          <div style={styles.inputWrapper}>
            <textarea
            ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
            style={styles.textarea}
            className="puppychat-textarea"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping || disabled}
              style={{
                ...styles.sendButton,
                backgroundColor: inputValue.trim() && !isTyping ? '#4a90e2' : '#3a3a3a',
                color: '#ffffff',
                boxShadow: inputValue.trim() && !isTyping ? '0 4px 12px rgba(74, 144, 226, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
                opacity: !inputValue.trim() || isTyping ? 0.3 : 1
              }}
            >
              {isTyping ? (
                <svg style={{ animation: 'spin 1s linear infinite', height: '24px', width: '24px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      )}
    </div>
  )
}

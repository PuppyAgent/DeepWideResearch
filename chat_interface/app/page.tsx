'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from './supabase/SupabaseAuthProvider'
import dynamic from 'next/dynamic'
import DeepWideGrid from './DeepWideGrid'
import MCPBar from './MCPBar'
import HistoryToggleButton from './headercomponent/HistoryToggleButton'
import NewChatButton from './headercomponent/NewChatButton'
import SessionsOverlay from './headercomponent/SessionsOverlay'
import UserMenu from './headercomponent/UserMenu'
import DevModePanel from './headercomponent/DevModePanel'
import { useRouter } from 'next/navigation'
import { useSession } from './context/SessionContext'
import type { Message as UIMessage } from '../components/component/ChatInterface'
 

// Dynamically import local ChatMain component, disable SSR to avoid document undefined error
const ChatMain = dynamic(
  () => import('../components/ChatMain'),
  { ssr: false }
)

// Standard message format - follows OpenAI format
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

export default function Home() {
  const { getAccessToken, session } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!session) {
      router.replace('/login')
    }
  }, [session, router])
  // 🎯 Use SessionContext (contains session list, message history, etc.)
  const {
    sessions,
    chatHistory,
    currentSessionId,
    tempSessionId,
    isLoading: isLoadingSessions,
    isLoadingChat,
    createSession,
    createTempSession,
    promoteTempSession,
    switchSession,
    deleteSession,
    addMessage,
    updateMessages,
    getCurrentMessages,
    saveSessionToBackend
  } = useSession()

  // UI state
  const [researchParams, setResearchParams] = useState<{ deep: number; wide: number }>({ deep: 1.0, wide: 1.0 })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false)
  const [isDevModeOpen, setIsDevModeOpen] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [showCreateSuccess, setShowCreateSuccess] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  
  // 📜 Cache streaming history for each session (session_id -> streamingHistory[])
  const [sessionStreamingCache, setSessionStreamingCache] = useState<Record<string, string[]>>({})
  
  // 🔑 Stable key for ChatMain component, avoid re-mounting when promoting temporary session
  const [chatComponentKey, setChatComponentKey] = useState<string>('default')
  
  // Update chatComponentKey when currentSessionId changes (excluding temporary session promotion)
  const previousSessionIdRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const prev = previousSessionIdRef.current
    const current = currentSessionId
    
    // If switching from temporary session to permanent session (promotion), keep key unchanged
    const isTempPromotion = prev?.startsWith('temp-') && current && !current.startsWith('temp-')
    
    if (!isTempPromotion && current !== prev && current) {
      // Normal session switch, update key
      console.log('🔑 Updating chatComponentKey from', prev, 'to', current)
      setChatComponentKey(current)
    }
    
    previousSessionIdRef.current = current
  }, [currentSessionId])
  
  // Track currentSessionId changes
  React.useEffect(() => {
    console.log('📌 currentSessionId changed to:', currentSessionId)
  }, [currentSessionId])

  // Add logic to close settings panel and dev panel on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSettingsOpen || isDevModeOpen) {
        const target = event.target as Element
        const settingsPanel = document.querySelector('[data-settings-panel]')
        const settingsButton = document.querySelector('[data-settings-button]')
        const devPanel = document.querySelector('[data-dev-panel]')
        const devButton = document.querySelector('[data-dev-button]')
        
        if (settingsPanel && settingsButton) {
          const isClickInPanel = settingsPanel.contains(target)
          const isClickOnButton = settingsButton.contains(target)
          
          if (!isClickInPanel && !isClickOnButton) {
            setIsSettingsOpen(false)
          }
        }
        if (isDevModeOpen && devPanel) {
          const isClickInDev = devPanel.contains(target)
          const isClickOnDevButton = devButton ? devButton.contains(target) : false
          if (!isClickInDev && !isClickOnDevButton) {
            setIsDevModeOpen(false)
          }
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSettingsOpen, isDevModeOpen])
  const [mcpConfig, setMcpConfig] = useState({
    services: [
      { 
        name: 'Tavily', 
        enabled: true, 
        tools: [
          { name: 'tavily_search', enabled: true, description: 'Web search using Tavily' }
        ]
      },
      { 
        name: 'Exa', 
        enabled: true, 
        tools: [
          { name: 'web_search_exa', enabled: true, description: 'AI-powered web search using Exa' }
        ]
      }
    ]
  })


  // Fetch credits balance
  React.useEffect(() => {
    let active = true
    const loadBalance = async () => {
      if (!session) { setBalance(null); return }
      setBalanceLoading(true)
      try {
        const token = await getAccessToken()
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiBase}/api/credits/balance`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (!res.ok) throw new Error('Failed to load balance')
        const data = await res.json()
        if (active) setBalance(Number(data?.balance ?? 0))
      } catch (e) {
        if (active) setBalance(null)
      } finally {
        if (active) setBalanceLoading(false)
      }
    }
    loadBalance()
    return () => { active = false }
  }, [session, getAccessToken])

  // Add debug info - show current parameter state
  React.useEffect(() => {
    console.log('📊 Current research params:', researchParams)
  }, [researchParams])

  // Add debug info - show current MCP configuration state
  React.useEffect(() => {
    const enabledServices = mcpConfig.services
      .filter(service => service.enabled)
      .map(service => service.name)

    const mcpForBackend = mcpConfig.services.reduce((acc, service) => {
      if (service.enabled) {
        const enabledTools = service.tools
          .filter(tool => tool.enabled)
          .map(tool => tool.name)
        
        if (enabledTools.length > 0) {
          acc[service.name.toLowerCase()] = enabledTools
        }
      }
      return acc
    }, {} as Record<string, string[]>)
    
    console.log('🔧 Current MCP config:', {
      allServices: mcpConfig.services.map(s => ({ 
        name: s.name, 
        enabled: s.enabled,
        tools: s.tools.map(t => ({ name: t.name, enabled: t.enabled }))
      })),
      enabledServices: enabledServices,
      backendFormat: mcpForBackend
    })
  }, [mcpConfig])

  // Sidebar dropdown (overlay) close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isSidebarMenuOpen) return
      const target = event.target as Element
      const panel = document.querySelector('[data-sidebar-panel]')
      const toggle = document.querySelector('[data-sidebar-toggle]')
      if (panel && toggle) {
        const inPanel = panel.contains(target)
        const onToggle = toggle.contains(target)
        if (!inPanel && !onToggle) {
          setIsSidebarMenuOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSidebarMenuOpen])

  // Map messages from Context to UI messages
  const uiMessages: UIMessage[] = React.useMemo(() => {
    // Get current session messages directly from chatHistory, avoid async issues with getCurrentMessages
    const currentMessages = currentSessionId ? (chatHistory[currentSessionId] || []) : []
    console.log('🔄 uiMessages recalculating, currentSessionId:', currentSessionId, 'messages:', currentMessages.length)
    
    // Get cached streaming history for current session
    const cachedHistory = currentSessionId ? sessionStreamingCache[currentSessionId] : undefined
    
    // Find the last assistant message index
    let lastAssistantIdx = -1
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        lastAssistantIdx = i
        break
      }
    }
    
    const result = currentMessages.map((m, idx) => {
      const baseMessage = {
        id: `${m.timestamp ?? idx}-${idx}`,
        content: m.content,
        sender: (m.role === 'assistant' ? 'bot' : 'user') as 'bot' | 'user',
        timestamp: new Date(m.timestamp ?? Date.now())
      }
      
      // If it's the last assistant message and we have cached streaming history, attach it
      if (m.role === 'assistant' && idx === lastAssistantIdx && cachedHistory && cachedHistory.length > 0) {
        console.log('📜 Attaching cached history to last assistant message:', cachedHistory.length, 'steps')
        return { ...baseMessage, streamingHistory: cachedHistory }
      }
      
      return baseMessage
    })
    console.log('✅ uiMessages result:', result.length, 'messages', cachedHistory ? `with cached history (${cachedHistory.length} steps)` : '')
    return result
  }, [chatHistory, currentSessionId, sessionStreamingCache]) // Depends on chatHistory, currentSessionId, and sessionStreamingCache

  // Handle creating new chat
  const handleCreateNewChat = async () => {
    if (isCreatingSession) return
    setIsCreatingSession(true)
    try {
      // If already has temporary session, switch to it; otherwise create new temporary session
      if (tempSessionId) {
        await switchSession(tempSessionId)
      } else {
        createTempSession()
      }
      setIsSidebarMenuOpen(false)
      // Show success feedback
      setShowCreateSuccess(true)
      setTimeout(() => setShowCreateSuccess(false), 2000)
    } finally {
      setIsCreatingSession(false)
    }
  }

  // Handle session switch (use Context's cache mechanism)
  const handleSessionClick = async (id: string) => {
    try {
      await switchSession(id) // ✅ Use Context's switchSession, automatically handle cache
      setIsSidebarMenuOpen(false)
    } catch (e) {
      console.warn('Failed to switch session:', e)
    }
  }

  // Handle session deletion
  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id) // ✅ Use Context's deleteSession
    } catch (e) {
      console.warn('Failed to delete session:', e)
    }
  }

  const handleSendMessage = async (message: string, onStreamUpdate?: (content: string, isStreaming?: boolean, statusHistory?: string[]) => void) => {
    // 🔒 Key: Lock the current sessionId at the start of the function, prevent state confusion from session switching
    let targetSessionId = currentSessionId
    
    // 📝 Before promoting temporary session, save temporary session messages first
    let messagesBeforePromotion: ChatMessage[] = []
    if (tempSessionId && currentSessionId === tempSessionId) {
      messagesBeforePromotion = chatHistory[tempSessionId] || []
    }
    
    // If current session is temporary, promote it to permanent first
    if (tempSessionId && currentSessionId === tempSessionId) {
      console.log('⬆️ Promoting temp session before sending message')
      const firstUserMessage = message.slice(0, 60) // Use first 60 characters of first message as title
      targetSessionId = await promoteTempSession(firstUserMessage)
    } else if (!targetSessionId) {
      // If no session exists, create a new permanent session
      const firstUserMessage = message.slice(0, 60)
      targetSessionId = await createSession(firstUserMessage)
      await switchSession(targetSessionId)
    }
    
    const userMessage: ChatMessage = { role: 'user', content: message, timestamp: Date.now() }
    
    // 📝 If just promoted temporary session, use saved messages before promotion; otherwise get from chatHistory
    const currentMessages = messagesBeforePromotion.length > 0 
      ? messagesBeforePromotion 
      : (chatHistory[targetSessionId] || [])
    const localHistoryBefore = [...currentMessages, userMessage]
    
    try {
      // ✅ Immediately add user message to Context (UI updates immediately)
      addMessage(targetSessionId, userMessage)

      // Construct request data
      const requestData = {
        message: {
          query: message,
          deepwide: {
            deep: researchParams.deep,
            wide: researchParams.wide
          },
            mcp: mcpConfig.services.reduce((acc, service) => {
              // Only include enabled services and their tools
              if (service.enabled) {
                const enabledTools = service.tools
                  .filter(tool => tool.enabled)
                  .map(tool => tool.name)
                
                if (enabledTools.length > 0) {
                  // Convert to backend expected format: {service_name_lowercase: [enabled_tools_list]}
                  acc[service.name.toLowerCase()] = enabledTools
                }
              }
              return acc
            }, {} as Record<string, string[]>)
        },
        history: localHistoryBefore  // Send conversation history with latest user message
      }

      console.log('🚀 Sending streaming request to backend:', message)

      // Call streaming API - use environment variable or default local address
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const token = await getAccessToken()
      const response = await fetch(`${apiUrl}/api/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      const statusHistory: string[] = [] // 📜 累积所有状态步骤
      let finalReport = ''
      let isGeneratingReport = false

      // Read streaming response
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.action === 'complete' && data.final_report) {
                finalReport = data.final_report
                onStreamUpdate?.(finalReport, false, statusHistory) // 传递完整历史
                isGeneratingReport = false
              } else if (data.action === 'report_chunk') {
                // Streaming report content
                finalReport = data.accumulated_report
                if (!isGeneratingReport) {
                  isGeneratingReport = true
                }
                onStreamUpdate?.(finalReport, true, statusHistory) // Stream the accumulated report
              } else if (data.message) {
                statusHistory.push(data.message) // 👈 追加到历史，不覆盖
                // Only update streaming status if not currently generating report
                if (!isGeneratingReport) {
                  onStreamUpdate?.(data.message, true, statusHistory) // 传递当前消息和完整历史
                }
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }

      // ✅ Add assistant reply to Context
      const assistantMessage: ChatMessage = { role: 'assistant', content: finalReport || statusHistory[statusHistory.length - 1] || '', timestamp: Date.now() }
      addMessage(targetSessionId, assistantMessage)
      
      // 📜 Cache the streaming history for this session
      if (statusHistory.length > 0) {
        setSessionStreamingCache(prev => ({
          ...prev,
          [targetSessionId]: statusHistory
        }))
        console.log('📜 Cached streaming history for session:', targetSessionId, 'steps:', statusHistory.length)
      }
      
      // ✅ Save to backend
      const completeHistory = [...localHistoryBefore, assistantMessage]
      await saveSessionToBackend(targetSessionId, completeHistory)
      
      // 🔑 If promoted from temporary session, now safe to update chatComponentKey
      if (messagesBeforePromotion.length > 0 && targetSessionId !== chatComponentKey) {
        console.log('🔑 Updating chatComponentKey after successful message, from', chatComponentKey, 'to', targetSessionId)
        setChatComponentKey(targetSessionId)
      }
      
      return finalReport || statusHistory[statusHistory.length - 1] || ''
      
    } catch (error) {
      console.error('Error calling research API:', error)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const errorMessage = `❌ Error: ${error instanceof Error ? error.message : `Failed to connect to research API. Please make sure the backend server is running at ${apiUrl}`}`
      
      // ✅ Add error message to Context
      const errorAssistantMessage: ChatMessage = { role: 'assistant', content: errorMessage, timestamp: Date.now() }
      addMessage(targetSessionId, errorAssistantMessage)
      
      // ✅ Save to backend
      const completeHistoryWithError = [...localHistoryBefore, errorAssistantMessage]
      await saveSessionToBackend(targetSessionId, completeHistoryWithError).catch(e => 
        console.warn('Failed to save error message:', e)
      )
      
      // 🔑 If promoted from temporary session, now safe to update chatComponentKey
      if (messagesBeforePromotion.length > 0 && targetSessionId !== chatComponentKey) {
        console.log('🔑 Updating chatComponentKey after error message, from', chatComponentKey, 'to', targetSessionId)
        setChatComponentKey(targetSessionId)
      }
      
      return errorMessage
    }
  }

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw',
      display: 'flex', 
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      padding: '32px 32px 32px 32px',
      backgroundColor: '#0a0a0a',
      backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(120, 120, 120, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(120, 120, 120, 0.1) 0%, transparent 50%)',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        height: '100%', 
        width: '100%', 
        display: 'flex', 
        alignItems: 'stretch', 
        gap: '16px',
        overflow: 'hidden'
      }}>
        {/* Left side no longer occupies flex space, sessions rendered as header overlay */}

        {/* Right side chat area (limit max width to 800px) */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '900px', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            overflow: 'hidden',
            minHeight: 0
          }}>
            {/* Top control bar */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '0 32px', 
              position: 'relative',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HistoryToggleButton
                  isOpen={isSidebarMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsSidebarMenuOpen(prev => !prev)
                  }}
                />

                <NewChatButton
                  isCreating={isCreatingSession}
                  showSuccess={showCreateSuccess}
                  onClick={handleCreateNewChat}
                />

                {/* Overlay panel under the toggle button */}
                <SessionsOverlay
                  isOpen={isSidebarMenuOpen}
                  sidebarWidth={sidebarWidth}
                  sessions={sessions}
                  selectedSessionId={currentSessionId}
                  isLoading={isLoadingSessions}
                  onSessionClick={handleSessionClick}
                  onCreateNew={handleCreateNewChat}
                  onDeleteSession={handleDeleteSession}
                />
              </div>

              {/* Center area intentionally left empty (logo removed) */}

              {/* Right side: User menu | Credits + Dev Mode pill */}
              <div style={{ width: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserMenu />
                  
                  {/* Dev Mode + Credits Pill */}
                  <div 
                    data-dev-button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsDevModeOpen(prev => !prev)
                    }}
                    title={isDevModeOpen ? 'Close Dev Mode' : 'Open Dev Mode'}
                    style={{
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 12px 0 4px',
                      borderRadius: '18px',
                      border: '1px solid #2a2a2a',
                      background: 'rgba(20,20,20,0.9)',
                      backdropFilter: 'blur(8px)',
                      cursor: 'pointer',
                      transition: 'all 200ms ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isDevModeOpen) {
                        e.currentTarget.style.borderColor = '#3a3a3a'
                        e.currentTarget.style.background = 'rgba(25,25,25,0.9)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDevModeOpen) {
                        e.currentTarget.style.borderColor = '#2a2a2a'
                        e.currentTarget.style.background = 'rgba(20,20,20,0.9)'
                      }
                    }}
                  >
                    {/* Dev Mode Icon */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '14px',
                      border: isDevModeOpen ? '2px solid #4a4a4a' : '1px solid #2a2a2a',
                      background: isDevModeOpen
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)'
                        : 'rgba(30, 30, 30, 0.9)',
                      color: isDevModeOpen ? '#e6e6e6' : '#bbb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isDevModeOpen
                        ? '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)'
                        : '0 2px 8px rgba(0,0,0,0.3)',
                      transition: 'all 200ms ease',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 16L4 12L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 8L20 12L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    
                    {/* Credits Display */}
                    <div style={{
                      color: '#4599DF',
                      fontSize: '14px',
                      fontWeight: '600',
                      lineHeight: '12px',
                      minWidth: '24px',
                      textAlign: 'left'
                    }}>
                      {balanceLoading ? '—' : `${balance ?? '—'}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dev Mode Panel (absolute inside header container) */}
            <div data-dev-panel>
              <DevModePanel isOpen={isDevModeOpen} onClose={() => setIsDevModeOpen(false)} />
            </div>

            {/* ChatMain wrapper - fill remaining space */}
            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <ChatMain
                key={chatComponentKey}
                initialMessages={uiMessages.length > 0 ? uiMessages : undefined}
                onSendMessage={handleSendMessage}
                title="Deep Wide Research"
                placeholder="Ask anything about your research topic..."
                welcomeMessage="Welcome to Deep & Wide Research! I'm your AI research assistant ready to conduct comprehensive research and provide detailed insights. What would you like to explore today?"
                width="100%"
                height="100%"
        recommendedQuestions={[
          "What are the key differences between Databricks and Snowflake?",
          "Explain quantum computing and its applications",
          "What are the latest trends in AI research?",
        ]}
              showHeader={false}
        backgroundColor="transparent"
        borderWidth={3}
        showAvatar={false}
              headerLeft={(
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HistoryToggleButton
                    isOpen={isSidebarMenuOpen}
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsSidebarMenuOpen(prev => !prev)
                    }}
                  />

                  <NewChatButton
                    isCreating={isCreatingSession}
                    showSuccess={showCreateSuccess}
                    onClick={handleCreateNewChat}
                  />

                  {/* Overlay panel under the toggle button */}
                  <SessionsOverlay
                    isOpen={isSidebarMenuOpen}
                    sidebarWidth={sidebarWidth}
                    sessions={sessions}
                    selectedSessionId={currentSessionId}
                    isLoading={isLoadingSessions}
                    onSessionClick={handleSessionClick}
                    onCreateNew={handleCreateNewChat}
                    onDeleteSession={handleDeleteSession}
                  />
                </div>
              )}
          aboveInput={
            <div 
              style={{ 
                display: 'flex',
                gap: '8px',
                position: 'relative'
              }}
            >
              {/* Deep/Wide Settings */}
              <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                {/* Settings Panel */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '47px',
                    left: '0',
                    width: '195px',
                  background: 'linear-gradient(135deg, rgba(25,25,25,0.98) 0%, rgba(15,15,15,0.98) 100%)',
                  border: '1px solid #2a2a2a',
                  borderRadius: '14px',
                  boxShadow: isSettingsOpen 
                    ? '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)' 
                    : '0 4px 12px rgba(0,0,0,0.3)',
                  overflow: 'visible',
                  opacity: isSettingsOpen ? 1 : 0,
                  transform: isSettingsOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
                  transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  pointerEvents: isSettingsOpen ? 'auto' : 'none',
                  backdropFilter: 'blur(12px)',
                  zIndex: 10
                }}
                aria-hidden={!isSettingsOpen}
                onClick={(e) => e.stopPropagation()}
                data-settings-panel
              >
                {/* Grid Content */}
                <div style={{ padding: '14px' }}>
                  <DeepWideGrid
                    value={researchParams}
                    onChange={(newParams) => {
                      console.log('🔄 Page: Updating research params:', newParams)
                      setResearchParams(newParams)
                    }}
                    cellSize={20}
                    innerBorder={2}
                    outerPadding={4}
                  />
                </div>
              </div>

              {/* Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsSettingsOpen(!isSettingsOpen)
                }}
                data-settings-button
                title="Research Settings"
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  border: isSettingsOpen 
                    ? '2px solid #4a4a4a' 
                    : '1px solid #2a2a2a',
                  background: isSettingsOpen 
                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)' 
                    : 'rgba(20, 20, 20, 0.9)',
                  color: isSettingsOpen ? '#e6e6e6' : '#bbb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isSettingsOpen 
                    ? '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)' 
                    : '0 2px 8px rgba(0,0,0,0.3)',
                  transition: 'all 200ms ease',
                  transform: isSettingsOpen ? 'rotate(180deg) scale(1.05)' : 'rotate(0deg) scale(1)',
                  backdropFilter: 'blur(8px)',
                  padding: 0,
                  margin: 0,
                  zIndex: 11
                }}
                onMouseEnter={(e) => {
                  if (!isSettingsOpen) {
                    e.currentTarget.style.borderColor = '#3a3a3a'
                    e.currentTarget.style.color = '#e6e6e6'
                    e.currentTarget.style.transform = 'scale(1.08)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSettingsOpen) {
                    e.currentTarget.style.borderColor = '#2a2a2a'
                    e.currentTarget.style.color = '#bbb'
                    e.currentTarget.style.transform = 'scale(1)'
                  }
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="8" cy="6" r="2.5" fill="currentColor"/>
                  <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="14" cy="12" r="2.5" fill="currentColor"/>
                  <path d="M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="10" cy="18" r="2.5" fill="currentColor"/>
                </svg>
              </button>
              </div>

              {/* Separator Line */}
              <div style={{
                width: '1px',
                height: '20px',
                backgroundColor: '#3a3a3a',
                margin: '0 4px',
                alignSelf: 'center'
              }} />

              {/* MCP Services Bar */}
              <MCPBar
                value={mcpConfig}
                onChange={setMcpConfig}
              />
            </div>
          }
        />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from './supabase/SupabaseAuthProvider'
import dynamic from 'next/dynamic'
// Grid and MCP controls are composed inside ChatPanel
 
import DevModePanel from './headercomponent/DevModeButton'
import MainHeaderBar from './headercomponent/MainHeaderBar'
import { useRouter } from 'next/navigation'
import { useSession } from './context/SessionContext'
import type { Message as UIMessage } from '../components/ChatMain'
import { useUiMessages } from './hooks/useUiMessages'
import { useAccountData } from './context/AccountDataContext'
 

// Dynamically import ChatPanel (composes settings buttons and ChatInterface)
const ChatPanel = dynamic(
  () => import('./ChatPanel'),
  { ssr: false }
)

// Standard message format - follows OpenAI format
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  actionList?: string[]
  sources?: { service: string; query: string; url: string }[]
}

export default function Home() {
  const { getAccessToken, session, isAuthReady } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthReady && !session) {
      router.replace('/login')
    }
  }, [isAuthReady, session, router])
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
    saveSessionToBackend,
    updateMessages
  } = useSession()

  // UI state
  const [researchParams, setResearchParams] = useState<{ deep: number; wide: number }>({ deep: 1.0, wide: 1.0 })
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false)
  const [isDevModeOpen, setIsDevModeOpen] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [showCreateSuccess, setShowCreateSuccess] = useState(false)
  const { balance, balanceLoading } = useAccountData()
  
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

  // Close Dev Mode panel on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isDevModeOpen) return
      const target = event.target as Element
      const devPanel = document.querySelector('[data-dev-panel]')
      const devButton = document.querySelector('[data-dev-button]')
      const isClickInDev = devPanel ? devPanel.contains(target) : false
      const isClickOnDevButton = devButton ? devButton.contains(target) : false
      if (!isClickInDev && !isClickOnDevButton) {
        setIsDevModeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDevModeOpen])
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


  // Balance now comes from AccountDataContext (single source of truth). No local fetching here.

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

  // Map messages from Context to UI messages via hook (keeps this file lean)
  const uiMessages: UIMessage[] = useUiMessages(chatHistory, currentSessionId, sessionStreamingCache)

  // Decide whether to show a splash (logo) while chat history is loading/preparing
  const hasSession = !!currentSessionId
  const isTempSession = currentSessionId ? currentSessionId.startsWith('temp-') : false
  const hasLoadedCurrent = hasSession ? (chatHistory[currentSessionId!] !== undefined) : false
  const showChatSplash = !hasSession || (!isTempSession && !hasLoadedCurrent) || isLoadingChat

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

      // Prepare assistant placeholder to update in-place during streaming
      const assistantTimestamp = Date.now()
      let assistantMessage: ChatMessage = { role: 'assistant', content: '', timestamp: assistantTimestamp, actionList: [] }
      // Show assistant placeholder immediately in UI
      addMessage(targetSessionId!, assistantMessage)
      let workingHistory: ChatMessage[] = [...localHistoryBefore, assistantMessage]

      // Construct request data (strip UI-only fields like actionList before sending)
      const sanitizedHistory = localHistoryBefore.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }))
      
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
        history: sanitizedHistory  // Send conversation history without UI-only fields
      }

      console.log('🚀 Sending streaming request to backend:', message)

      // Call streaming API - use environment variable or default local address
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const token = await getAccessToken()
      const response = await fetch(`${apiUrl}/api/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestData),
        cache: 'no-store'
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

      // Read streaming response (buffer-safe)
      const decoder = new TextDecoder()
      let pending = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        pending += decoder.decode(value, { stream: true })
        const lines = pending.split('\n')
        // keep the last partial line in pending
        pending = lines.pop() || ''
        
        for (const rawLine of lines) {
          const line = rawLine.trimEnd()
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.action === 'complete' && data.final_report) {
                finalReport = data.final_report
                onStreamUpdate?.(finalReport, false, statusHistory) // 传递完整历史
                isGeneratingReport = false
                // Update assistant message with final content and full actionList
                assistantMessage = { ...assistantMessage, content: finalReport, actionList: statusHistory.length > 0 ? [...statusHistory] : undefined }
                workingHistory = [...localHistoryBefore, assistantMessage]
                updateMessages(targetSessionId!, workingHistory)
              } else if (data.action === 'report_chunk') {
                // Streaming report content
                finalReport = data.accumulated_report
                if (!isGeneratingReport) {
                  isGeneratingReport = true
                }
                onStreamUpdate?.(finalReport, true, statusHistory) // Stream the accumulated report
                // Update assistant content and (if any) actionList
                assistantMessage = { ...assistantMessage, content: finalReport, actionList: statusHistory.length > 0 ? [...statusHistory] : assistantMessage.actionList }
                workingHistory = [...localHistoryBefore, assistantMessage]
                updateMessages(targetSessionId!, workingHistory)
              } else if (data.action === 'sources_update' && Array.isArray(data.sources)) {
                // Update assistant message with latest minimal sources and sync UI
                assistantMessage = { ...assistantMessage, sources: data.sources }
                workingHistory = [...localHistoryBefore, assistantMessage]
                updateMessages(targetSessionId!, workingHistory)
              } else if (data.message) {
                statusHistory.push(data.message) // 👈 追加到历史，不覆盖
                // Only update streaming status if not currently generating report
                if (!isGeneratingReport) {
                  onStreamUpdate?.(data.message, true, statusHistory) // 传递当前消息和完整历史
                }
                // Reflect latest step into assistant actionList only; content should only show backend report chunks
                assistantMessage = { ...assistantMessage, actionList: [...statusHistory] }
                workingHistory = [...localHistoryBefore, assistantMessage]
                updateMessages(targetSessionId!, workingHistory)
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }

      // 📜 Cache the streaming history for this session
      if (statusHistory.length > 0) {
        setSessionStreamingCache(prev => ({
          ...prev,
          [targetSessionId]: statusHistory
        }))
        console.log('📜 Cached streaming history for session:', targetSessionId, 'steps:', statusHistory.length)
      }
      
      // ✅ Save to backend
      const completeHistory = workingHistory
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

  // Gate rendering to avoid flicker: wait for auth to resolve
  if (!isAuthReady) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(120, 120, 120, 0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(120, 120, 120, 0.06) 0%, transparent 50%)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <img src="/SimpleDWlogo.svg" alt="Deep Wide Research" width={52} height={52} style={{ opacity: 0.95 }} />
          <div style={{ marginTop: 4, color: '#bbb', fontSize: 12 }}>Loading…</div>
        </div>
      </div>
    )
  }

  // If not authenticated (and auth is ready), let the redirect occur without rendering chat UI
  if (!session) {
    return null
  }

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw',
      display: 'flex', 
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
        padding: '24px 24px 24px 24px',
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
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2px',
            overflow: 'hidden',
            minHeight: 0
          }}>
            {/* Top control bar (independent width) */}
            <MainHeaderBar
              isSidebarMenuOpen={isSidebarMenuOpen}
              onToggleSidebarMenu={() => setIsSidebarMenuOpen(prev => !prev)}
              isCreatingSession={isCreatingSession}
              showCreateSuccess={showCreateSuccess}
              onCreateNewChat={handleCreateNewChat}
              sessions={sessions}
              currentSessionId={currentSessionId}
              isLoadingSessions={isLoadingSessions}
              onSessionClick={handleSessionClick}
              onDeleteSession={handleDeleteSession}
              sidebarWidth={sidebarWidth}
              isDevModeOpen={isDevModeOpen}
              onToggleDevMode={() => setIsDevModeOpen(prev => !prev)}
              balance={balance}
              balanceLoading={balanceLoading}
            />

            {/* Dev Mode Panel (aligned with header width) */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: '900px' }} data-dev-panel>
                <DevModePanel isOpen={isDevModeOpen} onClose={() => setIsDevModeOpen(false)} />
              </div>
            </div>

            {/* ChatMain wrapper - fill remaining space */}
            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {showChatSplash ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img src="/SimpleDWlogo.svg" alt="Deep Wide Research" width={52} height={52} style={{ opacity: 0.95 }} />
                </div>
              ) : (
                <ChatPanel
                  key={chatComponentKey}
                  initialMessages={uiMessages.length > 0 ? uiMessages : undefined}
                  onSendMessage={handleSendMessage}
                  placeholder="Ask anything about your research topic..."
                  researchParams={researchParams}
                  onResearchParamsChange={setResearchParams}
                  mcpConfig={mcpConfig}
                  onMcpConfigChange={setMcpConfig}
                  style={{ height: '100%' }}
                />
              )}
            </div>

            {/* Composer is managed inside ChatPanel */}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from '../supabase/SupabaseAuthProvider'

// Type definitions
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  actionList?: string[]
  sources?: { service: string; query: string; url: string }[]
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

interface SessionContextType {
  // Lightweight: session metadata for all sessions
  sessions: Session[]
  
  // Heavy: chat history (lazy-loaded cache)
  chatHistory: Record<string, ChatMessage[]>
  
  // Currently selected session
  currentSessionId: string | null
  
  // Temporary session (not yet saved to backend)
  tempSessionId: string | null
  
  // Loading state
  isLoading: boolean
  isLoadingChat: boolean
  
  // Session operations
  fetchSessions: () => Promise<void>
  createSession: (title?: string) => Promise<string>
  createTempSession: () => string
  promoteTempSession: (title?: string) => Promise<string>
  switchSession: (id: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  
  // Message operations
  addMessage: (sessionId: string, message: ChatMessage) => void
  updateMessages: (sessionId: string, messages: ChatMessage[]) => void
  getCurrentMessages: () => ChatMessage[]
  
  // Save to backend
  saveSessionToBackend: (sessionId: string, messages: ChatMessage[]) => Promise<void>
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Lightweight: session list (metadata only)
  const [sessions, setSessions] = useState<Session[]>([])
  
  // Heavy: chat history (lazy-loaded, only store accessed sessions)
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({})
  
  // Currently selected session ID
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  
  // Temporary session ID (not saved to backend)
  const [tempSessionId, setTempSessionId] = useState<string | null>(null)
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingChat, setIsLoadingChat] = useState(false)

  // ==================== API Call Functions ====================
  
  // Fetch all sessions list (lightweight, metadata only)
  const { supabase, session: authSession } = useAuth()

  const fetchSessions = useCallback(async () => {
    if (!supabase) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('threads')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      type ThreadRow = {
        id: string
        title: string | null
        created_at: string | null
        updated_at: string | null
      }
      const result: Session[] = (data || []).map((t: ThreadRow) => ({
        id: t.id,
        title: t.title || 'New Chat',
        createdAt: t.created_at ? Date.parse(t.created_at) : Date.now(),
        updatedAt: t.updated_at ? Date.parse(t.updated_at) : Date.now(),
      }))
      setSessions(result)
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  // Fetch detailed messages for a single session (lazy-loaded)
  const fetchSessionMessages = useCallback(async (id: string) => {
    if (!supabase) return []
    setIsLoadingChat(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('thread_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      type MessageRow = {
        role: 'user' | 'assistant' | 'system'
        content: string
        created_at: string | null
      }
      const unpackContent = (raw: string): { content: string; actionList?: string[]; sources?: { service: string; query: string; url: string }[] } => {
        try {
          const obj = JSON.parse(raw)
          if (obj && obj.dw_format === 'v1' && typeof obj.content === 'string') {
            const actionList = Array.isArray(obj.actionList) ? obj.actionList.filter((x: unknown) => typeof x === 'string') : undefined
            const sources = Array.isArray(obj.sources)
              ? (obj.sources as Array<{ service?: unknown; query?: unknown; url?: unknown }>)
                  .map((s) => ({
                    service: String(s?.service ?? ''),
                    query: String(s?.query ?? ''),
                    url: String(s?.url ?? ''),
                  }))
                  .filter((s) => Boolean(s.service && s.url))
              : undefined
            return { content: obj.content as string, actionList, sources }
          }
        } catch (_) {
          // fall through
        }
        return { content: raw }
      }
      const msgs: ChatMessage[] = (data || []).map((m: MessageRow) => {
        const { content, actionList, sources } = unpackContent(m.content)
        return {
          role: m.role,
          content,
          actionList,
          sources,
          timestamp: m.created_at ? Date.parse(m.created_at) : undefined
        }
      })
      return msgs
    } catch (e) {
      console.error('Failed to fetch session messages:', e)
      return []
    } finally {
      setIsLoadingChat(false)
    }
  }, [supabase])

  // Create new session (save to backend immediately)
  const createSession = useCallback(async (title = 'New Chat') => {
    if (!supabase || !authSession) throw new Error('Not authenticated')
    try {
      const { data, error } = await supabase
        .from('threads')
        .insert([{ user_id: authSession.user.id, title }])
        .select('id')
        .single()
      if (error) throw error
      const newId = data.id as string
      await fetchSessions()
      setChatHistory(prev => ({ ...prev, [newId]: [] }))
      return newId
    } catch (e) {
      console.error('Failed to create session:', e)
      throw e
    }
  }, [supabase, authSession, fetchSessions])

  // Create temporary session (don't save to backend until user sends the first message)
  const createTempSession = useCallback(() => {
    const tempId = `temp-${Date.now()}`
    console.log('📝 Creating temp session:', tempId)
    
    // Initialize empty chat history
    setChatHistory(prev => ({
      ...prev,
      [tempId]: []
    }))
    
    // Set as temporary session
    setTempSessionId(tempId)
    setCurrentSessionId(tempId)
    
    return tempId
  }, [])

  // Promote temporary session to permanent session (save to backend)
  const promoteTempSession = useCallback(async (title = 'New Chat') => {
    if (!tempSessionId) {
      throw new Error('No temp session to promote')
    }
    
    console.log('⬆️ Promoting temp session to permanent:', tempSessionId)
    
    try {
      // Get messages from temporary session
      const messages = chatHistory[tempSessionId] || []
      
      if (!supabase || !authSession) throw new Error('Not authenticated')
      const { data: thread, error: threadErr } = await supabase
        .from('threads')
        .insert([{ user_id: authSession.user.id, title }])
        .select('id')
        .single()
      if (threadErr) throw threadErr
      const newId = thread.id as string
      if (messages.length > 0) {
        const rows = messages.map(m => ({
          thread_id: newId,
          user_id: authSession.user.id,
          role: m.role,
          content: JSON.stringify({
            dw_format: 'v1',
            content: m.content,
            actionList: m.actionList && m.actionList.length > 0 ? m.actionList : undefined,
            sources: m.sources && m.sources.length > 0 ? m.sources : undefined
          }),
          created_at: m.timestamp ? new Date(m.timestamp).toISOString() : undefined,
        }))
        const { error: msgErr } = await supabase.from('messages').insert(rows)
        if (msgErr) throw msgErr
      }
      
      // Refresh session list
      await fetchSessions()
      
      // Migrate messages from temporary session to new permanent session
      setChatHistory(prev => {
        const newHistory = { ...prev }
        newHistory[newId] = messages
        delete newHistory[tempSessionId]
        return newHistory
      })
      
      // Clear temporary session flag
      setTempSessionId(null)
      setCurrentSessionId(newId)
      
      console.log('✅ Temp session promoted to:', newId)
      return newId
    } catch (e) {
      console.error('Failed to promote temp session:', e)
      throw e
    }
  }, [tempSessionId, chatHistory, supabase, authSession, fetchSessions])

  // Switch session (lazy-loading strategy)
  const switchSession = useCallback(async (id: string) => {
    console.log('🔄 Switching to session:', id)
    setCurrentSessionId(id)
    
    // If switching to non-temporary session, clear temporary session flag and data
    if (!id.startsWith('temp-')) {
      if (tempSessionId) {
        console.log('🗑️ Clearing temp session:', tempSessionId)
        setChatHistory(prev => {
          const newHistory = { ...prev }
          delete newHistory[tempSessionId]
          return newHistory
        })
        setTempSessionId(null)
      }
      
      // Check if messages for this session have already been loaded
      if (!chatHistory[id]) {
        console.log('📥 Loading messages for session:', id)
        const messages = await fetchSessionMessages(id)
        setChatHistory(prev => ({
          ...prev,
          [id]: messages
        }))
        console.log('✅ Loaded', messages.length, 'messages')
      } else {
        console.log('✅ Using cached messages:', chatHistory[id].length)
      }
    }
  }, [chatHistory, fetchSessionMessages, tempSessionId])

  // Delete session (optimistic update, remove from UI immediately)
  const deleteSession = useCallback(async (id: string) => {
    // Save old state for recovery on failure
    const oldSessions = sessions
    const oldCurrentSessionId = currentSessionId
    
    try {
      // 🚀 Optimistic update: remove from UI immediately (don't trigger isLoading)
      const remainingSessions = sessions.filter(s => s.id !== id)
      setSessions(remainingSessions)
      
      // Remove from chatHistory
      setChatHistory(prev => {
        const newHistory = { ...prev }
        delete newHistory[id]
        return newHistory
      })
      
      // If deleting current session, immediately switch to the first one
      if (currentSessionId === id) {
        if (remainingSessions.length > 0) {
          await switchSession(remainingSessions[0].id)
        } else {
          setCurrentSessionId(null)
        }
      }
      
      // Delete in background (non-blocking UI)
      if (!supabase) throw new Error('Not ready')
      const { error } = await supabase.from('threads').delete().eq('id', id).limit(1)
      if (error) throw error
      
      console.log('✅ Session deleted:', id)
    } catch (e) {
      console.error('❌ Failed to delete session, rolling back:', e)
      // Delete failed, restore old state
      setSessions(oldSessions)
      if (oldCurrentSessionId !== currentSessionId) {
        setCurrentSessionId(oldCurrentSessionId)
      }
      throw e
    }
  }, [currentSessionId, sessions, switchSession, supabase])

  // ==================== Message Operations ====================
  
  // Add single message to context (real-time sync)
  const addMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setChatHistory(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), message]
    }))
  }, [])

  // Batch update messages (sync after backend returns)
  const updateMessages = useCallback((sessionId: string, messages: ChatMessage[]) => {
    setChatHistory(prev => ({
      ...prev,
      [sessionId]: messages
    }))
  }, [])

  // Get messages from current session
  const getCurrentMessages = useCallback(() => {
    if (!currentSessionId) return []
    return chatHistory[currentSessionId] || []
  }, [currentSessionId, chatHistory])

  // Save to backend
  const saveSessionToBackend = useCallback(async (sessionId: string, messages: ChatMessage[]) => {
    try {
      const firstUser = messages.find(m => m.role === 'user')
      const title = firstUser ? (firstUser.content || 'New Chat').slice(0, 60) : 'New Chat'
      if (!supabase || !authSession) throw new Error('Not authenticated')
      await supabase.from('threads').update({ title }).eq('id', sessionId)
      await supabase.from('messages').delete().eq('thread_id', sessionId)
      if (messages.length > 0) {
        const rows = messages.map(m => ({
          thread_id: sessionId,
          user_id: authSession.user.id,
          role: m.role,
          content: JSON.stringify({
            dw_format: 'v1',
            content: m.content,
            actionList: m.actionList && m.actionList.length > 0 ? m.actionList : undefined,
            sources: m.sources && m.sources.length > 0 ? m.sources : undefined
          }),
          created_at: new Date(m.timestamp ?? Date.now()).toISOString(),
        }))
        await supabase.from('messages').insert(rows)
      }
      await fetchSessions()
    } catch (e) {
      console.warn('Failed to save session to backend:', e)
      throw e
    }
  }, [fetchSessions, supabase, authSession])

  // ==================== Initialization ====================
  
  useEffect(() => {
    if (!supabase || !authSession) return
    let isMounted = true
    const init = async () => {
      try {
        await fetchSessions()
        if (!isMounted) return
        setSessions(currentSessions => {
          if (currentSessions.length === 0) {
            const tempId = `temp-${Date.now()}`
            setChatHistory(prev => ({ ...prev, [tempId]: [] }))
            setTempSessionId(tempId)
            setCurrentSessionId(tempId)
          } else if (!currentSessionId) {
            switchSession(currentSessions[0].id)
          }
          return currentSessions
        })
      } catch (e) {
        console.error('Failed to initialize sessions:', e)
      }
    }
    init()
    return () => { isMounted = false }
  }, [supabase, authSession, fetchSessions])

  const value: SessionContextType = {
    sessions,
    chatHistory,
    currentSessionId,
    tempSessionId,
    isLoading,
    isLoadingChat,
    fetchSessions,
    createSession,
    createTempSession,
    promoteTempSession,
    switchSession,
    deleteSession,
    addMessage,
    updateMessages,
    getCurrentMessages,
    saveSessionToBackend
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

// Custom Hook for convenient usage
export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}


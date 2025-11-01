'use client'

import React from 'react'
import type { Message as UIMessage } from '../../components/component/ChatInterface'

// chatHistory: { [sessionId]: Array<{ role: 'user'|'assistant'|'system'; content: string; timestamp?: number }> }
// sessionStreamingCache: { [sessionId]: string[] }
export function useUiMessages(
  chatHistory: Record<string, any[]>,
  currentSessionId: string | null | undefined,
  sessionStreamingCache: Record<string, string[]>
): UIMessage[] {
  return React.useMemo(() => {
    const currentMessages = currentSessionId ? (chatHistory[currentSessionId] || []) : []

    const cachedHistory = currentSessionId ? sessionStreamingCache[currentSessionId] : undefined

    // Find last assistant index
    let lastAssistantIdx = -1
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i]?.role === 'assistant') {
        lastAssistantIdx = i
        break
      }
    }

    const result: UIMessage[] = currentMessages.map((m: any, idx: number) => {
      const baseMessage: UIMessage = {
        id: `${m?.timestamp ?? idx}-${idx}`,
        content: m?.content ?? '',
        sender: (m?.role === 'assistant' ? 'bot' : 'user') as 'bot' | 'user',
        timestamp: new Date(m?.timestamp ?? Date.now())
      }

      // Attach cached streaming history to last assistant message
      if (m?.role === 'assistant' && idx === lastAssistantIdx && cachedHistory && cachedHistory.length > 0) {
        return { ...baseMessage, streamingHistory: cachedHistory }
      }
      return baseMessage
    })

    return result
  }, [chatHistory, currentSessionId, sessionStreamingCache])
}



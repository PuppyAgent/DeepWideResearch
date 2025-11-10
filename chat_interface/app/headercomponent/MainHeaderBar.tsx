'use client'

import React from 'react'
import type { Session } from '../context/SessionContext'
import { HistoryToggleButton } from './ChatHistoryButton'
import NewChatButton from './NewChatButton'
import SessionsOverlay from './ChatHistoryButton'
import AuthButton from './AuthButton'

export interface MainHeaderBarProps {
  isSidebarMenuOpen: boolean
  onToggleSidebarMenu: () => void
  isCreatingSession: boolean
  showCreateSuccess: boolean
  onCreateNewChat: () => void
  sessions: Session[]
  currentSessionId?: string | null
  isLoadingSessions: boolean
  onSessionClick: (id: string) => void
  onDeleteSession: (id: string) => void
  sidebarWidth: number
  isDevModeOpen: boolean
  onToggleDevMode: () => void
  balance: number | null
  balanceLoading: boolean
}

export default function MainHeaderBar({
  isSidebarMenuOpen,
  onToggleSidebarMenu,
  isCreatingSession,
  showCreateSuccess,
  onCreateNewChat,
  sessions,
  currentSessionId,
  isLoadingSessions,
  onSessionClick,
  onDeleteSession,
  sidebarWidth,
  isDevModeOpen,
  onToggleDevMode,
  balance,
  balanceLoading
}: MainHeaderBarProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 8px', 
        position: 'relative',
        flexShrink: 0,
        width: '100%',
        maxWidth: '900px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <HistoryToggleButton
            isOpen={isSidebarMenuOpen}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSidebarMenu()
            }}
          />

          <NewChatButton
            isCreating={isCreatingSession}
            showSuccess={showCreateSuccess}
            onClick={onCreateNewChat}
          />

          <SessionsOverlay
            isOpen={isSidebarMenuOpen}
            sidebarWidth={sidebarWidth}
            sessions={sessions}
            selectedSessionId={currentSessionId ?? null}
            isLoading={isLoadingSessions}
            onSessionClick={onSessionClick}
            onCreateNew={onCreateNewChat}
            onDeleteSession={onDeleteSession}
          />
        </div>

        <div style={{ width: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              data-dev-button
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
                cursor: 'default',
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
            <AuthButton onAvatarClick={() => onToggleDevMode()} />
          </div>
        </div>
      </div>
    </div>
  )
}



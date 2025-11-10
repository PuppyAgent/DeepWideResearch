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
              onClick={(e) => {
                e.stopPropagation()
                // Navigate to Plans tab
                try {
                  const evt = new CustomEvent('navigate-to-plans')
                  window.dispatchEvent(evt)
                } catch {}
                // Ensure dev panel is opened
                if (!isDevModeOpen) {
                  onToggleDevMode()
                }
              }}
              title={'Manage plan'}
              style={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 12px',
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
              {/* Icon + value (no "Credits" text) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="12" r="9.5" stroke="#8a8a8a" strokeWidth="2" />
                  <text x="12" y="12" textAnchor="middle" dominantBaseline="middle" alignmentBaseline="middle" fontSize="12" fill="#8a8a8a" fontWeight="700">c</text>
                </svg>
                <span style={{
                  color: '#e5e5e5',
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: '12px',
                  minWidth: '24px',
                  textAlign: 'left'
                }}>
                  {balanceLoading ? '—' : `${balance ?? '—'}`}
                </span>
              </div>
              {/* Divider */}
              <div style={{ width: 1, height: 18, background: '#2a2a2a' }} />
              {/* Subtle Upgrade label */}
              <span style={{ color: '#4599DF', fontSize: '14px', fontWeight: 400 }}>Upgrade</span>
            </div>
            <AuthButton onAvatarClick={() => onToggleDevMode()} />
          </div>
        </div>
      </div>
    </div>
  )
}



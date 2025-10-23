import React from 'react'
import SessionsSidebar from '../../components/SessionsSidebar'

interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

interface SessionsOverlayProps {
  isOpen: boolean
  sidebarWidth: number
  sessions: Session[]
  selectedSessionId: string | null
  isLoading: boolean
  onSessionClick: (id: string) => void
  onCreateNew: () => void
  onDeleteSession: (id: string) => void
}

export default function SessionsOverlay({
  isOpen,
  sidebarWidth,
  sessions,
  selectedSessionId,
  isLoading,
  onSessionClick,
  onCreateNew,
  onDeleteSession
}: SessionsOverlayProps) {
  return (
    <div
      data-sidebar-panel
      style={{
        position: 'absolute',
        top: '47px',
        left: '32px',
        width: `${sidebarWidth}px`,
        maxHeight: '60vh',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(25,25,25,0.98) 0%, rgba(15,15,15,0.98) 100%)',
        border: '1px solid #2a2a2a',
        borderRadius: '14px',
        boxShadow: isOpen 
          ? '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)' 
          : '0 4px 12px rgba(0,0,0,0.3)',
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
        transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: isOpen ? 'auto' : 'none',
        backdropFilter: 'blur(12px)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column'
      }}
      aria-hidden={!isOpen}
      onClick={(e) => e.stopPropagation()}
    >
      <SessionsSidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        isLoading={isLoading}
        showHeader={false}
        showNewButton={false}
        onSessionClick={onSessionClick}
        onCreateNew={onCreateNew}
        onDeleteSession={onDeleteSession}
      />
    </div>
  )
}


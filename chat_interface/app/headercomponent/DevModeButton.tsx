'use client'

import React from 'react'

interface DevModeButtonProps {
  isOpen: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export default function DevModeButton({ isOpen, onClick }: DevModeButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      title={isOpen ? 'Close Dev Mode' : 'Open Dev Mode'}
      aria-pressed={isOpen}
      style={{
        position: 'relative',
        width: '36px',
        height: '36px',
        borderRadius: '18px',
        border: isOpen ? '2px solid #4a4a4a' : '1px solid #2a2a2a',
        background: isOpen
          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)'
          : 'rgba(20, 20, 20, 0.9)',
        color: isOpen ? '#e6e6e6' : '#bbb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: isOpen
          ? '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 200ms ease',
        backdropFilter: 'blur(8px)',
        padding: 0,
        margin: 0
      }}
      onMouseEnter={(e) => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = '#3a3a3a'
          e.currentTarget.style.color = '#e6e6e6'
          e.currentTarget.style.transform = 'scale(1.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = '#2a2a2a'
          e.currentTarget.style.color = '#bbb'
          e.currentTarget.style.transform = 'scale(1)'
        }
      }}
      data-testid="dev-mode-button"
    >
      {/* Simple dev glyph: code brackets <> */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 16L4 12L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 8L20 12L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}



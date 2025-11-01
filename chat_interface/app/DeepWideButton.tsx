'use client'

import React, { useState } from 'react'
import DeepWideGrid, { type DeepWideValue } from './DeepWideGrid'

export interface DeepWideButtonProps {
  value: DeepWideValue
  onChange: (value: DeepWideValue) => void
}

export default function DeepWideButton({ value, onChange }: DeepWideButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Close panel on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen) {
        const target = event.target as Element
        const panel = document.querySelector('[data-deepwide-panel]')
        const button = document.querySelector('[data-deepwide-button]')
        if (panel && button) {
          const isClickInPanel = panel.contains(target)
          const isClickOnButton = button.contains(target)
          if (!isClickInPanel && !isClickOnButton) {
            setIsOpen(false)
          }
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div style={{ position: 'relative' }}>
      {/* Popover Panel */}
      <div
        style={{
          position: 'absolute',
          bottom: '47px',
          left: '0',
          background: 'linear-gradient(135deg, rgba(25,25,25,0.98) 0%, rgba(15,15,15,0.98) 100%)',
          border: '1px solid #2a2a2a',
          borderRadius: '14px',
          boxShadow: isOpen
            ? '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 4px 12px rgba(0,0,0,0.3)',
          overflow: 'visible',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
          transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: isOpen ? 'auto' : 'none',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
          padding: '12px'
        }}
        aria-hidden={!isOpen}
        data-deepwide-panel
      >
        <DeepWideGrid value={value} onChange={onChange} />
      </div>

      {/* Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        title="Deep × Wide"
        data-deepwide-button
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
          transform: isOpen ? 'scale(1.05)' : 'scale(1)',
          backdropFilter: 'blur(8px)',
          padding: 0,
          margin: 0
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#3a3a3a'
            e.currentTarget.style.color = '#e6e6e6'
            e.currentTarget.style.transform = 'scale(1.08)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#2a2a2a'
            e.currentTarget.style.color = '#bbb'
            e.currentTarget.style.transform = 'scale(1)'
          } else {
            e.currentTarget.style.transform = 'scale(1.05)'
          }
        }}
      >
        {/* Icon representing Deep × Wide */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="5" width="5" height="5" stroke="currentColor" strokeWidth="2" />
          <rect x="14" y="5" width="5" height="5" stroke="currentColor" strokeWidth="2" />
          <rect x="5" y="14" width="5" height="5" stroke="currentColor" strokeWidth="2" />
          <rect x="14" y="14" width="5" height="5" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </div>
  )
}



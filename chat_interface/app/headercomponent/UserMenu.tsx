'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../supabase/SupabaseAuthProvider'

export default function UserMenu() {
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!session) return null

  const email = session.user.email || ''
  const userName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || email.split('@')[0] || 'User'
  const initial = userName.trim().charAt(0).toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        title={email}
        onClick={() => setOpen(v => !v)}
        style={avatarButtonStyle}
      >
        <span style={avatarInnerStyle}>{initial}</span>
      </button>

      <div
        data-user-menu-panel
        style={{
          position: 'absolute',
          right: 0,
          top: 44,
          width: 180,
          background: 'linear-gradient(135deg, rgba(25,25,25,0.98) 0%, rgba(15,15,15,0.98) 100%)',
          border: '1px solid #2a2a2a',
          borderRadius: 14,
          boxShadow: open 
            ? '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 4px 12px rgba(0,0,0,0.3)',
          padding: 8,
          zIndex: 50,
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
          transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: open ? 'auto' : 'none',
          backdropFilter: 'blur(12px)'
        }}
        aria-hidden={!open}
      >
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid #2a2a2a',
          marginBottom: 4
        }}>
          <div style={{
            color: '#e6e6e6',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {userName}
          </div>
          <div style={{
            color: '#888',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {email}
          </div>
        </div>
        <MenuItem onClick={() => { console.log('Recharge clicked') }}>Recharge</MenuItem>
        <MenuItem onClick={() => { signOut() }}>Logout</MenuItem>
      </div>
    </div>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        height: 32,
        textAlign: 'left',
        padding: '0 4px 0 12px',
        borderRadius: 8,
        border: '1px solid transparent',
        background: 'transparent',
        color: '#888',
        fontSize: 14,
        cursor: 'pointer',
        transition: 'background-color 200ms ease, color 200ms ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = '#e6e6e6'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#888'
      }}
    >
      {children}
    </button>
  )
}

const avatarButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  border: '1px solid #2a2a2a',
  background: 'linear-gradient(135deg, rgba(60,60,60,0.6) 0%, rgba(40,40,40,0.6) 100%)',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 200ms ease'
}

const avatarInnerStyle: React.CSSProperties = {
  color: '#eee',
  fontSize: 14,
  fontWeight: 700,
}



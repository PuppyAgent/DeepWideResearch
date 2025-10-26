'use client'

import React from 'react'
import { useAuth } from '../supabase/SupabaseAuthProvider'

export default function AuthButton() {
  const { session, signInWithProvider, signOut } = useAuth()

  if (!session) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => signInWithProvider('google')} style={btnStyle}>Login with Google</button>
        <button onClick={() => signInWithProvider('github')} style={btnStyle}>GitHub</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#888', fontSize: 12 }}>{session.user.email}</span>
      <button onClick={signOut} style={btnStyle}>Logout</button>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #2a2a2a',
  background: 'rgba(20,20,20,0.9)',
  color: '#ddd',
  cursor: 'pointer'
}



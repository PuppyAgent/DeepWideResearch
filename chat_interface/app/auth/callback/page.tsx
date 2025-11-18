'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../supabase/SupabaseAuthProvider'

export default function AuthCallbackPage() {
  const { supabase, session } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    if (session) {
      router.replace('/')
      return
    }
    const run = async () => {
      try {
        // Let supabase-js parse the code/hash from the current URL and exchange for a session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (exchangeError) throw exchangeError
        router.replace('/')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Authentication failed'
        setError(msg)
        // Fallback to login after brief delay
        setTimeout(() => router.replace('/login'), 1200)
      }
    }
    void run()
  }, [supabase, session, router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0a',
      color: '#ddd',
      padding: 24
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/SimpleDWlogo.svg" alt="Deep Wide Research" width={48} height={48} style={{ opacity: 0.9, display: 'block', margin: '0 auto' }} />
        <div style={{ marginTop: 12, fontSize: 14 }}>
          {error ? `Auth error: ${error}` : 'Signing you in…'}
        </div>
      </div>
    </div>
  )
}



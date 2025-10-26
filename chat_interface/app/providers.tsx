'use client'

import { SessionProvider } from './context/SessionContext'
import { SupabaseAuthProvider } from './supabase/SupabaseAuthProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <SessionProvider>
        {children}
      </SessionProvider>
    </SupabaseAuthProvider>
  )
}


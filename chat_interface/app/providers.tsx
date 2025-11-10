'use client'

import { SessionProvider } from './context/SessionContext'
import { SupabaseAuthProvider } from './supabase/SupabaseAuthProvider'
import { AccountDataProvider } from './context/AccountDataContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <SessionProvider>
        <AccountDataProvider>
          {children}
        </AccountDataProvider>
      </SessionProvider>
    </SupabaseAuthProvider>
  )
}


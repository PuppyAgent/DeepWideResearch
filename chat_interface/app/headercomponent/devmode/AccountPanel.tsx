'use client'

import React from 'react'
import { useAuth } from '../../supabase/SupabaseAuthProvider'
import { PRIMARY_BUTTON_COLORS, getPrimaryButtonStyle } from './primaryButtonStyles'
import { useAccountData } from '../../context/AccountDataContext'

export default function AccountPanel() {
  const { session, signOut } = useAuth()
  const { plan, balance, balanceLoading, refreshBalance } = useAccountData()

  const email = session?.user?.email ?? '—'
  const userMeta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>
  const userName =
    (typeof userMeta?.['name'] === 'string' && userMeta['name']) ||
    (typeof userMeta?.['full_name'] === 'string' && userMeta['full_name']) ||
    (email.includes('@') ? email.split('@')[0] : 'User')
  
  // Plan/credits derived from context
  const activePlan = plan
  const upgradeable = activePlan === 'free' || activePlan === 'plus'
  const ctaLabel = upgradeable ? 'Upgrade' : 'Manage'
  const formatNumber = (n: number) => n.toLocaleString()
  const planInfo = React.useMemo(() => {
    if (activePlan === 'free') {
      return { credits: `${formatNumber(100)} credits/month` }
    }
    if (activePlan === 'plus') {
      return { credits: `${formatNumber(2000)} credits/month` }
    }
    if (activePlan === 'pro') {
      return { credits: `${formatNumber(15000)} credits/month` }
    }
    return { credits: 'Unlimited credits/month' }
  }, [activePlan])
  const featureInfo = React.useMemo(() => {
    if (activePlan === 'free') {
      return { customizedSources: false, apiSdk: false, support: 'Community support' }
    }
    if (activePlan === 'plus') {
      return { customizedSources: false, apiSdk: true, support: 'Priority support' }
    }
    if (activePlan === 'pro') {
      return { customizedSources: false, apiSdk: true, support: 'Dedicated support' }
    }
    return { customizedSources: true, apiSdk: true, support: '24/7 dedicated support' }
  }, [activePlan])
  const gotoPlans = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('navigate-to-plans')
      window.dispatchEvent(event)
    }
  }, [])
  const getMoreCreditsBaseBackground = PRIMARY_BUTTON_COLORS.base
  

  return (
    <div className='space-y-4'>
      {/* Account info card */}
      <div style={{
        border: '1px solid #2a2a2a',
        borderRadius: 12,
        background: 'linear-gradient(135deg, #0a0a0a 0%, #121212 100%)',
        padding: 32
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: '#e5e5e5', fontSize: 18, fontWeight: 700 }}>{userName}</div>
            <div style={{ color: '#8a8a8a', fontSize: 12 }}>{email}</div>
          </div>
          <button
            type='button'
            onClick={signOut}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 6,
              border: '1px solid #2a2a2a',
              background: 'transparent',
              color: '#e5e5e5',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease, border-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor = '#3a3a3a'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#2a2a2a'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Plan & Credits card (migrated inline from CreditsPanel) */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          border: '1px solid #2a2a2a', 
          borderRadius: 12, 
          background: 'linear-gradient(135deg, #0a0a0a 0%, #121212 100%)',
          padding: '32px',
          paddingRight: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Left side - Content */}
          <div style={{ flex: 1, zIndex: 1 }}>
            {/* Plan row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a8a', marginBottom: 6 }}>Plan</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e5e5' }}>
                  {activePlan === 'free' ? 'Free' : activePlan === 'plus' ? 'Plus' : activePlan === 'pro' ? 'Pro' : 'Enterprise'}
                </div>
              </div>
            </div>
            {/* Divider */}
            <div style={{ height: 1, background: '#2a2a2a', margin: '8px 0 12px 0' }} />
            {/* Credits label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8a8a' }}>Credits</div>
            </div>
            {/* Credits value + refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e5e5' }}>
                {balanceLoading ? '…' : (typeof balance === 'number' ? formatNumber(balance) : '—')}
              </div>
              <button
                onClick={() => { refreshBalance().catch(() => {}) }}
                disabled={balanceLoading}
                aria-label='Refresh credits'
                title='Refresh'
                style={{ background: 'transparent', border: 'none', color: '#cfcfcf', cursor: balanceLoading ? 'progress' : 'pointer' }}
              >
                <svg 
                  width='16' 
                  height='16' 
                  viewBox='0 0 24 24' 
                  fill='none' 
                  stroke='currentColor' 
                  strokeWidth='2' 
                  strokeLinecap='round' 
                  strokeLinejoin='round'
                  className={balanceLoading ? 'animate-spin' : ''}
                >
                  <path d='M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2'/>
                </svg>
              </button>
            </div>
            {/* Plan summary (monthly credits only) */}
            <div style={{ color: '#8a8a8a', fontSize: 12 }}>
              {planInfo.credits}
            </div>
            {/* Features checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {featureInfo.customizedSources ? (
                  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#22C55E' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='20 6 9 17 4 12'/>
                  </svg>
                ) : (
                  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#EF4444' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                )}
                <span style={{ fontSize: 12, color: '#8a8a8a' }}>Customized information sources</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {featureInfo.apiSdk ? (
                  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#22C55E' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='20 6 9 17 4 12'/>
                  </svg>
                ) : (
                  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#EF4444' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                )}
                <span style={{ fontSize: 12, color: '#8a8a8a' }}>API & SDK access</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#22C55E' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                  <polyline points='20 6 9 17 4 12'/>
                </svg>
                <span style={{ fontSize: 12, color: '#8a8a8a' }}>{featureInfo.support}</span>
              </div>
            </div>
            {/* Primary CTA at very bottom (below description) */}
            <div style={{ marginTop: 12 }}>
              <button
                type='button'
                onClick={gotoPlans}
                style={getPrimaryButtonStyle({})}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = PRIMARY_BUTTON_COLORS.hover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = getMoreCreditsBaseBackground
                }}
              >
                {upgradeable && (
                  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>
                    <path d='M12 19V5M5 12l7-7 7 7'/>
                  </svg>
                )}
                <span>{ctaLabel}</span>
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}



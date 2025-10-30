'use client'

import React from 'react'
import { useAuth } from '../supabase/SupabaseAuthProvider'

interface ApiKeyItem {
  id: string
  prefix: string
  name?: string
  created_at?: string
  last_used_at?: string
  expires_at?: string | null
  revoked_at?: string | null
  scopes: string[]
  api_key?: string
  used_credits?: number
}

interface DevModePanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function DevModePanel({ isOpen, onClose }: DevModePanelProps) {
  const { getAccessToken, session } = useAuth()
  const [loading, setLoading] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [keys, setKeys] = React.useState<ApiKeyItem[]>([])
  const [balance, setBalance] = React.useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [languageByKey, setLanguageByKey] = React.useState<Record<string, 'curl' | 'node' | 'python'>>({})
  const [copiedKeyId, setCopiedKeyId] = React.useState<string | null>(null)
  const [copiedSnippetFor, setCopiedSnippetFor] = React.useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = React.useState<string | null>(null)
  const [showSecretByKey, setShowSecretByKey] = React.useState<Record<string, boolean>>({})
  const [isRendered, setIsRendered] = React.useState(false)
  const [animateIn, setAnimateIn] = React.useState(false)
  const hasLoadedRef = React.useRef(false)
  const [activeTab, setActiveTab] = React.useState<'credits' | 'api-keys'>('credits')
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const paymentsBase = process.env.NEXT_PUBLIC_PAYMENTS_API_URL || apiBase
  const polarProductId = process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID
  const productId15 = process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID_15
  const productId100 = process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID_100
  const productIdsJson = process.env.NEXT_PUBLIC_POLAR_PRODUCT_IDS_JSON
  const parsedProductIds = React.useMemo<Record<string, string> | null>(() => {
    try {
      return productIdsJson ? JSON.parse(productIdsJson) : null
    } catch {
      return null
    }
  }, [productIdsJson])
  const resolvedProductId15 = productId15 || parsedProductIds?.['15'] || parsedProductIds?.['plus'] || parsedProductIds?.['PLUS'] || null
  const resolvedProductId100 = productId100 || parsedProductIds?.['100'] || parsedProductIds?.['pro'] || parsedProductIds?.['PRO'] || null
  const canBuyPlus = !!resolvedProductId15
  const canBuyPro = !!resolvedProductId100
  const [activePlan, setActivePlan] = React.useState<'free' | 'plus' | 'pro' | 'enterprise'>('free')

  React.useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('dwr_active_plan') : null
      if (saved === 'free' || saved === 'plus' || saved === 'pro' || saved === 'enterprise') {
        setActivePlan(saved)
      }
    } catch {}
  }, [])

  const copyToClipboard = React.useCallback(async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      return true
    } catch {
      return false
    }
  }, [])

  const formatDate = React.useCallback((iso?: string) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleString()
    } catch {
      return '—'
    }
  }, [])

  const gotoCheckout = React.useCallback((productId?: string | null, planKey?: 'plus' | 'pro') => {
    let url = '/api/polar/checkout'
    const pid = productId
    if (!pid) {
      alert('Billing not configured: missing product id')
      return
    }
    const q = url.includes('?') ? '&' : '?'
    url = `${url}${q}products=${encodeURIComponent(pid)}`
    const email = session?.user?.email
    if (email) {
      url += `&customerEmail=${encodeURIComponent(email)}`
    }
    // Mark as pending only; activation happens after checkout success callback
    if (planKey) {
      try {
        localStorage.setItem('dwr_pending_plan', planKey)
      } catch {}
    }
    try {
      window.location.href = url
    } catch {
      try { window.open(url, '_blank', 'noopener') } catch {}
    }
  }, [polarProductId, session?.user?.email])

  const fetchKeys = React.useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${apiBase}/api/keys`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setKeys(data.keys || [])
    } catch (e) {
      console.warn('Failed to load keys', e)
    } finally {
      setLoading(false)
    }
  }, [apiBase, getAccessToken])

  const fetchBalance = React.useCallback(async () => {
    setBalanceLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${apiBase}/api/credits/balance`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      if (res.ok) {
        const data = await res.json()
        setBalance(typeof data.balance === 'number' ? data.balance : null)
      }
    } catch (e) {
      console.warn('Failed to load balance', e)
    } finally {
      setBalanceLoading(false)
    }
  }, [apiBase, getAccessToken])

  React.useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      fetchKeys()
      fetchBalance()
    }
  }, [isOpen, fetchKeys, fetchBalance])

  // Promote pending plan to active after returning with success flag
  React.useEffect(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      const isSuccess = !!(params && (params.get('checkout') === 'success' || params.get('success') === '1'))
      if (!isSuccess) return
      const pending = typeof window !== 'undefined' ? localStorage.getItem('dwr_pending_plan') : null
      if (pending === 'plus' || pending === 'pro') {
        localStorage.setItem('dwr_active_plan', pending)
        localStorage.removeItem('dwr_pending_plan')
        setActivePlan(pending)
        // notify payments service to grant credits immediately (webhook is still the primary path)
        ;(async () => {
          try {
            const token = await getAccessToken()
            await fetch(`${paymentsBase}/api/polar/checkout/success`, {
              method: 'POST',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ plan: pending })
            })
          } catch {}
          try { await fetchBalance() } catch {}
        })()
      }
    } catch {}
  }, [fetchBalance])

  const createKey = async () => {
    if (creating) return
    setCreating(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${apiBase}/api/keys`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'default' })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const newItem: ApiKeyItem = {
        id: data.id,
        prefix: data.prefix,
        name: data.name,
        created_at: new Date().toISOString(),
        last_used_at: undefined,
        expires_at: data.expires_at,
        revoked_at: null,
        scopes: ['research:invoke'],
        api_key: data.api_key
      }
      setKeys(prev => [newItem, ...prev])
      setExpandedId(data.id)
      setTimeout(() => { fetchKeys().catch(() => {}) }, 1500)
    } catch (e) {
      console.warn('Failed to create key', e)
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: string) => {
    try {
      const token = await getAccessToken()
      const res = await fetch(`${apiBase}/api/keys/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!res.ok) throw new Error(await res.text())
      await fetchKeys()
      if (expandedId === id) setExpandedId(null)
    } catch (e) {
      console.warn('Failed to revoke key', e)
    }
  }

  // Close on ESC
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Animate panel mount/unmount
  React.useEffect(() => {
    if (isOpen) {
      setIsRendered(true)
      setAnimateIn(false)
      let raf1 = 0
      let raf2 = 0
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setAnimateIn(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    } else {
      setAnimateIn(false)
      const t = setTimeout(() => setIsRendered(false), 450)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  if (!isRendered) return null

  const NavBtn = ({ id, label, icon }: { id: 'credits' | 'api-keys', label: string, icon?: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
        activeTab === id ? 'bg-[#1F1F1F] text-[#E5E5E5]' : 'text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-[#E5E5E5]'
      }`}
    >
      {icon}
      <span className='text-[13px]'>{label}</span>
    </button>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, opacity: animateIn ? 1 : 0, transition: 'opacity 450ms cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 400ms ease'
        }}
      />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-1/2 left-1/2 ${animateIn ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'} -translate-x-1/2 -translate-y-1/2 w-[min(980px,96vw)] h-[720px] overflow-hidden bg-[linear-gradient(140deg,rgba(22,22,22,0.98)_0%,rgba(14,14,14,0.98)_100%)] border border-[#2a2a2a] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.06)] transition-all`}
      >
        <div className='flex h-full text-[13px] text-[#D4D4D4]'>
          {/* Sidebar */}
          <div className='w-56 h-full border-r border-[#2f2f2f] bg-transparent py-3'>
            <nav className='space-y-0.5 px-2'>
              <div className='px-2 pb-1 text-[12px] font-semibold text-[#9CA3AF]'>Account</div>
              <NavBtn id='credits' label='Credits' icon={<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='10'/><path d='M8 12h8M8 16h5M8 8h8'/></svg>} />
              <NavBtn id='api-keys' label='API Keys' icon={<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M21 2l-2 2m-7 7l-2 2m4-4l-2 2m-7 7l-2 2'/><circle cx='7' cy='17' r='3'/><path d='M7 14l6-6 4 4'/></svg>} />
            </nav>
          </div>

          {/* Content */}
          <div className='flex flex-col flex-1 pl-6 pr-4 py-6 overflow-y-auto min-h-0'>
            <div className='flex items-center justify-start mb-3'>
              <div className='text-[16px] font-semibold text-[#e6e6e6]'>
                {activeTab === 'credits' ? 'Credits' : 'API Keys'}
              </div>
            </div>

            {/* Credits */}
            {activeTab === 'credits' && (
              <div className='space-y-4'>
                {/* Active plan */}
                <div>
                  <div className='text-[12px] font-semibold text-[#9CA3AF] mb-2'>Active plan</div>
                  <div className='rounded-xl border border-[#2a2a2a] bg-[#121212] px-4 py-3 flex items-start justify-between'>
                    <div>
                      <div className='text-[16px] font-semibold text-[#E5E5E5]'>Current plan</div>
                      <div className='text-[13px] text-[#9AA0A6]'>The connected research workspace</div>
                      <div className='text-[12px] text-[#9AA0A6] mt-2'>$15 or $100 billed monthly • includes monthly credits</div>
                    </div>
                    <div className='text-right'>
                      <div className='text-[12px] text-[#9AA0A6] mb-1'>Balance</div>
                      <div className='text-[28px] font-extrabold text-[#4599DF] leading-7'>
            {balanceLoading ? '…' : (balance ?? '—')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* All plans */}
                <div>
                  <div className='text-[12px] font-semibold text-[#9CA3AF] mb-2'>All plans</div>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
                    {/* Free */}
                    <div className='border border-white/20 bg-black/20 p-4 md:p-5 flex flex-col rounded-xl'>
                      <div className='text-[16px] font-semibold text-foreground/90 mb-1'>Free</div>
                      <div className='mt-1 mb-4'>
                        <span className='text-[22px] font-bold text-foreground/90'>$0</span>
                        <span className='text-[12px] text-foreground/50 ml-1'>/ month</span>
                      </div>
                      <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span><strong className='text-foreground/90'>100 credits</strong> per month</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>Community support</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-foreground/40'>[✗]</span>
                          <span className='text-foreground/60'>API & SDK access</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-foreground/40'>[✗]</span>
                          <span className='text-foreground/60'>Advanced features</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-foreground/40'>[✗]</span>
                          <span className='text-foreground/60'>Custom integrations</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-foreground/40'>[✗]</span>
                          <span className='text-foreground/60'>SLA & compliance</span>
                        </div>
                      </div>
                    </div>

                    {/* Plus - highlight only if active */}
                    <div className={`${activePlan==='plus' ? 'border-[#2CAC58] bg-gradient-to-br from-[#2CAC58]/10 to-black/20' : 'border-white/20 bg-black/20'} border p-4 md:p-5 flex flex-col relative rounded-xl`}>
                      {activePlan==='plus' && (<div className='absolute top-0 right-0 bg-[#2CAC58] px-2 py-0.5 text-[10px] font-bold text-white rounded-bl-md'>Active</div>)}
                      <div className='text-[16px] font-semibold text-foreground/90 mb-1'>Plus</div>
                      <div className='mt-1 mb-4'>
                        <span className='text-[22px] font-bold text-foreground/90'>$15</span>
                        <span className='text-[12px] text-foreground/50 ml-1'>/ month</span>
                      </div>
                      <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span><strong className='text-foreground/90'>2,000 credits</strong> per month</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>API & SDK access</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>Priority support</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>Advanced features</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-foreground/40'>[✗]</span>
                          <span className='text-foreground/60'>Custom integrations</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-foreground/40'>[✗]</span>
                          <span className='text-foreground/60'>SLA & compliance</span>
                        </div>
                      </div>
                      <button
                        onClick={() => gotoCheckout(resolvedProductId15, 'plus')}
                        disabled={!canBuyPlus}
                        className={`w-full px-4 py-2.5 text-[12px] font-semibold transition-all rounded-md ${activePlan==='plus' ? 'bg-[#2CAC58] hover:bg-[#25994D] text-white shadow-lg shadow-[#2CAC58]/20 hover:shadow-xl hover:shadow-[#2CAC58]/30' : 'border border-white/20 bg-white/5 hover:bg-white/10 text-foreground/90'}`}
                      >{activePlan==='plus' ? 'Current plan' : (canBuyPlus ? 'Upgrade' : 'Configure')}</button>
                    </div>

                    {/* Pro */}
                    <div className={`${activePlan==='pro' ? 'border-[#2CAC58] bg-gradient-to-br from-[#2CAC58]/10 to-black/20' : 'border-white/20 bg-black/20'} border p-4 md:p-5 flex flex-col relative rounded-xl`}>
                      {activePlan==='pro' && (<div className='absolute top-0 right-0 bg-[#2CAC58] px-2 py-0.5 text-[10px] font-bold text-white rounded-bl-md'>Active</div>)}
                      <div className='text-[16px] font-semibold text-foreground/90 mb-1'>Pro</div>
                      <div className='mt-1 mb-4'>
                        <span className='text-[22px] font-bold text-foreground/90'>$100</span>
                        <span className='text-[12px] text-foreground/50 ml-1'>/ month</span>
                      </div>
                      <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span><strong className='text-foreground/90'>15,000 credits</strong> per month</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>API & SDK access</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>Dedicated support</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>All advanced features</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-[#2CAC58]'>[✓]</span>
                          <span>Custom integrations</span>
                        </div>
                        <div className='flex items-start gap-2'>
                          <span className='text-foreground/40'>[✗]</span>
                          <span className='text-foreground/60'>SLA & compliance</span>
                        </div>
                      </div>
                      <button
                        onClick={() => gotoCheckout(resolvedProductId100, 'pro')}
                        disabled={!canBuyPro}
                        className={`w-full px-4 py-2.5 text-[12px] font-semibold transition-all rounded-md ${activePlan==='pro' ? 'bg-[#2CAC58] hover:bg-[#25994D] text-white shadow-lg shadow-[#2CAC58]/20 hover:shadow-xl hover:shadow-[#2CAC58]/30' : 'border border-white/20 bg-white/5 hover:bg-white/10 text-foreground/90'}`}
                      >{activePlan==='pro' ? 'Current plan' : (canBuyPro ? 'Upgrade' : 'Configure')}</button>
                    </div>

                    {/* Enterprise */}
                    <div className='border border-white/20 bg-black/20 p-4 md:p-5 flex flex-col rounded-xl'>
                      <div className='text-[16px] font-semibold text-foreground/90 mb-2'>Enterprise</div>
                      <div className='mt-1 mb-4'>
                        <span className='text-[18px] font-bold text-foreground/90'>Custom</span>
                      </div>
                      <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
                        <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span><strong className='text-foreground/90'>Unlimited credits</strong></span></div>
                        <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>API & SDK access</span></div>
                        <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>24/7 dedicated support</span></div>
                        <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>All advanced features</span></div>
                        <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>Custom integrations</span></div>
                        <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>SLA & compliance</span></div>
                      </div>
                      <a href='mailto:guantum@puppyagent.com' className='w-full text-center border border-[#2CAC58] bg-[#2CAC58]/10 hover:bg-[#2CAC58]/20 px-4 py-2.5 text-[12px] font-semibold text-foreground/90 transition-all rounded-md'>
                        Contact Sales
                      </a>
                    </div>
        </div>
      </div>
                {/* Highlights removed per request */}
              </div>
            )}

            {/* API Keys */}
            {activeTab === 'api-keys' && (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 12 }}>
          {loading && <div style={{ color: '#888', fontSize: '14px' }}>Loading...</div>}
          {!loading && keys.length === 0 && (
            <div style={{ color: '#888', fontSize: '14px' }}>No keys yet.</div>
          )}
          {!loading && keys.length > 0 && (
            <div style={{ border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#121212' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px 80px', padding: '10px 12px', color: '#9aa0a6', fontSize: 14, background: 'transparent' }}>
                <div>Key</div>
                <div style={{ textAlign: 'left' }}>Actions</div>
                <div style={{ textAlign: 'right' }}>Used</div>
              </div>
              {keys.map(k => {
                const expanded = expandedId === k.id
                const lang = languageByKey[k.id] || 'curl'
                const displayKey = k.api_key || `dwr_${k.prefix}_<SECRET>`
                const placeholder = displayKey
                return (
                  <React.Fragment key={k.id}>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: '1fr 112px 80px', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid #2a2a2a', cursor: 'pointer', background: hoveredRowId === k.id ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background-color 200ms ease' }}
                      onMouseEnter={() => setHoveredRowId(k.id)}
                      onMouseLeave={() => setHoveredRowId(prev => (prev === k.id ? null : prev))}
                      onClick={() => setExpandedId(expanded ? null : k.id)}
                    >
                      <code style={{ color: '#22C55E', fontSize: '14px', wordBreak: 'break-all' }}>
                        {(() => {
                          const full = displayKey
                          const visible = showSecretByKey[k.id]
                          if (!full) return ''
                          if (visible) return full
                          const firstUnderscore = full.indexOf('_')
                          const secondUnderscore = firstUnderscore >= 0 ? full.indexOf('_', firstUnderscore + 1) : -1
                          const stars = '*'.repeat(12)
                          if (firstUnderscore >= 0 && secondUnderscore > firstUnderscore) {
                            const prefixAll = full.substring(firstUnderscore + 1, secondUnderscore)
                            const prefixShort = prefixAll.slice(0, 4)
                            return `dwr_${prefixShort}…_${stars}`
                          }
                          const last = full.lastIndexOf('_')
                          if (last >= 0) return `${full.slice(0, last + 1)}${stars}`
                          return stars
                        })()}
                      </code>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setShowSecretByKey(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
                          title={showSecretByKey[k.id] ? 'Hide' : 'Show'}
                          aria-label={showSecretByKey[k.id] ? 'Hide' : 'Show'}
                          style={{ width: 28, height: 28, padding: 0, borderRadius: 6, border: 'none', background: 'transparent', color: '#d6d6d6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await copyToClipboard(displayKey)
                            if (ok) {
                              setCopiedKeyId(k.id)
                              setTimeout(() => setCopiedKeyId(null), 1200)
                            }
                          }}
                          title={copiedKeyId === k.id ? 'Copied' : 'Copy API key'}
                          aria-label={copiedKeyId === k.id ? 'Copied' : 'Copy API key'}
                          style={{ width: 32, height: 32, padding: 0, borderRadius: 6, border: 'none', background: 'transparent', color: copiedKeyId === k.id ? '#4ade80' : '#d6d6d6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {copiedKeyId === k.id ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                              <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.6"/>
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => { revokeKey(k.id) }}
                          title="Revoke API key"
                          aria-label="Revoke API key"
                          style={{ width: 32, height: 32, padding: 0, borderRadius: 6, border: 'none', background: 'transparent', color: '#ff7a7a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                      <div style={{ color: '#c6c6c6', fontSize: '14px', textAlign: 'right' }}>{typeof k.used_credits === 'number' ? k.used_credits : 0}</div>
                    </div>
                    <div
                      style={{
                        borderTop: expanded ? '1px solid #2a2a2a' : '1px solid transparent',
                        padding: expanded ? '10px 12px' : '0 12px',
                        background: '#101010',
                        maxHeight: expanded ? 360 : 0,
                        opacity: expanded ? 1 : 0,
                        transform: expanded ? 'translateY(0)' : 'translateY(-6px)',
                        overflow: 'hidden',
                        transition: 'max-height 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease, transform 500ms ease, border-top-color 500ms ease, padding 500ms ease'
                      }}
                      aria-hidden={!expanded}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['curl','node','python'] as const).map(l => (
                            <button
                              key={l}
                              onClick={() => setLanguageByKey(prev => ({ ...prev, [k.id]: l }))}
                              style={{
                                height: 32,
                                padding: '0 10px',
                                borderRadius: 6,
                                border: '1px solid #2a2a2a',
                                background: (lang === l) ? '#1e1e1e' : 'transparent',
                                color: '#ddd',
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >{l}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ color: '#8b8b8b', fontSize: 14, marginBottom: 6 }}>Endpoint: <code style={{ color: '#cfcfcf' }}>{apiBase}/api/research</code></div>
                      <div style={{ position: 'relative' }}>
                        <pre style={{ whiteSpace: 'pre-wrap', color: '#cfcfcf', fontSize: '14px', margin: 0, background: '#000000', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px', paddingTop: '34px' }}>
                                  {(() => {
                                    const codeFor = (lang: 'curl' | 'node' | 'python', placeholder: string) => {
                                      if (lang === 'node') return `import fetch from 'node-fetch';\n\nasync function run() {\n  const res = await fetch('${apiBase}/api/research', {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      'X-API-Key': '${placeholder}'\n    },\n    body: JSON.stringify({\n      message: { query: 'Your research question', deepwide: { deep: 0.8, wide: 0.6 }, mcp: {} },\n      history: []\n    })\n  });\n  for await (const chunk of res.body) {\n    process.stdout.write(chunk.toString());\n  }\n}\n\nrun().catch(console.error);`
                                      if (lang === 'python') return `import requests\n\nurl = '${apiBase}/api/research'\nheaders = {\n  'Content-Type': 'application/json',\n  'X-API-Key': '${placeholder}'\n}\npayload = {\n  'message': {\n    'query': 'Your research question',\n    'deepwide': { 'deep': 0.8, 'wide': 0.6 },\n    'mcp': {}\n  },\n  'history': []\n}\n\nwith requests.post(url, headers=headers, json=payload, stream=True) as r:\n    for line in r.iter_lines():\n        if line:\n            print(line.decode('utf-8'))`
                                      return `curl -N -X POST "${apiBase}/api/research" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${placeholder}" \\\n  -d '{\n    "message": {\n      "query": "Your research question",\n      "deepwide": { "deep": 0.8, "wide": 0.6 },\n      "mcp": {}\n    },\n    "history": []\n  }'`
                                    }
                                    const lang = languageByKey[k.id] || 'curl'
                                    return codeFor(lang, placeholder)
                                  })()}
                        </pre>
                        <button
                          onClick={async () => {
                                    const lang = languageByKey[k.id] || 'curl'
                                    const codeFor = (lang: 'curl' | 'node' | 'python', placeholder: string) => {
                                      if (lang === 'node') return `import fetch from 'node-fetch';\n\nasync function run() {\n  const res = await fetch('${apiBase}/api/research', {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      'X-API-Key': '${placeholder}'\n    },\n    body: JSON.stringify({\n      message: { query: 'Your research question', deepwide: { deep: 0.8, wide: 0.6 }, mcp: {} },\n      history: []\n    })\n  });\n  for await (const chunk of res.body) {\n    process.stdout.write(chunk.toString());\n  }\n}\n\nrun().catch(console.error);`
                                      if (lang === 'python') return `import requests\n\nurl = '${apiBase}/api/research'\nheaders = {\n  'Content-Type': 'application/json',\n  'X-API-Key': '${placeholder}'\n}\npayload = {\n  'message': {\n    'query': 'Your research question',\n    'deepwide': { 'deep': 0.8, 'wide': 0.6 },\n    'mcp': {}\n  },\n  'history': []\n}\n\nwith requests.post(url, headers=headers, json=payload, stream=True) as r:\n    for line in r.iter_lines():\n        if line:\n            print(line.decode('utf-8'))`
                                      return `curl -N -X POST "${apiBase}/api/research" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${placeholder}" \\\n  -d '{\n    "message": {\n      "query": "Your research question",\n      "deepwide": { "deep": 0.8, "wide": 0.6 },\n      "mcp": {}\n    },\n    "history": []\n  }'`
                                    }
                                    const snippet = codeFor(lang, placeholder)
                                    const ok = await copyToClipboard(snippet)
                            if (ok) {
                              setCopiedSnippetFor(k.id)
                              setTimeout(() => setCopiedSnippetFor(null), 1200)
                            }
                          }}
                          title={copiedSnippetFor === k.id ? 'Copied' : 'Copy example'}
                          aria-label="Copy example"
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 28,
                            height: 28,
                            border: 'none',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.06)',
                            color: copiedSnippetFor === k.id ? '#4ade80' : '#d6d6d6',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {copiedSnippetFor === k.id ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                              <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.6"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={createKey}
            disabled={creating}
            title="Create new API key"
            aria-label="Create new API key"
            style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.6)', background: creating ? '#14532d' : 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)', color: '#0b1b10', fontWeight: 400, letterSpacing: 0.2, cursor: creating ? 'progress' : 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', boxShadow: 'none' }}
          >
            {creating ? 'Creating…' : 'Create a New key'}
          </button>
                </div>
              </div>
            )}
        </div>
      </div>
      </div>
    </div>
  )
}



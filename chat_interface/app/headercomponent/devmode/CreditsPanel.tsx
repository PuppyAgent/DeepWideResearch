'use client'

import React from 'react'
import { useAuth } from '../../supabase/SupabaseAuthProvider'

export default function CreditsPanel() {
  const { getAccessToken, session, supabase } = useAuth()
  const [balance, setBalance] = React.useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = React.useState(false)
  const [activePlan, setActivePlan] = React.useState<'free' | 'plus' | 'pro' | 'team'>('free')
  const [dwPlusLabel, setDwPlusLabel] = React.useState('downgrade')
  const [dwProLabel, setDwProLabel] = React.useState('downgrade')

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const paymentsBase = process.env.NEXT_PUBLIC_PAYMENTS_API_URL || apiBase
  const paymentsFallback = process.env.NEXT_PUBLIC_PAYMENTS_FALLBACK === '1'
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

  React.useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('dwr_active_plan') : null
      if (saved === 'free' || saved === 'plus' || saved === 'pro' || saved === 'team') {
        setActivePlan(saved)
      }
    } catch {}
  }, [])

  const fetchBalance = React.useCallback(async () => {
    setBalanceLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${apiBase}/api/credits/balance`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>
        const rawUnknown = data?.['balance']
        const numeric = typeof rawUnknown === 'number' ? rawUnknown : (typeof rawUnknown === 'string' ? Number(rawUnknown) : NaN)
        setBalance(Number.isFinite(numeric) ? numeric : null)
      }
    } catch (e) {
      console.warn('Failed to load balance', e)
    } finally {
      setBalanceLoading(false)
    }
  }, [apiBase, getAccessToken])

  const fetchPlan = React.useCallback(async () => {
    try {
      if (!supabase || !session?.user?.id) return
      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', session.user.id)
        .single()
      if (!error && data && typeof data.plan === 'string') {
        const p = data.plan as 'free' | 'plus' | 'pro' | 'team'
        setActivePlan(p)
        try { localStorage.setItem('dwr_active_plan', p) } catch {}
      }
    } catch (e) {
      console.warn('Failed to load plan', e)
    }
  }, [supabase, session?.user?.id])

  const onRefreshBalance = React.useCallback(() => {
    fetchBalance().catch(() => {})
  }, [fetchBalance])

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
    const userId = session?.user?.id
    if (userId) {
      // multiple encodings for compatibility
      url += `&metadata.user_id=${encodeURIComponent(userId)}`
      url += `&metadata[user_id]=${encodeURIComponent(userId)}`
      url += `&metadata[supabase_user_id]=${encodeURIComponent(userId)}`
      try {
        const metaObj: Record<string, string> = { user_id: userId }
        if (planKey) metaObj.plan = planKey
        url += `&metadata=${encodeURIComponent(JSON.stringify(metaObj))}`
      } catch {}
    }
    if (planKey) {
      url += `&metadata.plan=${encodeURIComponent(planKey)}`
      url += `&metadata[plan]=${encodeURIComponent(planKey)}`
    }
    try {
      const successUrl = `${window.location.origin}/?success=1`
      url += `&success_url=${encodeURIComponent(successUrl)}`
    } catch {}
    if (planKey) {
      try { localStorage.setItem('dwr_pending_plan', planKey) } catch {}
    }
    try {
      window.location.href = url
    } catch {
      try { window.open(url, '_blank', 'noopener') } catch {}
    }
  }, [session?.user?.email, session?.user?.id])

  const requestDowngrade = React.useCallback(async (target: 'plus' | 'pro') => {
    try {
      if (target === 'plus') setDwPlusLabel('…')
      if (target === 'pro') setDwProLabel('…')
      const token = await getAccessToken()
      const res = await fetch(`${paymentsBase}/api/polar/downgrade`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target })
      })
      if (!res.ok) throw new Error(await res.text())
      try { await fetchPlan() } catch {}
      if (target === 'plus') setDwPlusLabel('queued')
      if (target === 'pro') setDwProLabel('queued')
    } catch (e) {
      console.warn('Failed to request downgrade', e)
      if (target === 'plus') setDwPlusLabel('failed')
      if (target === 'pro') setDwProLabel('failed')
    } finally {
      setTimeout(() => {
        if (target === 'plus') setDwPlusLabel('downgrade')
        if (target === 'pro') setDwProLabel('downgrade')
      }, 1500)
    }
  }, [paymentsBase, getAccessToken, fetchPlan])

  React.useEffect(() => {
    fetchBalance().catch(() => {})
    fetchPlan().catch(() => {})
  }, [fetchBalance, fetchPlan])

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
        if (paymentsFallback) {
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
        } else {
          ;(async () => {
            try { await fetchBalance() } catch {}
            try { await fetchPlan() } catch {}
          })()
        }
      }
    } catch {}
  }, [fetchBalance, fetchPlan, getAccessToken, paymentsBase, paymentsFallback])
  return (
    <div className='space-y-4'>
      <div>
        <div className='text-[12px] font-semibold text-[#9CA3AF] mb-2'>Active plan</div>
        <div className='rounded-xl border border-[#2a2a2a] bg-[#121212] px-4 py-3 flex items-center justify-between'>
          <div>
            <div className='text-[12px] text-[#9AA0A6] mb-1'>Current credits</div>
            <div className='flex items-center gap-2'>
              <div>
                <div className='text-[28px] font-extrabold text-[#4599DF] leading-7'>
                  {balanceLoading ? '…' : (balance ?? '—')}
                </div>
                {balance !== null && !balanceLoading && (
                  <div className='text-[10px] text-[#9AA0A6] mt-0.5'>
                    ≈ {Math.floor(balance / 20)} full deep wide research{Math.floor(balance / 20) !== 1 ? 'es' : ''}
                  </div>
                )}
              </div>
              <button
                onClick={onRefreshBalance}
                disabled={balanceLoading}
                aria-label='Refresh balance'
                title='Refresh'
                className='ml-1 w-7 h-7 rounded-md hover:bg-white/10 text-[#cfcfcf] flex items-center justify-center disabled:opacity-60 transition-colors duration-150'
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
          </div>
          <div className='text-right'>
            <div className='text-[11px] text-[#9AA0A6]'>Current plan</div>
            <div className='text-[12px] font-medium text-[#E5E5E5]'>{activePlan}</div>
          </div>
        </div>
      </div>

      <div>
        <div className='text-[12px] font-semibold text-[#9CA3AF] mb-2'>All plans</div>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
          <div className='border border-white/20 bg-black/20 p-4 md:p-5 flex flex-col rounded-xl'>
            <div className='text-[16px] font-semibold text-foreground/90 mb-1'>Free</div>
            <div className='mt-1 mb-4'>
              <span className='text-[22px] font-bold text-foreground/90'>$0</span>
              <span className='text-[12px] text-foreground/50 ml-1'>/ month</span>
            </div>
            <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
              <div className='flex items-start gap-2'>
                <span className='text-[#2CAC58]'>[✓]</span>
                <div>
                  <div><strong className='text-[#4599DF]'>100</strong> <span className='text-foreground/90'>credits</span> per month</div>
                  <div className='text-[10px] text-foreground/50 mt-0.5'>≈ 5 full deep wide researches</div>
                </div>
              </div>
              <div className='flex items-start gap-2'>
                <span className='text-[#2CAC58]'>[✓]</span>
                <span>Community support</span>
              </div>
            </div>
          </div>

          <div className={`${activePlan==='plus' ? 'border-[#2CAC58] bg-gradient-to-br from-[#2CAC58]/10 to-black/20' : 'border-white/20 bg-black/20'} border p-4 md:p-5 flex flex-col relative rounded-xl`}>
            {activePlan==='plus' && (<div className='absolute top-0 right-0 bg-[#2CAC58] px-2 py-0.5 text-[10px] font-bold text-white rounded-bl-md'>Current</div>)}
            <div className='text-[16px] font-semibold text-foreground/90 mb-1'>Plus</div>
            <div className='mt-1 mb-4'>
              <span className='text-[22px] font-bold text-foreground/90'>$15</span>
              <span className='text-[12px] text-foreground/50 ml-1'>/ month</span>
            </div>
            <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
              <div className='flex items-start gap-2'>
                <span className='text-[#2CAC58]'>[✓]</span>
                <div>
                  <div><strong className='text-[#4599DF]'>2,000</strong> <span className='text-foreground/90'>credits</span> per month</div>
                  <div className='text-[10px] text-foreground/50 mt-0.5'>≈ 100 full deep wide researches</div>
                </div>
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
                <span className='text-foreground/40'>[✗]</span>
                <span className='text-foreground/60'>Custom integrations</span>
              </div>
              <div className='flex items-start gap-2'>
                <span className='text-foreground/40'>[✗]</span>
                <span className='text-foreground/60'>SLA & compliance</span>
              </div>
            </div>
            {(activePlan !== 'plus' && activePlan !== 'pro' && activePlan !== 'team') && (
              <button
                onClick={() => gotoCheckout(resolvedProductId15, 'plus')}
                disabled={!canBuyPlus}
                className={`w-full px-4 py-2.5 text-[12px] font-semibold transition-all rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-foreground/90`}
              >{canBuyPlus ? 'Upgrade' : 'Configure'}</button>
            )}
            {(activePlan === 'pro' || activePlan === 'team') && (
              <div className='mt-2'>
                <button
                  onClick={() => requestDowngrade('plus')}
                  className='text-[11px] text-[#9AA0A6]'
                  style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                  aria-label='Downgrade to Plus next cycle'
                >{dwPlusLabel}</button>
              </div>
            )}
          </div>

          <div className={`${activePlan==='pro' ? 'border-[#2CAC58] bg-gradient-to-br from-[#2CAC58]/10 to-black/20' : 'border-white/20 bg-black/20'} border p-4 md:p-5 flex flex-col relative rounded-xl`}>
            {activePlan==='pro' && (<div className='absolute top-0 right-0 bg-[#2CAC58] px-2 py-0.5 text-[10px] font-bold text-white rounded-bl-md'>Current</div>)}
            <div className='text-[16px] font-semibold text-foreground/90 mb-1'>Pro</div>
            <div className='mt-1 mb-4'>
              <span className='text-[22px] font-bold text-foreground/90'>$100</span>
              <span className='text-[12px] text-foreground/50 ml-1'>/ month</span>
            </div>
            <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
              <div className='flex items-start gap-2'>
                <span className='text-[#2CAC58]'>[✓]</span>
                <div>
                  <div><strong className='text-[#4599DF]'>15,000</strong> <span className='text-foreground/90'>credits</span> per month</div>
                  <div className='text-[10px] text-foreground/50 mt-0.5'>≈ 750 full deep wide researches</div>
                </div>
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
                <span>Custom integrations</span>
              </div>
              <div className='flex items-start gap-2'>
                <span className='text-foreground/40'>[✗]</span>
                <span className='text-foreground/60'>SLA & compliance</span>
              </div>
            </div>
            {(activePlan !== 'pro' && activePlan !== 'team') && (
              <button
                onClick={() => gotoCheckout(resolvedProductId100, 'pro')}
                disabled={!canBuyPro}
                className={`w-full px-4 py-2.5 text-[12px] font-semibold transition-all rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-foreground/90`}
              >{canBuyPro ? 'Upgrade' : 'Configure'}</button>
            )}
            {activePlan === 'team' && (
              <div className='mt-2'>
                <button
                  onClick={() => requestDowngrade('pro')}
                  className='text-[11px] text-[#9AA0A6]'
                  style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                  aria-label='Downgrade to Pro next cycle'
                >{dwProLabel}</button>
              </div>
            )}
          </div>

          <div className={`${activePlan==='team' ? 'border-[#2CAC58] bg-gradient-to-br from-[#2CAC58]/10 to-black/20' : 'border-white/20 bg-black/20'} border p-4 md:p-5 flex flex-col relative rounded-xl`}>
            {activePlan==='team' && (<div className='absolute top-0 right-0 bg-[#2CAC58] px-2 py-0.5 text-[10px] font-bold text-white rounded-bl-md'>Current</div>)}
            <div className='text-[16px] font-semibold text-foreground/90 mb-2'>Team</div>
            <div className='mt-1 mb-4'>
              <span className='text-[18px] font-bold text-foreground/90'>Custom</span>
            </div>
            <div className='space-y-2 text-[12px] text-foreground/70 mb-4 flex-grow'>
              <div className='flex items-start gap-2'>
                <span className='text-[#2CAC58]'>[✓]</span>
                <div>
                  <div><strong className='text-[#4599DF]'>Unlimited</strong> <span className='text-foreground/90'>credits</span></div>
                  <div className='text-[10px] text-foreground/50 mt-0.5'>≈ Unlimited full deep wide researches</div>
                </div>
              </div>
              <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>API & SDK access</span></div>
              <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>24/7 dedicated support</span></div>
              <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>Custom integrations</span></div>
              <div className='flex items-start gap-2'><span className='text-[#2CAC58]'>[✓]</span><span>SLA & compliance</span></div>
            </div>
            <a href='mailto:guantum@puppyagent.com' className='w-full text-center border border-[#2CAC58] bg-[#2CAC58]/10 hover:bg-[#2CAC58]/20 px-4 py-2.5 text-[12px] font-semibold text-foreground/90 transition-all rounded-md'>
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}



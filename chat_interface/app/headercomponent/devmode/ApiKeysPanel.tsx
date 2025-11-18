'use client'

import React from 'react'
import { useAuth } from '../../supabase/SupabaseAuthProvider'
import { useAccountData } from '../../context/AccountDataContext'
import { PRIMARY_BUTTON_COLORS, getPrimaryButtonStyle } from './primaryButtonStyles'

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

export default function ApiKeysPanel() {
  const { getAccessToken, session, supabase } = useAuth()
  const { plan, apiKeys, keysLoading, refreshApiKeys } = useAccountData()
  const userPlan: 'free' | 'plus' | 'pro' | 'team' = (plan === 'enterprise' ? 'team' : plan)
  const [loading, setLoading] = React.useState(false)
  const [keys, setKeys] = React.useState<ApiKeyItem[]>([])
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [languageByKey, setLanguageByKey] = React.useState<Record<string, 'curl' | 'node' | 'python'>>({})
  const [showSecretByKey, setShowSecretByKey] = React.useState<Record<string, boolean>>({})
  const [copiedKeyId, setCopiedKeyId] = React.useState<string | null>(null)
  const [copiedSnippetFor, setCopiedSnippetFor] = React.useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // cache helpers (localStorage with TTL)
  const readCache = React.useCallback(<T,>(key: string, ttlMs: number): T | null => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (!raw) return null
      const obj = JSON.parse(raw) as { ts: number; value: T }
      if (!obj || typeof obj.ts !== 'number') return null
      if (Date.now() - obj.ts > ttlMs) return null
      return obj.value
    } catch {
      return null
    }
  }, [])
  const writeCache = React.useCallback(<T,>(key: string, value: T) => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }))
    } catch {}
  }, [])
  const KEYS_TTL = 2 * 60 * 1000 // 2 minutes

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

  const fetchKeys = React.useCallback(async (force?: boolean) => {
    const uid = session?.user?.id || ''
    const cacheKey = uid ? `dwr_api_keys_${uid}` : 'dwr_api_keys'
    if (!force) {
      const cached = readCache<ApiKeyItem[]>(cacheKey, KEYS_TTL)
      if (cached && Array.isArray(cached)) {
        setKeys(cached)
        return
      }
    }
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
      const serverKeys: ApiKeyItem[] = Array.isArray(data?.keys) ? data.keys : []
      // sanitize before caching (avoid storing api_key secrets)
      const sanitized = serverKeys.map(({ api_key, ...rest }) => rest)
      setKeys(serverKeys)
      writeCache(cacheKey, sanitized)
    } catch (e) {
      console.warn('Failed to load keys', e)
    } finally {
      setLoading(false)
    }
  }, [apiBase, getAccessToken, readCache, writeCache, session?.user?.id])

  const createKey = React.useCallback(async () => {
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
      setExpandedId(data.id)
      setTimeout(() => { refreshApiKeys(true).catch(() => {}) }, 800)
    } catch (e) {
      console.warn('Failed to create key', e)
    } finally {
      setCreating(false)
    }
  }, [apiBase, creating, getAccessToken, refreshApiKeys])

  const revokeKey = React.useCallback(async (id: string) => {
    try {
      const token = await getAccessToken()
      const res = await fetch(`${apiBase}/api/keys/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!res.ok) throw new Error(await res.text())
      await refreshApiKeys(true)
      if (expandedId === id) setExpandedId(null)
    } catch (e) {
      console.warn('Failed to revoke key', e)
    }
  }, [apiBase, getAccessToken, refreshApiKeys, expandedId])

  // No plan fetching here; use plan from AccountDataContext

  const gotoPlans = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('navigate-to-plans')
      window.dispatchEvent(event)
    }
  }, [])

  React.useEffect(() => {
    // No auto-fetch; rely on AccountDataContext and explicit refresh button
  }, [])

  // Splash while determining plan to avoid flashing wrong view
  // No splash – use already available context values

  // If user is on free plan, show upgrade prompt
  if (userPlan === 'free') {
    return (
      <>
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
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                color: '#e5e5e5',
                marginBottom: '12px',
                lineHeight: '1.3'
              }}>
                Integrate DeepWide into your workflow
              </h3>
              <p style={{ 
                fontSize: '13px', 
                color: '#9aa0a6',
                lineHeight: '1.5',
                marginBottom: '20px'
              }}>
                Create API keys and build custom integrations.
              </p>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#22C55E' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='20 6 9 17 4 12'/>
                  </svg>
                  <span style={{ fontSize: '12px', color: '#cfcfcf' }}>Full REST API access</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#22C55E' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='20 6 9 17 4 12'/>
                  </svg>
                  <span style={{ fontSize: '12px', color: '#cfcfcf' }}>Code examples in Python, Node.js & cURL</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#22C55E' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='20 6 9 17 4 12'/>
                  </svg>
                  <span style={{ fontSize: '12px', color: '#cfcfcf' }}>Usage tracking & analytics</span>
                </div>
              </div>
              <button
                onClick={gotoPlans}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#3b82f6',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
              >
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M12 19V5M5 12l7-7 7 7'/>
                </svg>
                Upgrade
              </button>
            </div>

            {/* Right side - Code Preview */}
            <div style={{ 
              flex: '0 0 340px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              position: 'relative'
            }}>
              {/* Code snippet preview */}
              <div style={{
                background: '#000',
                border: '1px solid #2a2a2a',
                borderRadius: '10px',
                padding: '16px',
                fontSize: '12px',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden',
                width: '340px'
              }}>
                <div style={{ marginBottom: '12px', display: 'flex', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57' }}/>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }}/>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28ca42' }}/>
                </div>
                <div style={{ color: '#666', marginBottom: '3px' }}>
                  <span style={{ color: '#c678dd' }}>import</span> <span style={{ color: '#e5c07b' }}>DeepWide</span>
                </div>
                <div style={{ color: '#666', marginBottom: '10px' }}>
                  <span style={{ color: '#c678dd' }}>from</span> <span style={{ color: '#98c379' }}>&apos;deepwide-sdk&apos;</span>
                </div>
                <div style={{ color: '#666', marginBottom: '3px' }}>
                  <span style={{ color: '#61afef' }}>client</span> <span style={{ color: '#56b6c2' }}>=</span> <span style={{ color: '#e5c07b' }}>DeepWide</span><span style={{ color: '#abb2bf' }}>(</span>
                </div>
                <div style={{ color: '#666', marginBottom: '3px', paddingLeft: '16px' }}>
                  <span style={{ color: '#e06c75' }}>api_key</span><span style={{ color: '#56b6c2' }}>=</span><span style={{ color: '#98c379' }}>&apos;dwr_xxx&apos;</span>
                </div>
                <div style={{ color: '#666', marginBottom: '10px' }}>
                  <span style={{ color: '#abb2bf' }}>)</span>
                </div>
                <div style={{ color: '#666', marginBottom: '3px' }}>
                  <span style={{ color: '#61afef' }}>res</span> <span style={{ color: '#56b6c2' }}>=</span> <span style={{ color: '#61afef' }}>client</span><span style={{ color: '#abb2bf' }}>.</span><span style={{ color: '#61afef' }}>research</span><span style={{ color: '#abb2bf' }}>(</span>
                </div>
                <div style={{ color: '#666', paddingLeft: '16px' }}>
                  <span style={{ color: '#e06c75' }}>query</span><span style={{ color: '#56b6c2' }}>=</span><span style={{ color: '#98c379' }}>&apos;...&apos;</span>
                </div>
                <div style={{ color: '#666' }}>
                  <span style={{ color: '#abb2bf' }}>)</span>
                </div>
                {/* Blur overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50px',
                  background: 'linear-gradient(to bottom, transparent, #000)',
                  pointerEvents: 'none'
                }}/>
              </div>
            </div>

            {/* Subtle background pattern */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '200px',
              height: '100%',
              background: 'radial-gradient(circle at 80% 50%, rgba(34,197,94,0.03) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}/>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { Promise.resolve(refreshApiKeys(true)).catch(() => {}) }}
              disabled={keysLoading}
              title="Refresh API keys usage"
              aria-label="Refresh API keys usage"
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                background: keysLoading ? '#1a1a1a' : '#171717',
                color: '#d6d6d6',
                cursor: keysLoading ? 'progress' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <svg 
                width='14' 
                height='14' 
                viewBox='0 0 24 24' 
                fill='none' 
                stroke='currentColor' 
                strokeWidth='2' 
                strokeLinecap='round' 
                strokeLinejoin='round'
                className={keysLoading ? 'animate-spin' : ''}
              >
                <path d='M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2'/>
              </svg>
              <span style={{ fontSize: 12 }}>{keysLoading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
          {keysLoading && <div style={{ color: '#888', fontSize: '14px' }}>Loading...</div>}
          {!keysLoading && apiKeys.length === 0 && (
            <div style={{ color: '#888', fontSize: '14px' }}>No keys yet.</div>
          )}
          {!keysLoading && apiKeys.length > 0 && (
            <div style={{ border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#121212' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 112px', padding: '10px 12px', color: '#9aa0a6', fontSize: 14, background: 'transparent' }}>
                <div>Key</div>
                <div style={{ textAlign: 'left' }}>Used</div>
                <div style={{ textAlign: 'left' }}>Actions</div>
              </div>
              {apiKeys.map(k => {
                const expanded = expandedId === k.id
                const lang = languageByKey[k.id] || 'curl'
                const displayKey = k.api_key || `dwr_${k.prefix}_<SECRET>`
                const placeholder = displayKey
                return (
                  <React.Fragment key={k.id}>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: '1fr 64px 112px', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid #2a2a2a', cursor: 'pointer', background: hoveredRowId === k.id ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background-color 200ms ease' }}
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
                      <div style={{ color: '#4599DF', fontSize: '14px', textAlign: 'left' }}>{typeof k.used_credits === 'number' ? k.used_credits : 0}</div>
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
                        <pre style={{ whiteSpace: 'pre', color: '#cfcfcf', fontSize: '14px', margin: 0, background: '#000000', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px', paddingTop: '34px', maxHeight: 260, overflow: 'auto' }}>
                          {(() => {
                            const codeFor = (lang: 'curl' | 'node' | 'python', placeholder: string) => {
                              if (lang === 'node') return `import fetch from 'node-fetch';\n\nasync function run() {\n  const res = await fetch('${apiBase}/api/research', {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      'X-API-Key': '${placeholder}'\n    },\n    body: JSON.stringify({\n      message: { query: 'Your research question', deepwide: { deep: 1.0, wide: 1.0 }, mcp: {} },\n      history: []\n    })\n  });\n  for await (const chunk of res.body) {\n    process.stdout.write(chunk.toString());\n  }\n}\n\nrun().catch(console.error);`
                              if (lang === 'python') return `import requests\n\nurl = '${apiBase}/api/research'\nheaders = {\n  'Content-Type': 'application/json',\n  'X-API-Key': '${placeholder}'\n}\npayload = {\n  'message': {\n    'query': 'Your research question',\n    'deepwide': { 'deep': 1.0, 'wide': 1.0 },\n    'mcp': {}\n  },\n  'history': []\n}\n\nwith requests.post(url, headers=headers, json=payload, stream=True) as r:\n    for line in r.iter_lines():\n        if line:\n            print(line.decode('utf-8'))`
                              return `curl -N -X POST "${apiBase}/api/research" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${placeholder}" \\\n  -d '{\n    "message": {\n      "query": "Your research question",\n      "deepwide": { "deep": 1.0, "wide": 1.0 },\n      "mcp": {}\n    },\n    "history": []\n  }'`
                            }
                            const lang = languageByKey[k.id] || 'curl'
                            return codeFor(lang, placeholder)
                          })()}
                        </pre>
                        <button
                          onClick={async () => {
                            const lang = languageByKey[k.id] || 'curl'
                            const codeFor = (lang: 'curl' | 'node' | 'python', placeholder: string) => {
                              if (lang === 'node') return `import fetch from 'node-fetch';\n\nasync function run() {\n  const res = await fetch('${apiBase}/api/research', {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      'X-API-Key': '${placeholder}'\n    },\n    body: JSON.stringify({\n      message: { query: 'Your research question', deepwide: { deep: 1.0, wide: 1.0 }, mcp: {} },\n      history: []\n    })\n  });\n  for await (const chunk of res.body) {\n    process.stdout.write(chunk.toString());\n  }\n}\n\nrun().catch(console.error);`
                              if (lang === 'python') return `import requests\n\nurl = '${apiBase}/api/research'\nheaders = {\n  'Content-Type': 'application/json',\n  'X-API-Key': '${placeholder}'\n}\npayload = {\n  'message': {\n    'query': 'Your research question',\n    'deepwide': { 'deep': 1.0, 'wide': 1.0 },\n    'mcp': {}\n  },\n  'history': []\n}\n\nwith requests.post(url, headers=headers, json=payload, stream=True) as r:\n    for line in r.iter_lines():\n        if line:\n            print(line.decode('utf-8'))`
                              return `curl -N -X POST "${apiBase}/api/research" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${placeholder}" \\\n  -d '{\n    "message": {\n      "query": "Your research question",\n      "deepwide": { "deep": 1.0, "wide": 1.0 },\n      "mcp": {}\n    },\n    "history": []\n  }'`
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
            onClick={() => { Promise.resolve(createKey()).catch(() => {}) }}
            disabled={creating}
            title="Create new API key"
            aria-label="Create new API key"
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 6,
              border: 'none',
              background: creating ? '#16A34A' : '#22C55E',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: creating ? 'progress' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s ease, transform 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              opacity: creating ? 0.85 : 1
            }}
            onMouseEnter={(e) => {
              if (!creating) e.currentTarget.style.background = '#16A34A'
            }}
            onMouseLeave={(e) => {
              if (!creating) e.currentTarget.style.background = '#22C55E'
            }}
          >
            {!creating && (
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'>
                <path d='M12 5v14M5 12h14'/>
              </svg>
            )}
            <span>{creating ? 'Creating…' : 'Create a New key'}</span>
          </button>
        </div>
      </div>
    </>
  )
}



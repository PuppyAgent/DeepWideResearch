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
  const { getAccessToken } = useAuth()
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
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const billingUrl = process.env.NEXT_PUBLIC_BILLING_URL

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

  const onAddCredits = React.useCallback(() => {
    const url = billingUrl || '/billing'
    try {
      window.open(url, '_blank', 'noopener')
    } catch {
      alert('Billing page coming soon.')
    }
  }, [billingUrl])

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
      // Optionally refresh in background to sync other fields
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

  const sampleCurl = (placeholder: string) => `curl -N -X POST "${apiBase}/api/research" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${placeholder}" \
  -d '{
    "message": {
      "query": "Your research question",
      "deepwide": { "deep": 0.8, "wide": 0.6 },
      "mcp": {}
    },
    "history": []
  }'`

  const sampleNode = (placeholder: string) => `import fetch from 'node-fetch';

async function run() {
  const res = await fetch('${apiBase}/api/research', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': '${placeholder}'
    },
    body: JSON.stringify({
      message: { query: 'Your research question', deepwide: { deep: 0.8, wide: 0.6 }, mcp: {} },
      history: []
    })
  });
  for await (const chunk of res.body) {
    process.stdout.write(chunk.toString());
  }
}

run().catch(console.error);`

  const samplePython = (placeholder: string) => `import requests\n\nurl = '${apiBase}/api/research'\nheaders = {\n  'Content-Type': 'application/json',\n  'X-API-Key': '${placeholder}'\n}\npayload = {\n  'message': {\n    'query': 'Your research question',\n    'deepwide': { 'deep': 0.8, 'wide': 0.6 },\n    'mcp': {}\n  },\n  'history': []\n}\n\nwith requests.post(url, headers=headers, json=payload, stream=True) as r:\n    for line in r.iter_lines():\n        if line:\n            print(line.decode('utf-8'))`

  const codeFor = (lang: 'curl' | 'node' | 'python', placeholder: string) => {
    if (lang === 'node') return sampleNode(placeholder)
    if (lang === 'python') return samplePython(placeholder)
    return sampleCurl(placeholder)
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

      {/* Centered Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: animateIn ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.97)',
          width: 'min(760px, 92vw)',
          maxHeight: '80vh',
          overflow: 'auto',
          background: 'linear-gradient(140deg, rgba(22,22,22,0.98) 0%, rgba(14,14,14,0.98) 100%)',
          border: '1px solid #2a2a2a',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
          padding: '14px',
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 450ms cubic-bezier(0.22, 1, 0.36, 1), transform 450ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
      {/* Header removed as requested */}

      {/* Top Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
        {/* Credits Card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap', background: 'linear-gradient(180deg, rgba(18,18,18,1) 0%, rgba(12,12,12,1) 100%)', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 12px' }}>
          <span style={{ fontSize: 64, color: '#4599DF', fontWeight: 800, letterSpacing: 0.3, lineHeight: 1 }}>
            {balanceLoading ? '…' : (balance ?? '—')}
          </span>
          <span style={{ fontSize: 14, color: '#9aa0a6', fontWeight: 700, letterSpacing: 0.3, lineHeight: 1, alignSelf: 'flex-end' }}>credits</span>
          <button onClick={onAddCredits} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(69,153,223,0.7)', background: 'linear-gradient(180deg, #4FA0E2 0%, #3E87C7 100%)', color: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(69,153,223,0.25)', fontSize: 14, alignSelf: 'flex-end' }}>Buy Credits</button>
        </div>
      </div>
      {/* Removed unused spin keyframes */}

      {/* Keys List */}
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
                          // Fallback: mask everything after last underscore
                          const last = full.lastIndexOf('_')
                          if (last >= 0) return `${full.slice(0, last + 1)}${stars}`
                          return stars
                        })()}
                      </code>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        {/* Toggle visibility */}
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
                          {codeFor(lang, placeholder)}
                        </pre>
                        <button
                          onClick={async () => {
                            const ok = await copyToClipboard(codeFor(lang, placeholder))
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
      </div>
    </div>
  )
}



'use client'

import React from 'react'
import { useAuth } from '../../supabase/SupabaseAuthProvider'

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
  const { getAccessToken } = useAuth()
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
  }, [apiBase, creating, getAccessToken, fetchKeys])

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
      await fetchKeys()
      if (expandedId === id) setExpandedId(null)
    } catch (e) {
      console.warn('Failed to revoke key', e)
    }
  }, [apiBase, getAccessToken, fetchKeys, expandedId])

  React.useEffect(() => {
    fetchKeys().catch(() => {})
  }, [fetchKeys])
  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { Promise.resolve(fetchKeys()).catch(() => {}) }}
              disabled={loading}
              title="Refresh API keys usage"
              aria-label="Refresh API keys usage"
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                background: loading ? '#1a1a1a' : '#171717',
                color: '#d6d6d6',
                cursor: loading ? 'progress' : 'pointer',
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
                className={loading ? 'animate-spin' : ''}
              >
                <path d='M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2'/>
              </svg>
              <span style={{ fontSize: 12 }}>{loading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
          {loading && <div style={{ color: '#888', fontSize: '14px' }}>Loading...</div>}
          {!loading && keys.length === 0 && (
            <div style={{ color: '#888', fontSize: '14px' }}>No keys yet.</div>
          )}
          {!loading && keys.length > 0 && (
            <div style={{ border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#121212' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 112px', padding: '10px 12px', color: '#9aa0a6', fontSize: 14, background: 'transparent' }}>
                <div>Key</div>
                <div style={{ textAlign: 'left' }}>Used</div>
                <div style={{ textAlign: 'left' }}>Actions</div>
              </div>
              {keys.map(k => {
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
            style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.6)', background: creating ? '#14532d' : 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)', color: '#0b1b10', fontWeight: 400, letterSpacing: 0.2, cursor: creating ? 'progress' : 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', boxShadow: 'none' }}
          >
            {creating ? 'Creating…' : 'Create a New key'}
          </button>
        </div>
      </div>
    </>
  )
}



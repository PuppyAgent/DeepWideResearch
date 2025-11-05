'use client'

import React from 'react'

export interface AddSourcePanelProps {
  open: boolean
  onClose: () => void
}

const LOGOS: Array<{ key: string; logoSrc: string }> = [
  { key: 'notion', logoSrc: '/moreMcpLogo/notion.png' },
  { key: 'linear', logoSrc: '/moreMcpLogo/images.jpeg' },
  { key: 'jina', logoSrc: '/moreMcpLogo/jina-text.png' },
  { key: 'elasticsearch', logoSrc: '/moreMcpLogo/elasticsearch.svg' },
  { key: 'jira', logoSrc: '/moreMcpLogo/jira.png' },
  { key: 'milvus', logoSrc: '/moreMcpLogo/milvus-icon-color.png' },
  { key: 'pinecone', logoSrc: '/moreMcpLogo/pinecone 1.png' },
  { key: 'postgresql', logoSrc: '/moreMcpLogo/Postgresql_elephant.svg.png' },
  { key: 'slack', logoSrc: '/moreMcpLogo/Slack_icon_2019.svg.png' },
  { key: 'supabase', logoSrc: '/moreMcpLogo/supabase-icon.png' },
]

export default function AddSourcePanel({ open, onClose }: AddSourcePanelProps) {
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const onJoin = async () => {
    setErr(null)
    const email = typeof window !== 'undefined' ? window.prompt('Leave your email to join the waiting list:') : ''
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('邮箱格式不正确')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/waitinglist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sources: [] })
      })
      if (!res.ok) throw new Error(await res.text())
      setDone(true)
    } catch (e) {
      setErr('提交失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        pointerEvents: open ? 'auto' : 'none',
        opacity: open ? 1 : 0,
        transition: 'opacity 200ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)'
        }}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(880px, 92vw)',
          maxHeight: 'min(88vh, 900px)',
          overflow: 'auto',
          background: '#111111',
          border: '1px solid #2a2a2a',
          borderRadius: '12px',
          boxShadow: 'none',
          color: '#e5e5e5',
          margin: '0 2vw'
        }}
      >
        {/* Main content wrapper */}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#EDEDED' }}>Over 500 information sources via MCP</div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0B0B0B', background: '#FBBF24', borderRadius: '9999px', padding: '2px 8px', letterSpacing: '0.3px' }}>TEAM PLAN ONLY</span>
            </div>
            <div style={{ fontSize: '12px', color: '#9AA0A6', marginTop: '6px' }}>Members‑only · Early access</div>
          </div>
          
          {/* Scrolling logos */}
          <div>
          <style>{`
            @keyframes dwr-scroll-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            @keyframes dwr-scroll-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
            @media (prefers-reduced-motion: reduce) {
              .dwr-marquee { animation: none !important; }
            }
          `}</style>
          {/* Row 1: left -> right (visually moves leftwards) */}
          <div style={{ overflow: 'hidden', paddingBottom: '6px' }}>
            <div
              className="dwr-marquee"
              style={{ display: 'flex', width: 'max-content', animation: 'dwr-scroll-left 28s linear infinite', willChange: 'transform' }}
            >
              <div style={{ display: 'flex', gap: '8px', padding: '2px 2px' }}>
                {LOGOS.map((item) => (
                  <div
                    key={`row1-${item.key}`}
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e5e5e5',
                      flex: '0 0 auto'
                    }}
                    title={item.key}
                  >
                    <img src={item.logoSrc} alt={item.key} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '3px' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '2px 2px' }}>
                {LOGOS.map((item) => (
                  <div
                    key={`row1-dup-${item.key}`}
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e5e5e5',
                      flex: '0 0 auto'
                    }}
                    title={item.key}
                  >
                    <img src={item.logoSrc} alt={item.key} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '3px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: right -> left (visually moves rightwards) */}
          <div style={{ overflow: 'hidden', paddingBottom: '6px' }}>
            <div
              className="dwr-marquee"
              style={{ display: 'flex', width: 'max-content', animation: 'dwr-scroll-right 32s linear infinite', willChange: 'transform' }}
            >
              <div style={{ display: 'flex', gap: '8px', padding: '2px 2px' }}>
                {LOGOS.map((item) => (
                  <div
                    key={`row2-${item.key}`}
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e5e5e5',
                      flex: '0 0 auto'
                    }}
                    title={item.key}
                  >
                    <img src={item.logoSrc} alt={item.key} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '3px' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '2px 2px' }}>
                {LOGOS.map((item) => (
                  <div
                    key={`row2-dup-${item.key}`}
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e5e5e5',
                      flex: '0 0 auto'
                    }}
                    title={item.key}
                  >
                    <img src={item.logoSrc} alt={item.key} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '3px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>

          {/* CTA */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={onJoin}
                disabled={busy || done}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2CAC58',
                  color: '#fff',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.8 : 1
                }}
              >
                {busy ? 'Submitting…' : (done ? 'Joined ✓' : 'Join the waiting list')}
              </button>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0B0B0B', background: '#FBBF24', borderRadius: '9999px', padding: '2px 8px', letterSpacing: '0.3px' }}>20% OFF</span>
            </div>
            {err && <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: '#ef4444' }}>{err}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}




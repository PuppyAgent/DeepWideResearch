'use client'

import React, { useState, useRef } from 'react'

export interface DeepWideModelProps {
  researchParams: { deep: number; wide: number; model?: string }
  onResearchParamsChange: (value: { deep: number; wide: number; model?: string }) => void
  menuDirection?: 'up' | 'down'
}

const AVAILABLE_MODELS = [
  { label: 'Gemini 3 Pro', value: 'google/gemini-3-pro-preview' },
  { label: 'GPT-5.1', value: 'openai/gpt-5.1' },
  { label: 'GPT-4o', value: 'openai/gpt-4o' },
  { label: 'O4 Mini', value: 'openai/o4-mini' }
]

export default function DeepWideModel({
  researchParams,
  onResearchParamsChange,
  menuDirection = 'up'
}: DeepWideModelProps) {
  const [isDeepWideHover, setIsDeepWideHover] = useState(false)
  const [isModelHover, setIsModelHover] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const deepBlocksRef = useRef<HTMLSpanElement>(null)
  const wideBlocksRef = useRef<HTMLSpanElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  // Close model menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setShowModelMenu(false)
        setIsModelHover(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const BAR_LEN = 12
  const STEPS = 4

  const getProviderLogoPath = (modelValue?: string) => {
    if (!modelValue) return '/openai.jpg'
    if (modelValue.startsWith('google/')) return '/genmini.jpg' // Gemini placeholder logo
    return '/openai.jpg'
  }

  const makeBlocks = (v: number) => {
    const filled = Math.round(v * BAR_LEN)
    const empty = Math.max(0, BAR_LEN - filled)
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`
  }

  const selectedModelLabel = AVAILABLE_MODELS.find(m => m.value === researchParams.model)?.label || 'Select Model'
  const selectedLogo = getProviderLogoPath(researchParams.model)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Model Selector */}
      <div 
        style={{ position: 'relative' }} 
        ref={modelMenuRef}
        onMouseEnter={() => setIsModelHover(true)}
        onMouseLeave={() => setIsModelHover(false)}
      >
        <button
          onClick={() => {
            const next = !showModelMenu
            setShowModelMenu(next)
            if (!next) setIsModelHover(false)
          }}
          style={{
            fontSize: '12px',
            color: isModelHover || showModelMenu ? '#e5e5e5' : '#888',
            background: isModelHover || showModelMenu ? 'rgba(255,255,255,0.04)' : 'transparent',
            border: 'none',
            padding: '2px 8px',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            height: '36px',
            borderRadius: '8px'
          }}
        >
          <img
            src={selectedLogo}
            alt="provider logo"
            style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'contain' }}
          />
          <span style={{ fontWeight: 400 }}>{selectedModelLabel}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ transform: showModelMenu ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showModelMenu && (
          <div style={{
            position: 'absolute',
            ...(menuDirection === 'up' 
              ? { bottom: '100%', marginBottom: '4px' } 
              : { top: '100%', marginTop: '4px' }
            ),
            left: 0,
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '4px',
            width: '140px',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {AVAILABLE_MODELS.map((model) => (
              <div
                key={model.value}
                onClick={() => {
                  onResearchParamsChange({ ...researchParams, model: model.value })
                  setShowModelMenu(false)
                  setIsModelHover(false)
                }}
                style={{
                  padding: '6px 8px',
                  fontSize: '12px',
                  color: researchParams.model === model.value ? '#fff' : '#aaa',
                  background: researchParams.model === model.value ? '#4a90e2' : 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (researchParams.model !== model.value) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    e.currentTarget.style.color = '#e5e5e5'
                  }
                }}
                onMouseLeave={(e) => {
                  if (researchParams.model !== model.value) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#aaa'
                  }
                }}
              >
                <img
                  src={getProviderLogoPath(model.value)}
                  alt="provider logo"
                  style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'contain' }}
                />
                {model.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '24px', background: '#333' }} />

      <div
        data-deepwide-inline-trigger
      onMouseEnter={() => setIsDeepWideHover(true)}
      onMouseLeave={() => setIsDeepWideHover(false)}
      title="Adjust Deep × Wide"
      style={{
        fontSize: '12px',
        color: isDeepWideHover ? '#e5e5e5' : '#888',
        fontFamily:
          'inherit, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        lineHeight: '1.25',
        whiteSpace: 'pre',
        cursor: 'ew-resize',
        userSelect: 'none',
        transition: 'color 150ms ease, background 150ms ease',
        padding: '2px 8px',
        borderRadius: '8px',
        background: isDeepWideHover ? 'rgba(255,255,255,0.04)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px'
      }}
    >
      {/* DEEP Row */}
      <div
        onClick={(e) => {
          const targetSpan = deepBlocksRef.current
          if (!targetSpan) return
          const barRect = targetSpan.getBoundingClientRect()
          let xWithin = e.clientX - barRect.left
          xWithin = Math.max(0, Math.min(barRect.width - 1, xWithin))
          const bucketPx = barRect.width / STEPS
          const stepIndex = Math.floor(xWithin / bucketPx)
          const next = (stepIndex + 1) / STEPS
          onResearchParamsChange({ deep: next, wide: researchParams.wide, model: researchParams.model })
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: 0,
          borderRadius: '6px',
          cursor: 'inherit'
        }}
      >
        <span style={{ fontFamily: 'inherit', fontWeight: 400, width: '36px' }}>Deep</span>
        <span style={{ margin: '0 2px' }} />
        <span
          ref={deepBlocksRef}
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}
        >
          {makeBlocks(researchParams.deep)}
        </span>
        <span
          style={{
            fontFamily: 'inherit',
            display: 'inline-block',
            width: '4ch',
            textAlign: 'right',
            marginLeft: '8px'
          }}
        >
          {Math.round(researchParams.deep * 100)}%
        </span>
      </div>

      {/* WIDE Row */}
      <div
        style={{
          marginTop: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: 0,
          borderRadius: '6px',
          cursor: 'inherit'
        }}
        onClick={(e) => {
          const targetSpan = wideBlocksRef.current
          if (!targetSpan) return
          const barRect = targetSpan.getBoundingClientRect()
          let xWithin = e.clientX - barRect.left
          xWithin = Math.max(0, Math.min(barRect.width - 1, xWithin))
          const bucketPx = barRect.width / STEPS
          const stepIndex = Math.floor(xWithin / bucketPx)
          const next = (stepIndex + 1) / STEPS
          onResearchParamsChange({ deep: researchParams.deep, wide: next, model: researchParams.model })
        }}
      >
        <span style={{ fontFamily: 'inherit', fontWeight: 400, width: '36px' }}>Wide</span>
        <span style={{ margin: '0 2px' }} />
        <span
          ref={wideBlocksRef}
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}
        >
          {makeBlocks(researchParams.wide)}
        </span>
        <span
          style={{
            fontFamily: 'inherit',
            display: 'inline-block',
            width: '4ch',
            textAlign: 'right',
            marginLeft: '8px'
          }}
        >
          {Math.round(researchParams.wide * 100)}%
        </span>
      </div>
    </div>
    </div>
  )
}


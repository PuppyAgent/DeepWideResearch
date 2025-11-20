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
  const deepBlocksRef = useRef<HTMLDivElement>(null)
  const wideBlocksRef = useRef<HTMLDivElement>(null)
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

  const STEPS = 4

  const getProviderLogoPath = (modelValue?: string) => {
    if (!modelValue) return '/openai.jpg'
    if (modelValue.startsWith('google/')) return '/genmini.jpg' // Gemini placeholder logo
    return '/openai.jpg'
  }

  const selectedModelLabel = AVAILABLE_MODELS.find(m => m.value === researchParams.model)?.label || 'Select Model'
  const selectedLogo = getProviderLogoPath(researchParams.model)

  const handleInteract = (e: React.MouseEvent, type: 'deep' | 'wide') => {
    const ref = type === 'deep' ? deepBlocksRef : wideBlocksRef
    if (!ref.current) return
    
    const rect = ref.current.getBoundingClientRect()
    let x = e.clientX - rect.left
    x = Math.max(0, Math.min(rect.width, x))
    
    // 4 steps
    const step = Math.ceil((x / rect.width) * STEPS)
    const newValue = step / STEPS
    
    // Prevent 0 if desired, though logic above gives 1..4 if x>0. If x=0 (very left edge), step=0. 
    // Let's ensure at least 1 step is selected if that's the desired behavior, or allow 0. 
    // Usually Deep/Wide starts at 1/4? Let's stick to the ceiling logic which biases to 1..4 unless exactly 0.
    // Actually, let's just clamp to min 0.25 if needed, but let's respect user input.
    
    const finalValue = Math.max(0.25, newValue) // Ensure at least one block if clicked

    if (type === 'deep') {
        if (finalValue !== researchParams.deep) {
             onResearchParamsChange({ ...researchParams, deep: finalValue })
        }
    } else {
        if (finalValue !== researchParams.wide) {
             onResearchParamsChange({ ...researchParams, wide: finalValue })
        }
    }
  }

  // New function to handle drag (mouse move while pressed)
  const handleMouseMove = (e: React.MouseEvent, type: 'deep' | 'wide') => {
      if (e.buttons === 1) {
          handleInteract(e, type)
      }
  }

  const renderGrid = (value: number, activeColor: string) => {
    const activeCount = Math.round(value * STEPS)
    return (
        <div style={{ 
            display: 'flex',
            gap: '0', 
            height: '14px'
        }}>
            {Array.from({ length: STEPS }).map((_, i) => {
                const isActive = i < activeCount
                const isFirst = i === 0
                const isLast = i === STEPS - 1
                const borderColor = isActive ? activeColor : '#555'

                return (
                    <div 
                        key={i} 
                        style={{
                            width: '20px',
                            height: '100%',
                            backgroundColor: isActive ? activeColor : 'transparent',
                            borderTop: `1px solid ${borderColor}`,
                            borderBottom: `1px solid ${borderColor}`,
                            borderLeft: isFirst ? `1px solid ${borderColor}` : 'none',
                            borderRight: `1px solid ${borderColor}`,
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            transition: 'all 0.15s ease',
                            boxSizing: 'border-box'
                        }}
                    />
                )
            })}
        </div>
    )
  }

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
        fontFamily: 'inherit',
        lineHeight: '1.25',
        whiteSpace: 'pre',
        userSelect: 'none',
        transition: 'color 150ms ease, background 150ms ease',
        padding: '2px 8px',
        borderRadius: '8px',
        background: isDeepWideHover ? 'rgba(255,255,255,0.04)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4px'
      }}
    >
      {/* DEEP Row */}
      <div
        onMouseDown={(e) => handleInteract(e, 'deep')}
        onMouseMove={(e) => handleMouseMove(e, 'deep')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: 0,
          borderRadius: '6px',
          cursor: 'ew-resize'
        }}
      >
        <span style={{ fontFamily: 'inherit', fontWeight: 400, width: '36px' }}>Deep</span>
        <div ref={deepBlocksRef}>
             {renderGrid(researchParams.deep, '#a3a3a3')}
        </div>
        <span
          style={{
            fontFamily: 'inherit',
            display: 'inline-block',
            width: '4ch',
            textAlign: 'right',
            color: '#666',
            fontSize: '11px'
          }}
        >
          {Math.round(researchParams.deep * 100)}%
        </span>
      </div>

      {/* WIDE Row */}
      <div
        onMouseDown={(e) => handleInteract(e, 'wide')}
        onMouseMove={(e) => handleMouseMove(e, 'wide')}
        style={{
          marginTop: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: 0,
          borderRadius: '6px',
          cursor: 'ew-resize'
        }}
      >
        <span style={{ fontFamily: 'inherit', fontWeight: 400, width: '36px' }}>Wide</span>
        <div ref={wideBlocksRef}>
            {renderGrid(researchParams.wide, '#a3a3a3')}
        </div>
        <span
          style={{
            fontFamily: 'inherit',
            display: 'inline-block',
            width: '4ch',
            textAlign: 'right',
            color: '#666',
            fontSize: '11px'
          }}
        >
          {Math.round(researchParams.wide * 100)}%
        </span>
      </div>
    </div>
    </div>
  )
}

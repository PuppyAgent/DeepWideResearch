'use client'

import React from 'react'
import AccountPanel from './devmode/AccountPanel'
import ApiKeysPanel from './devmode/ApiKeysPanel'
import PlansPanel from './devmode/PlansPanel'
import InformationSourcesPanel from './devmode/InformationSourcesPanel'

interface DevModeButtonProps {
  isOpen: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export function DevModeButton({ isOpen, onClick }: DevModeButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      title={isOpen ? 'Close Dev Mode' : 'Open Dev Mode'}
      aria-pressed={isOpen}
      style={{
        position: 'relative',
        width: '36px',
        height: '36px',
        borderRadius: '18px',
        border: isOpen ? '2px solid #4a4a4a' : '1px solid #2a2a2a',
        background: isOpen
          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)'
          : 'rgba(20, 20, 20, 0.9)',
        color: isOpen ? '#e6e6e6' : '#bbb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: isOpen
          ? '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 200ms ease',
        backdropFilter: 'blur(8px)',
        padding: 0,
        margin: 0
      }}
      onMouseEnter={(e) => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = '#3a3a3a'
          e.currentTarget.style.color = '#e6e6e6'
          e.currentTarget.style.transform = 'scale(1.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = '#2a2a2a'
          e.currentTarget.style.color = '#bbb'
          e.currentTarget.style.transform = 'scale(1)'
        }
      }}
      data-testid="dev-mode-button"
    >
      {/* Lightning bolt glyph */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polyline
          points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

interface DevModePanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function DevModePanel({ isOpen, onClose }: DevModePanelProps) {
  const [isRendered, setIsRendered] = React.useState(false)
  const [animateIn, setAnimateIn] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'account' | 'api-keys' | 'plans' | 'sources'>('account')

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  React.useEffect(() => {
    const handleNavigateToPlans = () => {
      setActiveTab('plans')
    }
    const handleNavigateToApiKeys = () => {
      setActiveTab('api-keys')
    }
    window.addEventListener('navigate-to-plans', handleNavigateToPlans)
    window.addEventListener('navigate-to-api-keys', handleNavigateToApiKeys)
    return () => {
      window.removeEventListener('navigate-to-plans', handleNavigateToPlans)
      window.removeEventListener('navigate-to-api-keys', handleNavigateToApiKeys)
    }
  }, [])

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

  const NavBtn = ({ id, label, icon }: { id: 'account' | 'api-keys' | 'plans' | 'sources', label: string, icon?: React.ReactNode }) => (
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

      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-1/2 left-1/2 ${animateIn ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'} -translate-x-1/2 -translate-y-1/2 w-[min(980px,96vw)] h-[720px] overflow-hidden bg-[linear-gradient(140deg,rgba(22,22,22,0.98)_0%,rgba(14,14,14,0.98)_100%)] border border-[#2a2a2a] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.06)] transition-all`}
      >
        <div className='flex h-full text-[13px] text-[#D4D4D4]'>
          <div className='w-44 h-full border-r border-[#2f2f2f] bg-transparent py-3'>
            <nav className='space-y-0.5 px-2'>
              <NavBtn id='account' label='Account' icon={<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='8' r='4'/><path d='M4 22c0-4 4-7 8-7s8 3 8 7'/></svg>} />
              <NavBtn id='api-keys' label='API Keys' icon={<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <circle cx='7' cy='12' r='4'/>
                <path d='M11 12h8'/>
                <path d='M19 12v3'/>
                <path d='M16 12v2'/>
              </svg>} />
              <NavBtn id='sources' label='Sources' icon={<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='3' y='3' width='7' height='7'/><rect x='14' y='3' width='7' height='7'/><rect x='14' y='14' width='7' height='7'/><rect x='3' y='14' width='7' height='7'/></svg>} />
              <NavBtn id='plans' label='Plans' icon={<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M12 19V5M5 12l7-7 7 7'/></svg>} />
            </nav>
          </div>

          <div className='flex flex-col flex-1 pl-6 pr-4 py-6 overflow-y-auto min-h-0'>
            <div className='flex items-center justify-start mb-3'>
              <div className='text-[16px] font-semibold text-[#e6e6e6]'>
                {activeTab === 'account' ? 'Account' : activeTab === 'api-keys' ? 'API Keys' : activeTab === 'plans' ? 'Plans' : 'Sources'}
              </div>
            </div>

            {activeTab === 'account' && (
              <AccountPanel />
            )}
            {activeTab === 'api-keys' && (
              <ApiKeysPanel />
            )}
            {activeTab === 'plans' && (
              <PlansPanel />
            )}
            {activeTab === 'sources' && (
              <InformationSourcesPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


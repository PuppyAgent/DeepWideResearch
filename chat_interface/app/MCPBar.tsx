'use client'

import React, { useState } from 'react'
import MCPButton from './MCPButton'

export interface McpTool {
  name: string
  enabled: boolean
  description: string
}

export interface McpService {
  name: string
  enabled: boolean
  tools: McpTool[]
}

export interface McpConfigValue {
  services: McpService[]
}

export interface MCPBarProps {
  value: McpConfigValue
  onChange: (value: McpConfigValue) => void
}

export default function MCPBar({ value, onChange }: MCPBarProps) {
  // Filter services with enabled tools
  const activeServices = value.services.filter(service => 
    service.enabled && service.tools.some(tool => tool.enabled)
  )
  
  // Get removed services (services without enabled tools)
  const removedServices = value.services.filter(service => 
    !service.enabled || !service.tools.some(tool => tool.enabled)
  )

  const handleServiceChange = (updatedService: McpService) => {
    const newServices = value.services.map(service => 
      service.name === updatedService.name ? updatedService : service
    )
    onChange({ services: newServices })
  }

  return (
    <>
      {/* MCP Services Bar - each button has its own panel */}
      {activeServices.map((service) => (
        <MCPButton
          key={service.name}
          service={service}
          onServiceChange={handleServiceChange}
        />
      ))}

      {/* Add MCP Button - for restoring removed services and adding custom MCP */}
      <AddMCPButton
        removedServices={removedServices}
        onRestoreService={(serviceName) => {
          const serviceIndex = value.services.findIndex(s => s.name === serviceName)
          if (serviceIndex !== -1) {
            const newServices = [...value.services]
            newServices[serviceIndex] = {
              ...newServices[serviceIndex],
              enabled: true,
              tools: newServices[serviceIndex].tools.map(tool => ({ ...tool, enabled: true }))
            }
            onChange({ services: newServices })
          }
        }}
      />
    </>
  )
}

// Standalone Add MCP Button component
interface AddMCPButtonProps {
  removedServices: McpService[]
  onRestoreService: (serviceName: string) => void
}

function AddMCPButton({ removedServices, onRestoreService }: AddMCPButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Close panel on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen) {
        const target = event.target as Element
        const panel = document.querySelector('[data-add-mcp-panel]')
        const button = document.querySelector('[data-add-mcp-button]')
        
        if (panel && button) {
          const isClickInPanel = panel.contains(target)
          const isClickOnButton = button.contains(target)
          
          if (!isClickInPanel && !isClickOnButton) {
            setIsOpen(false)
          }
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div style={{ position: 'relative' }}>
      {/* Add MCP Panel */}
      <div
        style={{
          position: 'absolute',
          bottom: '47px',
          left: '0',
          width: '195px',
          background: 'linear-gradient(135deg, rgba(25,25,25,0.98) 0%, rgba(15,15,15,0.98) 100%)',
          border: '1px solid #3a3a3a',
          borderRadius: '14px',
          boxShadow: isOpen 
            ? '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)' 
            : '0 4px 12px rgba(0,0,0,0.3)',
          overflow: 'visible',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
          transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: isOpen ? 'auto' : 'none',
          backdropFilter: 'blur(12px)',
          zIndex: 10
        }}
        aria-hidden={!isOpen}
        data-add-mcp-panel
      >
        <div style={{ padding: '14px' }}>
          {/* Default MCP Servers Section */}
          {removedServices.length > 0 && (
            <>
              <div style={{ 
                fontSize: '10px', 
                color: '#888', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                marginBottom: '8px',
                paddingBottom: '8px',
              borderBottom: '1px solid #3a3a3a'
              }}>
                Default MCP Servers
              </div>

              {removedServices.map((service, serviceIndex) => (
                <div
                  key={service.name}
                  style={{
                    marginBottom: serviceIndex < removedServices.length - 1 ? '4px' : '8px',
                    height: '28px',
                    padding: '0 8px',
                    background: 'transparent',
                    border: '1px dashed #5a5a5a',
                    borderRadius: '8px',
                    transition: 'all 150ms ease',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRestoreService(service.name)
                    setIsOpen(false) // 关闭面板
                  }}
                >
                  <img 
                    src={service.name === 'Tavily' ? '/tavilylogo.png' : '/exalogo.png'}
                    alt={`${service.name} logo`}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      objectFit: 'contain'
                    }}
                  />
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '500',
                    color: '#888',
                    flex: 1
                  }}>
                    Add {service.name}
                  </div>
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none"
                  >
                    <path 
                      d="M12 5v14M5 12h14" 
                      stroke="#888" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ))}
            </>
          )}

          {/* Custom MCP Section */}
          <div style={{ 
            fontSize: '10px', 
            color: '#888', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            marginBottom: '8px',
            paddingBottom: removedServices.length > 0 ? '8px' : '0',
            borderBottom: removedServices.length > 0 ? '1px solid #3a3a3a' : 'none',
            marginTop: removedServices.length > 0 ? '12px' : '0'
          }}>
            Custom MCP
          </div>

          <div
            style={{
              height: '28px',
              padding: '0 8px',
              background: 'transparent',
              border: '1px solid #5a5a5a',
              borderRadius: '8px',
              transition: 'all 150ms ease',
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: 0.5
            }}
          >
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              background: 'linear-gradient(135deg, #666 0%, #444 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#888" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: '500',
              color: '#666',
              flex: 1
            }}>
              Import MCP
            </div>
            <div style={{ 
              fontSize: '10px', 
              color: '#555',
              fontStyle: 'italic'
            }}>
              Soon
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        title="Add MCP Services"
        data-add-mcp-button
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          borderRadius: '18px',
          border: isOpen ? '2px solid #5a5a5a' : '1px dashed #5a5a5a',
          background: isOpen 
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)'
            : 'rgba(20, 20, 20, 0.5)',
          color: isOpen ? '#e6e6e6' : '#666',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: isOpen
            ? '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)'
            : '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 200ms ease',
          transform: isOpen ? 'scale(1.05)' : 'scale(1)',
          backdropFilter: 'blur(8px)',
          padding: 0,
          margin: 0,
          opacity: isOpen ? 1 : 0.6
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#5a5a5a'
            e.currentTarget.style.color = '#e6e6e6'
            e.currentTarget.style.transform = 'scale(1.08)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#5a5a5a'
            e.currentTarget.style.color = '#666'
            e.currentTarget.style.transform = 'scale(1)'
          }
        }}
      >
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none"
        >
          <path 
            d="M12 5v14M5 12h14" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
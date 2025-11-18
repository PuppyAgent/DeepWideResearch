import type { CSSProperties } from 'react'

export const PRIMARY_BUTTON_COLORS = {
  base: '#3b82f6',
  hover: '#2563eb',
  disabled: '#1d4ed8'
} as const

type PrimaryButtonOptions = {
  disabled?: boolean
  fullWidth?: boolean
  variant?: 'primary' | 'ghost'
}

export const getPrimaryButtonStyle = (options: PrimaryButtonOptions = {}): CSSProperties => {
  const variant = options.variant ?? 'primary'
  const disabled = !!options.disabled
  const background =
    variant === 'primary'
      ? (disabled ? PRIMARY_BUTTON_COLORS.disabled : PRIMARY_BUTTON_COLORS.base)
      : 'transparent'
  const color = variant === 'primary' ? '#ffffff' : PRIMARY_BUTTON_COLORS.base
  const border =
    variant === 'primary'
      ? 'none'
      : `1px solid rgba(59,130,246,${disabled ? 0.3 : 0.55})`
  const boxShadow =
    variant === 'primary'
      ? '0 1px 2px rgba(0,0,0,0.1)'
      : 'none'

  return {
    height: '32px',
    padding: '0 12px',
    borderRadius: '6px',
    border,
    background,
    color,
    fontWeight: 600,
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'background 0.2s ease, transform 0.2s ease',
    boxShadow,
    opacity: disabled ? 0.6 : 1,
    width: options.fullWidth ? '100%' : undefined,
    textDecoration: 'none'
  }
}


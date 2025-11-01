'use client'

import React, { useState } from 'react'

export interface DeepWideValue {
  deep: number
  wide: number
}

export interface DeepWideGridAltProps {
  value: DeepWideValue
  onChange: (value: DeepWideValue) => void
  cellSize?: number
  innerBorder?: number
  outerBorder?: number
  outerPadding?: number
  showAxes?: boolean // default true; no numbers anywhere
  showTitle?: boolean // default true
  titleText?: string // default 'Deep × Wide'
}

export default function DeepWideGridAlt({
  value,
  onChange,
  cellSize = 24,
  innerBorder = 1,
  outerBorder = 1,
  outerPadding = 4,
  showAxes = true,
  showTitle = true,
  titleText = 'Deep × Wide'
}: DeepWideGridAltProps) {
  const step = 0.25
  const frameOffset = outerBorder + outerPadding
  const gridCols = 4
  const gridRows = 4

  const gridInnerWidth = gridCols * cellSize + (gridCols - 1) * innerBorder
  const gridInnerHeight = gridRows * cellSize + (gridRows - 1) * innerBorder
  const gridWidth = gridInnerWidth + 2 * frameOffset
  const gridHeight = gridInnerHeight + 2 * frameOffset

  const clampedDeep = Math.max(0, Math.min(1, value.deep))
  const clampedWide = Math.max(0, Math.min(1, value.wide))
  const selectedRowIndex = Math.max(0, Math.min(3, Math.round(clampedDeep / step) - 1))
  const selectedColIndex = Math.max(0, Math.min(3, Math.round(clampedWide / step) - 1))

  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null)

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: showTitle ? '6px' : '0px',
    alignItems: 'stretch',
    position: 'relative',
    width: '100%'
  }

  const headerTitleStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    userSelect: 'none',
    marginBottom: '0px',
    paddingBottom: '0px',
    width: '100%'
  }

  const gridWrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: `${gridWidth}px`,
    height: `${gridHeight}px`,
    border: `${outerBorder}px solid #2a2a2a`,
    borderRadius: '8px',
    boxSizing: 'content-box',
    overflow: 'visible',
    background: 'rgba(10, 10, 10, 0.6)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
    marginTop: showAxes ? '26px' : '0px',
    marginLeft: showAxes ? '40px' : '0px',
    cursor: 'default'
  }

  const gridStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${frameOffset}px`,
    left: `${frameOffset}px`,
    display: 'grid',
    gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
    gridAutoRows: `${cellSize}px`,
    gap: `${innerBorder}px`
  }

  const cellBaseStyle: React.CSSProperties = {
    width: `${cellSize}px`,
    height: `${cellSize}px`,
    backgroundColor: '#141414',
    transition: 'background-color 120ms ease',
    cursor: 'pointer',
    position: 'relative'
  }

  const dotStyle: React.CSSProperties = {
    position: 'absolute',
    right: '-4px',
    bottom: '-4px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#e6e6e6',
    pointerEvents: 'none'
  }

  const renderCells = () =>
    Array.from({ length: gridRows }, (_, row) =>
      Array.from({ length: gridCols }, (_, col) => {
        const covered = (col + 1) * step <= clampedWide && (row + 1) * step <= clampedDeep
        const isHover = hoverCell?.row === row && hoverCell?.col === col
        const isSelected = row === selectedRowIndex && col === selectedColIndex
        const backgroundColor = covered
          ? (isHover ? 'rgba(74, 144, 226, 0.28)' : 'rgba(74, 144, 226, 0.18)')
          : (isHover ? '#1b1b1b' : '#141414')

        return (
          <div
            key={`${row}-${col}`}
            role="button"
            aria-pressed={covered}
            onClick={() => onChange({ deep: (row + 1) * step, wide: (col + 1) * step })}
            onMouseEnter={() => setHoverCell({ row, col })}
            onMouseLeave={() => setHoverCell(null)}
            style={{ ...cellBaseStyle, backgroundColor, zIndex: isSelected ? 10 : 1 }}
          >
            {isSelected && <div style={dotStyle} />}
          </div>
        )
      })
    ).flat()

  const axisLabelStyle: React.CSSProperties = {
    position: 'absolute',
    color: '#888',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    userSelect: 'none'
  }

  return (
    <div style={containerStyle}>
      {showTitle && (
        <div style={headerTitleStyle}>{titleText}</div>
      )}
      <div style={gridWrapperStyle}>
        {showAxes && (
          <>
            <div style={{
              ...axisLabelStyle,
              top: '-22px',
              left: `${frameOffset}px`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: `${gridInnerWidth}px`
            }}>
              <span style={{ flexShrink: 0 }}>wide</span>
              <svg width={gridInnerWidth - 32} height="8" viewBox={`0 0 ${gridInnerWidth - 32} 8`} fill="none" style={{ marginTop: '1px' }}>
                <path d={`M0 4H${gridInnerWidth - 38}M${gridInnerWidth - 38} 4L${gridInnerWidth - 41} 1M${gridInnerWidth - 38} 4L${gridInnerWidth - 41} 7`} stroke="#888" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{
              ...axisLabelStyle,
              top: `${frameOffset}px`,
              left: '-36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              height: `${gridInnerHeight}px`
            }}>
              <span style={{ flexShrink: 0 }}>deep</span>
              <svg width="8" height={gridInnerHeight - 32} viewBox={`0 0 8 ${gridInnerHeight - 32}`} fill="none">
                <path d={`M4 0V${gridInnerHeight - 38}M4 ${gridInnerHeight - 38}L1 ${gridInnerHeight - 41}M4 ${gridInnerHeight - 38}L7 ${gridInnerHeight - 41}`} stroke="#888" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </>
        )}
        <div style={gridStyle}>
          {renderCells()}
        </div>
      </div>
    </div>
  )
}



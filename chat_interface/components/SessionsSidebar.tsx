'use client'

import React from 'react'

export interface SessionItem {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface SessionsSidebarProps {
  sessions: SessionItem[]
  selectedSessionId: string | null
  isLoading: boolean
  onSessionClick: (sessionId: string) => Promise<void> | void
  onCreateNew: () => Promise<void> | void
  onDeleteSession?: (sessionId: string) => Promise<void> | void
  showHeader?: boolean
  showNewButton?: boolean
}

export default function SessionsSidebar({
  sessions,
  selectedSessionId,
  isLoading,
  onSessionClick,
  onCreateNew,
  onDeleteSession,
  showHeader = true,
  showNewButton = true,
}: SessionsSidebarProps) {
  const list = isLoading ? [] : sessions

  // 根据是否显示 header/button 调整 padding
  const paddingTop = showHeader ? '16px' : '8px'
  const paddingBottom = showNewButton ? '4px' : '8px'

  return (
    <div className="flex flex-col font-normal px-[8px] items-start relative font-plus-jakarta-sans transition-all duration-300 ease-in-out rounded-[12px]" style={{ 
      paddingTop, 
      paddingBottom,
      background: 'transparent',
      overflow: 'hidden',
      flex: 1,
      minHeight: 0
    }}>
      {/* Header 区域 */}
      {showHeader && (
        <div className='w-full text-[#5D6065] text-[11px] font-normal pl-[12px] pr-[8px] flex-shrink-0'>
          <div className='mb-[16px] flex items-center gap-2'>
            <span>Chats</span>
            <div className='h-[1px] flex-grow bg-[#404040]'></div>
          </div>
        </div>
      )}

      {/* 会话列表 */}
      <ul className='flex flex-col gap-[4px] items-start relative w-full overflow-y-auto puppychat-messages' style={{ flex: 1, minHeight: 0 }}>
        {list.length === 0 ? (
          <div className='w-full flex items-center justify-center py-8'>
            <span className='text-[#888] text-[11px] font-normal tracking-wider'>Empty History</span>
          </div>
        ) : (
          list.map((s) => {
          const isSelected = s.id === selectedSessionId
          return (
            <li
              key={s.id}
              className={`group flex items-center justify-center pl-[12px] pr-[4px] h-[32px] w-full gap-[10px] rounded-[8px] cursor-pointer relative ${isSelected ? 'bg-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.16)]' : 'hover:bg-[rgba(255,255,255,0.08)]'} transition-colors duration-200`}
              onClick={async (e) => {
                // 防止点击删除按钮时也触发切换
                if ((e.target as HTMLElement).closest('[data-delete]')) return
                await onSessionClick(s.id)
              }}
              title={s.title || 'Untitled'}
            >
              <div className={`flex items-center justify-start min-h-[32px] text-left text-[14px] w-full font-plus-jakarta-sans font-medium ${isSelected ? 'text-[#e6e6e6]' : 'text-[#888]'} overflow-hidden`}>
                <div className='flex items-center gap-[8px] max-w-[166px]'>
                  <span className='truncate'>{s.title || 'Untitled'}</span>
                </div>
              </div>

              {/* 删除按钮（仅悬浮显示） */}
              <button
                data-delete
                aria-label='Delete session'
                title='Delete'
                className='absolute right-[6px] top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-md bg-transparent text-[#888] border border-transparent hover:text-[#e6e6e6] hover:bg-[rgba(255,255,255,0.1)] hidden group-hover:flex items-center justify-center transition-colors'
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!onDeleteSession) return
                  await onDeleteSession(s.id)
                }}
              >
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                  <path d='M3 6h18' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'/>
                  <path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'/>
                  <path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'/>
                  <path d='M10 11v6M14 11v6' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'/>
                </svg>
              </button>
            </li>
          )
        })
        )}
      </ul>

      {/* New 按钮，样式对齐 AddNewWorkspaceButton */}
      {showNewButton && (
        <div className='flex h-[32px] items-center mt-[16px] relative self-stretch w-full flex-shrink-0'>
          <button
            className='w-full h-[32px] pl-[12px] pr-[4px] flex items-center gap-[10px] font-plus-jakarta-sans text-[#6d7177] rounded-md transition-colors group hover:bg-[#313131] cursor-pointer'
            onClick={async () => {
              await onCreateNew()
            }}
            title='New Chat'
          >
            <svg
              width='16'
              height='16'
              viewBox='0 0 16 16'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              className='group-hover:[&>*]:stroke-[#CDCDCD]'
            >
              <rect x='0.75' y='0.75' width='14.5' height='14.5' rx='3.25' stroke='#5D6065' strokeWidth='1.2' />
              <path d='M8 4V12' stroke='#5D6065' strokeWidth='1.2' />
              <path d='M4 8L12 8' stroke='#5D6065' strokeWidth='1.2' />
            </svg>
            <span className='text-[12px] text-[#5D6065] group-hover:text-[#CDCDCD]'>New</span>
          </button>
        </div>
      )}
    </div>
  )
}



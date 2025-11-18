// Message type definition for chat components
export interface SourceItem {
  service: string
  query: string
  url: string
}

export interface Message {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: Date
  actionList?: string[]
  sources?: SourceItem[]
}


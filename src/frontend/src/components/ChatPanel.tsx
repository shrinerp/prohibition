import React, { useEffect, useRef, useState, useCallback } from 'react'

interface ChatMessage {
  id: number
  message: string
  createdAt: string
  playerName: string
  turnOrder: number
}

export interface ChatPanelProps {
  gameId: string
  myTurnOrder: number
  players: Array<{ turnOrder: number; name: string; isYou: boolean }>
  playerColors: string[]
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function ChatPanel({ gameId, myTurnOrder, players, playerColors }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [since, setSince] = useState(0)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [unread, setUnread] = useState(0)

  const listRef = useRef<HTMLDivElement>(null)
  const sinceRef = useRef(0)
  const openRef = useRef(false)

  openRef.current = open
  sinceRef.current = since

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    }, 0)
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/messages?since=${sinceRef.current}`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.success || data.data.messages.length === 0) return
      const newMsgs: ChatMessage[] = data.data.messages
      setMessages(prev => [...prev, ...newMsgs])
      setSince(newMsgs[newMsgs.length - 1].id)
      if (!openRef.current) {
        setUnread(u => u + newMsgs.length)
      } else {
        scrollToBottom()
      }
    } catch {
      // ignore network errors during polling
    }
  }, [gameId, scrollToBottom])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  function openPanel() {
    setOpen(true)
    setUnread(0)
    scrollToBottom(false)
  }

  function closePanel() {
    setOpen(false)
    setFullscreen(false)
  }

  async function sendMessage() {
    const trimmed = draft.trim()
    if (!trimmed) return
    setDraft('')
    await fetch(`/api/games/${gameId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed }),
    })
    await fetchMessages()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function colorForTurnOrder(turnOrder: number): string {
    return playerColors[turnOrder % playerColors.length] ?? '#888'
  }

  const messageList = (
    <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
      {messages.length === 0 ? (
        <p className="text-stone-600 text-xs italic">No messages yet</p>
      ) : (
        messages.map(msg => (
          <div key={msg.id} className="flex gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
              style={{ background: colorForTurnOrder(msg.turnOrder) }}
            />
            <div className="flex-1 min-w-0">
              <span className="font-semibold" style={{ color: colorForTurnOrder(msg.turnOrder) }}>
                {msg.turnOrder === myTurnOrder ? 'You' : msg.playerName}
              </span>
              {' '}
              <span className="text-stone-300 break-words">{msg.message}</span>
              {' '}
              <span className="text-stone-600 whitespace-nowrap">{relativeTime(msg.createdAt)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const inputBar = (
    <div className="flex gap-1.5 p-2 border-t border-stone-700 flex-shrink-0">
      <textarea
        rows={1}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="type a message…"
        maxLength={500}
        className="flex-1 resize-none bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
      />
      <button
        onClick={sendMessage}
        disabled={!draft.trim()}
        className="px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 text-xs font-bold rounded transition flex-shrink-0"
      >
        Send
      </button>
    </div>
  )

  return (
    <>
      {/* Trigger button — rendered inline wherever this component is placed in the header */}
      <button
        onClick={() => open ? closePanel() : openPanel()}
        className="relative flex items-center gap-1 px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 hover:text-white text-xs transition flex-shrink-0"
        title="Chat"
      >
        <span className="text-sm">💬</span>
        <span className="hidden sm:inline">Chat</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-stone-900 text-xs font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full leading-none px-0.5">
            {unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && !fullscreen && (
        <div className="fixed top-11 right-2 w-80 z-40 bg-stone-900 border border-stone-700 rounded-lg shadow-2xl flex flex-col"
          style={{ maxHeight: 'calc(100vh - 56px)' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-stone-700 flex-shrink-0">
            <span className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Chat</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setFullscreen(true); scrollToBottom(false) }}
                className="text-stone-500 hover:text-stone-200 text-sm px-1 transition"
                title="Full screen"
              >
                ⤢
              </button>
              <button
                onClick={closePanel}
                className="text-stone-500 hover:text-stone-200 text-sm px-1 transition"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          {messageList}
          {inputBar}
        </div>
      )}

      {/* Fullscreen overlay */}
      {open && fullscreen && (
        <div className="fixed inset-0 z-50 bg-stone-950 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-stone-900 border-b border-stone-700 flex-shrink-0">
            <span className="text-stone-300 font-semibold">Chat</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreen(false)}
                className="text-stone-400 hover:text-stone-200 text-sm px-2 py-1 rounded hover:bg-stone-700 transition"
                title="Exit full screen"
              >
                ⤡ Exit full screen
              </button>
              <button
                onClick={closePanel}
                className="text-stone-400 hover:text-stone-200 text-lg px-1 transition"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          {messageList}
          {inputBar}
        </div>
      )}
    </>
  )
}

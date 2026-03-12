import React, { useEffect, useRef, useState, useCallback } from 'react'

interface ChatMessage {
  id: number
  message: string
  createdAt: string
  playerName: string
  turnOrder: number
}

interface ChatPanelProps {
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
  const [open, setOpen] = useState(true)
  const [unread, setUnread] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const sinceRef = useRef(0)
  const openRef = useRef(true)

  openRef.current = open
  sinceRef.current = since

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
        setTimeout(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
        }, 0)
      }
    } catch {
      // ignore network errors during polling
    }
  }, [gameId])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  function handleOpen() {
    setOpen(true)
    setUnread(0)
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }, 0)
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

  return (
    <div className="border-t border-stone-700 pt-2">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between text-xs text-stone-400 uppercase tracking-wider mb-1 hover:text-stone-200 transition"
        onClick={() => (open ? setOpen(false) : handleOpen())}
      >
        <span>Chat</span>
        <span className="flex items-center gap-1">
          {!open && unread > 0 && (
            <span className="bg-amber-500 text-stone-900 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unread}
            </span>
          )}
          <span>{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <>
          {/* Message list */}
          <div
            ref={listRef}
            className="max-h-[200px] overflow-y-auto space-y-1.5 mb-2"
          >
            {messages.length === 0 ? (
              <p className="text-stone-600 text-xs italic">No messages yet</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex gap-1.5 text-xs">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                    style={{ background: colorForTurnOrder(msg.turnOrder) }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-semibold"
                      style={{ color: colorForTurnOrder(msg.turnOrder) }}
                    >
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

          {/* Input */}
          <div className="flex gap-1">
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
              className="px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 text-xs font-bold rounded transition"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}

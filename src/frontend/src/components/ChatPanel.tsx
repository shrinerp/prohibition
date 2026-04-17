import React, { useEffect, useRef, useState, useCallback } from 'react'
import { capture } from '../analytics'

const ALCOHOL_EMOJI: Record<string, string> = {
  beer: '🍺', wine: '🍷', whiskey: '🥃', bourbon: '🥃', scotch: '🥃', rye: '🥃',
  gin: '🍸', rum: '🍹', vodka: '🍸', moonshine: '🫙', tequila: '🥂',
  brandy: '🍷', vermouth: '🍸', malort: '😬',
}

interface ChatMessage {
  id: number
  message: string
  createdAt: string
  playerName: string
  turnOrder: number
  isSystem: boolean
}

export interface ChatPanelProps {
  gameId: string
  myTurnOrder: number
  players: Array<{ id: number; turnOrder: number; name: string; isYou: boolean }>
  playerColors: string[]
  isMyTurn: boolean
  inventoryItems: Array<{ alcohol_type: string; quantity: number }>
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function ChatPanel({ gameId, myTurnOrder, players, playerColors, isMyTurn, inventoryItems }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [since, setSince] = useState(0)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [drinkOpen, setDrinkOpen] = useState(false)
  const [drinkType, setDrinkType] = useState('')
  const [drinkRecipient, setDrinkRecipient] = useState<number | ''>('')
  const [drinkSending, setDrinkSending] = useState(false)

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
      const newMsgs: ChatMessage[] = data.data.messages.map((m: ChatMessage) => ({
        ...m,
        isSystem: !!m.isSystem,
      }))
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

  async function sendDrink() {
    if (!drinkType || drinkRecipient === '') return
    setDrinkSending(true)
    const res = await fetch(`/api/games/${gameId}/send-drink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientPlayerId: drinkRecipient, alcoholType: drinkType }),
    })
    const data = await res.json()
    setDrinkSending(false)
    if (data.success) {
      capture('drink_sent', { alcohol_type: drinkType })
      setDrinkOpen(false)
      setDrinkType('')
      setDrinkRecipient('')
      await fetchMessages()
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
            {msg.isSystem ? (
              <div className="flex-1 pl-3 border-l-2 border-amber-800 min-w-0">
                <span className="text-amber-500 italic">{msg.message}</span>
                {' '}<span className="text-stone-600">{relativeTime(msg.createdAt)}</span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        ))
      )}
    </div>
  )

  const availableDrinks = inventoryItems.filter(i => i.quantity > 0)
  const otherPlayers = players.filter(p => !p.isYou)
  const canSendDrink = availableDrinks.length > 0

  const inputBar = (
    <div className="border-t border-stone-700 flex-shrink-0">
      <div className="flex gap-1.5 p-2">
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
        <button
          onClick={() => canSendDrink && setDrinkOpen(o => !o)}
          disabled={!canSendDrink}
          title={availableDrinks.length === 0 ? 'No drinks in inventory' : 'Send a drink'}
          className="px-2 py-1 bg-stone-700 hover:bg-stone-600 disabled:opacity-30 text-base rounded transition flex-shrink-0"
        >
          🥃
        </button>
      </div>
      {drinkOpen && (
        <div className="px-2 pb-2 space-y-1.5">
          <div className="flex gap-1.5 items-center">
            <select
              value={drinkType}
              onChange={e => setDrinkType(e.target.value)}
              className="flex-1 bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">Pick a drink…</option>
              {availableDrinks.map(i => (
                <option key={i.alcohol_type} value={i.alcohol_type}>
                  {ALCOHOL_EMOJI[i.alcohol_type] ?? '🥃'} {i.alcohol_type.charAt(0).toUpperCase() + i.alcohol_type.slice(1)} (×{i.quantity})
                </option>
              ))}
            </select>
            <select
              value={drinkRecipient}
              onChange={e => setDrinkRecipient(e.target.value === '' ? '' : Number(e.target.value))}
              className="flex-1 bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">To whom…</option>
              {otherPlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={sendDrink}
              disabled={!drinkType || drinkRecipient === '' || drinkSending}
              className="px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 text-xs font-bold rounded transition flex-shrink-0"
            >
              {drinkSending ? '…' : 'Send 🥃'}
            </button>
            <button
              onClick={() => setDrinkOpen(false)}
              className="text-stone-500 hover:text-stone-200 text-sm px-1 transition flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
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

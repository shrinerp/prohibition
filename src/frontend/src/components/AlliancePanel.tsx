import React, { useEffect, useRef, useState } from 'react'

interface Alliance {
  id: number
  status: 'pending' | 'active'
  formedSeason: number | null
  partnerPlayerId: number
  partnerName: string
  iRequested: boolean
}

interface ChatMessage {
  id: number
  playerId: number
  message: string
  createdAt: string
  senderName: string
  isMe: boolean
}

interface OtherPlayer {
  id: number
  name: string
}

interface AlliancePanelProps {
  gameId: string
  alliances: Alliance[]
  otherPlayers: OtherPlayer[]
  myPlayerId: number
  onRefresh: () => void
}

export default function AlliancePanel({ gameId, alliances, otherPlayers, myPlayerId, onRefresh }: AlliancePanelProps) {
  const [open, setOpen] = useState(false)
  const [openAllianceId, setOpenAllianceId] = useState<number | null>(null)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [breakConfirm, setBreakConfirm] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const pendingIncoming = alliances.filter(a => a.status === 'pending' && !a.iRequested)
  const hasPending = pendingIncoming.length > 0

  async function fetchChat(allianceId: number) {
    const res = await fetch(`/api/games/${gameId}/alliances/${allianceId}/chat`)
    const data = await res.json() as { success: boolean; messages: ChatMessage[] }
    if (data.success) setChat(data.messages)
  }

  useEffect(() => {
    if (openAllianceId) {
      fetchChat(openAllianceId)
      const interval = setInterval(() => fetchChat(openAllianceId), 5000)
      return () => clearInterval(interval)
    } else {
      setChat([])
    }
  }, [openAllianceId])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  async function sendMessage() {
    if (!chatInput.trim() || !openAllianceId) return
    setSubmitting(true)
    await fetch(`/api/games/${gameId}/alliances/${openAllianceId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: chatInput.trim() }),
    })
    setChatInput('')
    await fetchChat(openAllianceId)
    setSubmitting(false)
  }

  async function sendTransfer() {
    const amount = Number(transferAmount)
    if (!amount || amount <= 0 || !openAllianceId) return
    setSubmitting(true)
    const res = await fetch(`/api/games/${gameId}/alliances/${openAllianceId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    const data = await res.json() as { success: boolean }
    if (data.success) { setTransferAmount(''); setShowTransfer(false); onRefresh() }
    setSubmitting(false)
  }

  async function acceptAlliance(allianceId: number) {
    await fetch(`/api/games/${gameId}/alliances/${allianceId}/accept`, { method: 'POST' })
    onRefresh()
  }

  async function declineAlliance(allianceId: number) {
    await fetch(`/api/games/${gameId}/alliances/${allianceId}/decline`, { method: 'POST' })
    onRefresh()
  }

  async function breakAlliance(allianceId: number) {
    setSubmitting(true)
    await fetch(`/api/games/${gameId}/alliances/${allianceId}/break`, { method: 'POST' })
    setBreakConfirm(null)
    setOpenAllianceId(null)
    onRefresh()
    setSubmitting(false)
  }

  async function requestAlliance(recipientPlayerId: number) {
    await fetch(`/api/games/${gameId}/alliances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientPlayerId }),
    })
    setShowRequest(false)
    onRefresh()
  }

  const alliancePartnerIds = new Set(alliances.map(a => a.partnerPlayerId))
  const availablePlayers = otherPlayers.filter(p => !alliancePartnerIds.has(p.id))
  const pendingOutgoing = alliances.filter(a => a.status === 'pending' && a.iRequested)
  const active = alliances.filter(a => a.status === 'active')

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center gap-1 px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 hover:text-white text-xs transition flex-shrink-0"
        title="Alliances"
      >
        🤝
        {hasPending && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[9px] font-bold text-stone-900 flex items-center justify-center">
            {pendingIncoming.length}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="fixed top-11 right-12 w-72 z-40 bg-stone-900 border border-stone-700 rounded-lg shadow-2xl flex flex-col"
          style={{ maxHeight: 'calc(100vh - 56px)' }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-stone-700 flex items-center justify-between flex-shrink-0">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-wide">🤝 Alliances</p>
            <div className="flex items-center gap-2">
              {availablePlayers.length > 0 && (
                <button
                  onClick={() => setShowRequest(v => !v)}
                  className="text-xs text-amber-500 hover:text-amber-300 transition"
                >
                  + Propose
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-300 text-sm transition">✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Propose alliance */}
            {showRequest && (
              <div className="px-3 py-2 border-b border-stone-700 bg-stone-800/60 space-y-1">
                <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Propose to</p>
                {availablePlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => requestAlliance(p.id)}
                    className="w-full text-left text-xs text-stone-200 hover:text-amber-300 px-2 py-1 rounded hover:bg-stone-700 transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {/* Incoming requests */}
            {pendingIncoming.map(a => (
              <div key={a.id} className="px-3 py-2 border-b border-stone-700 bg-amber-950/30">
                <p className="text-amber-300 text-xs font-bold">{a.partnerName} proposes an alliance</p>
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => acceptAlliance(a.id)} className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 text-stone-900 text-xs font-bold rounded transition">Accept</button>
                  <button onClick={() => declineAlliance(a.id)} className="flex-1 py-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded transition">Decline</button>
                </div>
              </div>
            ))}

            {/* Outgoing pending */}
            {pendingOutgoing.map(a => (
              <div key={a.id} className="px-3 py-2 border-b border-stone-700">
                <p className="text-stone-400 text-xs italic">⏳ Waiting on {a.partnerName}…</p>
              </div>
            ))}

            {/* Empty state */}
            {alliances.length === 0 && (
              <p className="text-stone-600 text-xs text-center py-8 italic">No alliances yet</p>
            )}

            {/* Active alliances */}
            {active.map(a => (
              <div key={a.id} className="border-b border-stone-700">
                <button
                  onClick={() => { setOpenAllianceId(prev => prev === a.id ? null : a.id); setShowTransfer(false); setBreakConfirm(null) }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition ${openAllianceId === a.id ? 'bg-stone-800' : 'hover:bg-stone-800/50'}`}
                >
                  <div>
                    <p className="text-amber-300 text-xs font-bold">🤝 {a.partnerName}</p>
                    <p className="text-stone-500 text-xs">Since season {a.formedSeason ?? '?'}</p>
                  </div>
                  <span className="text-stone-500 text-xs">{openAllianceId === a.id ? '▲' : '▼'}</span>
                </button>

                {openAllianceId === a.id && (
                  <div className="px-3 pb-3 space-y-2">
                    {/* Private chat */}
                    <div className="bg-stone-950 border border-stone-700 rounded-lg overflow-hidden">
                      <div className="h-44 overflow-y-auto p-2 space-y-1">
                        {chat.length === 0 && (
                          <p className="text-stone-600 text-xs text-center italic pt-6">Private channel — eyes only</p>
                        )}
                        {chat.map(m => (
                          <div key={m.id} className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'}`}>
                            <span className="text-stone-500 text-[10px]">{m.senderName}</span>
                            <span className={`text-xs px-2 py-1 rounded max-w-[90%] break-words ${m.isMe ? 'bg-amber-700/40 text-amber-200' : 'bg-stone-700 text-stone-200'}`}>
                              {m.message}
                            </span>
                          </div>
                        ))}
                        <div ref={chatBottomRef} />
                      </div>
                      <div className="border-t border-stone-700 flex">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendMessage()}
                          placeholder="Whisper…"
                          className="flex-1 bg-transparent px-2 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none"
                        />
                        <button
                          onClick={sendMessage}
                          disabled={submitting || !chatInput.trim()}
                          className="px-2 py-1.5 text-amber-500 hover:text-amber-300 disabled:opacity-30 text-xs transition"
                        >↵</button>
                      </div>
                    </div>

                    {/* Transfer */}
                    {!showTransfer ? (
                      <button
                        onClick={() => setShowTransfer(true)}
                        className="w-full py-1.5 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition"
                      >💸 Transfer Cash</button>
                    ) : (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min={1}
                          value={transferAmount}
                          onChange={e => setTransferAmount(e.target.value)}
                          placeholder="Amount"
                          className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                        />
                        <button onClick={sendTransfer} disabled={submitting || !transferAmount} className="px-2 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded disabled:opacity-40 transition">Send</button>
                        <button onClick={() => { setShowTransfer(false); setTransferAmount('') }} className="px-2 py-1 bg-stone-700 text-stone-400 text-xs rounded hover:bg-stone-600 transition">✕</button>
                      </div>
                    )}

                    {/* Break alliance */}
                    {breakConfirm === a.id ? (
                      <div className="bg-red-950/50 border border-red-900 rounded p-2 space-y-1.5">
                        <p className="text-red-300 text-xs font-bold">Your heat shoots to 100. No going back.</p>
                        <div className="flex gap-1">
                          <button onClick={() => breakAlliance(a.id)} disabled={submitting} className="flex-1 py-1 bg-red-800 hover:bg-red-700 text-red-100 text-xs font-bold rounded disabled:opacity-40 transition">Betray</button>
                          <button onClick={() => setBreakConfirm(null)} className="flex-1 py-1 bg-stone-700 text-stone-300 text-xs rounded hover:bg-stone-600 transition">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setBreakConfirm(a.id)} className="w-full py-1 text-xs text-red-800 hover:text-red-500 transition">
                        Break Alliance
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

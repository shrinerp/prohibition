import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'

interface CityNode {
  id: number
  name: string
  x: number
  y: number
  ownerColor?: number  // hex color, e.g. 0xff0000
}

interface Road {
  fromCityId: number
  toCityId: number
}

interface PlayerToken {
  playerId: number
  cityId: number
  color: number
}

interface PhaserMapProps {
  cities: CityNode[]
  roads: Road[]
  playerTokens: PlayerToken[]
  width?: number
  height?: number
}

class ProhibitionMapScene extends Phaser.Scene {
  private mapData: { cities: CityNode[]; roads: Road[]; tokens: PlayerToken[] }

  constructor(data: { cities: CityNode[]; roads: Road[]; tokens: PlayerToken[] }) {
    super({ key: 'ProhibitionMap' })
    this.mapData = data
  }

  create() {
    const { cities, roads, tokens } = this.mapData
    const cityMap = new Map(cities.map(c => [c.id, c]))

    // Draw roads
    const gfx = this.add.graphics()
    gfx.lineStyle(2, 0x5a4a2f, 0.7)
    for (const road of roads) {
      const a = cityMap.get(road.fromCityId)
      const b = cityMap.get(road.toCityId)
      if (!a || !b) continue
      gfx.beginPath()
      gfx.moveTo(a.x, a.y)
      gfx.lineTo(b.x, b.y)
      gfx.strokePath()
    }

    // Draw city nodes
    for (const city of cities) {
      const fill = city.ownerColor ?? 0x78716c
      const circle = this.add.circle(city.x, city.y, 12, fill)
      circle.setStrokeStyle(2, 0xd4a855)

      this.add.text(city.x, city.y + 18, city.name, {
        fontSize: '10px',
        color: '#d4a855',
        align: 'center'
      }).setOrigin(0.5, 0)
    }

    // Draw player tokens
    for (const token of tokens) {
      const city = cityMap.get(token.cityId)
      if (!city) continue
      this.add.circle(city.x + 8, city.y - 8, 6, token.color)
        .setStrokeStyle(1, 0xffffff)
    }
  }
}

export default function PhaserMap({ cities, roads, playerTokens, width = 800, height = 500 }: PhaserMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef      = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (gameRef.current) gameRef.current.destroy(true)

    gameRef.current = new Phaser.Game({
      type:       Phaser.AUTO,
      width,
      height,
      parent:     containerRef.current,
      backgroundColor: '#1c1917',
      scene:      new ProhibitionMapScene({ cities, roads, tokens: playerTokens }),
      scale: {
        mode:          Phaser.Scale.FIT,
        autoCenter:    Phaser.Scale.CENTER_BOTH
      }
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [cities, roads, playerTokens, width, height])

  return <div ref={containerRef} className="rounded overflow-hidden border border-stone-700" />
}

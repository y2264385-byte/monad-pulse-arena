import { useEffect, useRef } from 'react'
import type { GmonadsPoint } from '../lib/gmonads'

type PulseCanvasProps = {
  points: GmonadsPoint[]
}

export function PulseCanvas({ points }: PulseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const width = rect.width
      const height = rect.height
      context.clearRect(0, 0, width, height)

      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(1, '#f1f4ec')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      context.strokeStyle = 'rgba(35, 24, 47, 0.08)'
      context.lineWidth = 1
      for (let i = 1; i < 4; i += 1) {
        const y = (height / 4) * i
        context.beginPath()
        context.moveTo(16, y)
        context.lineTo(width - 16, y)
        context.stroke()
      }

      const source =
        points.length > 0
          ? points
          : Array.from({ length: 28 }, (_, index) => ({
              bucket: String(index),
              tps: 17 + Math.sin(index / 2) * 4 + (index % 5),
              bps: 2.3 + Math.cos(index / 4) * 0.2,
            }))
      const maxTps = Math.max(...source.map((point) => point.tps), 1)
      const gap = 5
      const innerWidth = width - 32
      const barWidth = Math.max(3, (innerWidth - gap * (source.length - 1)) / source.length)

      source.forEach((point, index) => {
        const barHeight = Math.max(8, (point.tps / maxTps) * (height - 44))
        const x = 16 + index * (barWidth + gap)
        const y = height - 22 - barHeight
        const barGradient = context.createLinearGradient(0, y, 0, height - 22)
        barGradient.addColorStop(0, '#6d28d9')
        barGradient.addColorStop(1, '#168052')
        context.fillStyle = barGradient
        context.fillRect(x, y, barWidth, barHeight)
      })

      context.fillStyle = '#23182f'
      context.font = '700 13px Inter, system-ui, sans-serif'
      context.fillText('60 min TPS pulse', 16, 22)
      context.fillStyle = '#706b7d'
      context.font = '600 12px Inter, system-ui, sans-serif'
      context.fillText(`${source.length} buckets`, width - 92, 22)
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)

    return () => observer.disconnect()
  }, [points])

  return <canvas className="pulse-canvas" ref={canvasRef} aria-label="Monad TPS chart" />
}

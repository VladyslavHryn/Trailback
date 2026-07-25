import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

type ParticlesProps = {
  className?: string
  /** Particle count at a 1280x800 viewport; scaled by actual area. */
  density?: number
  color?: string
}

/**
 * A drifting field of faint dots behind the hero — location pings, thinned
 * down to atmosphere.
 *
 * Rendered on a canvas rather than as DOM nodes on purpose: a hundred
 * absolutely-positioned divs each with their own transform animation means
 * a hundred composited layers and a hundred style recalculations per frame,
 * which is exactly how "subtle background texture" ends up costing more
 * than the content it sits behind. One canvas is one layer.
 *
 * Two things keep it cheap: the render loop is suspended while the canvas
 * is scrolled out of view (an IntersectionObserver toggles it), and the
 * whole effect is skipped for readers who asked for reduced motion.
 */
export function Particles({
  className,
  density = 70,
  color = '245, 158, 11',
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Cap the backing store at 2x. On a 3x phone screen the extra pixels are
    // invisible for blurred dots but trebles the fill cost every frame.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    type Particle = {
      x: number
      y: number
      radius: number
      speed: number
      drift: number
      alpha: number
      phase: number
    }
    let particles: Particle[] = []
    let width = 0
    let height = 0

    const seed = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.round((density * width * height) / (1280 * 800))
      particles = Array.from({ length: Math.max(12, count) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.6 + Math.random() * 1.6,
        speed: 0.06 + Math.random() * 0.16,
        drift: (Math.random() - 0.5) * 0.06,
        alpha: 0.15 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    seed()

    let frame = 0
    let running = true
    let tick = 0

    const draw = () => {
      if (!running) return
      tick += 1
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        // Drift upward and sideways; wrap around rather than respawning, so
        // the field never visibly thins out or pops.
        p.y -= p.speed
        p.x += p.drift
        if (p.y < -4) {
          p.y = height + 4
          p.x = Math.random() * width
        }
        if (p.x < -4) p.x = width + 4
        if (p.x > width + 4) p.x = -4

        // Slow individual twinkle, so the field breathes instead of sitting
        // there as a static starfield that happens to slide.
        const twinkle = 0.65 + 0.35 * Math.sin(tick * 0.02 + p.phase)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color}, ${p.alpha * twinkle})`
        ctx.fill()
      }

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)

    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true
          frame = requestAnimationFrame(draw)
        } else if (!entry.isIntersecting && running) {
          running = false
          cancelAnimationFrame(frame)
        }
      },
      { threshold: 0 },
    )
    visibility.observe(canvas)

    const resize = new ResizeObserver(seed)
    resize.observe(canvas)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      visibility.disconnect()
      resize.disconnect()
    }
  }, [density, color, prefersReducedMotion])

  if (prefersReducedMotion) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}

import { Constants as ct } from '../constants'

export const getVectMag = (x: number, y: number): number => {
  return Math.sqrt(x ** 2 + y ** 2)
}

export const lightenColor = (color: number, percent: number): number => {
  const amt = Math.round(2.55 * percent)
  const R = ((color >> 16) & 0xff) + amt
  const G = ((color >> 8) & 0xff) + amt
  const B = (color & 0xff) + amt

  const newR = R < 255 ? (R < 0 ? 0 : R) : 255
  const newG = G < 255 ? (G < 0 ? 0 : G) : 255
  const newB = B < 255 ? (B < 0 ? 0 : B) : 255

  return (newR << 16) + (newG << 8) + newB
}

export const blendColors = (
  color1: number,
  color2: number,
  amount: number,
): number => {
  const r1 = (color1 >> 16) & 0xff
  const g1 = (color1 >> 8) & 0xff
  const b1 = color1 & 0xff

  const r2 = (color2 >> 16) & 0xff
  const g2 = (color2 >> 8) & 0xff
  const b2 = color2 & 0xff

  const r = Math.round(r1 + (r2 - r1) * amount)
  const g = Math.round(g1 + (g2 - g1) * amount)
  const b = Math.round(b1 + (b2 - b1) * amount)

  return (r << 16) + (g << 8) + b
}

export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const getSoundPan = (
  sourceX: number,
  sourceY: number,
  listenerX: number,
  listenerY: number,
  listenerRotation: number,
): number => {
  const relativeX = sourceX - listenerX
  const relativeY = sourceY - listenerY

  const angle = Math.atan2(relativeY, relativeX)
  const relativeAngle = angle - listenerRotation
  return Math.cos(Phaser.Math.Angle.Normalize(relativeAngle))
}

export const getSoundDistanceScale = (
  sourceX: number,
  sourceY: number,
  listenerX: number,
  listenerY: number,
): number => {
  let distance = Phaser.Math.Distance.Between(
    sourceX,
    sourceY,
    listenerX,
    listenerY,
  )
  distance = Phaser.Math.Clamp(distance, 1, ct.maxEnemySoundDistance - 1)
  return (
    (ct.maxEnemySoundDistance - distance) ** ct.LoudnessProximityExponent /
    ct.maxEnemySoundDistance
  )
}

export const increaseColorIntensity = (color: number): number => {
  // Extract the red, green, and blue components
  let r = (color >> 16) & 0xff
  let g = (color >> 8) & 0xff
  let b = color & 0xff

  // Double each component's value
  r = Math.min(255, r + 100)
  g = Math.min(255, g + 60)
  b = Math.min(255, b + 60)

  // Combine the adjusted components back into a single color
  return (r << 16) | (g << 8) | b
}

// Liang-Barsky Clipping Function
export function clipLineToRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rect: { xMin: number; yMin: number; xMax: number; yMax: number },
) {
  const dx = x1 - x0
  const dy = y1 - y0

  let u1 = 0
  let u2 = 1

  const p = [-dx, dx, -dy, dy]
  const q = [x0 - rect.xMin, rect.xMax - x0, y0 - rect.yMin, rect.yMax - y0]

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) {
        // Line is parallel and outside the boundary
        return null
      }
      // Line is parallel and inside the boundary, continue
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        // Potential entering point
        u1 = Math.max(u1, t)
      } else {
        // Potential leaving point
        u2 = Math.min(u2, t)
      }
      if (u1 > u2) {
        // No portion of the line is within the rectangle
        return null
      }
    }
  }

  const clippedX0 = x0 + u1 * dx
  const clippedY0 = y0 + u1 * dy
  const clippedX1 = x0 + u2 * dx
  const clippedY1 = y0 + u2 * dy

  return { x0: clippedX0, y0: clippedY0, x1: clippedX1, y1: clippedY1 }
}

export function normalDistribution(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  // Avoid zero to prevent Math.log(0)
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
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

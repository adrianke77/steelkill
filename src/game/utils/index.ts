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
  let u = 0,
    v = 0
  // Avoid zero to prevent Math.log(0)
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return (
    mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  )
}

export function getAverageColor(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
): number {
  // Get the texture
  const texture = sprite.texture
  const frame = sprite.frame

  // Create a temporary canvas to draw the sprite
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Set canvas dimensions to match the frame
  canvas.width = frame.width
  canvas.height = frame.height

  // Draw the sprite frame to the canvas
  ctx!.drawImage(
    texture.getSourceImage() as HTMLImageElement,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    0,
    0,
    frame.width,
    frame.height,
  )

  // Get the pixel data
  const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data

  // Calculate the sum of all pixel values
  let r = 0,
    g = 0,
    b = 0,
    count = 0

  for (let i = 0; i < pixels.length; i += 4) {
    // Skip transparent pixels
    if (pixels[i + 3] > 0) {
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      count++
    }
  }

  // Clean up resources
  canvas.width = 0
  canvas.height = 0

  if (count === 0) return 0xffffff // Default to white if no visible pixels

  // Calculate the average and convert to hex
  const rHex = Math.round(r / count)
  const gHex = Math.round(g / count)
  const bHex = Math.round(b / count)

  // Combine into a single hex color value (0xRRGGBB format)
  return (rHex << 16) | (gHex << 8) | bHex
}

export function getAverageColorOfTileSprite(
  tileSprite: Phaser.GameObjects.TileSprite,
): number {
  const texture = tileSprite.texture
  const frame = tileSprite.frame

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = frame.width
  canvas.height = frame.height

  ctx!.drawImage(
    texture.getSourceImage() as HTMLImageElement,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    0,
    0,
    frame.width,
    frame.height,
  )

  const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data

  let r = 0,
    g = 0,
    b = 0,
    count = 0

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 0) {
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      count++
    }
  }

  canvas.width = 0
  canvas.height = 0

  if (count === 0) return 0xffffff

  const rHex = Math.round(r / count)
  const gHex = Math.round(g / count)
  const bHex = Math.round(b / count)

  return (rHex << 16) | (gHex << 8) | bHex
}

export function loadVerticalSpritesheet(
  scene: Phaser.Scene,
  key: string,
  numFrames: number = 8,
) {
  // Load the image to get its dimensions
  scene.load.image(key, `${key}.png`)
  scene.load.start()

  scene.load.once(`filecomplete-image-${key}`, () => {
    const texture = scene.textures.get(key)
    const source = texture.getSourceImage() as HTMLImageElement
    const width = source.width
    const height = source.height

    const frameHeight = Math.floor(height / numFrames)
    const frameWidth = width

    // Remove the plain image texture so we can load as spritesheet
    scene.textures.remove(key)

    // Now load as a spritesheet
    scene.load.spritesheet(key, `${key}.png`, {
      frameWidth,
      frameHeight,
      endFrame: numFrames - 1,
    })

    // After spritesheet loads, create the animation
    scene.load.once(`filecomplete-spritesheet-${key}`, () => {
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(key, {
          start: 0,
          end: numFrames - 1,
        }),
        frameRate: 20,
        repeat: -1,
      })
    })

    scene.load.start()
  })
}

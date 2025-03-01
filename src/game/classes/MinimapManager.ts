import { EnemySprite, Projectile } from '../interfaces'
import { Game } from '../scenes/Game'
import { Constants as ct } from '../constants'
import { clipLineToRect } from '../utils'

const MINIMAP_WIDTH = 200 // Width of the minimap in pixels
const MINIMAP_HEIGHT = 200 // Height of the minimap in pixels
const GAME_WIDTH = ct.fieldWidth // Actual width of the game field
const GAME_HEIGHT = ct.fieldHeight // Actual height of the game field
const MINIMAP_SCALE = 0.05 // smaller value means more of the field is visible in the minimap
const MINIMAP_X = 30 // X position of the minimap on screen
const MINIMAP_Y = 40 // Y position of the minimap on screen
const MINIMAP_BKGRND_ALPHA = 0.4 // Transparency of the minimap background

export class MinimapManager {
  scene: Game
  minimap: Phaser.GameObjects.Graphics

  constructor(gameScene: Game) {
    this.scene = gameScene

    this.minimap = this.scene.make.graphics()
    this.minimap.setScrollFactor(0) // Ensure it doesn't scroll
    this.minimap.setDepth(ct.depths.minimap) // Draw on top of everything
    this.scene.viewMgr.minimapLayer.add(this.minimap)
  }
  drawMinimap() {
    // Clear previous minimap drawing
    this.minimap.clear()

    // Define the portion of the game field that the minimap shows
    const visibleGameWidth = MINIMAP_WIDTH / MINIMAP_SCALE
    const visibleGameHeight = MINIMAP_HEIGHT / MINIMAP_SCALE

    // Center the minimap on the player
    const minimapX = this.scene.player.mechContainer.x - visibleGameWidth / 2
    const minimapY = this.scene.player.mechContainer.y - visibleGameHeight / 2

    // Draw semi-transparent black background
    this.minimap.fillStyle(0x000000, MINIMAP_BKGRND_ALPHA)
    this.minimap.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT)

    // Calculate the boundary positions relative to the minimap
    const boundaryLeft = (0 - minimapX) * MINIMAP_SCALE
    const boundaryTop = (0 - minimapY) * MINIMAP_SCALE
    const boundaryRight = (GAME_WIDTH - minimapX) * MINIMAP_SCALE
    const boundaryBottom = (GAME_HEIGHT - minimapY) * MINIMAP_SCALE

    // Set the line style for boundaries
    this.minimap.lineStyle(5, 0x4444ff, 1)

    // Draw boundary lines
    if (boundaryLeft >= 0 && boundaryLeft <= MINIMAP_WIDTH) {
      const topClamp = Phaser.Math.Clamp(boundaryTop, 0, MINIMAP_HEIGHT)
      const bottomClamp = Phaser.Math.Clamp(boundaryBottom, 0, MINIMAP_HEIGHT)
      this.minimap.moveTo(MINIMAP_X + boundaryLeft, MINIMAP_Y + topClamp)
      this.minimap.lineTo(MINIMAP_X + boundaryLeft, MINIMAP_Y + bottomClamp)
    }
    if (boundaryRight >= 0 && boundaryRight <= MINIMAP_WIDTH) {
      const topClamp = Phaser.Math.Clamp(boundaryTop, 0, MINIMAP_HEIGHT)
      const bottomClamp = Phaser.Math.Clamp(boundaryBottom, 0, MINIMAP_HEIGHT)
      this.minimap.moveTo(MINIMAP_X + boundaryRight, MINIMAP_Y + topClamp)
      this.minimap.lineTo(MINIMAP_X + boundaryRight, MINIMAP_Y + bottomClamp)
    }
    if (boundaryTop >= 0 && boundaryTop <= MINIMAP_HEIGHT) {
      const leftClamp = Phaser.Math.Clamp(boundaryLeft, 0, MINIMAP_WIDTH)
      const rightClamp = Phaser.Math.Clamp(boundaryRight, 0, MINIMAP_WIDTH)
      this.minimap.moveTo(MINIMAP_X + leftClamp, MINIMAP_Y + boundaryTop)
      this.minimap.lineTo(MINIMAP_X + rightClamp, MINIMAP_Y + boundaryTop)
    }
    if (boundaryBottom >= 0 && boundaryBottom <= MINIMAP_HEIGHT) {
      const leftClamp = Phaser.Math.Clamp(boundaryLeft, 0, MINIMAP_WIDTH)
      const rightClamp = Phaser.Math.Clamp(boundaryRight, 0, MINIMAP_WIDTH)
      this.minimap.moveTo(MINIMAP_X + leftClamp, MINIMAP_Y + boundaryBottom)
      this.minimap.lineTo(MINIMAP_X + rightClamp, MINIMAP_Y + boundaryBottom)
    }

    this.minimap.strokePath()

    // Draw the minimap border
    this.minimap.lineStyle(2, 0xaaaaaa, 1)
    this.minimap.strokeRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT)

    // Draw player on the minimap (always centered)
    this.minimap.fillStyle(0x00ff00, 1)
    this.minimap.fillCircle(
      MINIMAP_X + MINIMAP_WIDTH / 2,
      MINIMAP_Y + MINIMAP_HEIGHT / 2,
      4,
    )

    // Draw enemies on the minimap
    this.scene.enemyMgr.enemies.children.iterate(object => {
      const enemy = object as EnemySprite
      // Calculate the position relative to the minimap
      const relativeX = (enemy.x - minimapX) * MINIMAP_SCALE
      const relativeY = (enemy.y - minimapY) * MINIMAP_SCALE

      // Only draw if the enemy is within the visible minimap area
      if (
        relativeX >= 0 &&
        relativeX <= MINIMAP_WIDTH &&
        relativeY >= 0 &&
        relativeY <= MINIMAP_HEIGHT
      ) {
        this.minimap.fillStyle(0xbb0000, 1)
        this.minimap.fillCircle(MINIMAP_X + relativeX, MINIMAP_Y + relativeY, 2)
      }
      return true
    })

    // Draw projectiles on the minimap
    this.scene.projectileMgr.projectiles.children.iterate(object => {
      const projectile = object as Projectile
      // Calculate the position relative to the minimap
      const relativeX = (projectile.x - minimapX) * MINIMAP_SCALE
      const relativeY = (projectile.y - minimapY) * MINIMAP_SCALE

      // Only draw if the projectile is within the visible minimap area
      if (
        relativeX >= 0 &&
        relativeX <= MINIMAP_WIDTH &&
        relativeY >= 0 &&
        relativeY <= MINIMAP_HEIGHT
      ) {
        const color = projectile.enemySource ? 0x66ff66 : 0xffffff
        this.minimap.fillStyle(color, 1)
        this.minimap.fillCircle(
          MINIMAP_X + relativeX,
          MINIMAP_Y + relativeY,
          projectile.enemySource ? 2 : 1,
        )
      }
      return true
    })
    
    // Draw beams on the minimap
    for (const weaponIndexStr in this.scene.beamMgr.activeBeams) {
      const beam = this.scene.beamMgr.activeBeams[weaponIndexStr]
      const startX = beam.startX
      const startY = beam.startY
      const endX = beam.endX
      const endY = beam.endY

      // Calculate positions relative to the minimap
      const relativeStartX = (startX - minimapX) * MINIMAP_SCALE
      const relativeStartY = (startY - minimapY) * MINIMAP_SCALE
      const relativeEndX = (endX - minimapX) * MINIMAP_SCALE
      const relativeEndY = (endY - minimapY) * MINIMAP_SCALE

      // Clipping rectangle corresponding to the minimap area
      const rect = {
        xMin: 0,
        yMin: 0,
        xMax: MINIMAP_WIDTH,
        yMax: MINIMAP_HEIGHT,
      }

      // Clip the beam line to the minimap area
      const clippedLine = clipLineToRect(
        relativeStartX,
        relativeStartY,
        relativeEndX,
        relativeEndY,
        rect,
      )

      if (clippedLine) {
        // Draw the clipped beam on the minimap
        this.minimap.lineStyle(1, 0xffffff, 1) // Adjust color and thickness as needed
        this.minimap.beginPath()
        this.minimap.moveTo(
          MINIMAP_X + clippedLine.x0,
          MINIMAP_Y + clippedLine.y0,
        )
        this.minimap.lineTo(
          MINIMAP_X + clippedLine.x1,
          MINIMAP_Y + clippedLine.y1,
        )
        this.minimap.strokePath()
      }
    }
  }
}

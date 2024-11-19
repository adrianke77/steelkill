// TerrainManager.ts

import { Game } from '../scenes/Game'
import { Projectile, TerrainTile } from '../interfaces'
import { createDustCloud } from '../rendering'
import { Constants as ct } from '../constants'
import { tileProperties } from '../constants/tileProperties'
// Bitmask definitions for rounded corners
const CORNER_BITS = {
  TL: 1, // Top-left corner
  TR: 2, // Top-right corner
  BL: 4, // Bottom-left corner
  BR: 8, // Bottom-right corner
}

const TILE_CORNER_MAP: { [key: number]: number } = {
  0: 0, // No corners rounded
  1: CORNER_BITS.TL,
  2: CORNER_BITS.TR,
  3: CORNER_BITS.TL | CORNER_BITS.TR,
  4: CORNER_BITS.BL,
  5: CORNER_BITS.TL | CORNER_BITS.BL,
  6: CORNER_BITS.TR | CORNER_BITS.BL,
  7: CORNER_BITS.TL | CORNER_BITS.TR | CORNER_BITS.BL,
  8: CORNER_BITS.BR,
  9: CORNER_BITS.TL | CORNER_BITS.BR,
  10: CORNER_BITS.TR | CORNER_BITS.BR,
  11: CORNER_BITS.TL | CORNER_BITS.TR | CORNER_BITS.BR,
  12: CORNER_BITS.BL | CORNER_BITS.BR,
  13: CORNER_BITS.TL | CORNER_BITS.BL | CORNER_BITS.BR,
  14: CORNER_BITS.TR | CORNER_BITS.BL | CORNER_BITS.BR,
  15: CORNER_BITS.TL | CORNER_BITS.TR | CORNER_BITS.BL | CORNER_BITS.BR,
}
export const loadTerrainAssets = (scene: Game) => {
  scene.load.image('terrainTile', 'terrainTile2.png')
}

const debrisSprayEmitterConfig = {
  lifespan: 100,
  speed: { start: 100, end: 10 },
  scale: { start: 0.4, end: 0 },
  rotate: { start: 0, end: 360 },
  emitting: false,
} as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig

export class TerrainManager {
  scene: Game
  map: Phaser.Tilemaps.Tilemap
  terrainLayer: Phaser.Tilemaps.TilemapLayer
  debrisSprayEmitter: Phaser.GameObjects.Particles.ParticleEmitter

  constructor(scene: Game) {
    this.scene = scene

    // Create the terrain when the manager is instantiated
    this.createTerrain()
    this.setupCollision()
    this.debrisSprayEmitter = this.scene.addParticles(
      0,
      0,
      'whiteParticle',
      debrisSprayEmitterConfig,
    )
  }

  createTerrain() {
    // Remove the old tileset if it exists
    this.scene.textures.remove('generated-tileset')

    const tilesetColumns = 4
    const tilesetRows = 4
    const tileSize = ct.tileSize
    const tilesetWidth = tilesetColumns * tileSize
    const tilesetHeight = tilesetRows * tileSize

    // Create a canvas texture for the tileset
    const tilesetCanvas = this.scene.textures.createCanvas(
      'generated-tileset',
      tilesetWidth,
      tilesetHeight,
    ) as Phaser.Textures.CanvasTexture

    const context = tilesetCanvas.context

    // Get the base terrain tile image
    const baseTexture = this.scene.textures.get('terrainTile')
    const baseImage = baseTexture.getSourceImage() as HTMLImageElement

    // Draw the 16 tiles onto the canvas
    for (let tileIndex = 0; tileIndex <= 15; tileIndex++) {
      const col = tileIndex % tilesetColumns
      const row = Math.floor(tileIndex / tilesetColumns)
      const x = col * tileSize
      const y = row * tileSize

      // Draw the base tile
      context.drawImage(baseImage, x, y, tileSize, tileSize)

      // Apply rounded corners based on the bitmask
      const cornerMask = TILE_CORNER_MAP[tileIndex] || 0 // Default to 0 if undefined
      this.addCorners(context, x, y, tileSize, cornerMask)
    }

    // Refresh the canvas texture to update it
    tilesetCanvas.refresh()

    // Create the tilemap
    this.map = this.scene.make.tilemap({
      width: ct.fieldWidth / ct.tileSize,
      height: ct.fieldHeight / ct.tileSize,
      tileWidth: ct.tileSize,
      tileHeight: ct.tileSize,
    }) as Phaser.Tilemaps.Tilemap

    const tileset = this.map.addTilesetImage(
      'generated-tileset',
    ) as Phaser.Tilemaps.Tileset

    this.terrainLayer = this.map.createBlankLayer('Terrain', tileset)!

    this.terrainLayer.setDepth(ct.depths.terrain)

    // Populate the layer with sample terrain
    this.populateTerrain()

    // Add the terrain layer to the main layer
    this.scene.mainLayer.add(this.terrainLayer)

    // Set collision for all tile indices
    this.terrainLayer.setCollisionBetween(0, 15)
    this.terrainLayer.setPipeline('Light2D')

    // this.displayTilesetForDebug()
  }

  addCorners(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    cornerMask: number,
  ) {
    const cornerSize = size * 0.4 // Adjust the size of the corner cutouts
    const jitter = cornerSize * 0.8 // Jitter amount
    context.save()

    // Set composite operation to 'destination-out' to erase the corners
    context.globalCompositeOperation = 'destination-out'

    // Use solid black color to erase
    context.fillStyle = 'black'

    const randomOffset = (base: number) => {
      return base + (Math.random() * 2 - 1) * jitter
    }

    // Top-left corner
    if (cornerMask & CORNER_BITS.TL) {
      // Offsets along the top and left edges
      const offsetX = randomOffset(cornerSize)
      const offsetY = randomOffset(cornerSize)

      context.beginPath()
      context.moveTo(x, y) // Top-left corner (fixed)
      context.lineTo(x + offsetX, y) // Along top edge
      context.lineTo(x, y + offsetY) // Along left edge
      context.closePath()
      context.fill()
    }

    // Top-right corner
    if (cornerMask & CORNER_BITS.TR) {
      const offsetX = randomOffset(cornerSize)
      const offsetY = randomOffset(cornerSize)

      context.beginPath()
      context.moveTo(x + size, y) // Top-right corner (fixed)
      context.lineTo(x + size - offsetX, y) // Along top edge
      context.lineTo(x + size, y + offsetY) // Along right edge
      context.closePath()
      context.fill()
    }

    // Bottom-left corner
    if (cornerMask & CORNER_BITS.BL) {
      const offsetX = randomOffset(cornerSize)
      const offsetY = randomOffset(cornerSize)

      context.beginPath()
      context.moveTo(x, y + size) // Bottom-left corner (fixed)
      context.lineTo(x + offsetX, y + size) // Along bottom edge
      context.lineTo(x, y + size - offsetY) // Along left edge
      context.closePath()
      context.fill()
    }

    // Bottom-right corner
    if (cornerMask & CORNER_BITS.BR) {
      const offsetX = randomOffset(cornerSize)
      const offsetY = randomOffset(cornerSize)

      context.beginPath()
      context.moveTo(x + size, y + size) // Bottom-right corner (fixed)
      context.lineTo(x + size - offsetX, y + size) // Along bottom edge
      context.lineTo(x + size, y + size - offsetY) // Along right edge
      context.closePath()
      context.fill()
    }

    context.restore()
  }

  populateTerrain() {
    const numberOfRandomOvals = 200
    const MIN_DISTANCE_FROM_PLAYER = 20 // Minimum distance in tiles

    // Calculate player's position in tile coordinates
    const playerTileX = Math.floor(
      this.scene.player.mechContainer.x / ct.tileSize,
    )
    const playerTileY = Math.floor(
      this.scene.player.mechContainer.y / ct.tileSize,
    )

    for (let i = 0; i < numberOfRandomOvals; i++) {
      const tileType = Phaser.Math.Between(1, 3)

      // Generate random center coordinates within the tilemap boundaries
      const centerX = Phaser.Math.Between(0, ct.fieldWidth / ct.tileSize)
      const centerY = Phaser.Math.Between(200/ct.tileSize, ct.fieldHeight / ct.tileSize)

      // Generate random radii for the oval
      const radiusX = Phaser.Math.Between(3, 7)
      const radiusY = Phaser.Math.Between(2, 5)

      // Calculate distance from the oval center to the player's position
      const distanceToPlayer = Phaser.Math.Distance.Between(
        centerX,
        centerY,
        playerTileX,
        playerTileY,
      )

      // Skip this oval if it's too close to the player
      if (distanceToPlayer < MIN_DISTANCE_FROM_PLAYER) {
        continue
      }

      // Place the oval on the tilemap layer
      this.drawOval(centerX, centerY, radiusX, radiusY, tileType)

      this.applyAutotiling()
    }
  }

  applyAutotiling() {
    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        if (this.isSolidTileAt(x, y)) {
          const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
          const tileType = tile.type
          const tileIndex = this.computeTileIndex(x, y)
          this.terrainLayer.putTileAt(tileIndex, x, y)
          this.updateAutotileAt(x, y, tileType)
        }
      }
    }
  }

  setupCollision() {
    // Add colliders between terrain and player
    this.scene.physics.add.collider(
      this.scene.player.mechContainer,
      this.terrainLayer,
    )

    // Add colliders between terrain and enemies
    this.scene.physics.add.collider(
      this.scene.enemyMgr.enemies,
      this.terrainLayer,
    )

    // Add colliders between projectiles and terrain
    this.scene.physics.add.overlap(
      this.scene.projectileMgr.projectiles,
      this.terrainLayer,
      undefined,
      this.handleProjectileTileCollision,
      this,
    )
  }

  handleProjectileTileCollision(
    item1:
      | Phaser.Tilemaps.Tile
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body,
    item2:
      | Phaser.Tilemaps.Tile
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body,
  ) {
    const projectileSprite = item1 as Phaser.GameObjects.GameObject
    const tile = item2 as TerrainTile
    const projectile = projectileSprite as Projectile

    return this.scene.projectileMgr.projectileHitsTarget(projectile, tile)
  }

  destroyTile(tile: Phaser.Tilemaps.Tile) {
    // Remove the tile from the layer
    this.terrainLayer.removeTileAt(tile.x, tile.y)

    // Update autotiling for neighboring tiles
    const neighbors = [
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      // Skip the destroyed tile itself
      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ]

    for (const neighbor of neighbors) {
      const nx = tile.x + neighbor.dx
      const ny = tile.y + neighbor.dy

      // Ensure the neighbor is within map boundaries
      if (nx >= 0 && nx < this.map.width && ny >= 0 && ny < this.map.height) {
        // Update the autotiling for the neighboring tile
        this.updateAutotileAt(nx, ny, this.getTileTypeAt(nx, ny))
      }
    }

    this.renderTileDestructionEffect(tile)
  }

  getTileTypeAt(x: number, y: number): number {
    const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
    return tile ? tile.type : -1 // Return -1 if tile doesn't exist
  }

  renderTileDestructionEffect(tile: Phaser.Tilemaps.Tile) {
    const worldX = tile.getCenterX()
    const worldY = tile.getCenterY()

    // Create an effect at the tile's position
    createDustCloud(this.scene, worldX, worldY, 0, 0, 0.8, 3000, 200)
  }

  computeTileIndex(x: number, y: number): number {
    const above = this.isSolidTileAt(x, y - 1)
    const below = this.isSolidTileAt(x, y + 1)
    const left = this.isSolidTileAt(x - 1, y)
    const right = this.isSolidTileAt(x + 1, y)
    const aboveLeft = this.isSolidTileAt(x - 1, y - 1)
    const aboveRight = this.isSolidTileAt(x + 1, y - 1)
    const belowLeft = this.isSolidTileAt(x - 1, y + 1)
    const belowRight = this.isSolidTileAt(x + 1, y + 1)

    let cornerMask = 0

    // Top-left corner
    if (!(above && left && aboveLeft)) {
      cornerMask |= CORNER_BITS.TL
    }

    // Top-right corner
    if (!(above && right && aboveRight)) {
      cornerMask |= CORNER_BITS.TR
    }

    // Bottom-left corner
    if (!(below && left && belowLeft)) {
      cornerMask |= CORNER_BITS.BL
    }

    // Bottom-right corner
    if (!(below && right && belowRight)) {
      cornerMask |= CORNER_BITS.BR
    }

    // Find the tile index corresponding to the corner mask
    let tileIndex = 0
    for (const [index, mask] of Object.entries(TILE_CORNER_MAP)) {
      if (mask === cornerMask) {
        tileIndex = parseInt(index, 10)
        break
      }
    }

    // Default to tile index 0 if no match
    return tileIndex || 0
  }

  isSolidTileAt(x: number, y: number): boolean {
    const tile = this.terrainLayer.getTileAt(x, y)
    return tile !== null && tile.index !== -1
  }

  drawOval(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    tileType: number,
  ): void {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
      for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
        // Ensure the coordinates are within the map boundaries
        if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) {
          continue
        }

        // Calculate the normalized distance from the center
        const normalizedX = (x - centerX) ** 2 / radiusX ** 2
        const normalizedY = (y - centerY) ** 2 / radiusY ** 2

        if (normalizedX + normalizedY <= 1) {
          // Place the tile at (x, y) and compute the correct tile index
          this.setAutotileAt(x, y, tileType)
        }
      }
    }
  }

  setAutotileAt(x: number, y: number, tileType: number): void {
    // Set the tile at (x, y)
    this.terrainLayer.putTileAt(0, x, y)

    // Update the tile at (x, y)
    this.updateAutotileAt(x, y, tileType)

    // Update neighboring tiles to reflect the new tile
    const neighbors = [
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ]

    for (const neighbor of neighbors) {
      const nx = x + neighbor.dx
      const ny = y + neighbor.dy
      if (nx >= 0 && nx < this.map.width && ny >= 0 && ny < this.map.height) {
        if (this.isSolidTileAt(nx, ny)) {
          this.updateAutotileAt(nx, ny, tileType)
        }
      }
    }
  }

  updateAutotileAt(x: number, y: number, tileType: number): void {
    if (!this.isSolidTileAt(x, y)) {
      return
    }

    const tileIndex = this.computeTileIndex(x, y)
    const tile = this.terrainLayer.putTileAt(tileIndex, x, y) as TerrainTile
    tile.type = tileType
    const properties = tileProperties[tileType as keyof typeof tileProperties]
    tile.armor = properties.armor
    tile.health = properties.health
    tile.tint = properties.color
  }

  isTerrainNear(tileX: number, tileY: number, minDistanceInTiles: number): boolean {
    const startX = tileX - minDistanceInTiles
    const startY = tileY - minDistanceInTiles
    const endX = tileX + minDistanceInTiles
    const endY = tileY + minDistanceInTiles

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        if (x >= 0 && x < this.map.width && y >= 0 && y < this.map.height) {
          if (this.isSolidTileAt(x, y)) {
            return true
          }
        }
      }
    }
    return false
  }

  displayTilesetForDebug() {
    const { width, height } = this.scene.cameras.main
    const textureKey = 'generated-tileset'

    // Create an image using the generated tileset texture
    const tilesetImage = this.scene.add.image(width / 2, height / 2, textureKey)

    // Set the origin to the center of the image
    tilesetImage.setOrigin(0.5, 0.5)

    // **Scale the image by a factor of 3 to make it larger**
    tilesetImage.setScale(3)

    // Bring the image to the top depth
    tilesetImage.setDepth(99999999999999)

    this.scene.mainLayer.add(tilesetImage)
  }

  
}

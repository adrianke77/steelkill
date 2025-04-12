// TerrainManager.ts

import { Game } from '../scenes/Game'
import { Projectile, TerrainTile } from '../interfaces'
import { createDustCloud } from '../rendering'
import { Constants as ct } from '../constants'
import { tileProperties } from '../constants/tileProperties'
import { blendColors } from '../utils'

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

const NUM_VARIANTS = 5 // Number of tileset variants

export const loadTerrainAssets = (scene: Game) => {
  scene.load.image('terrainTile', 'terrainTile3.png')
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
  // Margin variables (in tiles)
  marginTop: number = 15 // Adjust as needed
  marginBottom: number = 2 // Adjust as needed
  marginLeft: number = 2 // Adjust as neededv
  marginRight: number = 2 // Adjust as
  playerSafeRadius: number = 5
  outlineGraphics: Phaser.GameObjects.Graphics
  outlineUpdateTimer: number = 0
  outlineSegments = new Map<string, Phaser.GameObjects.Graphics>()
  tilesetColumns: number
  tilesetRows: number

  constructor(scene: Game) {
    this.scene = scene

    // Create the tilemap
    this.map = this.scene.make.tilemap({
      width: this.scene.mapWidth / ct.tileSize,
      height: this.scene.mapHeight / ct.tileSize,
      tileWidth: ct.tileSize,
      tileHeight: ct.tileSize,
    }) as Phaser.Tilemaps.Tilemap

    // create tileset and terrain layer

    // Remove the old tileset if it exists
    if (this.scene.textures.exists('generated-tileset')) {
      this.scene.textures.remove('generated-tileset')
    }

    this.tilesetColumns = 16 // There are 16 unique tile configurations
    this.tilesetRows = NUM_VARIANTS // Number of variants
    const tileSize = ct.tileSize
    const tilesetWidth = this.tilesetColumns * tileSize
    const tilesetHeight = this.tilesetRows * tileSize

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

    // Draw the tiles with variants onto the canvas
    for (let variant = 0; variant < NUM_VARIANTS; variant++) {
      for (let tileIndex = 0; tileIndex <= 15; tileIndex++) {
        const col = tileIndex
        const row = variant
        const x = col * tileSize
        const y = row * tileSize

        // Draw the base tile
        context.drawImage(baseImage, x, y, tileSize, tileSize)

        // Apply rounded corners based on the bitmask
        const cornerMask = TILE_CORNER_MAP[tileIndex] || 0

        // Apply randomized corners for each variant
        this.addCorners(context, x, y, tileSize, cornerMask)
      }
    }

    // Refresh the canvas texture to update it
    tilesetCanvas.refresh()

    const tileset = this.map.addTilesetImage(
      'generated-tileset',
    ) as Phaser.Tilemaps.Tileset

    this.terrainLayer = this.map.createBlankLayer('Terrain', tileset)!
    this.scene.viewMgr.mainLayer.add(this.terrainLayer)

    this.terrainLayer.setDepth(ct.depths.terrain)
    this.terrainLayer.setAlpha(0.17)
  }

  getTileData(tile: TerrainTile) {
    return tileProperties[tile.type as keyof typeof tileProperties]
  }

  createTerrain() {
    this.terrainLayer.setCollisionBetween(
      0,
      this.tilesetColumns * this.tilesetRows - 1,
    )
    this.terrainLayer.setPipeline('Light2D')

    this.setupColliders()
    this.debrisSprayEmitter = this.scene.addParticles(
      0,
      0,
      'whiteParticle',
      debrisSprayEmitterConfig,
    )
  }

  clearTileOutlines(x: number, y: number): void {
    const key = `${x},${y}`
    const existingOutline = this.outlineSegments.get(key)
    if (existingOutline) {
      existingOutline.destroy()
      this.outlineSegments.delete(key)
    }
  }

  drawTileOutline(tile: TerrainTile): void {
    const x = tile.x
    const y = tile.y
    const key = `${x},${y}`

    const tileData = this.getTileData(tile)
    const outlineColor = blendColors(tileData.color, 0x000000, 0.9)
    const tileSize = this.map.tileWidth
    const worldX = tile.pixelX
    const worldY = tile.pixelY

    // Create a new Graphics object for this tile, using effects layer as the outlines are 'added by computer' instead of being in the world
    const gfx = this.scene.addGraphicsEffect()
    gfx.setAlpha(0.6)
    gfx.lineStyle(4, outlineColor, 0.9)

    // For each side, check if a neighboring tile is missing. If so, draw an outline segment.
    if (!this.isSolidTileAt(x, y - 1)) {
      gfx.lineBetween(worldX, worldY, worldX + tileSize, worldY)
    }
    if (!this.isSolidTileAt(x + 1, y)) {
      gfx.lineBetween(
        worldX + tileSize,
        worldY,
        worldX + tileSize,
        worldY + tileSize,
      )
    }
    if (!this.isSolidTileAt(x, y + 1)) {
      gfx.lineBetween(
        worldX,
        worldY + tileSize,
        worldX + tileSize,
        worldY + tileSize,
      )
    }
    if (!this.isSolidTileAt(x - 1, y)) {
      gfx.lineBetween(worldX, worldY, worldX, worldY + tileSize)
    }

    // Store the Graphics object so we can remove/replace it later
    this.outlineSegments.set(key, gfx)
    this.scene.viewMgr.mainLayer.add(gfx)
  }

  public drawTerrainOutlines(affectedTiles?: { x: number; y: number }[]): void {
    let tilesToUpdate: { x: number; y: number }[] = []

    if (affectedTiles && affectedTiles.length > 0) {
      // Collect the affected tiles + neighbors
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
      const tileSet = new Set<string>()

      for (const { x, y } of affectedTiles) {
        // Add original tile
        if (x >= 0 && x < this.map.width && y >= 0 && y < this.map.height) {
          tileSet.add(`${x},${y}`)
        }
        // Add neighbors
        for (const { dx, dy } of neighbors) {
          const nx = x + dx
          const ny = y + dy
          if (
            nx >= 0 &&
            nx < this.map.width &&
            ny >= 0 &&
            ny < this.map.height
          ) {
            tileSet.add(`${nx},${ny}`)
          }
        }
      }

      // Convert the set back to an array
      tilesToUpdate = [...tileSet].map(key => {
        const [tx, ty] = key.split(',').map(Number)
        return { x: tx, y: ty }
      })
    } else {
      // If no specific tiles, update every tile in the map
      for (let x = 0; x < this.map.width; x++) {
        for (let y = 0; y < this.map.height; y++) {
          tilesToUpdate.push({ x, y })
        }
      }
    }

    // For each tile, clear old outlines and draw new ones
    for (const { x, y } of tilesToUpdate) {
      this.clearTileOutlines(x, y)

      const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
      if (tile) {
        this.drawTileOutline(tile)
      }
    }
  }

  addCorners(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    cornerMask: number,
  ) {
    const cornerSize = size * 0.25 // Adjust the size of the corner cutouts
    const jitter = cornerSize * 0.4 // Jitter amount
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
    // Calculate the player's starting tile coordinates
    const playerStartTileX = Math.floor(
      this.scene.player.mechContainer.x / ct.tileSize,
    )
    const playerStartTileY = Math.floor(
      this.scene.player.mechContainer.y / ct.tileSize,
    )

    // Increase to make terrain denser, decrease for sparser terrain
    const fillProbability = ct.terrainDefaultFillProbability
    // Increasing iterations: Can smooth out the terrain and potentially make it more filled in or homogeneous.
    // Decreasing iterations: May result in more random, rugged, or fragmented terrain patterns.
    const iterations = ct.terrainDefaultIterations
    // Generate a temporary grid for the initial state, including margins
    let tempGrid: boolean[][] = []

    for (let x = 0; x < this.map.width; x++) {
      tempGrid[x] = []
      for (let y = 0; y < this.map.height; y++) {
        // Calculate the distance from the player's starting position
        const dx = x - playerStartTileX
        const dy = y - playerStartTileY
        const distanceSquared = dx * dx + dy * dy

        if (distanceSquared <= this.playerSafeRadius * this.playerSafeRadius) {
          // Within the safe radius, set tile to empty
          tempGrid[x][y] = false
        } else {
          const isSolid = Math.random() < fillProbability
          tempGrid[x][y] = isSolid
        }
      }
    }

    // Apply the cellular automata rules
    for (let i = 0; i < iterations; i++) {
      tempGrid = this.runAutomataStep(tempGrid)
    }

    // Apply the generated terrain, excluding margins
    for (let x = this.marginLeft; x < this.map.width - this.marginRight; x++) {
      for (
        let y = this.marginTop;
        y < this.map.height - this.marginBottom;
        y++
      ) {
        if (tempGrid[x][y]) {
          // Set all initial solid tiles to a default type (e.g., 1)
          this.setAutotileAt(x, y, 1)
        } else {
          this.terrainLayer.removeTileAt(x, y)
        }
      }
    }

    // Assign terrain types to each clump after cellular automata
    this.assignTerrainTypesToClumps()

    // Apply autotiling to update tile graphics
    this.applyAutotiling()

    this.drawTerrainOutlines()
  }

  assignTerrainTypesToClumps() {
    const visited = new Set<string>()
    const terrainTypes = [1, 2, 3] // Available terrain types

    // Define clump weight per terrain type (adjust these values as needed)
    const terrainTypeClumpWeight = {
      1: 1.0,
      2: 1.0,
      3: 1.0,
    }

    // Collect all clumps
    const allClumps: TerrainTile[][] = []

    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
        if (tile && tile.index !== -1 && !visited.has(`${x},${y}`)) {
          // Start a new clump
          const clumpTiles: TerrainTile[] = []
          const stack = [{ x, y }]
          visited.add(`${x},${y}`)

          while (stack.length > 0) {
            const { x: cx, y: cy } = stack.pop()!
            const currentTile = this.terrainLayer.getTileAt(
              cx,
              cy,
            ) as TerrainTile
            if (currentTile && currentTile.index !== -1) {
              clumpTiles.push(currentTile)

              // Check neighbors (up, down, left, right)
              const neighbors = [
                { x: cx - 1, y: cy },
                { x: cx + 1, y: cy },
                { x: cx, y: cy - 1 },
                { x: cx, y: cy + 1 },
              ]

              for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`
                if (
                  neighbor.x >= 0 &&
                  neighbor.x < this.map.width &&
                  neighbor.y >= 0 &&
                  neighbor.y < this.map.height &&
                  !visited.has(key)
                ) {
                  const neighborTile = this.terrainLayer.getTileAt(
                    neighbor.x,
                    neighbor.y,
                  ) as TerrainTile
                  if (neighborTile && neighborTile.index !== -1) {
                    stack.push(neighbor)
                    visited.add(key)
                  }
                }
              }
            }
          }

          // Store the clump for later processing
          allClumps.push(clumpTiles)
        }
      }
    }

    // Now, assign terrain types to clumps based on their sizes and weights
    for (const clumpTiles of allClumps) {
      const clumpSize = clumpTiles.length

      // Compute weighted probabilities for each terrain type
      const terrainTypeProbabilities = terrainTypes.map(terrainType => {
        // Use weights to influence the probability
        const weight =
          terrainTypeClumpWeight[
            terrainType as keyof typeof terrainTypeClumpWeight
          ]
        return Math.pow(clumpSize, weight)
      })

      // Normalize probabilities
      const sumProbabilities = terrainTypeProbabilities.reduce(
        (a, b) => a + b,
        0,
      )
      const normalizedProbabilities = terrainTypeProbabilities.map(
        p => p / sumProbabilities,
      )

      // Choose a terrain type based on the probabilities
      const chosenTerrainType = this.weightedRandomChoice(
        terrainTypes,
        normalizedProbabilities,
      )

      // Assign the chosen terrain type to the clump
      for (const clumpTile of clumpTiles) {
        clumpTile.type = chosenTerrainType
        // Update the tile's visual appearance based on the new type
        this.updateAutotileAt(clumpTile.x, clumpTile.y, chosenTerrainType)
      }
    }
  }

  weightedRandomChoice(items: number[], weights: number[]): number {
    let cumulativeWeight = 0
    const random = Math.random()
    for (let i = 0; i < items.length; i++) {
      cumulativeWeight += weights[i]
      if (random < cumulativeWeight) {
        return items[i]
      }
    }
    return items[items.length - 1]
  }

  runAutomataStep(grid: boolean[][]): boolean[][] {
    const newGrid: boolean[][] = []

    for (let x = 0; x < this.map.width; x++) {
      newGrid[x] = []
      for (let y = 0; y < this.map.height; y++) {
        const aliveNeighbors = this.countAliveNeighborsInGrid(grid, x, y)
        const isSolid = grid[x][y]

        if (isSolid) {
          // Survival rule: A solid tile remains solid if it has 4 or more solid neighbors
          newGrid[x][y] = aliveNeighbors >= 4
        } else {
          // Birth rule: An empty tile becomes solid if it has 5 or more solid neighbors
          newGrid[x][y] = aliveNeighbors >= 5
        }
      }
    }

    return newGrid
  }

  decideTileTypeBasedOnNeighbors(x: number, y: number): number {
    const neighborTypes: number[] = []

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue // Skip the tile itself

        const nx = x + dx
        const ny = y + dy

        if (nx < 0 || nx >= this.map.width || ny < 0 || ny >= this.map.height) {
          continue // Skip out-of-bounds
        }

        const neighborTileType = this.getTileTypeAt(nx, ny)
        if (neighborTileType > 0) {
          neighborTypes.push(neighborTileType)
        }
      }
    }

    if (neighborTypes.length > 0) {
      // Return the most common tile type among neighbors
      const counts = neighborTypes.reduce(
        (acc, type) => {
          acc[type] = (acc[type] || 0) + 1
          return acc
        },
        {} as { [key: string]: number },
      )

      const mostCommonType = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b,
      )

      return parseInt(mostCommonType, 10)
    } else {
      // Default to a random tile type if no solid neighbors
      return Phaser.Math.Between(1, 3)
    }
  }

  countAliveNeighborsInGrid(grid: boolean[][], x: number, y: number): number {
    let count = 0

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) {
          continue // Skip the tile itself
        }

        const nx = x + dx
        const ny = y + dy

        if (nx >= 0 && nx < this.map.width && ny >= 0 && ny < this.map.height) {
          if (grid[nx][ny]) {
            count++
          }
        }
        // Treat out-of-bounds as empty (do not increment count)
      }
    }

    return count
  }

  countAliveNeighbors(x: number, y: number): number {
    let count = 0

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) {
          continue // Skip the tile itself
        }

        const nx = x + dx
        const ny = y + dy

        // Skip neighbors outside the map boundaries or within margins
        if (
          nx < 0 ||
          nx >= this.map.width ||
          ny < 0 ||
          ny >= this.map.height ||
          nx < this.marginLeft ||
          nx >= this.map.width - this.marginRight ||
          ny < this.marginTop ||
          ny >= this.map.height - this.marginBottom
        ) {
          // Optionally, treat out-of-bounds or margin tiles as solid to favor enclosed shapes
          count++
        } else if (this.isSolidTileAt(nx, ny)) {
          count++
        }
      }
    }

    return count
  }

  applyAutotiling() {
    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
        if (tile) {
          const tileType = tile.type
          const tileIndex = this.computeTileIndex(x, y, tileType)
          this.terrainLayer.putTileAt(tileIndex, x, y)
        }
      }
    }
  }

  setupColliders() {
    this.scene.physics.add.collider(
      this.scene.player.mechContainer,
      this.terrainLayer,
    )

    this.scene.physics.add.collider(
      this.scene.enemyMgr.enemies,
      this.terrainLayer,
    )

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

  destroyTile(tile: TerrainTile) {
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
        const neighborTile = this.terrainLayer.getTileAt(nx, ny) as TerrainTile
        if (neighborTile) {
          // Update the autotiling for the neighboring tile
          this.updateAutotileAt(nx, ny, neighborTile.type)
        }
      }
    }

    this.renderTerrainTileDestruction(tile)
    this.drawTerrainOutlines([{ x: tile.x, y: tile.y }])
  }

  getTileTypeAt(x: number, y: number): number {
    const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
    return tile ? tile.type : 0 // Return 0 if tile doesn't exist
  }

  renderTerrainTileDestruction(tile: TerrainTile) {
    const worldX = tile.getCenterX()
    const worldY = tile.getCenterY()
    const tileData = this.getTileData(tile)

    // Create an effect at the tile's position
    createDustCloud(
      this.scene,
      worldX,
      worldY,
      0,
      0,
      0.8,
      7000,
      250,
      tileData.color,
    )
  }

  computeTileIndex(x: number, y: number, tileType: number): number {
    const above = this.isSolidTileAt(x, y - 1, tileType)
    const below = this.isSolidTileAt(x, y + 1, tileType)
    const left = this.isSolidTileAt(x - 1, y, tileType)
    const right = this.isSolidTileAt(x + 1, y, tileType)
    const aboveLeft = this.isSolidTileAt(x - 1, y - 1, tileType)
    const aboveRight = this.isSolidTileAt(x + 1, y - 1, tileType)
    const belowLeft = this.isSolidTileAt(x - 1, y + 1, tileType)
    const belowRight = this.isSolidTileAt(x + 1, y + 1, tileType)

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

  isSolidTileAt(x: number, y: number, tileType?: number): boolean {
    // Check if the terrain layer has been initialized, sometimes happens if isSolidTileAt is in a running update loop and when game is restarted
    if (!this.terrainLayer.scene) {
      return false
    }
    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) {
      return false // Treat out-of-bounds as empty
    }

    const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
    if (tileType !== undefined) {
      return tile !== null && tile.index !== -1 && tile.type === tileType
    } else {
      return tile !== null && tile.index !== -1
    }
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
    const tile = this.terrainLayer.putTileAt(0, x, y) as TerrainTile
    tile.type = tileType

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
        const neighborTile = this.terrainLayer.getTileAt(nx, ny) as TerrainTile
        if (neighborTile) {
          this.updateAutotileAt(nx, ny, neighborTile.type)
        }
      }
    }
  }

  updateAutotileAt(x: number, y: number, tileType: number): void {
    const tile = this.terrainLayer.getTileAt(x, y) as TerrainTile
    if (!tile) {
      return
    }

    const baseTileIndex = this.computeTileIndex(x, y, tileType)
    const tilesetColumns = 16

    // Randomly select a variant index between 0 and NUM_VARIANTS - 1
    const variant = Phaser.Math.Between(0, NUM_VARIANTS - 1)

    // Compute the tile index with the variant offset
    const tileIndex = baseTileIndex + variant * tilesetColumns

    tile.index = tileIndex
    tile.type = tileType

    // Update tile properties based on tile type
    const properties = tileProperties[tileType as keyof typeof tileProperties]
    tile.armor = properties.armor
    tile.health = properties.health
    tile.tint = properties.color
  }

  isTerrainNear(
    tileX: number,
    tileY: number,
    minDistanceInTiles: number,
  ): boolean {
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

    this.scene.viewMgr.mainLayer.add(tilesetImage)
  }

  isATerrainTile(obj: any): boolean {
    return obj instanceof Phaser.Tilemaps.Tile
  }

  isPointInPolygon(
    point: { x: number; y: number },
    polygon: { x: number; y: number }[],
  ): boolean {
    let isInside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x,
        yi = polygon[i].y
      const xj = polygon[j].x,
        yj = polygon[j].y

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
      if (intersect) isInside = !isInside
    }
    return isInside
  }

  public generateTerrainInPolygon(
    polygon: { x: number; y: number }[],
    fillProbability: number = ct.terrainDefaultFillProbability,
    iterations: number = ct.terrainDefaultIterations,
  ): void {
    // Calculate the bounding box of the polygon for optimization
    const minX = Math.min(...polygon.map(p => p.x)) / ct.tileSize
    const maxX = Math.max(...polygon.map(p => p.x)) / ct.tileSize
    const minY = Math.min(...polygon.map(p => p.y)) / ct.tileSize
    const maxY = Math.max(...polygon.map(p => p.y)) / ct.tileSize

    // Generate a temporary grid for the initial state
    let tempGrid: boolean[][] = []

    for (let x = 0; x < this.map.width; x++) {
      tempGrid[x] = []
      for (let y = 0; y < this.map.height; y++) {
        // Skip if outside the bounding box of the polygon (optimization)
        if (x < minX || x > maxX || y < minY || y > maxY) {
          tempGrid[x][y] = false
          continue
        }

        const worldX = x * ct.tileSize
        const worldY = y * ct.tileSize

        // Check if the tile's center is inside the polygon
        if (this.isPointInPolygon({ x: worldX, y: worldY }, polygon)) {
          const isSolid = Math.random() < fillProbability
          tempGrid[x][y] = isSolid
        } else {
          tempGrid[x][y] = false
        }
      }
    }

    // Apply the cellular automata rules
    for (let i = 0; i < iterations; i++) {
      tempGrid = this.runAutomataStep(tempGrid)
    }

    // Apply the generated terrain
    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        if (tempGrid[x][y]) {
          this.setAutotileAt(x, y, 1) // Set all initial solid tiles to a default type
        } else {
          this.terrainLayer.removeTileAt(x, y)
        }
      }
    }

    // Assign terrain types to each clump after cellular automata
    this.assignTerrainTypesToClumps()

    // Apply autotiling to update tile graphics
    this.applyAutotiling()

    this.drawTerrainOutlines()

    this.terrainLayer.setCollisionBetween(
      0,
      this.tilesetColumns * this.tilesetRows - 1,
    )
    this.setupColliders()
  }
}

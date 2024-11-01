// TerrainManager.ts

import { Game } from '../scenes/Game'
import { Projectile, TerrainTile } from '../interfaces'
import { renderExplosion } from '../rendering'
import { Constants as ct} from '../constants'
import { drawOval } from '../utils'

export class TerrainManager {
  scene: Game
  map: Phaser.Tilemaps.Tilemap
  terrainLayer: Phaser.Tilemaps.TilemapLayer

  constructor(scene: Game) {
    this.scene = scene

    // Create the terrain when the manager is instantiated
    this.createTerrain()
    this.setupCollision()
  }

  createTerrain() {
    // Generate the tileset dynamically
    const tilesetCanvas = this.scene.textures.createCanvas(
      'dynamic-tileset',
      ct.tileSize * 2,
      ct.tileSize * 2,
    )

    // Get the drawing context
    const context = tilesetCanvas!.context

    // Define colors for different tiles
    const colors = [
      '#00FF00', // Tile index 0
      '#FF0000', // Tile index 1
      '#0000FF', // Tile index 2
    ]

    // Draw colored squares onto the canvas
    colors.forEach((color, index) => {
      const x = (index % 2) * ct.tileSize
      const y = Math.floor(index / 2) * ct.tileSize
      context.fillStyle = color
      context.fillRect(x, y, ct.tileSize, ct.tileSize)
    })

    // Refresh the canvas texture to update it
    tilesetCanvas!.refresh()

    // Create the tilemap
    this.map = this.scene.make.tilemap({
      width: ct.fieldWidth / ct.tileSize,
      height: ct.fieldHeight / ct.tileSize,
      tileWidth: ct.tileSize,
      tileHeight: ct.tileSize,
    })

    // Add the dynamically generated tileset to the map
    const tileset = this.map.addTilesetImage(
      'dynamic-tileset',
      'dynamic-tileset',
      ct.tileSize,
      ct.tileSize,
    )

    // Create a layer and fill it with tiles
    this.terrainLayer = this.map.createBlankLayer('Terrain', tileset!)!

    // Set the layer depth
    this.terrainLayer.setDepth(ct.depths.terrain) // Behind everything else

    // Populate the layer with sample terrain
    this.populateTerrain()

    // Add the terrain layer to the main layer
    this.scene.mainLayer.add(this.terrainLayer)

    // Set collision properties
    this.terrainLayer.setCollisionBetween(0, 2)
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
      const tileType = Phaser.Math.Between(0, 2)

      // Generate random center coordinates within the tilemap boundaries
      const centerX = Phaser.Math.Between(0, ct.fieldWidth / ct.tileSize)
      const centerY = Phaser.Math.Between(0, ct.fieldHeight / ct.tileSize)

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
      drawOval(this.terrainLayer, centerX, centerY, radiusX, radiusY, tileType)
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
    this.scene.physics.add.collider(
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

    // Optionally, add an effect or sound for tile destruction
    this.renderTileDestructionEffect(tile)
  }

  renderTileDestructionEffect(tile: Phaser.Tilemaps.Tile) {
    const worldX = tile.getCenterX()
    const worldY = tile.getCenterY()

    // Create an effect at the tile's position
    renderExplosion(this.scene, worldX, worldY, 50, 50, {
      color: 0x888888, // Grey color for debris
    })
  }
}

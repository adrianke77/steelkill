// TerrainManager.ts

import { Game } from '../scenes/Game'
import { Projectile, TerrainTile } from '../interfaces'
import { createDustCloud } from '../rendering'
import { Constants as ct } from '../constants'
import { tileProperties } from '../constants/tileProperties'

export const loadTerrainAssets = (scene: Game) => {
  Object.values(tileProperties).forEach(prop => {
    scene.load.image(prop.imageName, `${prop.imageName}.png`)
  })
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
    // Remove the old tileset if it exists, such as from app hot reload
    this.scene.textures.remove('dynamic-tileset')

    const tilesetCanvas = this.scene.textures.createCanvas(
      'dynamic-tileset',
      ct.tileSize * 2,
      ct.tileSize * 2,
    )
    const context = tilesetCanvas!.context

    // First load your terrain textures in the preload function
    const textures = [
      'terrainTile1', // Tile index 0
      'terrainTile2', // Tile index 1
      'terrainTile3', // Tile index 2
    ]

    textures.forEach((textureName, index) => {
      const x = (index % 2) * ct.tileSize
      const y = Math.floor(index / 2) * ct.tileSize
      const texture = this.scene.textures.get(textureName)
      context.drawImage(
        texture.getSourceImage() as HTMLImageElement,
        x,
        y,
        ct.tileSize,
        ct.tileSize,
      )
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

    const tileset = this.map.addTilesetImage(
      'dynamic-tileset',
      'dynamic-tileset',
      ct.tileSize,
      ct.tileSize,
    ) as Phaser.Tilemaps.Tileset

    this.terrainLayer = this.map.createBlankLayer('Terrain', tileset)!

    this.terrainLayer.setDepth(ct.depths.terrain)

    // Populate the layer with sample terrain
    this.populateTerrain()

    // Add the terrain layer to the main layer
    this.scene.mainLayer.add(this.terrainLayer)

    // Set collision properties
    this.terrainLayer.setCollisionBetween(0, 2)
    this.terrainLayer.setPipeline('Light2D')
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
      this.drawOval(this.terrainLayer, centerX, centerY, radiusX, radiusY, tileType)
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
    createDustCloud(this.scene, worldX, worldY, 0, 0, 0.5, 3000, 100)
  }

  drawOval(
    layer: Phaser.Tilemaps.TilemapLayer,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    tileIndex: number
  ): void {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
      for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
        // Calculate the normalized distance from the center
        const normalizedX = ((x - centerX) ** 2) / (radiusX ** 2);
        const normalizedY = ((y - centerY) ** 2) / (radiusY ** 2);
  
        if (normalizedX + normalizedY <= 1) {
          layer.putTileAt(tileIndex, x, y);
        }
      }
    }
  }
}

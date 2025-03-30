import { Game } from '../scenes/Game'
import { XMLParser } from 'fast-xml-parser'
import { Constants as ct } from '../constants/index'

const MAP_SCALE = 0.5

// These tile indices (from the .tsx) are treated as "trees" for random rotation/scale
const tilesetTreeIds = [0, 8]

export class MapManager {
  private scene: Game
  private xmlParser: XMLParser

  constructor(scene: Game) {
    this.scene = scene
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      allowBooleanAttributes: true,
    })
  }

  /**
   * Loads the .tmj JSON map data and the corresponding .tsx tileset file,
   * queues up images, converts map layers for scaling + collision shapes,
   * and then draws them.
   */
  public async loadMap(baseUrl: string) {
    // 1) Load the Tiled map JSON (map.tmj)
    const mapDataFetchResponse = await fetch('/assets/' + baseUrl + '/map.tmj')
    const mapData = await mapDataFetchResponse.json()

    // 2) Load the .tsx tileset
    const tileSet1FileName = mapData.tilesets[0].source
    const tsxFullUrl = '/assets/' + baseUrl + '/' + tileSet1FileName
    const tilesetData = (await this.importTilesetData(tsxFullUrl)) as any
    const tileDefs = Array.isArray(tilesetData.tileset.tile)
      ? tilesetData.tileset.tile
      : [tilesetData.tileset.tile]

    // 3) Queue up images for each tile in the tileset
    await this.loadTilesetImages(baseUrl, tileDefs)

    // 4) Convert the map’s layers and objects so that each object has
    //    (a) a final scale
    //    (b) collisionShapes embedded if the tile has objectgroup data
    const mapLayersWithScaling = this.convertMapDataToUseScaling(
      mapData.layers,
      tileDefs,
      MAP_SCALE,
    )

    // 5) Draw the objects
    this.drawMapObjects(baseUrl, mapLayersWithScaling, tilesetTreeIds)

    // Return essential map dimension info for reference
    return {
      width: mapData.width,
      height: mapData.height,
      tilewidth: mapData.tilewidth,
      tileheight: mapData.tileheight,
    }
  }

  /**
   * Helper for loading a .tsx file (Tiled tileset definition) via XML parsing.
   */
  public async importTilesetData(url: string): Promise<unknown> {
    const response = await fetch(url)
    const tsxContent = await response.text()
    const data = this.xmlParser.parse(tsxContent)
    return data
  }

  /**
   * Queues each tile image in tilesetData to be loaded by Phaser, then awaits completion.
   */
  public async loadTilesetImages(
    mapBaseUrl: string,
    tilesetData: any[],
  ): Promise<void> {
    return new Promise<void>(resolve => {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve())
      tilesetData.forEach(tile => {
        const key = `${mapBaseUrl}_${tile.id}`
        this.scene.load.image(key, mapBaseUrl + '/' + tile.image.source)
      })
      this.scene.load.start()
    })
  }

  public convertMapDataToUseScaling(
    layersData: any[],
    tilesetData: any[],
    globalScale: number
  ): any[] {
    // Make a deep copy so we don’t mutate the original
    const resultLayers = JSON.parse(JSON.stringify(layersData))
  
    // Build a lookup keyed by tile ID
    const tileLookup = new Map<number, any>()
    for (const tileDef of tilesetData) {
      tileLookup.set(tileDef.id, tileDef)
    }
  
    // For each layer in the map
    for (const layer of resultLayers) {
      // Skip layers that don’t have objects
      if (!layer.objects) continue
  
      // For each object in the layer
      for (const obj of layer.objects) {
        // Scale the object's position by the globalScale
        obj.x *= globalScale
        obj.y *= globalScale
  
        // If it’s not a tile-based object, still scale width/height if they exist
        if (obj.width !== undefined) {
          obj.width *= globalScale
        }
        if (obj.height !== undefined) {
          obj.height *= globalScale
        }
  
        // If obj.gid is not a number, move on to the next object
        if (typeof obj.gid !== 'number') {
          continue
        }
  
        const tileIndex = obj.gid - 1
        const tileDef = tileLookup.get(tileIndex)
        if (!tileDef || !tileDef.image) continue
  
        // Compute a uniform scale from Tiled’s object width/height
        const originalW = tileDef.image.width
        const originalH = tileDef.image.height
  
        let scaleW = 1
        let scaleH = 1
  
        // If width/height are known, they've already been scaled by globalScale
        if (obj.width !== undefined && obj.height !== undefined) {
          scaleW = originalW ? obj.width / originalW : 1
          scaleH = originalH ? obj.height / originalH : 1
        }
  
        // Combine Tiled’s own scale factor with the globalScale-based sizing
        obj.scale = (scaleW + scaleH) * 0.5
  
        // If this tile has collision <objectgroup>, transform the shapes
        if (tileDef.objectgroup && tileDef.objectgroup.object) {
          let rawShapes = tileDef.objectgroup.object
          if (!Array.isArray(rawShapes)) {
            rawShapes = [rawShapes]
          }
  
          const tileRotationDeg = tileDef.rotation ?? 0
          const tileRotationRad = Phaser.Math.DegToRad(tileRotationDeg)
  
          // We'll store collisionShapes on the map object
          obj.collisionShapes = []
  
          for (const shape of rawShapes) {
            const isEllipse = 'ellipse' in shape
            const { x, y, width, height, rotation } = shape
  
            // Combine shape’s own rotation with the tile’s rotation
            const shapeRotationDeg = (rotation ?? 0) + tileRotationDeg
  
            // Scale shape’s local width/height by the final object scale
            const scaledWidth = width * obj.scale
            const scaledHeight = height * obj.scale
  
            // Also apply the same scale to shape’s local position
            const sx = x * obj.scale
            const sy = y * obj.scale
  
            // Rotate (sx, sy) around (0,0) by tileRotationRad
            const cosR = Math.cos(tileRotationRad)
            const sinR = Math.sin(tileRotationRad)
            const rx = sx * cosR - sy * sinR
            const ry = sx * sinR + sy * cosR
  
            obj.collisionShapes.push({
              x: rx,
              y: ry,
              width: scaledWidth,
              height: scaledHeight,
              ellipse: isEllipse,
              rotation: shapeRotationDeg,
            })
          }
        }
      }
    }
  
    return resultLayers
  }

  /**
   * Draws each object as a sprite (with Tiled’s position/rotation/scale),
   * plus draws collisionShapes from the data embedded in each obj (if any).
   */
  public drawMapObjects(
    mapBaseUrl: string,
    mapLayers: any[],
    treeGids: number[] = [],
  ): void {
    mapLayers.forEach(layer => {
      if (!layer.objects) return

      layer.objects.forEach((obj: any) => {
        if (typeof obj.gid !== 'number') return
        const tileIndex = obj.gid - 1
        const textureKey = `${mapBaseUrl}_${tileIndex}`

        const startX = obj.x
        const startY = obj.y

        const sprite = treeGids.includes(tileIndex)
          ? this.scene.addSpriteEffect(startX, startY, textureKey)
          : this.scene.addSprite(startX, startY, textureKey)

        sprite.setPipeline('Light2D')
        // Tiled tile origins are (0,0).
        sprite.setOrigin(0, 0)

        // Apply rotation from Tiled (degrees → radians).
        const tiledRotationRad = Phaser.Math.DegToRad(obj.rotation ?? 0)
        sprite.setRotation(tiledRotationRad)

        // Apply Tiled’s scale (if set).
        const finalScale = obj.scale ?? 1
        sprite.setScale(finalScale)
        sprite.setDepth(ct.depths.buildings)

        // Draw collision shapes if present.
        if (obj.collisionShapes) {
          const debugGraphics = this.scene.add.graphics({
            lineStyle: { width: 2, color: 0xff0000, alpha: 0.8 },
          })
          debugGraphics.setDepth(ct.depths.debug)

          // The sprite’s actual transform.
          const finalRotation = sprite.rotation
          const originOffsetX = -sprite.originX * sprite.displayWidth
          const originOffsetY = -sprite.originY * sprite.displayHeight
          const cosR = Math.cos(finalRotation)
          const sinR = Math.sin(finalRotation)

          // Since collisionShapes have already been scaled inside
          // convertMapDataToUseScaling(), we skip sprite scale here.
          obj.collisionShapes.forEach((shape: any) => {
            // Local shape coords before final sprite transform.
            const localX = shape.x
            const localY = shape.y

            // Step 1: account for sprite’s top-left origin offset.
            const worldX = localX + originOffsetX
            const worldY = localY + originOffsetY

            // Step 2: rotate around sprite’s rotation.
            const rx = worldX * cosR - worldY * sinR
            const ry = worldX * sinR + worldY * cosR

            // Step 3: final translate by sprite’s in-world position.
            const finalX = sprite.x + rx
            const finalY = sprite.y + ry

            // Combine shape’s own rotation with sprite rotation.
            const shapeRotationRad = Phaser.Math.DegToRad(shape.rotation || 0)
            const totalRotation = finalRotation + shapeRotationRad

            // Draw ellipse or rect. No extra scaling needed here.
            if (shape.ellipse) {
              const ellipseCenterX = finalX + shape.width / 2
              const ellipseCenterY = finalY + shape.height / 2
              debugGraphics.save()
              debugGraphics.translateCanvas(ellipseCenterX, ellipseCenterY)
              debugGraphics.rotateCanvas(totalRotation)
              debugGraphics.strokeEllipse(0, 0, shape.width, shape.height)
              debugGraphics.restore()
            } else {
              debugGraphics.save()
              debugGraphics.translateCanvas(finalX, finalY)
              debugGraphics.rotateCanvas(totalRotation)
              debugGraphics.strokeRect(0, 0, shape.width, shape.height)
              debugGraphics.restore()
            }
          })
        }
      })
    })
  }
}

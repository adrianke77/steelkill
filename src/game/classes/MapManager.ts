import { Game } from '../scenes/Game'
import { XMLParser } from 'fast-xml-parser'
import { Constants as ct } from '../constants/index'

const tilesetTreeIds = [0, 8]

// handles importing and rendering maps made in the Tiled map editor
export class MapManager {
  private scene: Game
  private xmlParser: XMLParser

  constructor(scene: Game) {
    this.scene = scene
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '', // optional: remove @_ or other prefix
      parseAttributeValue: true, // optional: parse numbers etc.
      allowBooleanAttributes: true, // optional
    })
  }

  // Function to load and render a map, given the map path, eg 'maps/ruralVillage1'
  public async loadMap(baseUrl: string) {
    const mapDataFetchResponse = await fetch('/assets/' + baseUrl + '/map.tmj')
    const mapData = await mapDataFetchResponse.json()
    const tileSet1FileName = mapData.tilesets[0].source
    const tilesetData = (
      (await this.importTilesetData(
        '/assets/' + baseUrl + '/' + tileSet1FileName,
      )) as any
    ).tileset.tile
    await this.loadTilesetImages(baseUrl, tilesetData)
    const mapLayersWithScaling = this.convertMapDataToUseScaling(
      mapData.layers,
      tilesetData,
    )
    this.drawMapObjects(
      baseUrl,
      mapLayersWithScaling,
      undefined,
      tilesetTreeIds,
    )
    return {
      width: mapData.width,
      height: mapData.height,
      tilewidth: mapData.tilewidth,
      tileheight: mapData.tileheight,
    }
  }

  // Function to import data from a .tsx file (Tiled tileset). XML format.
  public async importTilesetData(url: string): Promise<unknown> {
    const response = await fetch(url)
    const tsxContent = await response.text()
    const data = this.xmlParser.parse(tsxContent)
    return data
  }

  public async loadTilesetImages(
    mapBaseUrl: string,
    tilesetData: any[],
  ): Promise<void> {
    return new Promise<void>(resolve => {
      // Listen for Phaser's loader "complete" event
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve())

      // Enqueue all tileset images to the loader
      tilesetData.forEach(tile => {
        const key = `${mapBaseUrl}_${tile.id}`
        this.scene.load.image(key, mapBaseUrl + '/' + tile.image.source)
      })

      // Start the loader to load the queued assets
      this.scene.load.start()
    })
  }

  /**
   * Given:
   *  1) layersData from the Tiled map editor (sample object layers .json),
   *  2) objectsData from the sample objects .json which specifies each object's
   *     original width and height at neutral rotation,
   * this function returns a new copy of layersData in which every object's
   * "height" and "width" are replaced with a "scale" (height/width ratio),
   * calculated using the rotation and the original height, width and rectangular shape.
   *
   * Assumes each object has a matching "gid" in the Tiled data that maps to
   * the array index (gid - 1) in the objectsData. Also assumes uniform scaling
   * for height and width.
   *
   * @param {Array} layersData - The array of layer objects exported from Tiled
   * @param {Array} objectsData - The array of original object definitions (with image sizes)
   * @returns {Array} A new array of layers with each object's scale and rotation
   */

  public convertMapDataToUseScaling(layersData: any[], objectsData: any[]) {
    // Make a deep copy so we don't mutate the original
    const resultLayers = JSON.parse(JSON.stringify(layersData))

    for (const layer of resultLayers) {
      if (!layer.objects) {
        continue
      }

      for (const obj of layer.objects) {
        // If the object has a gid, look up the original width/height as
        if (typeof obj.gid === 'number') {
          const index = obj.gid - 1 // assuming gid indexes into objectsData by (gid - 1)
          const matchingData = objectsData[index]

          if (matchingData && matchingData.image) {
            const originalW = matchingData.image.width
            const originalH = matchingData.image.height

            // Instead of computing a rotated bounding box, just compare the original
            // tile size to Tiled's reported width/height for the object, which is
            // often the unrotated tile dims (plus any user scaling).
            const scaleW = originalW ? obj.width / originalW : 1
            const scaleH = originalH ? obj.height / originalH : 1
            const scale = (scaleW + scaleH) / 2

            obj.scale = scale
          }
        }
        // Keep obj.rotation as Tiled specified
        // Remove unneeded properties
        delete obj.height
        delete obj.width
      }
    }

    return resultLayers
  }

  public drawMapObjects(
    mapBaseUrl: string,
    mapLayers: any[],
    overallScale: number = ct.mapScaling,
    treeGids: number[] = [],
  ): void {
    mapLayers.forEach(layer => {
      if (!layer.objects) return

      layer.objects.forEach((obj: any) => {
        if (typeof obj.gid === 'number') {
          const tileIndex = obj.gid - 1
          const textureKey = `${mapBaseUrl}_${tileIndex}`

          // Create sprite at Tiled's position, scaled
          const spriteArgs: [number, number, string] = [
            obj.x * overallScale,
            obj.y * overallScale,
            textureKey,
          ]
          const sprite = treeGids.includes(tileIndex)
            ? this.scene.addSpriteEffect(...spriteArgs)
            : this.scene.addSprite(...spriteArgs)
          sprite.setPipeline('Light2D')

          // First, pivot around bottom-left, like Tiled
          sprite.setOrigin(0, 1)

          // Apply Tiled's rotation (degrees)
          const tiledRotationDeg = obj.rotation ?? 0
          const tiledRotationRad = Phaser.Math.DegToRad(tiledRotationDeg)
          sprite.setRotation(tiledRotationRad)

          // Apply Tiled scale if provided
          if (obj.scale !== undefined) {
            sprite.setScale(obj.scale * overallScale)
          } else {
            sprite.setScale(overallScale)
          }

          if (treeGids.includes(tileIndex)) {
            // Store the sprite's current position so we can restore it after changing origin
            const oldX = sprite.x
            const oldY = sprite.y

            // Shift sprite’s position so changing origin to center won't shift it visually
            const width = sprite.displayWidth
            const height = sprite.displayHeight

            sprite.x = oldX + width * 0.5
            sprite.y = oldY - height * 0.5

            // Change origin to center
            sprite.setOrigin(0.5, 0.5)

            // Extra random rotation
            const randomDeg = Phaser.Math.Between(0, 359)
            sprite.angle += randomDeg

            // Random resize up to ±10% of the sprite's current size
            const randomScaleFactor = 0.7 + 0.6 * Math.random() // 70 to 130 percent
            sprite.setScale(
              sprite.scaleX * randomScaleFactor,
              sprite.scaleY * randomScaleFactor,
            )

            sprite.setDepth(ct.depths.trees)
          }
        }
      })
    })
  }
}

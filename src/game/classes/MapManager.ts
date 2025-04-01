import { Game } from '../scenes/Game'
import { XMLParser } from 'fast-xml-parser'
import { Constants as ct } from '../constants/index'
import { MapTileEntity } from '../interfaces'

const MAP_SCALE = 0.5
const MIN_CIRCLE_DIAMETER = 12 // for approximateRectWithCircles

// These tile indices (from the .tsx) are treated as "trees" for random rotation/scale and alpha setting
// note that these are the ids in the raw tileset XML, plus 1
const treeGids = [1, 9]

//handles importing and rendering maps created in the Tiled map creator
export class MapManager {
  private scene: Game
  private xmlParser: XMLParser

  // New: Keep a collection of all tile "entities"
  public tileEntities: MapTileEntity[] = []

  public collisionShapesGroup: Phaser.Physics.Arcade.StaticGroup

  constructor(scene: Game) {
    this.scene = scene
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      allowBooleanAttributes: true,
    })
    this.collisionShapesGroup = this.scene.physics.add.staticGroup()
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

    // 4) Convert the map's layers and objects so that each object has
    //    (a) a final scale
    //    (b) collisionShapes embedded if the tile has objectgroup data
    const mapLayersWithScaling = this.convertMapDataToUseScaling(
      mapData.layers,
      tileDefs,
      MAP_SCALE,
    )

    // 5) Draw the objects
    this.drawMapObjects(baseUrl, mapLayersWithScaling, treeGids)

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
    globalScale: number,
  ): any[] {
    // Make a deep copy so we don't mutate the original
    const resultLayers = JSON.parse(JSON.stringify(layersData))

    // Build a lookup keyed by tile ID
    const tileLookup = new Map<number, any>()
    for (const tileDef of tilesetData) {
      tileLookup.set(tileDef.id, tileDef)
    }

    // For each layer in the map
    for (const layer of resultLayers) {
      // Skip layers that don't have objects
      if (!layer.objects) continue

      // For each object in the layer
      for (const obj of layer.objects) {
        // Scale the object's position by the globalScale
        obj.x *= globalScale
        obj.y *= globalScale

        // If it's not a tile-based object, still scale width/height if they exist
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

        // Merge any tile-level properties (like health, armor) into obj.properties
        if (tileDef.properties?.property) {
          obj.properties = obj.properties || {}
          tileDef.properties.property.forEach((prop: any) => {
            obj.properties[prop.name] = prop.value
          })
        }

        obj.tileSource = tileDef.image.source
        obj.tileId = tileIndex

        // Compute a uniform scale from Tiled's object width/height
        const originalW = tileDef.image.width
        const originalH = tileDef.image.height

        let scaleW = 1
        let scaleH = 1

        // If width/height are known, they've already been scaled by globalScale
        if (obj.width !== undefined && obj.height !== undefined) {
          scaleW = originalW ? obj.width / originalW : 1
          scaleH = originalH ? obj.height / originalH : 1
        }

        // Combine Tiled's own scale factor with the globalScale-based sizing
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

            // Combine shape's own rotation with the tile's rotation
            const shapeRotationDeg = (rotation ?? 0) + tileRotationDeg

            // Scale shape's local width/height by the final object scale
            const scaledWidth = width * obj.scale
            const scaledHeight = height * obj.scale

            // Also apply the same scale to shape's local position
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

        // Create the sprite
        const sprite = this.scene.addSprite(startX, startY, textureKey)
        sprite.setPipeline('Light2D')
        sprite.setOrigin(0, 0) // Tiled tile origins are (0, 0)

        // Apply rotation from Tiled (degrees → radians)
        const tiledRotationRad = Phaser.Math.DegToRad(obj.rotation ?? 0)
        sprite.setRotation(tiledRotationRad)

        // Get base scale from the object
        let finalScale = obj.scale ?? 1
        
        // For tree sprites, apply random scaling and adjust position
        if (treeGids.includes(obj.gid)) {
          // First apply the base scale to get the original dimensions
          sprite.setScale(finalScale)
        
          // Store original dimensions and center position
          const originalWidth = sprite.displayWidth
          const originalHeight = sprite.displayHeight

        
          // Generate random scale factor between 0.5 and 1.5
          const randomScaleFactor = Phaser.Math.FloatBetween(0.5, 1.5)
          finalScale *= randomScaleFactor
        
          // Apply the new scale
          sprite.setScale(finalScale)
        
          // Calculate new dimensions
          const newWidth = sprite.displayWidth
          const newHeight = sprite.displayHeight
        
          // Calculate new top-left position to maintain the center
          // We need to account for rotation when repositioning
          const cosR = Math.cos(tiledRotationRad)
          const sinR = Math.sin(tiledRotationRad)
        
          // Calculate the offset from the original top-left to maintain center
          const offsetX = (originalWidth - newWidth) / 2
          const offsetY = (originalHeight - newHeight) / 2
        
          // Apply rotation to the offset
          const rotatedOffsetX = offsetX * cosR - offsetY * sinR
          const rotatedOffsetY = offsetX * sinR + offsetY * cosR
        
          // Apply the offset to the sprite position
          sprite.x += rotatedOffsetX
          sprite.y += rotatedOffsetY
        
          // Also apply random alpha variation for trees
          sprite.setAlpha(Phaser.Math.FloatBetween(0.8, 1.0))
        } else {
          // For non-tree sprites, just apply the scale directly
          sprite.setScale(finalScale)
        }
        
        sprite.setDepth(ct.depths.buildings)

        const props = obj.properties || {}
        const health = props.health || 0
        const armor = props.armor || 0

        // Create a new entity object for this tile
        const tileEntity: MapTileEntity = {
          objectId: obj.id,
          sprite: sprite,
          collisionBodies: [],
          health,
          armor,
          source: obj.tileSource,
          entityType: 'mapEntity',
        }

        // If collisionShapes exist, create colliders.
        if (obj.collisionShapes) {
          // For trees with random scaling, we need to scale the collision shapes too
        
          // Store references to created bodies:
          obj.arcadeCollisionBodies = []

          const finalRotation = sprite.rotation
          const originOffsetX = -sprite.originX * sprite.displayWidth
          const originOffsetY = -sprite.originY * sprite.displayHeight
          const cosR = Math.cos(finalRotation)
          const sinR = Math.sin(finalRotation)

          // Track min/max coordinates to draw bounding box
          // this is for calculating the general centre of sprite and saving this later
          let minX = Number.MAX_VALUE
          let minY = Number.MAX_VALUE
          let maxX = Number.MIN_VALUE
          let maxY = Number.MIN_VALUE

          obj.collisionShapes.forEach((shape: any) => {
            // Apply the tree's random scale to the collision shape if needed
            const shapeWidth = shape.width * (treeGids.includes(obj.gid) ? finalScale / obj.scale : 1);
            const shapeHeight = shape.height * (treeGids.includes(obj.gid) ? finalScale / obj.scale : 1);
            
            // Local shape coords before final sprite transform.
            const localX = shape.x * (treeGids.includes(obj.gid) ? finalScale / obj.scale : 1);
            const localY = shape.y * (treeGids.includes(obj.gid) ? finalScale / obj.scale : 1);

            // Step 1: account for sprite's top-left origin offset.
            const worldX = localX + originOffsetX
            const worldY = localY + originOffsetY

            // Step 2: rotate around sprite's final rotation.
            const rx = worldX * cosR - worldY * sinR
            const ry = worldX * sinR + worldY * cosR

            // Step 3: position offset by sprite in world coords.
            const finalX = sprite.x + rx
            const finalY = sprite.y + ry

            // Combine shape's own rotation with sprite rotation.
            const shapeRotationRad = Phaser.Math.DegToRad(shape.rotation || 0)
            const totalRotation = finalRotation + shapeRotationRad

            if (shape.ellipse) {
              // 1) Debug-draw a circle with diameter = average of shape.width and shape.height
              const diameter = (shapeWidth + shapeHeight) / 2
              const radius = diameter / 2

              // 2) Create a corresponding circle collider at the same position
              const circleSprite = this.scene.add
                .sprite(finalX + shapeWidth / 2, finalY + shapeHeight / 2, '')
                .setAlpha(0)
                .setOrigin(0, 0)

              // Rotation for consistency (though not crucial for circles)
              circleSprite.setRotation(totalRotation)

              // Make it a static body and set as a circle
              this.scene.physics.add.existing(circleSprite, true)
              const body = circleSprite.body as Phaser.Physics.Arcade.Body

              // Keep negative offsets so the collider lines up with the debug circle
              body.setCircle(radius, -radius, -radius)

              obj.arcadeCollisionBodies.push(circleSprite)
              this.collisionShapesGroup.add(circleSprite)
              this.collisionShapesGroup.refresh()
              tileEntity.collisionBodies.push(circleSprite)
              
              // Update bounding box coordinates
              minX = Math.min(minX, finalX + shapeWidth / 2 - radius)
              minY = Math.min(minY, finalY + shapeHeight / 2 - radius)
              maxX = Math.max(maxX, finalX + shapeWidth / 2 + radius)
              maxY = Math.max(maxY, finalY + shapeHeight / 2 + radius)
            } else {
              // Update bounding box coordinates for rectangle corners
              // Since the rectangle is rotated, we need to check all four corners
              const corners = [
                { x: finalX, y: finalY },
                { x: finalX + shapeWidth * Math.cos(totalRotation), y: finalY + shapeWidth * Math.sin(totalRotation) },
                { x: finalX + shapeWidth * Math.cos(totalRotation) - shapeHeight * Math.sin(totalRotation), 
                  y: finalY + shapeWidth * Math.sin(totalRotation) + shapeHeight * Math.cos(totalRotation) },
                { x: finalX - shapeHeight * Math.sin(totalRotation), y: finalY + shapeHeight * Math.cos(totalRotation) }
              ];
              
              corners.forEach(corner => {
                minX = Math.min(minX, corner.x);
                minY = Math.min(minY, corner.y);
                maxX = Math.max(maxX, corner.x);
                maxY = Math.max(maxY, corner.y);
              });

              this.approximateRectWithCircles(
                obj,
                finalX,
                finalY,
                shapeWidth,
                shapeHeight,
                totalRotation,
                tileEntity,
              )
            }
          })
          
          // Calculate and store the center of the bounding box if we have valid bounds
          if (minX !== Number.MAX_VALUE) {
            // Calculate the center of the bounding box
            const centreX = minX + (maxX - minX) / 2;
            const centreY = minY + (maxY - minY) / 2;
            
            // Store the center in the tileEntity
            tileEntity.tileCentreX = centreX;
            tileEntity.tileCentreY = centreY;
          }
        }

        // Finally, store our tileEntity in the list
        this.tileEntities.push(tileEntity)
      })
    })
  }

  private approximateRectWithCircles(
    mapObject: any,
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number,
    rotationRad: number,
    tileEntity: MapTileEntity,
  ): void {
    // 1) Determine circle diameter/ radius from the rectangle's shorter dimension
    const longSide = Math.max(rectWidth, rectHeight)
    let diameter = longSide / 4
    diameter = Math.max(diameter, MIN_CIRCLE_DIAMETER)
    const radius = diameter * 0.5

    // 2) Instead of basing corners on the exact edges, we inset each corner by 'radius'.
    //    This creates a smaller "inset rectangle perimeter" on which we will place circles,
    //    ensuring they just touch the outer rectangle from the inside.
    const corners = [
      { x: radius, y: radius },
      { x: rectWidth - radius, y: radius },
      { x: rectWidth - radius, y: rectHeight - radius },
      { x: radius, y: rectHeight - radius },
    ]

    // We'll measure the perimeter in local space
    let totalPerimeter = 0
    for (let i = 0; i < corners.length; i++) {
      const j = (i + 1) % corners.length
      const dx = corners[j].x - corners[i].x
      const dy = corners[j].y - corners[i].y
      totalPerimeter += Math.sqrt(dx * dx + dy * dy)
    }

    // 3) Determine how many circles based on perimeter vs. diameter
    const circleCount = Math.max(1, Math.floor(totalPerimeter / diameter))
    const segmentLength = totalPerimeter / circleCount

    const cosR = Math.cos(rotationRad)
    const sinR = Math.sin(rotationRad)

    // Helper to interpolate along the inset edges
    function getPointAtLength(dist: number) {
      let remaining = dist
      for (let i = 0; i < corners.length; i++) {
        const j = (i + 1) % corners.length
        const dx = corners[j].x - corners[i].x
        const dy = corners[j].y - corners[i].y
        const edgeLen = Math.sqrt(dx * dx + dy * dy)
        if (remaining <= edgeLen) {
          // fraction along the current edge
          const t = remaining / edgeLen
          return {
            x: corners[i].x + dx * t,
            y: corners[i].y + dy * t,
          }
        } else {
          remaining -= edgeLen
        }
      }
      // If we go beyond, just return the last corner
      return corners[corners.length - 1]
    }

    // 6) Place circles along the inset perimeter
    for (let cIndex = 0; cIndex < circleCount; cIndex++) {
      const distAlongPerimeter = cIndex * segmentLength
      const localPt = getPointAtLength(distAlongPerimeter)

      // Rotate and then shift into world coordinates
      const rx = localPt.x * cosR - localPt.y * sinR
      const ry = localPt.x * sinR + localPt.y * cosR
      const finalX = rectX + rx
      const finalY = rectY + ry

      // Create an invisible sprite for the circle collider
      const circleSprite = this.scene.add
        .sprite(finalX, finalY, '')
        .setAlpha(0)
        .setOrigin(0, 0)

      circleSprite.setRotation(rotationRad)
      this.scene.physics.add.existing(circleSprite, true)
      const body = circleSprite.body as Phaser.Physics.Arcade.Body
      body.setCircle(radius, -radius, -radius)

      if (!mapObject.arcadeCollisionBodies) {
        mapObject.arcadeCollisionBodies = []
      }
      mapObject.arcadeCollisionBodies.push(circleSprite)
      this.collisionShapesGroup.add(circleSprite)
      tileEntity.collisionBodies.push(circleSprite)
    }
  }

  // to be expanded
  public destroyMapTileEntity(entity: MapTileEntity): void {
    const index = this.tileEntities.indexOf(entity)
    if (index !== -1) {
      this.tileEntities.splice(index, 1)
    }
    entity.sprite.destroy()
    for (const shape of entity.collisionBodies) {
      shape.destroy()
    }
  }

  public isAMapTileEntity(obj: any): boolean {
    return obj && obj.entityType === 'mapEntity'
  }
}

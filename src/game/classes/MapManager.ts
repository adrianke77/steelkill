import { Game } from '../scenes/Game'
import { XMLParser } from 'fast-xml-parser'
import { Constants as ct } from '../constants/index'
import { MapObject } from '../interfaces'
import { createDustCloud, drawDecal } from '../rendering'
import { getAverageColor, getSoundPan } from '../utils'
import { ExtendedSprite } from '../interfaces'

const MAP_SCALE = 0.5
const MIN_CIRCLE_DIAMETER = 12 // for approximateRectWithCircles

// These tile indices (from the .tsx) are treated as "trees" for random rotation/scale and alpha setting
// note that these are the ids in the raw tileset XML, plus 1
const treeGids = [1, 9]

const treeRubble = {
  1: {
    fallen: ['fallentree1', 'fallentree2', 'fallentree3'],
    bits: ['treebits1', 'treebits2', 'treebits3'],
  },
  9: {
    fallen: ['fallenpalm1'],
    bits: ['treebits1', 'treebits2', 'treebits3'],
  },
}

const rubbleImages = ['rubble1', 'rubble2', 'rubble3', 'rubble4', 'rubble5']

const scatteredRubbleImages = ['scatteredRubble1', 'scatteredRubble2']

const buildingCollapseSounds: [string, number][] = [
  ['buildingcollapse1', 1],
  ['buildingcollapse2', 1],
  ['buildingcollapse3', 1],
  ['buildingcollapse4', 1],
  ['buildingcollapse5', 1],
  ['buildingcollapse6', 1],
]

const treeCollapseSounds: [string, number][] = [
  ['treecollapse1', 3],
  ['treecollapse2', 3],
]

//handles importing and rendering maps created in the Tiled map creator
export class MapManager {
  private scene: Game
  private xmlParser: XMLParser

  public mapObjects: MapObject[] = []
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

    this.scene.load.setPath('assets')
    buildingCollapseSounds.forEach(([soundKey]) => {
      this.scene.load.audio(soundKey, `audio/${soundKey}.mp3`)
    })
    treeCollapseSounds.forEach(([soundKey]) => {
      this.scene.load.audio(soundKey, `audio/${soundKey}.mp3`)
    })
    rubbleImages.forEach(image => {
      this.scene.load.image(image, `${image}.png`)
    })
    scatteredRubbleImages.forEach(image => {
      this.scene.load.image(image, `${image}.png`)
    })
    Object.values(treeRubble).forEach(rubbleSet => {
      rubbleSet.fallen.forEach(image => {
        this.scene.load.image(image, `${image}.png`)
      })

      rubbleSet.bits.forEach(image => {
        this.scene.load.image(image, `${image}.png`)
      })
    })
  }

  /**
   * Loads the .tmj JSON map data and the corresponding .tsx tileset file,
   * queues up images, converts map layers for scaling + collision shapes,
   * and then draws them.
   */
  public async loadMap(baseUrl: string) {
    // 1) Load the Tiled map JSON (map.tmj)
    const mapDataFetchResponse = await fetch(`assets/${baseUrl}/map.tmj`)
    const mapData = await mapDataFetchResponse.json()

    // 2) Load the .tsx tileset
    const tileSet1FileName = mapData.tilesets[0].source
    const tsxFullUrl = `assets/${baseUrl}/${tileSet1FileName}`
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
    this.drawMapObjects(baseUrl, mapLayersWithScaling)

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
        this.scene.load.image(key, `${mapBaseUrl}/${tile.image.source}`)
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

  public drawMapObjects(mapBaseUrl: string, mapLayers: any[]): void {
    const infraredIsOn = this.scene.viewMgr.infraredIsOn

    mapLayers.forEach(layer => {
      if (!layer.objects) return

      layer.objects.forEach((obj: any) => {
        const isTree = treeGids.includes(obj.gid)

        if (typeof obj.gid !== 'number') return
        const tileIndex = obj.gid - 1
        const textureKey = `${mapBaseUrl}_${tileIndex}`

        const startX = obj.x
        const startY = obj.y

        // Create the sprite
        // effects layer if tree in order to draw it "higher" and avoid flashlight
        // else normal sprite
        const sprite = isTree
          ? (this.scene.addSpriteEffect(
              startX,
              startY,
              textureKey,
            ) as ExtendedSprite)
          : (this.scene.addSprite(startX, startY, textureKey) as ExtendedSprite)
        sprite.setPipeline('Light2D')
        sprite.setOrigin(0, 0) // Tiled tile origins are (0, 0)

        // Apply rotation from Tiled (degrees → radians)
        const tiledRotationRad = Phaser.Math.DegToRad(obj.rotation ?? 0)
        sprite.setRotation(tiledRotationRad)

        // Get base scale from the object
        let finalScale = obj.scale ?? 1

        const props = obj.properties || {}

        let health = props.health || 0
        const armor = props.armor || 0

        // For tree sprites, apply random scaling and adjust position
        if (isTree) {
          // First apply the base scale to get the original dimensions
          sprite.setScale(finalScale)

          // Store original dimensions
          const originalWidth = sprite.displayWidth
          const originalHeight = sprite.displayHeight

          // Calculate original center position
          const cosR = Math.cos(tiledRotationRad)
          const sinR = Math.sin(tiledRotationRad)

          // Calculate the center point of the original rectangle
          const originalCenterX =
            sprite.x + (originalWidth / 2) * cosR - (originalHeight / 2) * sinR
          const originalCenterY =
            sprite.y + (originalWidth / 2) * sinR + (originalHeight / 2) * cosR

          // Draw a blue circle at the original calculated center (for debugging)
          // this.scene.add.circle(originalCenterX, originalCenterY, 5, 0x0000ff, 1);

          // Generate random scale factor between 0.5 and 1.5
          const randomScaleFactor = Phaser.Math.FloatBetween(0.5, 1.5)
          finalScale *= randomScaleFactor

          // adjust health of tree to the square of the scale factor
          health *= randomScaleFactor * randomScaleFactor

          // Generate a random rotation angle (0 to 2π)
          const finalRotation = Phaser.Math.FloatBetween(0, Math.PI * 2)

          // Save the original rotation for collision calculations
          obj.originalRotation = tiledRotationRad

          // 1. First change the origin to center
          sprite.setOrigin(0.5, 0.5)

          // 2. Position at the original center point
          sprite.x = originalCenterX
          sprite.y = originalCenterY

          // 3. Save the sprite's position for collision calculation
          obj.savedPosition = { x: originalCenterX, y: originalCenterY }

          // 4. Apply scale and rotation
          sprite.setScale(finalScale)
          sprite.setRotation(finalRotation)

          // trees are all partially see through
          sprite.setAlpha(0.9)
        } else {
          // For non-tree sprites, just apply the scale directly
          sprite.setScale(finalScale)
        }

        // if object has no health property, is background object like roads
        sprite.setDepth(
          !props.health
            ? ct.depths.terrain
            : isTree
              ? ct.depths.trees
              : ct.depths.buildings,
        )

        // get average color of sprite
        const averageColor = getAverageColor(sprite)

        // Create a new entity object for this tile with health
        const newMapObject: MapObject = {
          objectId: obj.gid,
          sprite: sprite,
          collisionBodies: [],
          health,
          armor,
          averageColor,
          source: obj.tileSource,
          entityType: 'mapEntity',
          centreX: 0,
          centreY: 0,
        }

        if (infraredIsOn) {
          this.scene.viewMgr.setBuildingToInfraredColors(sprite)
        }

        // If collisionShapes exist, create colliders.
        if (obj.collisionShapes) {
          // Store references to created bodies:
          obj.arcadeCollisionBodies = []

          // Use the original rotation for collision calculations if it's a tree
          const finalRotation =
            isTree && obj.originalRotation !== undefined
              ? obj.originalRotation
              : sprite.rotation

          const originOffsetX = -sprite.originX * sprite.displayWidth
          const originOffsetY = -sprite.originY * sprite.displayHeight
          const cosR = Math.cos(finalRotation)
          const sinR = Math.sin(finalRotation)

          // Track min/max coordinates of collision areas to draw bounding box
          // this is for calculating the general centre of sprite and saving this later
          let minX = Number.MAX_VALUE
          let minY = Number.MAX_VALUE
          let maxX = Number.MIN_VALUE
          let maxY = Number.MIN_VALUE

          obj.collisionShapes.forEach((shape: any) => {
            // Apply the tree's random scale to the collision shape if needed
            const shapeWidth =
              shape.width * (isTree ? finalScale / obj.scale : 1)
            const shapeHeight =
              shape.height * (isTree ? finalScale / obj.scale : 1)

            // Local shape coords before final sprite transform.
            const localX = shape.x * (isTree ? finalScale / obj.scale : 1)
            const localY = shape.y * (isTree ? finalScale / obj.scale : 1)

            // Step 1: account for sprite's top-left origin offset.
            const worldX = localX + originOffsetX
            const worldY = localY + originOffsetY

            // Step 2: rotate around sprite's final rotation.
            const rx = worldX * cosR - worldY * sinR
            const ry = worldX * sinR + worldY * cosR

            // Step 3: position offset by sprite in world coords.
            let finalX = sprite.x + rx
            let finalY = sprite.y + ry

            // Special adjustment for trees with fixed rotation
            if (isTree && obj.savedPosition) {
              // Use the saved position instead of the current sprite position
              finalX = obj.savedPosition.x + rx
              finalY = obj.savedPosition.y + ry
            }

            // Combine shape's own rotation with sprite rotation.
            const shapeRotationRad = Phaser.Math.DegToRad(shape.rotation || 0)
            const totalRotation = finalRotation + shapeRotationRad

            if (shape.ellipse) {
              const diameter = (shapeWidth + shapeHeight) / 2
              const radius = diameter / 2

              // draw the collision circle for debugging
              // const debugCircle = this.scene.add.circle(
              //   finalX + shapeWidth / 2,
              //   finalY + shapeHeight / 2,
              //   radius,
              //   0xff0000,
              //   0.3,
              // )
              // debugCircle.setStrokeStyle(2, 0xff0000)

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
              newMapObject.collisionBodies.push(circleSprite)

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
                {
                  x: finalX + shapeWidth * Math.cos(totalRotation),
                  y: finalY + shapeWidth * Math.sin(totalRotation),
                },
                {
                  x:
                    finalX +
                    shapeWidth * Math.cos(totalRotation) -
                    shapeHeight * Math.sin(totalRotation),
                  y:
                    finalY +
                    shapeWidth * Math.sin(totalRotation) +
                    shapeHeight * Math.cos(totalRotation),
                },
                {
                  x: finalX - shapeHeight * Math.sin(totalRotation),
                  y: finalY + shapeHeight * Math.cos(totalRotation),
                },
              ]

              corners.forEach(corner => {
                minX = Math.min(minX, corner.x)
                minY = Math.min(minY, corner.y)
                maxX = Math.max(maxX, corner.x)
                maxY = Math.max(maxY, corner.y)
              })

              this.approximateRectWithCircles(
                obj,
                finalX,
                finalY,
                shapeWidth,
                shapeHeight,
                totalRotation,
                newMapObject,
              )
            }
          })

          // Calculate and store the center of the bounding box if we have valid bounds
          if (minX !== Number.MAX_VALUE) {
            // Calculate the center of the bounding box
            const centreX = minX + (maxX - minX) / 2
            const centreY = minY + (maxY - minY) / 2

            // Store the center in the newMapObject
            newMapObject.centreX = centreX
            newMapObject.centreY = centreY
          }
        }

        // Finally, store our newMapObject in the list
        this.mapObjects.push(newMapObject)
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
    tileEntity: MapObject,
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

  public isAMapObject(obj: any): boolean {
    return obj && obj.entityType === 'mapEntity'
  }

  public isTree(mapObject: MapObject): boolean {
    return treeGids.includes(mapObject.objectId)
  }

  public destroyMapObject(
    mapObject: MapObject,
    directionRadians: number,
  ): void {
    const isTree = this.isTree(mapObject)
    const index = this.mapObjects.indexOf(mapObject)
    if (index !== -1) {
      this.mapObjects.splice(index, 1)
    }

    // Start rendering destruction effects immediately so they can fade in
    // while the original object is fading out
    this.renderMapObjectDestruction(mapObject, directionRadians)

    // For trees, add movement in the direction of impact
    if (isTree) {
      // Calculate how far to move (50% of the sprite's width)
      const moveDistance = mapObject.sprite.displayWidth * 0.5

      // Calculate the x and y components of the movement
      const moveX = Math.cos(directionRadians) * moveDistance
      const moveY = Math.sin(directionRadians) * moveDistance

      // Start position
      const startX = mapObject.sprite.x
      const startY = mapObject.sprite.y

      // Fade out the sprite over 2 seconds with movement
      this.scene.tweens.add({
        targets: mapObject.sprite,
        alpha: 0,
        x: startX + moveX,
        y: startY + moveY,
        duration: 3000,
        onComplete: () => {
          mapObject.sprite.destroy()
        },
      })
    } else {
      // Regular fade out for non-tree objects
      this.scene.tweens.add({
        targets: mapObject.sprite,
        alpha: 0,
        duration: 3000,
        onComplete: () => {
          mapObject.sprite.destroy()
        },
      })
    }

    // Fade out collision bodies after a slight delay to maintain collision during initial fade
    for (const shape of mapObject.collisionBodies) {
      // We can't fade them since they're invisible, but we can delay their destruction
      this.scene.time.delayedCall(1800, () => {
        shape.destroy()
      })
    }
  }

  private renderMapObjectDestruction(
    mapObject: MapObject,
    directionRadians?: number,
  ) {
    const isTree = this.isTree(mapObject)
    const [x, y] = [mapObject.centreX, mapObject.centreY]
    const objectSize =
      mapObject.sprite.displayWidth + mapObject.sprite.displayHeight
    const infraredIsOn = this.scene.viewMgr.infraredIsOn

    // Get player position and rotation for sound positioning
    const playerX = this.scene.player.mechContainer.x
    const playerY = this.scene.player.mechContainer.y
    const playerRotation = this.scene.player.mechContainer.rotation

    // Calculate pan value based on relative positions
    const pan = getSoundPan(x, y, playerX, playerY, playerRotation)

    // Calculate size-based volume scale
    // Get the sprite's original dimensions and compare to default size
    const originalWidth = mapObject.sprite.displayWidth
    const originalHeight = mapObject.sprite.displayHeight
    const defaultSize = isTree ? 100 : 250
    const sizeRatio = (originalWidth + originalHeight) / (defaultSize * 2)

    const volumeMultiplier = 1 + (sizeRatio - 1) * 0.8

    if (isTree) {
      // Play one random tree collapse sound with pan and size-based volume
      const shuffledTreeSounds = Phaser.Utils.Array.Shuffle([
        ...treeCollapseSounds,
      ])
      const [soundKey, baseVolume] = shuffledTreeSounds[0]
      this.scene.sound.play(soundKey, {
        volume: (baseVolume as number) * volumeMultiplier,
        pan: pan,
      })

      // Get the tree's gid to select appropriate images
      const treeGid = mapObject.objectId
      const treeRubbleSet = treeRubble[treeGid as keyof typeof treeRubble]

      if (treeRubbleSet) {
        // 1. Create fallen tree
        const fallenTreeImages = treeRubbleSet.fallen
        const fallenTreeKey = Phaser.Utils.Array.GetRandom(fallenTreeImages)

        const fallenTree = this.scene.addSprite(
          x,
          y,
          fallenTreeKey as string,
        ) as ExtendedSprite

        // 2. Scale fallen tree to match original tree width
        const fallenTreeNaturalWidth = fallenTree.width
        const scaleFactor = originalWidth / fallenTreeNaturalWidth

        fallenTree.setScale(scaleFactor)

        // 3. Position and rotate fallen tree
        fallenTree.setOrigin(0.5, 1) // Bottom center origin
        if (directionRadians !== undefined) {
          fallenTree.setRotation(directionRadians + Math.PI / 2)
        } else {
          // Default random rotation if direction not provided
          fallenTree.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
        }

        // flip tree half the time
        if (Phaser.Math.Between(0, 1) === 1) {
          fallenTree.setFlipX(true)
        }

        fallenTree.setDepth(ct.depths.terrain + 1)
        fallenTree.setPipeline('Light2D')
        fallenTree.setAlpha(0)

        this.scene.tweens.add({
          targets: fallenTree,
          alpha: 1,
          duration: 3000,
          ease: 'Power2',
          onComplete: () => {
            drawDecal(this.scene, fallenTree)
          },
        })

        if (infraredIsOn) {
          this.scene.viewMgr.setBuildingToInfraredColors(fallenTree)
        }

        // 4. Add four random tree bit images
        const treeBitsImages = treeRubbleSet.bits

        for (let i = 0; i < 4; i++) {
          const treeBitKey = Phaser.Utils.Array.GetRandom(treeBitsImages)

          const treeBit = this.scene.addSprite(
            x,
            y,
            treeBitKey,
          ) as ExtendedSprite

          // Random rotation
          const randomRotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
          treeBit.setRotation(randomRotation)

          const widthRatio = Phaser.Math.FloatBetween(0.4, 0.6)
          const targetWidth = originalWidth * widthRatio
          const bitScaleFactor = targetWidth / treeBit.width

          treeBit.setScale(bitScaleFactor)

          treeBit.setDepth(ct.depths.terrain + 1)
          treeBit.setPipeline('Light2D')
          treeBit.setAlpha(0)

          this.scene.tweens.add({
            targets: treeBit,
            alpha: 1,
            duration: 3000,
            ease: 'Power2',
            onComplete: () => {
              drawDecal(this.scene, treeBit)
            },
          })

          if (infraredIsOn) {
            this.scene.viewMgr.setBuildingToInfraredColors(treeBit)
          }
        }
      }

      // Create dust clouds for trees
      const numClouds = Phaser.Math.Between(2, 4)
      for (let i = 0; i < numClouds; i++) {
        const offsetX = Phaser.Math.FloatBetween(
          -objectSize / 5,
          objectSize / 5,
        )
        const offsetY = Phaser.Math.FloatBetween(
          -objectSize / 5,
          objectSize / 5,
        )

        createDustCloud(
          this.scene,
          x + offsetX,
          y + offsetY,
          0,
          0,
          1,
          6000,
          objectSize * 0.7,
          undefined,
          true,
        )
      }
    } else {
      // Play two random building collapse sounds with pan and size-based volume
      const shuffledSounds = Phaser.Utils.Array.Shuffle([
        ...buildingCollapseSounds,
      ])
      for (let i = 0; i < 2 && i < shuffledSounds.length; i++) {
        const [soundKey, baseVolume] = shuffledSounds[i]
        this.scene.sound.play(soundKey, {
          volume: (baseVolume as number) * volumeMultiplier,
          pan: pan,
          // Slight delay between sounds for better effect
          delay: i * Phaser.Math.FloatBetween(0.1, 0.4),
        })
      }

      // Keep the existing dust cloud effects
      const numClouds = Phaser.Math.Between(3, 5)

      for (let i = 0; i < numClouds; i++) {
        // Calculate random offsets within objectSize distance
        const offsetX = Phaser.Math.FloatBetween(
          -objectSize / 5,
          objectSize / 5,
        )
        const offsetY = Phaser.Math.FloatBetween(
          -objectSize / 5,
          objectSize / 5,
        )

        createDustCloud(
          this.scene,
          x + offsetX,
          y + offsetY,
          0,
          0,
          1,
          6000,
          objectSize * 1.5,
          // make one dust cloud the roof color if not tree
          i === numClouds - 1 ? mapObject.averageColor : undefined,
          true,
        )
      }

      // Randomly select 3 from rubbleImages array
      const selectedRubbleImages = Phaser.Utils.Array.Shuffle([
        ...rubbleImages,
      ]).slice(0, 3)

      // Create 2 regular rubble piles
      for (let i = 0; i < 2; i++) {
        const offsetX = Phaser.Math.FloatBetween(
          -objectSize / 10,
          objectSize / 10,
        )
        const offsetY = Phaser.Math.FloatBetween(
          -objectSize / 10,
          objectSize / 10,
        )

        const rubbleKey = selectedRubbleImages[i].replace('.png', '')
        const rubble = this.scene.addSprite(
          x + offsetX,
          y + offsetY,
          rubbleKey,
        ) as ExtendedSprite
        rubble.setOrigin(0.5, 0.5)

        const randomRotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
        rubble.setRotation(randomRotation)

        rubble.displayWidth = originalWidth
        rubble.displayHeight = originalHeight

        rubble.setDepth(ct.depths.terrain + 1)
        rubble.setPipeline('Light2D')
        rubble.setAlpha(0)

        this.scene.tweens.add({
          targets: rubble,
          alpha: 1,
          duration: 3000,
          ease: 'Power2',
          onComplete: () => {
            drawDecal(this.scene, rubble)
          },
        })

        if (infraredIsOn) {
          this.scene.viewMgr.setBuildingToInfraredColors(rubble)
        }

      }

      // Create 1 roof-colored rubble pile
      const offsetX = Phaser.Math.FloatBetween(
        -objectSize / 10,
        objectSize / 10,
      )
      const offsetY = Phaser.Math.FloatBetween(
        -objectSize / 10,
        objectSize / 10,
      )

      const roofRubbleKey = selectedRubbleImages[2].replace('.png', '')
      const roofRubble = this.scene.addSprite(
        x + offsetX,
        y + offsetY,
        roofRubbleKey,
      ) as ExtendedSprite
      roofRubble.setOrigin(0.5, 0.5)

      const randomRotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
      roofRubble.setRotation(randomRotation)

      roofRubble.displayWidth = originalWidth * 1.3
      roofRubble.displayHeight = originalHeight * 1.3
      roofRubble.setDepth(ct.depths.terrain + 1)
      roofRubble.setPipeline('Light2D')
      roofRubble.setAlpha(0)

      if (mapObject.averageColor) {
        roofRubble.setTint(mapObject.averageColor)
      }

      this.scene.tweens.add({
        targets: roofRubble,
        alpha: 0.7,
        duration: 3000,
        ease: 'Power2',
        onComplete: () => {
          drawDecal(this.scene, roofRubble)
        },
      })

      if (infraredIsOn) {
        this.scene.viewMgr.setBuildingToInfraredColors(roofRubble)
      }

      // Randomly select 2 from scatteredRubbleImages array (with replacement if needed)
      const selectedScatteredImages = []
      for (let i = 0; i < 2; i++) {
        const randomIndex = Phaser.Math.Between(
          0,
          scatteredRubbleImages.length - 1,
        )
        selectedScatteredImages.push(scatteredRubbleImages[randomIndex])
      }

      // Add scattered rubble
      for (let i = 0; i < 2; i++) {
        // Create scattered rubble with wider distribution
        const scatterDistance = objectSize / 4
        const offsetX = Phaser.Math.FloatBetween(
          -scatterDistance,
          scatterDistance,
        )
        const offsetY = Phaser.Math.FloatBetween(
          -scatterDistance,
          scatterDistance,
        )

        const scatteredKey = selectedScatteredImages[i].replace('.png', '')
        const scattered = this.scene.addSprite(
          x + offsetX,
          y + offsetY,
          scatteredKey,
        ) as ExtendedSprite
        scattered.setOrigin(0.5, 0.5)

        const randomRotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
        scattered.setRotation(randomRotation)
        scattered.setDepth(ct.depths.terrain + 1)
        scattered.setPipeline('Light2D')
        scattered.setAlpha(0)
        scattered.displayWidth = originalWidth * 0.75
        scattered.displayHeight = originalHeight * 0.75

        this.scene.tweens.add({
          targets: scattered,
          alpha: 0.9,
          duration: 3000,
          ease: 'Power2',
          onComplete: () => {
            drawDecal(this.scene, scattered)
          },
        })

        if (infraredIsOn) {
          this.scene.viewMgr.setBuildingToInfraredColors(scattered)
        }

      }
    }
  }
}

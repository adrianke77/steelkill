import { Game } from '../scenes/Game'
import { WeaponSpec, EnemySprite, TerrainTile, MapObject } from '../interfaces'
import { Constants as ct } from '../constants'
import {
  destroyEnemyAndCreateCorpseDecals,
  createLightFlash,
  createDustCloud,
} from '../rendering'
import { EventBus } from '../../EventBus'
import { calculateWeaponStartPosition } from './ProjectileManager'
import { blendColors } from '../utils'

const baseEmitterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
  {
    scale: { start: 3.5, end: 0 },
    rotate: { start: 0, end: 360 },
    speed: { min: 20, max: 30 },
    emitting: false,
  }

interface ActiveBeam {
  graphics: Phaser.GameObjects.Graphics
  lights: Phaser.GameObjects.Light[]
  sound: Phaser.Sound.BaseSound
  startX: number
  startY: number
  endX: number
  endY: number
}

export class BeamManager {
  private scene: Game
  public activeBeams: { [key: number]: ActiveBeam } = {}
  private beamTimers: { [key: number]: number } = {}
  private beamParticleEmitter: Phaser.GameObjects.Particles.ParticleEmitter

  constructor(scene: Game) {
    this.scene = scene
    this.beamParticleEmitter = scene.addParticles(
      0,
      0,
      'whiteParticle',
      baseEmitterConfig,
    )
    this.beamParticleEmitter.setDepth(ct.depths.projectile)
    this.beamParticleEmitter.setPipeline('Light2D')
  }

  startBeam(weaponIndex: number): void {
    if (this.activeBeams[weaponIndex]) return

    if (this.scene.magCount[weaponIndex] <= 0) return

    const weapon = this.scene.player.weapons[weaponIndex]
    const weaponPosition = ct.weaponPositions[weaponIndex]

    const beamGraphics = this.scene.addGraphicsEffect()
    beamGraphics.setDepth(ct.depths.projectile)
    beamGraphics.setBlendMode(Phaser.BlendModes.NORMAL)
    beamGraphics.setPipeline('Light2D')

    const { startX, startY } = calculateWeaponStartPosition(
      this.scene,
      weaponPosition,
      this.scene.player.mechContainer.rotation,
      0,
    )

    const lights = this.createBeamLights(weapon, startX, startY)

    let volume = weapon.fireSoundVol ?? 1.0
    if (Object.keys(this.activeBeams).length > 0) {
      volume *= 0.5
    }

    const sound = this.scene.sound.add(weapon.fireSound, {
      loop: true,
      volume,
    })
    sound.play()

    this.activeBeams[weaponIndex] = {
      graphics: beamGraphics,
      lights,
      sound,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    }
    this.beamTimers[weaponIndex] = this.scene.time.now
  }

  stopBeam(weaponIndex: number): void {
    const beam = this.activeBeams[weaponIndex]
    if (beam) {
      beam.graphics.destroy()
      beam.lights.forEach(light => this.scene.lights.removeLight(light))
      this.scene.tweens.add({
        targets: beam.sound,
        volume: 0,
        duration: 500,
        onComplete: () => beam.sound.stop(),
      })
      delete this.activeBeams[weaponIndex]
      delete this.beamTimers[weaponIndex]
    }
  }

  private updateBeams(time: number): void {
    for (const weaponIndexStr in this.activeBeams) {
      const weaponIndex = Number(weaponIndexStr)
      const beam = this.activeBeams[weaponIndex]
      if (!beam) continue
  
      const weapon = this.scene.player.weapons[weaponIndex]
  
      if (!this.handleFireDelay(weaponIndex, time)) continue
  
      const { startX, startY, maxEndX, maxEndY } =
        this.calculateBeamPositions(weaponIndex)
  
      // Update beam positions
      beam.startX = startX
      beam.startY = startY
  
      // Default to fade if beam reaches max range without hitting anything
      let beamFades = true
  
      // Perform collision detection every frame
      if (weapon.arcTargeting) {
        this.handleArcTargeting(beam, weapon, startX, startY)
      } else {
        const { beamEndX, beamEndY, hitObject } = this.detectBeamCollision(
          startX,
          startY,
          maxEndX,
          maxEndY,
          weapon,
        )
  
        beam.endX = beamEndX
        beam.endY = beamEndY
  
        // Calculate how far along the max range the beam ends
        const maxDistance = Phaser.Math.Distance.Between(startX, startY, maxEndX, maxEndY);
        const actualDistance = Phaser.Math.Distance.Between(startX, startY, beamEndX, beamEndY);
        const distanceRatio = actualDistance / maxDistance;
  
        // Handle beam hits
        if (hitObject) {
          // If beam hits before 75% of max range, don't fade
          // If beam hits between 75% and max range, fade appropriately
          beamFades = distanceRatio > 0.75;
          
          if (this.scene.enemyMgr.isAnEnemy(hitObject)) {
            this.beamHitEnemy(hitObject as EnemySprite, weapon, startX, startY)
          } else if (this.scene.terrainMgr.isATerrainTile(hitObject)) {
            this.beamHitTerrainTile(
              hitObject as TerrainTile,
              weapon,
              startX,
              startY,
              beamEndX,
              beamEndY,
            )
          } else if (this.scene.mapMgr.isAMapObject(hitObject)) {
            this.beamHitMapObject(
              hitObject as MapObject,
              weapon,
              startX,
              startY,
              beamEndX,
              beamEndY,
            )
          }
        }
      }
  
      // Redraw the beam every frame
      this.resetAndDrawBeam(beam, weapon, startX, startY, beamFades)
  
      this.consumeAmmo(weaponIndex)
    }
  }

  private beamHitTerrainTile(
    tile: TerrainTile,
    weapon: WeaponSpec,
    beamStartX: number,
    beamStartY: number,
    beamEndX: number,
    beamEndY: number,
  ): void {
    const damage = weapon.terrainDamageMultiplier
      ? weapon.damage * weapon.terrainDamageMultiplier
      : weapon.damage
    createDustCloud(
      this.scene,
      beamEndX,
      beamEndY,
      0,
      0,
      1,
      4000,
      Math.min(weapon.damage * 40, 100),
      this.scene.terrainMgr.getTileData(tile).color,
    )

    // due to beam weapons being high ROF and low damage weapons, armor is less effective 
    const effectiveDamage = damage - tile.armor / 3
    tile.health -= effectiveDamage > 0 ? effectiveDamage : 0
    if (tile.health <= 0) {
      this.scene.terrainMgr.destroyTile(tile)
    }

    this.beamHitSpark(beamStartX, beamStartY, beamEndX, beamEndY, weapon)
    createLightFlash(
      this.scene,
      beamEndX,
      beamEndY,
      weapon.beamColor!,
      100,
      weapon.beamHitLightIntensity!,
      weapon.beamHitLightRadius!,
    )
  }

  private handleFireDelay(weaponIndex: number, time: number): boolean {
    const weapon = this.scene.player.weapons[weaponIndex]
    if (time - this.beamTimers[weaponIndex] < weapon.fireDelay!) return false
    this.beamTimers[weaponIndex] = time
    return true
  }

  private calculateBeamPositions(weaponIndex: number): {
    startX: number
    startY: number
    maxEndX: number
    maxEndY: number
  } {
    const weapon = this.scene.player.weapons[weaponIndex]
    const weaponPosition = ct.weaponPositions[weaponIndex]
    const player = this.scene.player
    const rotation = player.mechContainer.rotation - Math.PI / 2

    const { startX, startY } = calculateWeaponStartPosition(
      this.scene,
      weaponPosition,
      this.scene.player.mechContainer.rotation,
      0,
    )

    const maxEndX = startX + Math.cos(rotation) * weapon.maxRange!
    const maxEndY = startY + Math.sin(rotation) * weapon.maxRange!

    return { startX, startY, maxEndX, maxEndY }
  }

  private detectBeamCollision(
    startX: number,
    startY: number,
    maxEndX: number,
    maxEndY: number,
    weapon: WeaponSpec,
  ): {
    beamEndX: number
    beamEndY: number
    hitObject: EnemySprite | TerrainTile | MapObject | null
  } {
    const tileSize = this.scene.terrainMgr.map.tileWidth
    const layer = this.scene.terrainMgr.terrainLayer
    const map = this.scene.terrainMgr.map

    const enemies = this.scene.enemyMgr.enemies.getChildren() as EnemySprite[]
    let closestEnemy: EnemySprite | null = null
    let closestTile: TerrainTile | null = null
    let closestMapObject: MapObject | null = null
    let closestDistance = weapon.maxRange!
    let beamEndX = maxEndX
    let beamEndY = maxEndY
    const intersectionPoint = new Phaser.Geom.Point()
    const line = new Phaser.Geom.Line(startX, startY, maxEndX, maxEndY)

    // --- Terrain Collision Detection with DDA ---
    let x = Math.floor(startX / tileSize)
    let y = Math.floor(startY / tileSize)
    const deltaX = maxEndX - startX
    const deltaY = maxEndY - startY

    if (deltaX === 0 && deltaY === 0) {
      return {
        beamEndX: startX,
        beamEndY: startY,
        hitObject: null,
      }
    }

    const stepX = deltaX > 0 ? 1 : deltaX < 0 ? -1 : 0
    const stepY = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0
    const gridDeltaX =
      deltaX === 0 ? Number.MAX_VALUE : Math.abs(tileSize / deltaX)
    const gridDeltaY =
      deltaY === 0 ? Number.MAX_VALUE : Math.abs(tileSize / deltaY)

    let tMaxX: number
    let tMaxY: number

    if (deltaX === 0) {
      tMaxX = Number.MAX_VALUE
    } else {
      const xBound = stepX > 0 ? (x + 1) * tileSize : x * tileSize
      tMaxX = Math.abs((xBound - startX) / deltaX)
    }

    if (deltaY === 0) {
      tMaxY = Number.MAX_VALUE
    } else {
      const yBound = stepY > 0 ? (y + 1) * tileSize : y * tileSize
      tMaxY = Math.abs((yBound - startY) / deltaY)
    }

    while (x >= 0 && x < map.width && y >= 0 && y < map.height) {
      const tile = layer.getTileAt(x, y) as TerrainTile
      if (tile && tile.collides) {
        const tileBounds = new Phaser.Geom.Rectangle(
          tile.getLeft(),
          tile.getTop(),
          tileSize,
          tileSize,
        )
        const sides = [
          new Phaser.Geom.Line(
            tileBounds.left,
            tileBounds.top,
            tileBounds.right,
            tileBounds.top,
          ),
          new Phaser.Geom.Line(
            tileBounds.right,
            tileBounds.top,
            tileBounds.right,
            tileBounds.bottom,
          ),
          new Phaser.Geom.Line(
            tileBounds.right,
            tileBounds.bottom,
            tileBounds.left,
            tileBounds.bottom,
          ),
          new Phaser.Geom.Line(
            tileBounds.left,
            tileBounds.bottom,
            tileBounds.left,
            tileBounds.top,
          ),
        ]

        let collisionFound = false
        for (const side of sides) {
          if (
            Phaser.Geom.Intersects.LineToLine(line, side, intersectionPoint)
          ) {
            const distance = Phaser.Math.Distance.Between(
              startX,
              startY,
              intersectionPoint.x,
              intersectionPoint.y,
            )
            if (distance < closestDistance) {
              closestDistance = distance
              beamEndX = intersectionPoint.x
              beamEndY = intersectionPoint.y
              closestTile = tile
              closestEnemy = null
              closestMapObject = null
              collisionFound = true
              break
            }
          }
        }
        if (collisionFound) {
          break
        }
      }
      if (tMaxX < tMaxY) {
        tMaxX += gridDeltaX
        x += stepX
      } else {
        tMaxY += gridDeltaY
        y += stepY
      }
    }

    // --- Enemy Collision ---
    for (const enemy of enemies) {
      if (!enemy.active) continue
      const enemyCircle = new Phaser.Geom.Circle(
        enemy.x,
        enemy.y,
        enemy.displayWidth / 2,
      )
      if (
        Phaser.Geom.Intersects.LineToCircle(
          line,
          enemyCircle,
          intersectionPoint,
        )
      ) {
        const distance = Phaser.Math.Distance.Between(
          startX,
          startY,
          intersectionPoint.x,
          intersectionPoint.y,
        )
        if (distance < closestDistance) {
          closestDistance = distance
          closestEnemy = enemy
          closestTile = null
          closestMapObject = null
          beamEndX = intersectionPoint.x
          beamEndY = intersectionPoint.y
        }
      }
    }

    // map object collision
    for (const tileEntity of this.scene.mapMgr.mapObjects) {
      for (const colliderSprite of tileEntity.collisionBodies) {
        const body = colliderSprite.body as Phaser.Physics.Arcade.Body
        // Example circle collision (if using setCircle)
        const circle = new Phaser.Geom.Circle(
          body.x + body.halfWidth,
          body.y + body.halfHeight,
          body.halfWidth,
        )
        if (
          Phaser.Geom.Intersects.LineToCircle(line, circle, intersectionPoint)
        ) {
          const distance = Phaser.Math.Distance.Between(
            startX,
            startY,
            intersectionPoint.x,
            intersectionPoint.y,
          )
          if (distance < closestDistance) {
            closestDistance = distance
            closestEnemy = null
            closestTile = null
            closestMapObject = tileEntity
            beamEndX = intersectionPoint.x
            beamEndY = intersectionPoint.y
          }
        }
      }
    }

    const hitObject = closestEnemy || closestTile || closestMapObject || null
    return { beamEndX, beamEndY, hitObject }
  }

  private resetAndDrawBeam(
    beam: ActiveBeam,
    weapon: WeaponSpec,
    startX: number,
    startY: number,
    beamFades: boolean,
  ): void {
    beam.graphics.clear();
    
    // Calculate the max beam distance for fading calculations
    const maxBeamLength = weapon.maxRange!;
    const actualBeamLength = Phaser.Math.Distance.Between(
      startX, startY, beam.endX, beam.endY
    );
    
    // Only fade if the beam extends to at least 75% of max range
    const shouldFade = beamFades && (actualBeamLength > maxBeamLength * 0.75);
    
    this.drawBeam(weapon, startX, startY, beam.endX, beam.endY, beam, shouldFade);
    
  }

  private handleArcTargeting(
    beam: ActiveBeam,
    weapon: WeaponSpec,
    startX: number,
    startY: number,
  ): void {
    const enemies = this.scene.enemyMgr.enemies.getChildren() as EnemySprite[]
    const mechRotation = this.scene.player.mechContainer.rotation - Math.PI / 2
    const weaponArcHalfAngle = weapon.arcTargetingAngle! / 2
    const weaponMaxRange = weapon.maxRange!

    // filter enemies based on angle difference and distance
    const potentialTargets = enemies.filter(enemy => {
      if (!enemy.active) return false

      const deltaX = enemy.x - startX
      const deltaY = enemy.y - startY
      const distance = Math.hypot(deltaX, deltaY)
      if (distance > weaponMaxRange) return false

      const angleToEnemy = Math.atan2(deltaY, deltaX)
      const angleDiff = Phaser.Math.Angle.WrapDegrees(
        Phaser.Math.RadToDeg(angleToEnemy - mechRotation),
      )

      return Math.abs(angleDiff) <= weaponArcHalfAngle
    })


    // perform collision detection on the filtered list
    let targetEnemy: EnemySprite | null = null
    let minDistance = weaponMaxRange

    for (const enemy of potentialTargets) {
      const { hitObject } = this.detectBeamCollision(
        startX,
        startY,
        enemy.x,
        enemy.y,
        weapon,
      )

      // Check if there is a line of sight to the enemy
      if (!hitObject || hitObject === enemy) {
        const distance = Phaser.Math.Distance.Between(
          startX,
          startY,
          enemy.x,
          enemy.y,
        )
      
        if (distance < minDistance) {
          minDistance = distance
          targetEnemy = enemy
        }
      }
    }

    let beamFades = true


    if (targetEnemy) {
      beamFades = false
      // Set beam endpoint to the targeted enemy
      beam.endX = targetEnemy.x
      beam.endY = targetEnemy.y
      this.beamHitEnemy(targetEnemy, weapon, startX, startY)
    } else {
      // Fire straight ahead if no valid targets
      const mechRotationRadians = mechRotation
      const maxEndX = startX + Math.cos(mechRotationRadians) * weaponMaxRange
      const maxEndY = startY + Math.sin(mechRotationRadians) * weaponMaxRange
      const { beamEndX, beamEndY, hitObject } = this.detectBeamCollision(
        startX,
        startY,
        maxEndX,
        maxEndY,
        weapon,
      )
      beam.endX = beamEndX
      beam.endY = beamEndY

      if (hitObject) {
        beamFades = false
        if (this.scene.enemyMgr.isAnEnemy(hitObject)) {
          this.beamHitEnemy(hitObject as EnemySprite, weapon, startX, startY)
        } else if (this.scene.terrainMgr.isATerrainTile(hitObject)) {
          const tile = hitObject as TerrainTile
          this.beamHitTerrainTile(
            tile,
            weapon,
            startX,
            startY,
            beamEndX,
            beamEndY,
          )
        }
      }
    }

    // Redraw the beam
    beam.graphics.clear()
    this.drawBeam(weapon, startX, startY, beam.endX, beam.endY, beam, beamFades)
  }

  private consumeAmmo(weaponIndex: number): void {
    this.scene.magCount[weaponIndex] -= 1
    if (this.scene.magCount[weaponIndex] <= 0) {
      this.scene.magCount[weaponIndex] = 0
      this.stopBeam(weaponIndex)
    }
    EventBus.emit('mag-count', this.scene.magCount)
  }

  private createBeamLights(
    weapon: WeaponSpec,
    startX: number,
    startY: number,
  ): Phaser.GameObjects.Light[] {
    const lights: Phaser.GameObjects.Light[] = []
    for (let i = 0; i < weapon.beamParticlesDensity!; i++) {
      const light = this.scene.lights
        .addLight(
          startX,
          startY,
          weapon.beamLightRadius!,
          weapon.beamColor!,
          weapon.beamLightIntensity!,
        )
        .setVisible(true)
      lights.push(light)
    }
    return lights
  }

  private drawBeam(
    weapon: WeaponSpec,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    beam?: ActiveBeam,
    beamFades?: boolean,
  ): void {
    const isBeamFragment = !beam

    const length = Phaser.Math.Distance.Between(startX, startY, endX, endY)
    const segments = weapon.lightningSegments ? weapon.lightningSegments : 20
    const segmentCount = Math.ceil((length / weapon.maxRange!) * segments)

    const points = this.generateBeamPoints(
      weapon,
      startX,
      startY,
      endX,
      endY,
      segmentCount,
      weapon.lightningDisplacement!,
    )

    const glowLayers = [
      {
        color: weapon.beamGlowColor!,
        width: weapon.beamGlowWidth!,
        alpha: 0.15,
      },
      {
        color: weapon.beamGlowColor!,
        width: weapon.beamGlowWidth! * 0.5 * Phaser.Math.Between(0.5, 1.5),
        alpha: 0.15,
      },
      {
        color: weapon.beamGlowColor!,
        width: weapon.beamGlowWidth! * 0.2 * Phaser.Math.Between(0.5, 1.5),
        alpha: 0.15,
      },
      { color: weapon.beamColor!, width: weapon.beamWidth!, alpha: 0.7 },
    ]

    this.drawGlowLayers(points, glowLayers, weapon.fireDelay, beamFades)
    this.updateParticlesAndLights(
      weapon,
      beam,
      startX,
      startY,
      endX,
      endY,
      points,
      isBeamFragment,
    )
  }

  private generateBeamPoints(
    weapon: WeaponSpec,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    segmentCount: number,
    displacement: number,
  ): Phaser.Math.Vector2[] {
    const segmentsBetweenAlignedPoints = weapon.renderAsLightning ? 3 : 1;
    const points: Phaser.Math.Vector2[] = [
      new Phaser.Math.Vector2(startX, startY),
    ];
    const deltaX = (endX - startX) / segmentCount;
    const deltaY = (endY - startY) / segmentCount;

    for (let i = 1; i < segmentCount; i++) {
      const prevPoint = points[i - 1];
      
      // Use consistent displacement throughout the entire beam
      const randomX =
        i % segmentsBetweenAlignedPoints === 0
          ? 0
          : Phaser.Math.FloatBetween(-displacement, displacement);
      const randomY =
        i % segmentsBetweenAlignedPoints === 0
          ? 0
          : Phaser.Math.FloatBetween(-displacement, displacement);
      points.push(
        new Phaser.Math.Vector2(
          prevPoint.x + deltaX + randomX,
          prevPoint.y + deltaY + randomY,
        ),
      );
    }

    points.push(new Phaser.Math.Vector2(endX, endY));
    return points;
  }

  drawGlowLayers(
    points: Phaser.Math.Vector2[],
    glowLayers: { color: number; width: number; alpha: number }[],
    fireDelay: number,
    beamFades: boolean = true,
  ): void {
    // Calculate the point index where fading should start - 75% through the beam
    const totalPoints = points.length;
    const fadeStartIndex = beamFades ? Math.floor(totalPoints * 0.75) : Infinity;
  
    for (const layer of glowLayers) {
      const graphics = this.scene.addGraphicsEffect();
      graphics.setPipeline('TextureTintPipeline');
      graphics.setDepth(ct.depths.projectile);
  
      // Draw beam segments with proper fading
      for (let i = 0; i < totalPoints - 1; i++) {
        let segmentAlpha = layer.alpha;
        
        // Only apply fading if this segment is past the fade start point
        if (beamFades && i >= fadeStartIndex) {
          // Calculate fade progress, normalized between 0 and 1
          const fadeProgress = (i - fadeStartIndex) / Math.max(1, (totalPoints - 1 - fadeStartIndex));
          // Fade to minimum alpha of 0.1 instead of 0
          segmentAlpha = Phaser.Math.Linear(layer.alpha, layer.alpha * 0.1, fadeProgress);
        }
        
        // Use a more visible line style for debugging
        const width = i >= fadeStartIndex && beamFades 
          ? layer.width * (1 - ((i - fadeStartIndex) / (totalPoints - fadeStartIndex)) * 0.5)
          : layer.width;
          
        graphics.lineStyle(width, layer.color, segmentAlpha);
        graphics.beginPath();
        graphics.moveTo(points[i].x, points[i].y);
        graphics.lineTo(points[i + 1].x, points[i + 1].y);
        graphics.strokePath();
      }
  
      this.scene.time.delayedCall(fireDelay, () => graphics.destroy());
    }
  }
  

  private updateParticlesAndLights(
    weapon: WeaponSpec,
    beam: ActiveBeam | undefined,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    points: Phaser.Math.Vector2[],
    isBeamFragment: boolean,
  ): void {
    const particleCount = beam
      ? beam.lights.length
      : weapon.beamParticlesDensity!
    const lights = isBeamFragment ? [] : beam!.lights

    // Compute the direction vector of the straight line and its length
    const dir = new Phaser.Math.Vector2(endX - startX, endY - startY)
    const lineLength = dir.length()
    dir.normalize()

    // Compute perpendicular offsets for each point in the points array
    const perpendicularOffsets = points.map(point => {
      const v = new Phaser.Math.Vector2(point.x - startX, point.y - startY)
      const t = Phaser.Math.Clamp(v.dot(dir), 0, lineLength)
      const projection = dir.clone().scale(t)
      const perpendicular = v.clone().subtract(projection)
      const perpendicularDistance = perpendicular.length()

      // Compute signed perpendicular distance using cross product
      const cross = dir.x * v.y - dir.y * v.x
      const sign = Math.sign(cross)
      const signedPerpendicularDistance = perpendicularDistance * sign

      const tNormalized = t / lineLength

      return {
        t: tNormalized,
        offset: signedPerpendicularDistance,
      }
    })

    // Sort the offsets by their normalized t values along the line
    perpendicularOffsets.sort((a, b) => a.t - b.t)

    // Normal vector perpendicular to the line direction
    const normal = new Phaser.Math.Vector2(-dir.y, dir.x)

    for (let i = 0; i < particleCount; i++) {
      const maxOffset = 0.5 / particleCount
      const randomOffset = (Math.random() - 0.5) * 2 * maxOffset
      const t = Phaser.Math.Clamp(i / particleCount + randomOffset, 0, 1)
      const baseX = Phaser.Math.Interpolation.Linear([startX, endX], t)
      const baseY = Phaser.Math.Interpolation.Linear([startY, endY], t)

      // Interpolate the perpendicular offset at this t value
      let offset = 0
      if (perpendicularOffsets.length > 0) {
        if (t <= perpendicularOffsets[0].t) {
          offset = perpendicularOffsets[0].offset
        } else if (
          t >= perpendicularOffsets[perpendicularOffsets.length - 1].t
        ) {
          offset = perpendicularOffsets[perpendicularOffsets.length - 1].offset
        } else {
          for (let j = 0; j < perpendicularOffsets.length - 1; j++) {
            const p0 = perpendicularOffsets[j]
            const p1 = perpendicularOffsets[j + 1]
            if (t >= p0.t && t <= p1.t) {
              const localT = (t - p0.t) / (p1.t - p0.t)
              offset = Phaser.Math.Linear(p0.offset, p1.offset, localT)
              break
            }
          }
        }
      }

      // Apply the perpendicular offset
      const offsetX = normal.x * offset
      const offsetY = normal.y * offset

      const particleX = baseX + offsetX
      const particleY = baseY + offsetY

      // Emit the particle at the computed position
      const adjustedConfig = baseEmitterConfig
      if (weapon.beamParticleInitialSize) {
        adjustedConfig.scale = {
          start: weapon.beamParticleInitialSize!,
          end: 0,
        }
      }
      adjustedConfig.lifespan = weapon.beamParticlesFadeTime!
      this.beamParticleEmitter.setConfig(adjustedConfig)
      this.beamParticleEmitter.setParticleTint(weapon.beamParticlesColor!)
      this.beamParticleEmitter.setParticleAlpha(1)
      this.beamParticleEmitter.emitParticleAt(particleX, particleY)

      // generate large light flash occasionally

      if (weapon.randomFlash && Math.random() < weapon.randomFlash) {
        const radius = weapon.beamLightRadius! * 5
        const intensity = weapon.beamLightIntensity! * 5
        const bigFlash = this.scene.lights.addLight(
          particleX,
          particleY,
          radius,
          weapon.beamColor!,
          intensity,
        )
        this.scene.tweens.add({
          targets: bigFlash,
          intensity: { from: intensity, to: 0 },
          radius: { from: radius, to: radius / 2 },
          duration: 200,
          onComplete: () => {
            this.scene.lights.removeLight(bigFlash)
          },
        })
      }

      // Handle lights for beam fragments
      if (isBeamFragment) {
        for (let j = 0; j < weapon.beamParticlesDensity! / 2; j++) {
          const light = this.scene.lights
            .addLight(
              particleX,
              particleY,
              weapon.beamLightRadius! / 2,
              weapon.beamColor!,
              weapon.beamLightIntensity! / 2,
            )
            .setVisible(true)
          lights.push(light)
        }
      }

      // Update light positions for persistent beams
      const light = lights[i]
      if (light) {
        light.radius = weapon.beamLightRadius! * (Math.random() * 0.4 + 0.8)
        light.x = particleX
        light.y = particleY
      }

      // Remove lights for non-persistent beams
      if (!beam) {
        lights.forEach(light => this.scene.lights.removeLight(light))
      }
    }
  }

  private beamHitMapObject(
    entity: MapObject,
    weapon: WeaponSpec,
    beamStartX: number,
    beamStartY: number,
    beamEndX: number,
    beamEndY: number,
  ): void {
    const damage = weapon.damage

    // Optional: create a dust/explosion effect where the beam hit
    createDustCloud(
      this.scene,
      beamEndX,
      beamEndY,
      0,
      0,
      1,
      4000,
      Math.min(weapon.damage * 40, 100),
      0x666666, // Or pick any color relevant to the map tile entity
    )

    if (damage > entity.armor / 3) {
      const effectiveDamage = damage * 2 - entity.armor / 3
      entity.health -= effectiveDamage > 0 ? effectiveDamage : 0

      // If health is depleted, remove it
      if (entity.health <= 0) {
        const directionRadians = Phaser.Math.Angle.Between(
          beamStartX,
          beamStartY,
          entity.centreX,
          entity.centreY,
        )
        this.scene.mapMgr.destroyMapObject(entity, directionRadians)
      }
    }

    this.beamHitSpark(beamStartX, beamStartY, beamEndX, beamEndY, weapon)
    createLightFlash(
      this.scene,
      beamEndX,
      beamEndY,
      weapon.beamColor!,
      100,
      weapon.beamHitLightIntensity!,
      weapon.beamHitLightRadius!,
    )
  }

  private beamHitEnemy(
    enemy: EnemySprite,
    weapon: WeaponSpec,
    startX: number,
    startY: number,
  ): void {
    createLightFlash(
      this.scene,
      enemy.x,
      enemy.y,
      weapon.beamColor!,
      100,
      weapon.beamHitLightIntensity!,
      weapon.beamHitLightRadius!,
    )
    if (!enemy.active) return
    // beam weapons do double damage to map objects
    const damage = weapon.damage! * 2 // beam weapons do double damage to map objects
    const effectiveDamage = Math.max(damage - enemy.armor /3, 0)
    enemy.health -= effectiveDamage

    this.beamHitSpark(startX, startY, enemy.x, enemy.y, weapon)

    if (enemy.health <= 0) {
      this.handleEnemyDeath(
        enemy,
        this.scene.player.mechContainer.x,
        this.scene.player.mechContainer.y,
      )
    }

    if (weapon.chaining) {
      this.handleChainingEffect(enemy, weapon)
    }
  }

  private handleEnemyDeath(
    enemy: EnemySprite,
    attackerX: number,
    attackerY: number,
  ): void {
    const directionRadians = Phaser.Math.Angle.Between(
      attackerX,
      attackerY,
      enemy.x,
      enemy.y,
    )
    destroyEnemyAndCreateCorpseDecals(
      this.scene,
      enemy,
      enemy.x,
      enemy.y,
      directionRadians,
    )
    this.scene.enemyMgr.enemies.remove(enemy, true)
  }

  private handleChainingEffect(enemy: EnemySprite, weapon: WeaponSpec): void {
    const targets = this.scene.enemyMgr.enemies
      .getChildren()
      .filter(e => e !== enemy && e.active) as EnemySprite[]
    const maxChainRange = weapon.chainRange!

    const validTargets = targets
      .map(e => ({
        enemy: e,
        distance: Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y),
      }))
      .filter(e => {
        // Check if target is in range
        if (e.distance > maxChainRange) return false

        // Check line of sight between chain source and potential target
        const { hitObject } = this.detectBeamCollision(
          enemy.x,
          enemy.y,
          e.enemy.x,
          e.enemy.y,
          weapon,
        )

        // Only allow chaining if there's direct line of sight or if hitting another enemy
        return !hitObject || this.scene.enemyMgr.isAnEnemy(hitObject)
      })
      .sort((a, b) => a.distance - b.distance)

    const chainedTargets = validTargets.slice(0, 3)

    for (const targetData of chainedTargets) {
      const target = targetData.enemy
      const chainDamage = weapon.damage! * 0.5
      const effectiveDamage = Math.max(chainDamage - target.armor/3, 0)
      target.health -= effectiveDamage

      this.beamHitSpark(enemy.x, enemy.y, target.x, target.y, weapon)

      createLightFlash(
        this.scene,
        target.x,
        target.y,
        weapon.beamColor!,
        100,
        weapon.beamHitLightIntensity! * 0.66,
        weapon.beamHitLightRadius! * 0.66,
      )

      this.drawBeam(weapon, enemy.x, enemy.y, target.x, target.y)

      if (target.health <= 0) {
        this.handleEnemyDeath(target, enemy.x, enemy.y)
      }
    }
  }

  beamHitSpark(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    weapon: WeaponSpec,
  ): void {
    const directionRadians = Phaser.Math.Angle.Between(
      endX,
      endY,
      startX,
      startY,
    )
    this.scene.projectileMgr.hitSpark(
      endX,
      endY,
      blendColors(weapon.beamColor!, 0xffffff, 0.8),
      directionRadians,
      10,
      undefined,
      300,
    )

    const variation = 0.75
    const randomFactor = 1 + Phaser.Math.FloatBetween(-variation, variation)

    // Circles from center outward
    const circleRatios = [1, 0.6, 0.3]
    const baseRadius = 15

    // For each circle, use a separate Graphics instance so overlapping visually stacks
    for (let i = 0; i < circleRatios.length; i++) {
      const ratio = circleRatios[i]
      const radius = baseRadius * ratio * randomFactor

      const singleCircleGraphics = this.scene.addGraphicsEffect()
      singleCircleGraphics.setDepth(ct.depths.projectileSpark)

      singleCircleGraphics.fillStyle(weapon.beamColor!, 0.1)
      singleCircleGraphics.fillCircle(endX, endY, radius)
      singleCircleGraphics.setAlpha(0.3)

      this.scene.time.delayedCall(80, () => {
        singleCircleGraphics.destroy()
      })
    }
  }

  stopAllBeams(): void {
    for (const weaponIndexStr in this.activeBeams) {
      this.stopBeam(Number(weaponIndexStr))
    }
  }
}

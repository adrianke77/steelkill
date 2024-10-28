import { Game } from '../scenes/Game'
import { WeaponSpec, EnemySprite } from '../interfaces'
import { Constants as ct } from '../constants'
import {
  destroyEnemyAndCreateCorpseDecals,
  createLightFlash,
} from '../rendering'
import { EventBus } from '../../EventBus'
import { calculateWeaponStartPosition } from './ProjectileManager'

const baseEmitterConfig = {
  lifespan: 300,
  scale: { start: 0.35, end: 0 },
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
    const graphics = scene.add.graphics()
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(0, 0, 1)
    graphics.generateTexture('whiteParticle', 1, 1)
    graphics.destroy()
    this.beamParticleEmitter = scene.addParticles(
      0,
      0,
      'whiteParticle',
      baseEmitterConfig,
    )
  }

  startBeam(weaponIndex: number): void {
    if (this.activeBeams[weaponIndex]) return

    if (this.scene.magCount[weaponIndex] <= 0) return

    const weapon = this.scene.player.weapons[weaponIndex]
    const weaponPosition = ct.weaponPositions[weaponIndex]

    const beamGraphics = this.scene.add.graphics()
    this.scene.addGraphicsFiltering(beamGraphics)
    beamGraphics.setDepth(ct.depths.projectile)
    beamGraphics.setBlendMode(Phaser.BlendModes.ADD)
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
      volume *= 0.4
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

  updateBeams(time: number): void {
    for (const weaponIndexStr in this.activeBeams) {
      const weaponIndex = Number(weaponIndexStr)
      const beam = this.activeBeams[weaponIndex]
      if (!beam) continue

      const weapon = this.scene.player.weapons[weaponIndex]

      if (!this.handleFireDelay(weaponIndex, time)) continue

      const { startX, startY, maxEndX, maxEndY } =
        this.calculateBeamPositions(weaponIndex)

      const { beamEndX, beamEndY, closestEnemy } = this.detectBeamCollision(
        startX,
        startY,
        maxEndX,
        maxEndY,
        weapon,
      )

      beam.startX = startX
      beam.startY = startY
      beam.endX = beamEndX
      beam.endY = beamEndY

      this.resetAndDrawBeam(beam, weapon, startX, startY)

      if (closestEnemy) {
        if (weapon.circleSpreadTargeting) {
          this.handleCircleSpreadTargeting(
            beam,
            weapon,
            closestEnemy,
            startX,
            startY,
          )
        } else {
          this.hittingFirstEnemy(closestEnemy, weapon, startX, startY)
        }
      }

      this.consumeAmmo(weaponIndex)
    }
  }

  private handleFireDelay(weaponIndex: number, time: number): boolean {
    const weapon = this.scene.player.weapons[weaponIndex]
    if (time - this.beamTimers[weaponIndex] < weapon.fireDelay!) return false
    this.beamTimers[weaponIndex] = time
    return true
  }

  private calculateBeamPositions(
    weaponIndex: number,
  ): { startX: number; startY: number; maxEndX: number; maxEndY: number } {
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
    closestEnemy: EnemySprite | null
  } {
    const enemies = this.scene.enemyMgr.enemies.getChildren() as EnemySprite[]
    let closestEnemy: EnemySprite | null = null
    let closestDistance = weapon.maxRange!
    let beamEndX = maxEndX
    let beamEndY = maxEndY
    const intersectionPoint = new Phaser.Geom.Point()

    const line = new Phaser.Geom.Line(startX, startY, maxEndX, maxEndY)

    for (const enemy of enemies) {
      if (!enemy.active) continue

      const enemyCircle = new Phaser.Geom.Circle(
        enemy.x,
        enemy.y,
        enemy.displayWidth / 2,
      )
      const intersects = Phaser.Geom.Intersects.LineToCircle(
        line,
        enemyCircle,
        intersectionPoint,
      )

      if (intersects) {
        const distance = Phaser.Math.Distance.Between(
          startX,
          startY,
          intersectionPoint.x,
          intersectionPoint.y,
        )
        if (distance < closestDistance) {
          closestDistance = distance
          closestEnemy = enemy
          beamEndX = intersectionPoint.x
          beamEndY = intersectionPoint.y
        }
      }
    }

    return { beamEndX, beamEndY, closestEnemy }
  }

  private resetAndDrawBeam(
    beam: ActiveBeam,
    weapon: WeaponSpec,
    startX: number,
    startY: number,
  ): void {
    beam.graphics.clear()
    this.drawBeam(weapon, startX, startY, beam.endX, beam.endY, beam)
  }

  private handleCircleSpreadTargeting(
    beam: ActiveBeam,
    weapon: WeaponSpec,
    closestEnemy: EnemySprite,
    startX: number,
    startY: number,
  ): void {
    const enemies = this.scene.enemyMgr.enemies.getChildren() as EnemySprite[]

    const nearbyEnemies = enemies.filter(enemy => {
      return (
        Phaser.Math.Distance.Between(
          closestEnemy.x,
          closestEnemy.y,
          enemy.x,
          enemy.y,
        ) <= weapon.circleSpreadTargetingRadius!
      )
    })

    if (nearbyEnemies.length > 0) {
      const targetEnemy =
        nearbyEnemies[Phaser.Math.Between(0, nearbyEnemies.length - 1)]

      beam.endX = targetEnemy.x
      beam.endY = targetEnemy.y

      beam.graphics.clear()
      this.drawBeam(weapon, startX, startY, beam.endX, beam.endY, beam)

      this.hittingFirstEnemy(targetEnemy, weapon, startX, startY)
    }
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
    segmentCount: number = 100,
    displacement: number = 5,
  ): void {
    const isBeamFragment = !beam

    const points = this.generateBeamPoints(
      weapon,
      startX,
      startY,
      endX,
      endY,
      segmentCount,
      displacement,
    )

    const glowLayers = [
      {
        color: weapon.beamGlowColor!,
        width: weapon.beamGlowWidth!,
        alpha: 0.2,
      },
      {
        color: weapon.beamGlowColor!,
        width: weapon.beamGlowWidth! * 0.7,
        alpha: 0.2,
      },
      {
        color: weapon.beamGlowColor!,
        width: weapon.beamGlowWidth! * 0.4,
        alpha: 0.2,
      },
      { color: weapon.beamColor!, width: weapon.beamWidth!, alpha: 1 },
    ]

    this.drawGlowLayers(points, glowLayers)
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
    const segmentsBetweenAlignedPoints = weapon.renderAsLightning ? 3 : 1
    const points: Phaser.Math.Vector2[] = [
      new Phaser.Math.Vector2(startX, startY),
    ]
    const deltaX = (endX - startX) / segmentCount
    const deltaY = (endY - startY) / segmentCount

    for (let i = 1; i < segmentCount; i++) {
      const prevPoint = points[i - 1]
      const randomX =
        i % segmentsBetweenAlignedPoints === 0
          ? 0
          : Phaser.Math.FloatBetween(-displacement, displacement)
      const randomY =
        i % segmentsBetweenAlignedPoints === 0
          ? 0
          : Phaser.Math.FloatBetween(-displacement, displacement)

      points.push(
        new Phaser.Math.Vector2(
          prevPoint.x + deltaX + randomX,
          prevPoint.y + deltaY + randomY,
        ),
      )
    }
    points.push(new Phaser.Math.Vector2(endX, endY))
    return points
  }

  private drawGlowLayers(
    points: Phaser.Math.Vector2[],
    glowLayers: { color: number; width: number; alpha: number }[],
  ): void {
    const fadeStartIndex = Math.floor(points.length * (2 / 3))
    for (const layer of glowLayers) {
      const graphics = this.scene.add.graphics()
      this.scene.addGraphicsFiltering(graphics)
      for (let i = 0; i < points.length - 1; i++) {
        let segmentAlpha = layer.alpha
        if (i >= fadeStartIndex) {
          const fadeProgress =
            (i - fadeStartIndex) / (points.length - 1 - fadeStartIndex)
          segmentAlpha = layer.alpha * (1 - fadeProgress)
        }
        graphics.lineStyle(layer.width, layer.color, segmentAlpha)
        graphics.beginPath()
        graphics.moveTo(points[i].x, points[i].y)
        graphics.lineTo(points[i + 1].x, points[i + 1].y)
        graphics.strokePath()
      }
      this.scene.time.delayedCall(2, () => graphics.destroy())
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
        } else if (t >= perpendicularOffsets[perpendicularOffsets.length - 1].t) {
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
      this.beamParticleEmitter.setParticleTint(weapon.beamParticlesColor!)
      this.beamParticleEmitter.setParticleAlpha(isBeamFragment ? 0.5 : 0.9)
      this.beamParticleEmitter.emitParticleAt(particleX, particleY)
      this.beamParticleEmitter.lifespan = weapon.beamParticlesFadeTime!
  
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
  

  private hittingFirstEnemy(
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
    enemy.health -= weapon.damage!
    this.hitSpark(startX, startY, enemy.x, enemy.y, weapon)

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

    const sortedTargets = targets
      .map(e => ({
        enemy: e,
        distance: Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y),
      }))
      .filter(e => e.distance <= maxChainRange)
      .sort((a, b) => b.distance - a.distance)

    const chainedTargets = sortedTargets.slice(0, 3)

    for (const targetData of chainedTargets) {
      const target = targetData.enemy
      target.health -= weapon.damage! * 0.5

      this.hitSpark(enemy.x, enemy.y, target.x, target.y, weapon)

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

  hitSpark(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    weapon: WeaponSpec,
  ): void {
    const directionRadians = Phaser.Math.Angle.Between(
      startX,
      startY,
      endX,
      endY,
    )
    this.scene.projectileMgr.hitSpark(
      endX,
      endY,
      weapon.beamColor!,
      directionRadians,
      5,
    )
  }

  stopAllBeams(): void {
    for (const weaponIndexStr in this.activeBeams) {
      this.stopBeam(Number(weaponIndexStr))
    }
  }
}

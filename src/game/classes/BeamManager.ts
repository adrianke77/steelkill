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
  // store coordinates of the beam for minimap
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

    // Check for ammo before starting the beam
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

    const lights: Phaser.GameObjects.Light[] = []
    for (let i = 0; i < weapon.beamParticlesDensity!; i++) {
      // Create a light with desired properties
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

    let volume = weapon.fireSoundVol ?? 1.0
    // check if same beam sound already playing, if so reduce the volume of new beam
    if (Object.keys(this.activeBeams).length > 0) {
      volume = volume * 0.4
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
        onComplete: () => beam.sound.stop(), // Stop the sound when the fade completes
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

      // Handle fire delay
      if (time - this.beamTimers[weaponIndex] < weapon.fireDelay!) continue
      this.beamTimers[weaponIndex] = time

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

      // Collision detection with enemies
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

      beam.startX = startX
      beam.startY = startY
      beam.endX = beamEndX
      beam.endY = beamEndY

      // Reset graphics for redraw
      beam.graphics.clear()

      // Use the unified draw method
      this.drawBeam(weapon, startX, startY, beam.endX, beam.endY, beam)

      // Apply damage if enemy is hit
      if (closestEnemy) {
        if (weapon.circleSpreadTargeting) {
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

          // Select one enemy within that circle to damage
          if (nearbyEnemies.length > 0) {
            const targetEnemy =
              nearbyEnemies[Phaser.Math.Between(0, nearbyEnemies.length - 1)]

            // Adjust beam end to the new target enemy
            beam.endX = targetEnemy.x
            beam.endY = targetEnemy.y

            // Redraw the beam to the new target
            beam.graphics.clear()
            this.drawBeam(weapon, startX, startY, beam.endX, beam.endY, beam)

            // Apply damage to the selected enemy
            this.hittingFirstEnemy(targetEnemy, weapon, startX, startY)
          }
        } else {
          this.hittingFirstEnemy(closestEnemy, weapon, startX, startY)
        }
      }

      // Consume ammo
      this.scene.magCount[weaponIndex] -= 1
      if (this.scene.magCount[weaponIndex] <= 0) {
        this.scene.magCount[weaponIndex] = 0
        this.stopBeam(weaponIndex)
      }

      // Update HUD
      EventBus.emit('mag-count', this.scene.magCount)
    }
  }

  private drawBeam(
    weapon: WeaponSpec,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    beam?: ActiveBeam, // only for persistent beams
    segmentCount: number = 100,
    displacement: number = 5,
  ): void {
    // for non-persistent beams, e.g., chained weapons' secondary beams/lightning
    const isBeamFragment = !beam
    // Determine the number of segments between aligned points
    // 1 means all segments are aligned, thus is a straight line
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

    // Define layers for the glow effect
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

    // Calculate the index where the fade should start
    const fadeStartIndex = Math.floor(points.length * (2 / 3)) // Last third

    // Draw each layer
    for (const layer of glowLayers) {
      const graphics = this.scene.add.graphics()
      this.scene.addGraphicsFiltering(graphics)
      for (let i = 0; i < points.length - 1; i++) {
        let segmentAlpha = layer.alpha
        if (i >= fadeStartIndex) {
          const fadeProgress =
            (i - fadeStartIndex) / (points.length - 1 - fadeStartIndex)
          segmentAlpha = layer.alpha * (1 - fadeProgress) // Linear fade to zero
        }
        graphics.lineStyle(layer.width, layer.color, segmentAlpha)
        graphics.beginPath()
        graphics.moveTo(points[i].x, points[i].y)
        graphics.lineTo(points[i + 1].x, points[i + 1].y)
        graphics.strokePath()
      }
      // Destroy the graphics after rendering
      this.scene.time.delayedCall(2, () => graphics.destroy())
    }

    const particleCount = beam
      ? beam.lights.length
      : weapon.beamParticlesDensity!
    for (let i = 0; i < particleCount; i++) {
      const maxOffset = 0.5 / particleCount
      const randomOffset = (Math.random() - 0.5) * 2 * maxOffset
      const t = Phaser.Math.Clamp(i / particleCount + randomOffset, 0, 1)
      const particleX = Phaser.Math.Interpolation.Linear([startX, endX], t)
      const particleY = Phaser.Math.Interpolation.Linear([startY, endY], t)

      this.beamParticleEmitter.setParticleTint(weapon.beamParticlesColor!)
      this.beamParticleEmitter.setParticleAlpha(isBeamFragment ? 0.5 : 0.9)
      this.beamParticleEmitter.emitParticleAt(particleX, particleY)
      this.beamParticleEmitter.lifespan = weapon.beamParticlesFadeTime!

      // only persistent beams have persistent lights
      const lights = isBeamFragment ? [] : beam.lights

      if (isBeamFragment) {
        for (let i = 0; i < weapon.beamParticlesDensity! / 2; i++) {
          const light = this.scene.lights
            .addLight(
              startX,
              startY,
              weapon.beamLightRadius! / 2,
              weapon.beamColor!,
              weapon.beamLightIntensity! / 2,
            )
            .setVisible(true)
          lights.push(light)
        }
      }

      // Update corresponding light position
      const light = lights[i]
      if (light) {
        light.radius = weapon.beamLightRadius! * (Math.random() * 0.4 + 0.8)
        light.x = particleX
        light.y = particleY
      }

      // clear particle lights if beam is not persistent
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
    // Create hit spark
    this.hitSpark(startX, startY, enemy.x, enemy.y, weapon)
    
    if (enemy.health <= 0) {
      const directionRadians = Phaser.Math.Angle.Between(
        this.scene.player.mechContainer.x,
        this.scene.player.mechContainer.y,
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
      // Remove enemy from the group (don't destroy again)
      this.scene.enemyMgr.enemies.remove(enemy, true)
    }

    // Handle chaining effect
    if (weapon.chaining) {
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
        // sort targets with furthest first
        .sort((a, b) => b.distance - a.distance)

      // Select up to three furthest targets
      const chainedTargets = sortedTargets.slice(0, 3)

      for (const targetData of chainedTargets) {
        const target = targetData.enemy
        // Apply 50% of the weapon damage
        target.health -= weapon.damage! * 0.5

        this.hitSpark(enemy.x, enemy.y, target.x, target.y, weapon)

        // Create light flash at the target
        createLightFlash(
          this.scene,
          target.x,
          target.y,
          weapon.beamColor!,
          100,
          weapon.beamHitLightIntensity! * 0.66,
          weapon.beamHitLightRadius! * 0.66,
        )

        // Draw beam from initial enemy to the target

        this.drawBeam(weapon, enemy.x, enemy.y, target.x, target.y)

        // Check if the target is dead
        if (target.health <= 0) {
          const directionRadians = Phaser.Math.Angle.Between(
            enemy.x,
            enemy.y,
            target.x,
            target.y,
          )
          destroyEnemyAndCreateCorpseDecals(
            this.scene,
            target,
            target.x,
            target.y,
            directionRadians,
          )
          // Remove enemy from the group
          this.scene.enemyMgr.enemies.remove(target, true)
        }
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
    // Create hit spark
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
      this.activeBeams[weaponIndexStr].sound.stop()
      this.stopBeam(Number(weaponIndexStr))
    }
  }
}

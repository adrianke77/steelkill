import { Game } from '../scenes/Game'
import { WeaponSpec, EnemySprite } from '../interfaces'
import { Constants as ct } from '../constants'
import { destroyEnemyAndCreateCorpseDecals } from '../rendering'
import { EventBus } from '../../EventBus'

interface ActiveBeam {
  graphics: Phaser.GameObjects.Graphics
  lights: Phaser.GameObjects.Light[]
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
    this.beamParticleEmitter = scene.addParticles(0, 0, 'whiteParticle', {
      lifespan: 300,
      scale: { start: 0.3, end: 0 },
      rotate: { start: 0, end: 360 },
      speed: { min: 20, max: 30 },
      emitting: false,
    })
  }

  startBeam(weaponIndex: number): void {
    if (this.activeBeams[weaponIndex]) return

    const beamGraphics = this.scene.add.graphics()
    beamGraphics.setDepth(ct.depths.projectile)
    beamGraphics.setBlendMode(Phaser.BlendModes.ADD)
    beamGraphics.setPipeline('Light2D')

    const weapon = this.scene.player.weapons[weaponIndex]
    const density = weapon.beamParticlesDensity!

    const lights: Phaser.GameObjects.Light[] = []
    for (let i = 0; i < density; i++) {
      // Create a light with desired properties
      const light = this.scene.lights
        .addLight(
          0,
          0,
          weapon.beamLightRadius,
          weapon.beamColor,
          weapon.beamLightIntensity,
        )
        .setVisible(true)
      lights.push(light)
    }

    this.activeBeams[weaponIndex] = { graphics: beamGraphics, lights }
    this.beamTimers[weaponIndex] = this.scene.time.now
  }

  stopBeam(weaponIndex: number): void {
    const beam = this.activeBeams[weaponIndex]
    if (beam) {
      // Destroy graphics
      beam.graphics.destroy()
      // Destroy all associated lights
      beam.lights.forEach(light => this.scene.lights.removeLight(light))
      // Remove beam from activeBeams and beamTimers
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
      const beamGraphics = beam.graphics

      // Handle fire delay
      if (time - this.beamTimers[weaponIndex] < weapon.fireDelay) continue
      this.beamTimers[weaponIndex] = time

      const player = this.scene.player
      const rotation = player.mechContainer.rotation - Math.PI / 2

      const startX = player.mechContainer.x
      const startY = player.mechContainer.y

      const maxEndX = startX + Math.cos(rotation) * weapon.maxRange!
      const maxEndY = startY + Math.sin(rotation) * weapon.maxRange!

      // Reset graphics for redraw
      beamGraphics.clear()

      // Collision detection with enemies
      const enemies = this.scene.enemyMgr.enemies.getChildren() as EnemySprite[]
      let closestEnemy: EnemySprite | null = null
      let closestDistance = weapon.maxRange!
      let beamEndX = maxEndX
      let beamEndY = maxEndY

      const line = new Phaser.Geom.Line(startX, startY, maxEndX, maxEndY)

      for (const enemy of enemies) {
        if (!enemy.active) continue

        const enemyCircle = new Phaser.Geom.Circle(
          enemy.x,
          enemy.y,
          enemy.displayWidth / 2,
        )
        const intersectionPoint = new Phaser.Geom.Point()
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

      // Add a glowing effect by drawing the beam multiple times with increasing width and decreasing alpha
      const glowColor = weapon.beamColor!
      const glowWidth = weapon.beamGlowWidth!

      // Draw the outer glow (first, widest, faintest)
      beamGraphics.lineStyle(glowWidth, glowColor, 0.1)
      beamGraphics.beginPath()
      beamGraphics.moveTo(startX, startY)
      beamGraphics.lineTo(beamEndX, beamEndY)
      beamGraphics.closePath()
      beamGraphics.strokePath()

      // Draw mid-layer glow (smaller, a bit brighter)
      beamGraphics.lineStyle(glowWidth * 0.5, glowColor, 0.1)
      beamGraphics.beginPath()
      beamGraphics.moveTo(startX, startY)
      beamGraphics.lineTo(beamEndX, beamEndY)
      beamGraphics.closePath()
      beamGraphics.strokePath()

      // Draw inner glow (smallest, brightest)
      beamGraphics.lineStyle(glowWidth * 0.3, glowColor, 0.1)
      beamGraphics.beginPath()
      beamGraphics.moveTo(startX, startY)
      beamGraphics.lineTo(beamEndX, beamEndY)
      beamGraphics.closePath()
      beamGraphics.strokePath()

      // Draw the main beam (core of the beam)
      beamGraphics.lineStyle(weapon.beamWidth!, weapon.beamColor!, 1)
      beamGraphics.beginPath()
      beamGraphics.moveTo(startX, startY)
      beamGraphics.lineTo(beamEndX, beamEndY)
      beamGraphics.closePath()
      beamGraphics.strokePath()

      // Emit particles along the beam
      const particleCount = beam.lights.length // Ensure this matches the number of lights
      for (let i = 0; i < particleCount; i++) {
        // Randomize the particle position up and down the beam
        const maxOffset = 0.5 / particleCount
        const randomOffset = (Math.random() - 0.5) * 2 * maxOffset
        const t = Phaser.Math.Clamp(i / particleCount + randomOffset, 0, 1)
        const particleX = Phaser.Math.Interpolation.Linear(
          [startX, beamEndX],
          t,
        )
        const particleY = Phaser.Math.Interpolation.Linear(
          [startY, beamEndY],
          t,
        )

        // Manually emit particles at calculated positions
        this.beamParticleEmitter.setParticleTint(weapon.beamParticlesColor!)
        this.beamParticleEmitter.setParticleAlpha(0.9)
        this.beamParticleEmitter.emitParticleAt(particleX, particleY)

        // Update corresponding light position
        const light = beam.lights[i]
        if (light) {
          light.radius = weapon.beamLightRadius! * (Math.random() * 0.4 + 0.8);
          light.x = particleX
          light.y = particleY
        }
      }

      this.scene.addGraphicsFiltering(beamGraphics)

      // Apply damage if enemy is hit
      if (closestEnemy) {
        this.applyBeamDamage(closestEnemy, weapon)

        // Create hit spark
        const directionRadians = Phaser.Math.Angle.Between(
          startX,
          startY,
          beamEndX,
          beamEndY,
        )
        this.scene.projectileMgr.hitSpark(
          beamEndX,
          beamEndY,
          weapon.beamColor!,
          directionRadians,
          5,
        )
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

  private applyBeamDamage(enemy: EnemySprite, weapon: WeaponSpec): void {
    if (!enemy.active) return
    enemy.health -= weapon.damage
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
      // Remove enemy from the group
      this.scene.enemyMgr.enemies.remove(enemy, true, true)
    }
  }

  stopAllBeams(): void {
    for (const weaponIndexStr in this.activeBeams) {
      this.stopBeam(Number(weaponIndexStr))
    }
  }
}

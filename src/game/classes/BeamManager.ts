import { Game } from '../scenes/Game'
import { WeaponSpec, EnemySprite } from '../interfaces'
import { Constants as ct } from '../constants'
import {
  destroyEnemyAndCreateCorpseDecals,
  createLightFlash,
} from '../rendering'
import { EventBus } from '../../EventBus'
import { calculateWeaponStartPosition } from './ProjectileManager'

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
  private particleEmitter: Phaser.GameObjects.Particles.ParticleEmitter

  constructor(scene: Game) {
    this.scene = scene
    const graphics = scene.add.graphics()
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(0, 0, 1)
    graphics.generateTexture('whiteParticle', 1, 1)
    graphics.destroy()
    this.particleEmitter = scene.addParticles(0, 0, 'whiteParticle', {
      lifespan: 300,
      scale: { start: 0.35, end: 0 },
      rotate: { start: 0, end: 360 },
      speed: { min: 20, max: 30 },
      emitting: false,
    })
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

    const density = weapon.beamParticlesDensity!
    const lights: Phaser.GameObjects.Light[] = []
    for (let i = 0; i < density; i++) {
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
      const weaponPosition = ct.weaponPositions[weaponIndex]
      const beam = this.activeBeams[weaponIndex]
      if (!beam) continue

      const weapon = this.scene.player.weapons[weaponIndex]

      // Handle fire delay
      if (time - this.beamTimers[weaponIndex] < weapon.fireDelay!) continue
      this.beamTimers[weaponIndex] = time

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

      beam.startX = startX
      beam.startY = startY
      beam.endX = beamEndX
      beam.endY = beamEndY

      // Reset graphics for redraw
      beam.graphics.clear()

      if (weapon.renderAsLightning) {
        this.drawLightning(
          weapon,
          startX,
          startY,
          beamEndX,
          beamEndY,
          this.scene,
          beam,
        )
      } else {
        this.drawBeam(weapon, beam, startX, startY, beamEndX, beamEndY)
      }

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

  private drawBeam(
    weapon: WeaponSpec,
    beam: ActiveBeam,
    startX: number,
    startY: number,
    beamEndX: number,
    beamEndY: number,
  ): void {
    // Draw beam layers
    const glowColor = weapon.beamColor!
    const glowWidth = weapon.beamGlowWidth!

    const beamLayers = [
      { width: glowWidth, alpha: 0.1 },
      { width: glowWidth * 0.5, alpha: 0.1 },
      { width: glowWidth * 0.3, alpha: 0.1 },
      { width: weapon.beamWidth!, alpha: 1 },
    ]

    for (const layer of beamLayers) {
      this.drawBeamLayer(
        beam.graphics,
        startX,
        startY,
        beamEndX,
        beamEndY,
        layer.width,
        glowColor,
        layer.alpha,
      )
    }

    // Emit particles along the beam
    const particleCount = beam.lights.length // Ensure this matches the number of lights
    for (let i = 0; i < particleCount; i++) {
      // Randomize the particle position up and down the beam
      const maxOffset = 0.5 / particleCount
      const randomOffset = (Math.random() - 0.5) * 2 * maxOffset
      const t = Phaser.Math.Clamp(i / particleCount + randomOffset, 0, 1)
      const particleX = Phaser.Math.Interpolation.Linear([startX, beamEndX], t)
      const particleY = Phaser.Math.Interpolation.Linear([startY, beamEndY], t)

      // Manually emit particles at calculated positions
      this.particleEmitter.setParticleTint(weapon.beamParticlesColor!)
      this.particleEmitter.setParticleAlpha(0.9)
      this.particleEmitter.emitParticleAt(particleX, particleY)

      // Update corresponding light position
      const light = beam.lights[i]
      if (light) {
        light.radius = weapon.beamLightRadius! * (Math.random() * 0.4 + 0.8)
        light.x = particleX
        light.y = particleY
      }
    }
  }

  private drawBeamLayer(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    color: number,
    alpha: number,
  ) {
    const steps = 30 // Total number of segments for the beam
    const halfway = steps / 2 // Halfway point
    const dx = (endX - startX) / steps
    const dy = (endY - startY) / steps

    for (let i = 0; i < steps; i++) {
      const segmentStartX = startX + dx * i
      const segmentStartY = startY + dy * i
      const segmentEndX = startX + dx * (i + 1)
      const segmentEndY = startY + dy * (i + 1)

      let segmentAlpha: number
      if (i < halfway) {
        segmentAlpha = alpha
      } else {
        const fadeProgress = (i - halfway) / halfway
        segmentAlpha = alpha * (1 - fadeProgress)
      }

      graphics.lineStyle(width, color, segmentAlpha)
      graphics.beginPath()
      graphics.moveTo(segmentStartX, segmentStartY)
      graphics.lineTo(segmentEndX, segmentEndY)
      graphics.strokePath()
    }
  }

  private drawLightning(
    weapon: WeaponSpec,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    scene: Game,
    beam: ActiveBeam,
    segmentCount: number = 10,
    displacement: number = 10,
  ): void {
    const points: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(startX, startY)];
    const deltaX = (endX - startX) / segmentCount;
    const deltaY = (endY - startY) / segmentCount;
  
    for (let i = 1; i < segmentCount; i++) {
      const prevPoint = points[i - 1];
      const randomX = Phaser.Math.FloatBetween(-displacement, displacement);
      const randomY = Phaser.Math.FloatBetween(-displacement, displacement);
      points.push(
        new Phaser.Math.Vector2(
          prevPoint.x + deltaX + randomX,
          prevPoint.y + deltaY + randomY,
        ),
      );
    }
    points.push(new Phaser.Math.Vector2(endX, endY));
  
    // Define layers for the lightning glow effect
    const lightningLayers = [
      { width: weapon.beamGlowWidth!, alpha: 0.1 },
      { width: weapon.beamGlowWidth! * 0.7, alpha: 0.15 },
      { width: weapon.beamGlowWidth! * 0.4, alpha: 0.2 },
      { width: weapon.beamWidth!, alpha: 1 },
    ];
  
    // Draw each layer with different widths and alpha values
    for (const layer of lightningLayers) {
      const graphics = scene.add.graphics();
      scene.addGraphicsFiltering(graphics);
      graphics.lineStyle(layer.width, weapon.beamColor!, layer.alpha);
  
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
      }
      graphics.strokePath();
  
      // Destroy the graphics after rendering
      scene.time.delayedCall(1, () => graphics.destroy());
    }
  
    // Emit particles along the lightning path
    const particleCount = beam.lights.length;
    for (let i = 0; i < particleCount; i++) {
      const t = Phaser.Math.FloatBetween(0, 1);
      const index = Math.floor(t * (points.length - 1));
      const pointA = points[index];
      const pointB = points[index + 1] || points[points.length - 1];
      const localT = Phaser.Math.FloatBetween(0, 1);
      const particleX = Phaser.Math.Interpolation.Linear([pointA.x, pointB.x], localT);
      const particleY = Phaser.Math.Interpolation.Linear([pointA.y, pointB.y], localT);
  
      this.particleEmitter.setParticleTint(weapon.beamParticlesColor!);
      this.particleEmitter.setParticleAlpha(0.9);
      this.particleEmitter.emitParticleAt(particleX, particleY);
  
      const light = beam.lights[i];
      if (light) {
        light.radius = weapon.beamLightRadius! * (Math.random() * 0.4 + 0.8);
        light.x = particleX;
        light.y = particleY;
      }
    }
  }
  

  private applyBeamDamage(enemy: EnemySprite, weapon: WeaponSpec): void {
    createLightFlash(
      this.scene,
      enemy.x,
      enemy.y,
      weapon.beamColor!,
      100,
      1,
      100,
    )
    if (!enemy.active) return
    enemy.health -= weapon.damage!
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
  }

  stopAllBeams(): void {
    for (const weaponIndexStr in this.activeBeams) {
      this.activeBeams[weaponIndexStr].sound.stop()
      this.stopBeam(Number(weaponIndexStr))
    }
  }
}

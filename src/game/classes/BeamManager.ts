// classes/BeamManager.ts

import { Game } from '../scenes/Game'
import { WeaponSpec, EnemySprite } from '../interfaces'
import { Constants as ct } from '../constants'
import { destroyEnemyAndCreateCorpseDecals } from '../rendering'
import { EventBus } from '../../EventBus'

export class BeamManager {
  private scene: Game
  public activeBeams: { [key: number]: Phaser.GameObjects.Graphics } = {}
  private beamTimers: { [key: number]: number } = {}

  constructor(scene: Game) {
    this.scene = scene
  }

  startBeam(weaponIndex: number): void {
    if (this.activeBeams[weaponIndex]) return

    const beamGraphics = this.scene.add.graphics()
    beamGraphics.setDepth(ct.depths.projectile)
    beamGraphics.setBlendMode(Phaser.BlendModes.ADD)
    beamGraphics.setPipeline('Light2D')
    this.activeBeams[weaponIndex] = beamGraphics
    this.beamTimers[weaponIndex] = this.scene.time.now
  }

  stopBeam(weaponIndex: number): void {
    const beam = this.activeBeams[weaponIndex]
    if (beam) {
      beam.destroy()
      delete this.activeBeams[weaponIndex]
      delete this.beamTimers[weaponIndex]
    }
  }

  updateBeams(time: number): void {
    for (const weaponIndexStr in this.activeBeams) {
      const weaponIndex = Number(weaponIndexStr)
      const weapon = this.scene.player.weapons[weaponIndex]
      const beamGraphics = this.activeBeams[weaponIndex]
      if (!beamGraphics) continue

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

      // Draw the beam
      beamGraphics.lineStyle(weapon.beamWidth!, weapon.beamColor!, 1)
      beamGraphics.beginPath()
      beamGraphics.moveTo(startX, startY)
      beamGraphics.lineTo(beamEndX, beamEndY)
      beamGraphics.closePath()
      beamGraphics.strokePath()
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

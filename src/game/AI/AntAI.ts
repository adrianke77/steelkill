import { EnemyAI, EnemySprite, EnemyData, EnemyWeaponSpec } from '../interfaces'
import { Game } from '../scenes/Game'
import { Constants as ct } from '../constants'

// Extend EnemySprite for ant-specific state
export interface AntEnemySprite extends EnemySprite {
  antDirectionTimer?: Phaser.Time.TimerEvent | null
  targetRotation?: number
  rotationLerpStartTime?: number
  rotationLerpDuration?: number
  startRotation?: number
}

export class AntAI implements EnemyAI {
  update(enemy: AntEnemySprite, scene: Game, time: number): void {
    // If no timer is set, start one
    if (!enemy.antDirectionTimer) {
      this.startDecisionCycle(enemy, scene)
    }

    // Usual ant update logic (chasing, etc.)
    const enemyData = enemy.enemyData as EnemyData
    const hasWeapons = enemyData.weapons && enemyData.weapons.length > 0
    const [playerX, playerY] = scene.player.getPlayerCoords()
    const angle = Math.atan2(playerY - enemy.y, playerX - enemy.x)
    const direction = enemy.direction
    const distanceToPlayer = Phaser.Math.Distance.Between(
      enemy.x,
      enemy.y,
      playerX,
      playerY,
    )

    if (enemyData.terrainBreaker || hasWeapons) {
      scene.enemyMgr.handleStuckOrTerrainBreaker(
        enemy,
        angle,
        time,
        hasWeapons,
        enemyData,
      )
      if (hasWeapons) {
        scene.enemyMgr.handleEnemyWeaponFire(enemy, enemyData, distanceToPlayer, time)
      }
    }

    this.setEnemyVelocityByDirection(enemy, direction, angle, enemyData.speed)
    scene.enemyMgr.handleEnemyAnimation(enemy, enemyData)

    // --- Smoothly rotate towards targetRotation ---
    if (enemy.targetRotation !== undefined && enemy.rotationLerpStartTime !== undefined && enemy.rotationLerpDuration !== undefined) {
      const elapsed = time - enemy.rotationLerpStartTime
      const t = Math.min(elapsed / enemy.rotationLerpDuration, 1)
      // Use Phaser.Math.Angle.RotateTo for shortest path
      enemy.rotation = Phaser.Math.Angle.RotateTo(
        enemy.startRotation ?? enemy.rotation,
        enemy.targetRotation,
        Math.abs(Phaser.Math.Angle.Wrap(enemy.targetRotation - (enemy.startRotation ?? enemy.rotation))) * t
      )
      if (t >= 1) {
        enemy.rotation = enemy.targetRotation
        enemy.rotationLerpStartTime = undefined
        enemy.rotationLerpDuration = undefined
        enemy.startRotation = undefined
      }
    }
  }

  private startDecisionCycle(enemy: AntEnemySprite, scene: Game) {
    const enemyData = enemy.enemyData as EnemyData
    const directionTimer = Phaser.Math.Between(
      enemyData.directionTimerMin,
      enemyData.directionTimerMax,
    )
    const direction = AntAI.getRandomDirection()
    const [playerX, playerY] = scene.player.getPlayerCoords()
    const distance = Phaser.Math.Distance.Between(
      playerX,
      playerY,
      enemy.x,
      enemy.y,
    )
    if (
      !!enemy.enemyData.randomSound &&
      distance < ct.maxEnemySoundDistance &&
      Phaser.Math.FloatBetween(0, 1) < enemy.enemyData.randomSoundChance!
    ) {
      scene.enemyMgr.attemptEnemySound(enemy)
    }
    enemy.direction = direction

    // Calculate the new velocity for the chosen direction
    let moveAngle = 0
    switch (direction) {
      case 'charge':
        moveAngle = Math.atan2(playerY - enemy.y, playerX - enemy.x)
        break
      case 'angled-left':
        moveAngle = Math.atan2(playerY - enemy.y, playerX - enemy.x) - Math.PI / 4
        break
      case 'angled-right':
        moveAngle = Math.atan2(playerY - enemy.y, playerX - enemy.x) + Math.PI / 4
        break
      case 'back':
        moveAngle = Math.atan2(playerY - enemy.y, playerX - enemy.x) + Math.PI
        break
      case 'stop':
      default:
        // Keep current rotation
        moveAngle = enemy.rotation - Math.PI / 2
        break
    }
    // Target rotation is direction of movement (+ Math.PI/2 for sprite alignment)
    const targetRotation = moveAngle + Math.PI / 2

    // Start lerping from current rotation to targetRotation
    enemy.startRotation = enemy.rotation
    enemy.targetRotation = targetRotation
    enemy.rotationLerpStartTime = scene.time.now
    enemy.rotationLerpDuration = 300 // ms

    enemy.antDirectionTimer = scene.time.delayedCall(
      directionTimer,
      () => {
        enemy.antDirectionTimer = null
        this.startDecisionCycle(enemy, scene)
      },
      [],
      this,
    )
  }

  private setEnemyVelocityByDirection(
    enemy: EnemySprite,
    direction: string,
    angle: number,
    speed: number,
  ): void {
    switch (direction) {
      case 'charge':
        enemy.setVelocity(
          speed * 2 * Math.cos(angle),
          speed * 2 * Math.sin(angle),
        )
        break
      case 'stop':
        enemy.setVelocity(0, 0)
        break
      case 'angled-left': {
        const leftAngle = angle - Math.PI / 4
        enemy.setVelocity(
          speed * Math.cos(leftAngle),
          speed * Math.sin(leftAngle),
        )
        break
      }
      case 'angled-right': {
        const rightAngle = angle + Math.PI / 4
        enemy.setVelocity(
          speed * Math.cos(rightAngle),
          speed * Math.sin(rightAngle),
        )
        break
      }
      case 'back': {
        const backAngle = angle + Math.PI
        enemy.setVelocity(
          speed * Math.cos(backAngle),
          speed * Math.sin(backAngle),
        )
        break
      }
    }
  }

  static getRandomDirection(): string {
    const randomValue = Math.random()
    if (randomValue < 0.6) return 'stop'
    if (randomValue < 0.7) return 'charge'
    if (randomValue < 0.8) return 'angled-left'
    if (randomValue < 0.9) return 'angled-right'
    return 'back'
  }

  beforeFireWeapon(
    enemy: AntEnemySprite,
    scene: Game,
    _weapon: EnemyWeaponSpec,
    _index: number,
    fireCallback: () => void
  ): boolean {
    // Calculate angle to player
    const [playerX, playerY] = scene.player.getPlayerCoords()
    const angleToPlayer = Math.atan2(playerY - enemy.y, playerX - enemy.x)
    const targetRotation = angleToPlayer + Math.PI / 2

    enemy.startRotation = enemy.rotation
    enemy.targetRotation = targetRotation
    enemy.rotationLerpStartTime = scene.time.now
    enemy.rotationLerpDuration = 300

    // Schedule the fire after 300ms
    scene.time.delayedCall(300, () => {
      // Snap to final rotation
      enemy.rotation = targetRotation
      enemy.rotationLerpStartTime = undefined
      enemy.rotationLerpDuration = undefined
      enemy.startRotation = undefined
      fireCallback()
    })

    // Return true to indicate AntAI handled the firing
    return true
  }}
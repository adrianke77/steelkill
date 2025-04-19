import { EnemyAI, EnemySprite, EnemyData } from '../interfaces'
import { Game } from '../scenes/Game'
import { Constants as ct } from '../constants'

// Extend EnemySprite for ant-specific state
export interface AntEnemySprite extends EnemySprite {
  antDirectionTimer?: Phaser.Time.TimerEvent | null
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

    // Rotate towards movement direction instead of always facing player
    const vx = enemy.body?.velocity.x ?? 0
    const vy = enemy.body?.velocity.y ?? 0
    if (vx !== 0 || vy !== 0) {
      enemy.rotation = Math.atan2(vy, vx) + Math.PI / 2
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

    // Save the timer so we don't set multiple
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
}

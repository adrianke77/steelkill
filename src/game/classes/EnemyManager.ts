import { Game } from '../scenes/Game'
import { Constants as ct } from '../constants'
import { EnemyData, EnemySprite, SoundTracker } from '../interfaces'
import {
  generateUniqueId,
  getSoundPan,
  getSoundDistanceScale,
  increaseColorIntensity,
} from '../utils'

export const loadEnemyAssets = (scene: Game) => {
  scene.load.spritesheet('ant', 'whiteant.png', {
    frameWidth: 202,
    frameHeight: 248,
  })
  for (const enemyName of Object.keys(ct.enemyData)) {
    const enemyData = ct.enemyData[enemyName]
    if (enemyData.randomSound) {
      scene.load.audio(
        enemyData.randomSound,
        `audio/${enemyData.randomSound}.mp3`,
      )
    }
    if (enemyData.deathSound) {
      scene.load.audio(
        enemyData.deathSound,
        `audio/${enemyData.deathSound}.mp3`,
      )
    }
  }
}

export class EnemyManager {
  scene: Game
  enemies: Phaser.GameObjects.Group
  sounds: SoundTracker = {}

  constructor(scene: Game) {
    this.scene = scene
    this.enemies = this.scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
    })
    this.sounds = {}
    for (const enemyName of Object.keys(ct.enemyData)) {
      const enemyData = ct.enemyData[enemyName]
      if (enemyData.randomSound) {
        this.sounds[enemyData.randomSound] = []
      }
    }
  }

  createEnemy(x: number, y: number, enemyData: EnemyData): void {
    const enemy = this.enemies.create(x, y, enemyData.spriteSheetKey)
    enemy.health = enemyData.health
    enemy.armor = enemyData.armor
    enemy.displayHeight = enemyData.displaySize
    enemy.displayWidth = enemyData.displaySize
    enemy.setSize(enemyData.collisionSize * 2)
    const enemyColor = this.scene.viewMgr.infraredIsOn
      ? increaseColorIntensity(enemyData.color)
      : enemyData.color
    enemy.setTint(enemyColor)
    enemy.setDepth(ct.depths.enemy)
    enemy.play(enemyData.walkAnimation)
    enemy.setPipeline('Light2D')
    enemy.enemyData = enemyData
    enemy.lastHitTime = 0
    enemy.lastScreamTime = 0
    this.resetDirectionTimer(enemy)
  }

  switchEnemiesToInfraredColors(): void {
    this.enemies.children.iterate(enemy => {
      const enemySprite = enemy as EnemySprite
      const color = increaseColorIntensity(enemySprite.enemyData.color)
      enemySprite.setTint(color)
      return true
    })
  }

  switchEnemiesToNonInfraredColors(): void {
    this.enemies.children.iterate(enemy => {
      const enemySprite = enemy as EnemySprite
      enemySprite.setTint(enemySprite.enemyData.color)
      return true
    })
  }

  resetDirectionTimer(enemy: EnemySprite): void {
    const enemyData = enemy.enemyData as EnemyData
    const directionTimer = Phaser.Math.Between(
      enemyData.directionTimerMin,
      enemyData.directionTimerMax,
    )
    const direction = this.getRandomDirection()
    const [playerX, playerY] = this.scene.player.getPlayerCoords()
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
      this.attemptEnemySound(enemy)
    }
    enemy.direction = direction
    this.scene.time.delayedCall(
      directionTimer,
      this.resetDirectionTimer,
      [enemy],
      this,
    )
  }

  // only for ants now, need to refactor for other enemies
  getRandomDirection(): string {
    const randomValue = Math.random()
    if (randomValue < 0.25) return 'charge'
    if (randomValue < 0.5) return 'stop'
    if (randomValue < 0.75) return 'angled-left'
    return 'angled-right'
  }

  playEnemyHitPlayerSound(enemyData: EnemyData): void {
    const soundInstance = this.scene.sound.add(
      enemyData.hitSound,
    ) as Phaser.Sound.WebAudioSound
    soundInstance.play()
    soundInstance.once('complete', () => {
      soundInstance.destroy()
    })
  }

  chasePlayer(enemy: EnemySprite, speed: number): void {
    const [playerX, playerY] = this.scene.player.getPlayerCoords()
    const angle = Math.atan2(playerY - enemy.y, playerX - enemy.x)
    const direction = enemy.direction

    enemy.rotation = angle + Math.PI / 2
    switch (direction) {
      case 'charge':
        enemy.setVelocity(
          speed * 4 * Math.cos(angle),
          speed * 3 * Math.sin(angle),
        )
        break
      case 'stop':
        enemy.setVelocity(0, 0)
        break
      case 'angled-left': {
        const leftAngle = angle - Math.PI / 4
        enemy.setVelocity(
          speed * 2 * Math.cos(leftAngle),
          speed * Math.sin(leftAngle),
        )
        break
      }
      case 'angled-right': {
        const rightAngle = angle + Math.PI / 4
        enemy.setVelocity(
          speed * 2 * Math.cos(rightAngle),
          speed * Math.sin(rightAngle),
        )
        break
      }
    }
  }

  attemptEnemySound(enemy: EnemySprite): void {
    const enemyData = enemy.enemyData as EnemyData
    const enemySoundName = enemyData.randomSound!
    if (this.sounds[enemySoundName].length < 20) {
      const soundInstance = this.scene.sound.add(
        enemySoundName!,
      ) as Phaser.Sound.WebAudioSound
      const [playerX, playerY, playerRot] = this.scene.player.getPlayerCoords()

      let soundScale = getSoundDistanceScale(enemy.x, enemy.y, playerX, playerY)
      if (enemyData.randomSoundVol) {
        soundScale = enemyData.randomSoundVol * soundScale
      }
      soundInstance.setVolume(soundScale)

      const detune = Phaser.Math.Between(-200, 200)
      const pan = getSoundPan(enemy.x, enemy.y, playerX, playerY, playerRot)
      soundInstance.play({ detune, pan })

      const uid = generateUniqueId()
      enemy.randomSoundId = uid
      enemy.randomSound = soundInstance
      this.sounds[enemySoundName].push([
        uid,
        soundInstance,
        enemy,
        this.scene.time.now,
        soundScale,
      ])
      soundInstance.once('complete', () => {
        soundInstance.destroy()
        this.untrackRandomSound(enemy)
      })
    }
  }

  playDeathSound(enemy: EnemySprite): void {
    const enemyData = enemy.enemyData as EnemyData
    const soundInstance = this.scene.sound.add(
      enemyData.deathSound,
    ) as Phaser.Sound.WebAudioSound

    const [playerX, playerY, playerRot] = this.scene.player.getPlayerCoords()
    // let soundScale = getSoundDistanceScale(enemy.x, enemy.y, playerX, playerY);
    if (enemyData.deathSoundVol) {
      soundInstance.setVolume(enemyData.deathSoundVol)

      // 	soundScale = enemyData.deathSoundVol * soundScale
    }
    const detune = Phaser.Math.Between(-300, 300)
    const pan = getSoundPan(enemy.x, enemy.y, playerX, playerY, playerRot)
    soundInstance.play({ detune, pan })
  }

  untrackRandomSound(enemy: EnemySprite): void {
    this.sounds[enemy.enemyData.randomSound!].splice(
      this.sounds[enemy.enemyData.randomSound!].findIndex(
        sound => sound[0] === enemy.randomSoundId,
      ),
      1,
    )
  }
}

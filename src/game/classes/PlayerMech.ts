// PlayerMech.ts
import { EventBus } from '../../EventBus'
import { Constants as ct, weaponConstants, WeaponKey } from '../constants'
import { EnemySprite, FourPositions } from '../interfaces'
import { Game } from '../scenes/Game'
import { renderExplosion } from '../rendering'
import { EnemyData, WeaponSpec } from '../interfaces'
import { dataStore } from '../../DataStore'

export const loadMechAssets = (scene: Game) => {
  scene.load.image('mech', 'mech.png')
  scene.load.audio('boost', 'audio/boost.mp3')
  scene.load.audio('mechstep', 'audio/mechstep.mp3')
  scene.load.audio('mechexplosion', 'audio/mechexplosion.mp3')
  for (let i = 1; i <= 4; i++) {
    scene.load.audio(`mechhit${i}`, `audio/mechhit${i}.mp3`)
  }
}

export class PlayerMech {
  scene: Game
  mechContainer: Phaser.GameObjects.Container
  playerMech: Phaser.Physics.Arcade.Sprite
  boostFlames: Record<FourPositions, Phaser.GameObjects.Sprite>
  currentBoost: number
  boostMax: number
  boostOverload: boolean
  boostSound: Phaser.Sound.WebAudioSound
  mechStepSound: Phaser.Sound.WebAudioSound
  isBoostSoundFading: boolean
  isBoostSoundPlaying: boolean
  mechHealth: number
  hitSoundNames: string[]
  weapons: WeaponSpec[]

  constructor(scene: Game) {

    this.hitSoundNames = ['mechhit1', 'mechhit2', 'mechhit3', 'mechhit4']
    this.scene = scene
    this.boostMax = ct.boostCapacity
    this.currentBoost = ct.boostCapacity
    this.boostOverload = false
    this.isBoostSoundFading = false

    const selectedWeapons = dataStore.data['weapons'] as string[]
    this.weapons = selectedWeapons.map(
      weaponKey => weaponConstants[weaponKey as WeaponKey],
    )
    dataStore.data.weaponsData = this.weapons

    this.playerMech = this.scene.addSprite(0, 0, 'mech')
    this.playerMech.setOrigin(0.5, 0.5)
    this.playerMech.displayWidth = ct.mechDimensions[0]
    this.playerMech.width = ct.mechDimensions[0]
    this.playerMech.displayHeight = ct.mechDimensions[1]
    this.playerMech.height = ct.mechDimensions[1]
    this.boostFlames = {
      front: this.scene.add
        .sprite(0, -this.playerMech.height / 2, 'boostflame')
        .setPipeline('Light2D')
        .setVisible(false),
      back: this.scene.add
        .sprite(0, this.playerMech.height / 2, 'boostflame')
        .setPipeline('Light2D')
        .setVisible(false),
      left: this.scene.add
        .sprite(-this.playerMech.width / 2, 0, 'boostflame')
        .setPipeline('Light2D')
        .setVisible(false),
      right: this.scene.add
        .sprite(this.playerMech.width / 2, 0, 'boostflame')
        .setPipeline('Light2D')
        .setVisible(false),
    }
    this.playerMech.setPipeline('Light2D')

    this.mechHealth = ct.mechStartingHealth
    EventBus.emit('mech-health', this.mechHealth)

    for (const position of Object.keys(this.boostFlames) as FourPositions[]) {
      const sprite = this.boostFlames[position]
      sprite.setOrigin(0, 0.5)
      sprite.play('boostflame')
    }
    this.boostFlames.left.setRotation(Math.PI)
    this.boostFlames.front.setRotation(-Math.PI / 2)
    this.boostFlames.back.setRotation(Math.PI / 2)

    this.mechContainer = this.scene.addContainer(
      ct.startPosition.x,
      ct.startPosition.y,
      [
        this.playerMech,
        this.boostFlames.front,
        this.boostFlames.back,
        this.boostFlames.left,
        this.boostFlames.right,
      ],
    )
    this.scene.physics.world.enable(this.mechContainer)
    this.mechContainer.setDepth(ct.depths.player)
    ;(
      this.mechContainer.body as Phaser.Physics.Arcade.Body
    ).setCollideWorldBounds(true)
    this.boostSound = this.scene.sound.add('boost', {
      loop: true,
    }) as Phaser.Sound.WebAudioSound
    this.mechStepSound = this.scene.sound.add(
      'mechstep',
    ) as Phaser.Sound.WebAudioSound

  }

  getPlayerCoords(): [number, number, number] {
    return [
      this.mechContainer.x,
      this.mechContainer.y,
      this.mechContainer.rotation,
    ]
  }

  playMechstepSound(): void {
    this.mechStepSound.setVolume(ct.mechStepSoundVol)
    this.mechStepSound.play()
  }

  playBoostSound(): void {
    this.isBoostSoundPlaying = true
    this.boostSound.setVolume(ct.boostSoundVol)
    this.boostSound.play()
  }

  stopBoostSound(): void {
    this.isBoostSoundPlaying = false
    this.boostSound.stop()
  }

  playerDeath(): void {
    this.scene.physics.world.timeScale = 5
    const soundInstance = this.scene.sound.add(
      ct.mechDeathSound,
    ) as Phaser.Sound.WebAudioSound
    if (ct.mechDeathSoundVolume) {
      soundInstance.setVolume(ct.mechDeathSoundVolume)
    }
    soundInstance.play()
    soundInstance.once('complete', () => {
      soundInstance.destroy()
    })
    renderExplosion(
      this.scene,
      this.mechContainer.x,
      this.mechContainer.y,
      200,
      100,
    )
    ;(this.mechContainer!.body! as Phaser.Physics.Arcade.Body).enable = false
    this.playerMech.setTint(0x666666)
    this.scene.inputMgr.disableListeners()
  }

  enemyHitsPlayer(enemy: EnemySprite): boolean {
    const time = this.scene.time.now
    const enemyData = enemy.enemyData as EnemyData
    if (enemyData.hitDamage && time - enemy.lastHitTime > enemyData.hitDelay) {
      enemy.lastHitTime = time
      this.playTwoRandomMechHitSounds()
      this.scene.player.mechHealth -=
        enemyData.hitDamage * Phaser.Math.FloatBetween(0.97, 1.03)
      if (this.scene.player.mechHealth <= 0) {
        this.scene.player.mechHealth = 0
        this.scene.player.playerDeath()
      }
      const directionRadians = Phaser.Math.Angle.Between(
        enemy.x,
        enemy.y,
        this.mechContainer.x,
        this.mechContainer.y,
      )
      //white hit spark
      this.scene.projectileMgr.hitSpark(
        (this.mechContainer.x + enemy.x) / 2,
        (this.mechContainer.y + enemy.y) / 2,
        0xffffff,
        directionRadians,
        10,
      )
      if (this.mechHealth <= ct.mechStartingHealth * 0.6) {
        // additional 'fire' spark
        this.scene.projectileMgr.hitSpark(
          (this.mechContainer.x + enemy.x) / 2,
          (this.mechContainer.y + enemy.y) / 2,
          0xfa7202,
          directionRadians,
          20,
        )
      }
      EventBus.emit('mech-health', this.scene.player.mechHealth)
    }
    return true
  }

  playTwoRandomMechHitSounds(): void {
    const twoRandomHitSounds = Phaser.Utils.Array.Shuffle(
      this.hitSoundNames,
    ).slice(0, 2)
    twoRandomHitSounds.forEach(sound => {
      const soundInstance = this.scene.sound.add(
        sound,
      ) as Phaser.Sound.WebAudioSound
      if (ct.enemyHitMechSoundVolume) {
        soundInstance.setVolume(ct.enemyHitMechSoundVolume)
      }
      const detune = Phaser.Math.Between(-400, 400)
      soundInstance.play({ detune })
      soundInstance.once('complete', () => {
        soundInstance.destroy()
      })
    })
  }
}

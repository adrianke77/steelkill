import { EventBus } from '../../EventBus'
import { Constants as ct, weaponConstants, WeaponKey } from '../constants'
import { EnemySprite, FourPositions } from '../interfaces'
import { Game } from '../scenes/Game'
import { renderExplosion } from '../rendering'
import { EnemyData, WeaponSpec } from '../interfaces'
import { dataStore } from '../../DataStore'
import { getVectMag } from '../utils'
import { createLightFlash, addCloudAtPlayermech } from '../rendering'

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
  health: number
  hitSoundNames: string[]
  weapons: WeaponSpec[]
  lastMechStepTime: number
  playerSkidding: boolean
  armor:number

  constructor(scene: Game) {
    this.hitSoundNames = ['mechhit1', 'mechhit2', 'mechhit3', 'mechhit4']
    this.scene = scene
    this.boostMax = ct.boostCapacity
    this.currentBoost = ct.boostCapacity
    this.boostOverload = false
    this.isBoostSoundFading = false
    this.lastMechStepTime = 0
    this.playerSkidding = false
    this.armor = ct.playerInitialArmor

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
        .sprite(0, -this.playerMech.height / 2 + 5, 'boostflame')
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

    this.health = ct.mechStartingHealth
    EventBus.emit('player-health', this.health)

    for (const position of Object.keys(this.boostFlames) as FourPositions[]) {
      const sprite = this.boostFlames[position]
      sprite.setOrigin(0, 0.5)
      sprite.play('boostflame')
    }
    this.boostFlames.left.setRotation(Math.PI)
    this.boostFlames.front.setRotation(-Math.PI / 2)
    this.boostFlames.back.setRotation(Math.PI / 2)

    this.mechContainer = this.scene.addContainer(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
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
    this.mechStepSound.setVolume(ct.mechStepSoundVol)
  }

  updatePlayerMotion(time: number): void {
    const pointer = this.scene.input.activePointer
    const worldPoint = this.scene.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y,
    )

    this.mechContainer.rotation =
      Phaser.Math.Angle.Between(
        this.mechContainer.x,
        this.mechContainer.y,
        worldPoint.x,
        worldPoint.y,
      ) +
      Math.PI / 2

    this.scene.viewMgr.updateCameraOffset(this.mechContainer.rotation)

    const moveStates = this.scene.inputMgr.moveBindingStates
    const isBoosting =
      moveStates.boost &&
      (moveStates.up ||
        moveStates.down ||
        moveStates.left ||
        moveStates.right) &&
      this.currentBoost > 0 &&
      !this.boostOverload

    if (isBoosting) {
      if (!this.isBoostSoundPlaying) {
        this.playBoostSound()
      }
    } else {
      this.stopBoostSound()
    }

    // reset boost overload if above 1/4 of capacity
    if (this.boostOverload && this.currentBoost > this.boostMax / 4) {
      this.boostOverload = false
    }

    // boost regen
    this.currentBoost = Math.min(
      this.currentBoost + ct.boostRegeneration,
      ct.boostCapacity,
    )

    // boost spend
    if (isBoosting) {
      this.currentBoost = this.currentBoost - ct.boostConsumption
      if (this.currentBoost <= 0) {
        this.boostOverload = true
      }
    }

    EventBus.emit('boost-status', this.currentBoost, this.boostOverload)

    const maxVel = isBoosting ? ct.maxBoostVel : ct.maxWalkVel
    const accel = isBoosting ? ct.boostAccel : ct.walkAccel

    const stopVelocity = 20
    const currentVelX = this.mechContainer.body!.velocity.x
    const currentVelY = this.mechContainer.body!.velocity.y
    const velocMag = getVectMag(currentVelX, currentVelY)

    // Compute acceleration based on screen-relative input
    let ax = 0
    let ay = 0
    if (moveStates.right) {
      ax += accel
    }
    if (moveStates.left) {
      ax -= accel
    }
    if (moveStates.down) {
      ay += accel
    }
    if (moveStates.up) {
      ay -= accel
    }

    // Apply acceleration to player's body
    (this.mechContainer.body as Phaser.Physics.Arcade.Body).setAcceleration(
      ax,
      ay,
    )

    // Normalize the acceleration vector
    const accelMag = Math.sqrt(ax * ax + ay * ay)
    let normAx = 0
    let normAy = 0
    if (accelMag > 0) {
      normAx = ax / accelMag
      normAy = ay / accelMag
    }

    // Initialize flames
    this.initializeFlames()

    // Get the player's rotation
    const mechRotation = this.mechContainer.rotation

    // Compute direction angles for each flame
    const frontAngle = mechRotation + Math.PI / 2
    const backAngle = mechRotation - Math.PI / 2
    const leftAngle = mechRotation
    const rightAngle = mechRotation + Math.PI

    // Direction vectors for each flame
    const frontDir = { x: Math.cos(frontAngle), y: Math.sin(frontAngle) }
    const backDir = { x: Math.cos(backAngle), y: Math.sin(backAngle) }
    const leftDir = { x: Math.cos(leftAngle), y: Math.sin(leftAngle) }
    const rightDir = { x: Math.cos(rightAngle), y: Math.sin(rightAngle) }

    if (isBoosting && accelMag > 0) {
      // Compute dot products between flame directions and acceleration vector
      const dotProducts = {
        front: frontDir.x * normAx + frontDir.y * normAy,
        back: backDir.x * normAx + backDir.y * normAy,
        left: leftDir.x * normAx + leftDir.y * normAy,
        right: rightDir.x * normAx + rightDir.y * normAy,
      }

      // Iterate over each position and update flames accordingly
      ;(Object.keys(dotProducts) as FourPositions[]).forEach(position => {
        const scale = Math.max(0, dotProducts[position])
        if (scale > 0) {
          this.updateFlame(position, scale)
        }
      })
    }

    // Skidding
    if (!this.playerSkidding && isBoosting && velocMag > ct.maxWalkVel) {
      this.playerSkidding = true
    }
    if (!isBoosting && velocMag < ct.maxWalkVel) {
      this.playerSkidding = false
    }

    if (this.playerSkidding) {
      addCloudAtPlayermech(this.scene, 0.1)
    }

    const timeSinceLastMechStep = time - this.lastMechStepTime
    const adjustedMechStepPeriod =
      ct.mechStepPeriod * (ct.maxWalkVel / velocMag)

    if (!isBoosting && velocMag > 0) {
      if (timeSinceLastMechStep > adjustedMechStepPeriod) {
        addCloudAtPlayermech(this.scene, 0.9)
        this.playMechstepSound()
        this.lastMechStepTime = time
      }
    }

    if (
      !moveStates.up &&
      !moveStates.down &&
      !moveStates.left &&
      !moveStates.right
    ) {
      if (velocMag < stopVelocity) {
        const body = this.mechContainer.body as Phaser.Physics.Arcade.Body
        body.setVelocity(0, 0)
      } else {
        const decelerationX =
          Math.sign(currentVelX) *
          Math.min(Math.abs(currentVelX), ct.deceleration)
        const decelerationY =
          Math.sign(currentVelY) *
          Math.min(Math.abs(currentVelY), ct.deceleration)
        ;(
          this.mechContainer.body as Phaser.Physics.Arcade.Body
        ).setAcceleration(-decelerationX, -decelerationY)
      }
    }

    if (velocMag > maxVel) {
      const scale = maxVel / velocMag
      ;(this.mechContainer.body as Phaser.Physics.Arcade.Body).setVelocity(
        currentVelX * scale,
        currentVelY * scale,
      )
    }
  }

  private initializeFlames(): void {
    for (const position of Object.keys(this.boostFlames) as FourPositions[]) {
      const flame = this.boostFlames[position]
      flame.setVisible(false)
      flame.displayWidth = ct.boostWidth
      flame.displayHeight = ct.boostLength
      flame.setScale(0)
      flame.setTint(ct.boostTint)
    }
  }

  private updateFlame(position: FourPositions, scale: number): void {
    const flame = this.boostFlames[position]
    flame.setVisible(true).setScale(scale)
    flame.displayWidth = ct.boostLength * scale
    flame.displayHeight = ct.boostWidth * scale
    createLightFlash(
      this.scene,
      flame.x + this.mechContainer.x,
      flame.y + this.mechContainer.y,
      ct.boosterLightColor,
      10 * scale,
      1,
      100,
    )
  }

  getPlayerCoords(): [number, number, number] {
    return [
      this.mechContainer.x,
      this.mechContainer.y,
      this.mechContainer.rotation,
    ]
  }

  playMechstepSound(): void {
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
      this.damagePlayer(enemyData.hitDamage * Phaser.Math.FloatBetween(0.97, 1.03))
      const directionRadians = Phaser.Math.Angle.Between(
        enemy.x,
        enemy.y,
        this.mechContainer.x,
        this.mechContainer.y,
      )
      // white hit spark
      this.scene.projectileMgr.hitSpark(
        (this.mechContainer.x + enemy.x) / 2,
        (this.mechContainer.y + enemy.y) / 2,
        0xffffff,
        directionRadians,
        10,
      )
      if (this.health <= ct.mechStartingHealth * 0.6) {
        // additional 'fire' spark
        this.scene.projectileMgr.hitSpark(
          (this.mechContainer.x + enemy.x) / 2,
          (this.mechContainer.y + enemy.y) / 2,
          0xfa7202,
          directionRadians,
          20,
        )
      }
    }
    return true
  }

  damagePlayer(damage:number) {
    this.scene.player.health -= damage
    if (this.scene.player.health <= 0) {
      this.scene.player.health = 0
      this.scene.player.playerDeath()
    }
    EventBus.emit('player-health', this.scene.player.health)
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

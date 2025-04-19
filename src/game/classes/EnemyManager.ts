import { Game } from '../scenes/Game'
import { Constants as ct } from '../constants'
import { EnemyAIRegistry } from '../AI/EnemyAIRegistry'
import {
  EnemyData,
  EnemySprite,
  EnemyWeaponSpec,
  SoundTracker,
  TerrainTile,
  MapObject,
} from '../interfaces'
import {
  generateUniqueId,
  getSoundPan,
  getSoundDistanceScale,
  loadVerticalSpritesheet,
} from '../utils'

export function createBaseEnemyHitTerrainSparkConfig(): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
  return {
    lifespan: 500,
    speed: { min: 0, max: 100 },
    scale: { start: 6, end: 0 },
    rotate: { start: 0, end: 360 },
    emitting: false,
    accelerationX: 0,
    accelerationY: 0,
    // angle can be set by the caller as needed
  }
}

export const loadEnemyAssets = (scene: Game) => {
  for (const enemyName of Object.keys(ct.enemyData)) {
    const enemyData = ct.enemyData[enemyName]
    if (
      enemyData.randomSound &&
      !scene.cache.audio.has(enemyData.randomSound)
    ) {
      scene.load.audio(
        enemyData.randomSound,
        `audio/${enemyData.randomSound}.mp3`,
      )
    }
    if (enemyData.deathSound && !scene.cache.audio.has(enemyData.deathSound)) {
      scene.load.audio(
        enemyData.deathSound,
        `audio/${enemyData.deathSound}.mp3`,
      )
    }
    if (
      enemyData.walkAnimation &&
      !scene.textures.exists(enemyData.walkAnimation)
    ) {
      loadVerticalSpritesheet(scene, enemyData.walkAnimation)
    }
    if (!scene.cache.audio.has('terrainHit')) {
      scene.load.audio('terrainHit', 'audio/dig.mp3')
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
    const enemy = this.scene.createInGroup(
      this.enemies,
      x,
      y,
      enemyData.walkAnimation,
    )
    enemy.health = enemyData.health
    enemy.armor = enemyData.armor
    enemy.displayHeight = enemyData.displayHeight
    enemy.displayWidth = enemyData.displayWidth
    enemy.setSize(enemyData.collisionSize * 2)
    if (enemyData.color) {
      const enemyColor = this.scene.viewMgr.infraredIsOn
        ? 0xffffff
        : enemyData.color
      enemy.setTint(enemyColor)
    }
    enemy.setDepth(ct.depths.enemy)
    enemy.play(enemyData.walkAnimation)
    enemy.setPipeline('Light2D')
    enemy.enemyData = enemyData
    enemy.lastHitTime = 0
    enemy.lastScreamTime = 0

    // Assign AI instance
    const aiType = enemyData.aiType || 'ant'
    enemy.enemyAI = EnemyAIRegistry[aiType]

    if (enemyData.weapons && enemyData.weapons.length > 0) {
      enemy.lastWeaponFireTime = enemyData.weapons.map(() => 0)
      enemy.tracerTracking = enemyData.weapons.map(() => 0)
    }

    // add shadow
    const averageSize = (enemy.displayWidth + enemy.displayHeight) / 2
    const shadow = this.scene.addSprite(
      enemy.x,
      enemy.y,
      this.scene.shadowTextureKey,
    )
    shadow.setOrigin(0.5, 0.5)
    shadow.setDepth(ct.depths.shadows)
    shadow.setAlpha(ct.flashlightShadowDefaultAlpha)
    shadow.displayWidth = averageSize
    shadow.displayHeight = averageSize
    enemy.shadow = shadow // Attach shadow to enemy sprite
  }

  private breakObstacleInFront(enemy: EnemySprite, angle: number): void {
    const maxDistance = 2 * enemy.displayHeight
    const stepSize = this.scene.terrainMgr.map.tileWidth / 2

    let nearestObstacle: {
      type: 'tile' | 'mapObject'
      distance: number
      tile?: TerrainTile
      mapObject?: MapObject
      hitX: number
      hitY: number
    } | null = null

    for (
      let distance = stepSize;
      distance <= maxDistance;
      distance += stepSize
    ) {
      const dx = Math.cos(angle) * distance
      const dy = Math.sin(angle) * distance
      const targetX = enemy.x + dx
      const targetY = enemy.y + dy

      // Check for terrain tile
      const tile = this.scene.terrainMgr.terrainLayer.getTileAtWorldXY(
        targetX,
        targetY,
      ) as TerrainTile | null

      // Check for map object (use bounding box or circle collision)
      let foundMapObject: MapObject | undefined
      let foundMapObjectDist = Infinity
      for (const mapObject of this.scene.mapMgr.mapObjects) {
        // Skip map objects with no health
        if (mapObject.health <= 0) continue

        const objX = mapObject.centreX
        const objY = mapObject.centreY
        const avgSize =
          (mapObject.sprite.displayWidth + mapObject.sprite.displayHeight) / 2
        const radius = avgSize / 2
        const distToObj = Phaser.Math.Distance.Between(
          targetX,
          targetY,
          objX,
          objY,
        )
        if (distToObj <= radius) {
          foundMapObject = mapObject
          foundMapObjectDist = distToObj
          break // Only need the first one found at this step
        }
      }

      // If both found, pick the closer one
      if (tile && foundMapObject) {
        const tileCenterX = tile.getCenterX()
        const tileCenterY = tile.getCenterY()
        const distToTile = Phaser.Math.Distance.Between(
          targetX,
          targetY,
          tileCenterX,
          tileCenterY,
        )
        if (distToTile <= foundMapObjectDist) {
          nearestObstacle = {
            type: 'tile',
            distance,
            tile,
            hitX: tileCenterX,
            hitY: tileCenterY,
          }
        } else {
          nearestObstacle = {
            type: 'mapObject',
            distance,
            mapObject: foundMapObject,
            hitX: foundMapObject.centreX,
            hitY: foundMapObject.centreY,
          }
        }
        break
      } else if (tile) {
        const tileCenterX = tile.getCenterX()
        const tileCenterY = tile.getCenterY()
        nearestObstacle = {
          type: 'tile',
          distance,
          tile,
          hitX: tileCenterX,
          hitY: tileCenterY,
        }
        break
      } else if (foundMapObject) {
        nearestObstacle = {
          type: 'mapObject',
          distance,
          mapObject: foundMapObject,
          hitX: foundMapObject.centreX,
          hitY: foundMapObject.centreY,
        }
        break
      }
      // else: nothing found at this step, continue
    }

    if (nearestObstacle) {
      if (nearestObstacle.type === 'tile' && nearestObstacle.tile) {
        // Damage terrain tile
        nearestObstacle.tile.health -= 500
        const tilePixelX = nearestObstacle.tile.x * ct.tileSize
        const tilePixely = nearestObstacle.tile.y * ct.tileSize
        const directionRadians = Phaser.Math.Angle.Between(
          enemy.x,
          enemy.y,
          tilePixelX,
          tilePixely,
        )
        this.enemyHitTerrainSpark(
          (tilePixelX + enemy.x) / 2,
          (tilePixely + enemy.y) / 2,
          0xffffff,
          directionRadians,
          10,
        )
        this.playHitTerrainSound()
        if (nearestObstacle.tile.health <= 0) {
          this.scene.terrainMgr.destroyTile(nearestObstacle.tile)
        }
      } else if (
        nearestObstacle.type === 'mapObject' &&
        nearestObstacle.mapObject
      ) {
        // Damage map object
        nearestObstacle.mapObject.health -= 500
        const directionRadians = Phaser.Math.Angle.Between(
          enemy.x,
          enemy.y,
          nearestObstacle.hitX,
          nearestObstacle.hitY,
        )
        this.enemyHitTerrainSpark(
          (nearestObstacle.hitX + enemy.x) / 2,
          (nearestObstacle.hitY + enemy.y) / 2,
          0xffffff,
          directionRadians,
          10,
        )
        this.playHitTerrainSound()
        if (nearestObstacle.mapObject.health <= 0) {
          this.scene.mapMgr.destroyMapObject(
            nearestObstacle.mapObject,
            directionRadians,
          )
        }
      }
    }
  }

  handleStuckOrTerrainBreaker(
    enemy: EnemySprite,
    angle: number,
    time: number,
    hasWeapons: boolean | undefined,
    enemyData: EnemyData,
  ): void {
    if (!enemy.previousPosition) {
      enemy.previousPosition = { x: enemy.x, y: enemy.y }
      enemy.positionTimestamp = time
      enemy.hasFiredOnStuck = false
    }

    if (time - enemy.positionTimestamp! >= Math.random() * 1000 + 1000) {
      const distanceFromPreviousPosition = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        enemy.previousPosition.x,
        enemy.previousPosition.y,
      )

      if (distanceFromPreviousPosition <= 40 && !enemy.hasFiredOnStuck) {
        if (hasWeapons) {
          const weapon = enemyData.weapons![0]
          this.enemyWeaponFire(enemy, weapon, 0)
        } else {
          this.breakObstacleInFront(enemy, angle)
        }
        enemy.hasFiredOnStuck = true
      } else if (distanceFromPreviousPosition > 40) {
        enemy.hasFiredOnStuck = false
      }

      enemy.previousPosition = { x: enemy.x, y: enemy.y }
      enemy.positionTimestamp = time
    }
  }

  handleEnemyWeaponFire(
    enemy: EnemySprite,
    enemyData: EnemyData,
    distanceToPlayer: number,
    time: number,
  ): void {
    enemyData.weapons!.forEach((weapon, index) => {
      if (
        distanceToPlayer < weapon.maxRange! &&
        time - enemy.lastWeaponFireTime![index] > weapon.fireDelay
      ) {
        this.enemyWeaponFire(enemy, weapon, index)
        enemy.lastWeaponFireTime![index] = time
      }
    })
  }

  handleEnemyAnimation(enemy: EnemySprite, enemyData: EnemyData): void {
    const isMoving =
      enemy.body!.velocity.x !== 0 || enemy.body!.velocity.y !== 0
    const isPlaying = enemy.anims.isPlaying

    if (isMoving) {
      if (!isPlaying) {
        enemy.play(enemyData.walkAnimation)
      }
    } else {
      if (isPlaying) {
        enemy.anims.stop()
      }
    }
  }

  enemyHitTerrainSpark(
    x: number,
    y: number,
    particleTint: number,
    radDirection: number,
    particles: number,
  ) {
    const degDirection = Phaser.Math.RadToDeg(radDirection)
    const reversedDirection = Phaser.Math.Wrap(degDirection + 180, 0, 360)
    const config = createBaseEnemyHitTerrainSparkConfig()
    config.angle = {
      min: reversedDirection - 30,
      max: reversedDirection + 30,
    }
    if (!config) return
    this.scene.enemySparkEmitter!.setConfig(config)
    this.scene.enemySparkEmitter!.setParticleTint(particleTint)
    this.scene.enemySparkEmitter!.emitParticleAt(
      x,
      y,
      particles ? 5 : particles,
    )
  }

  enemyWeaponFire(enemy: EnemySprite, weapon: EnemyWeaponSpec, index: number) {
    // If the AI wants to handle weapon firing (e.g. for ants), let it
    if (enemy.enemyAI && typeof enemy.enemyAI.beforeFireWeapon === 'function') {
      const handled = enemy.enemyAI.beforeFireWeapon(
        enemy,
        this.scene,
        weapon,
        index,
        () => this._actuallyFireWeapon(enemy, weapon, index),
      )
      if (handled) return
    }
    // else directly fire weapon
    this._actuallyFireWeapon(enemy, weapon, index)
  }

  private _actuallyFireWeapon(
    enemy: EnemySprite,
    weapon: EnemyWeaponSpec,
    index: number,
  ) {
    const projectileMgr = this.scene.projectileMgr

    // Handle tracers
    let hasTracer = false
    let tracker = enemy.tracerTracking![index]
    if (weapon.tracerRate) {
      if (weapon.tracerRate === 1) {
        hasTracer = true
      } else {
        if (tracker === undefined) {
          // Initialize the tracer counter for this weapon
          tracker = index * 2
        } else {
          if (tracker >= weapon.tracerRate) {
            tracker = 1
            hasTracer = true
          } else {
            tracker++
          }
        }
        enemy.tracerTracking![index] = tracker
      }
    }

    // Fire the weapon
    if (!!weapon.burstFire && !!weapon.burstFireDelay) {
      for (let i = 0; i < weapon.burstFire; i++) {
        projectileMgr.enemyShot(
          i * weapon.burstFireDelay,
          enemy.x,
          enemy.y,
          enemy.rotation,
          weapon,
          hasTracer,
        )
      }
    } else {
      projectileMgr.enemyShot(
        0,
        enemy.x,
        enemy.y,
        enemy.rotation,
        weapon,
        hasTracer,
      )
    }
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

  playHitTerrainSound(): void {
    const soundInstance = this.scene.sound.add(
      'terrainHit',
    ) as Phaser.Sound.WebAudioSound
    soundInstance.volume = 0.3

    const detune = Phaser.Math.Between(-400, 400)
    soundInstance.play({ detune })
    soundInstance.once('complete', () => {
      soundInstance.destroy()
    })
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
    if (enemyData.deathSoundVol) {
      soundInstance.setVolume(enemyData.deathSoundVol)
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

  switchEnemiesToInfraredColors(): void {
    this.enemies.children.iterate(enemy => {
      const enemySprite = enemy as EnemySprite
      if (enemySprite.enemyData.color) {
        const color = 0xffffff
        enemySprite.setTint(color)
      }
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

  isAnEnemy(obj: any): boolean {
    return 'enemyData' in obj
  }

  updateEnemyShadows(
    playerX: number,
    playerY: number,
    playerRotation: number,
  ): void {
    const playerFacingDirection = playerRotation - Math.PI / 2
    const maxShadowDistance = ct.flashlightRadius * 1.1

    this.enemies.children.iterate(enemyObj => {
      const enemy = enemyObj as EnemySprite
      if (enemy.shadow) {
        const dx = enemy.x - playerX
        const dy = enemy.y - playerY
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy)
        const angleToShadow = Math.atan2(dy, dx)

        const angleDifference = Phaser.Math.Angle.Wrap(
          angleToShadow - playerFacingDirection,
        )

        // Calculate the alpha based on the angle difference and distance
        const coneAngle = (ct.flashlightAngleDegrees * Math.PI) / 180
        const extendedConeAngle = coneAngle * 1.2
        let alpha = 0

        const defaultAlpha = ct.flashlightEnemyShadowDefaultAlpha

        if (distanceToPlayer <= maxShadowDistance) {
          if (Math.abs(angleDifference) <= coneAngle / 2) {
            // Fully inside the cone
            if (distanceToPlayer <= ct.flashlightRadius) {
              alpha = defaultAlpha
            } else {
              // Decrease alpha based on distance beyond flashlightRadius
              const distanceFactor =
                (maxShadowDistance - distanceToPlayer) /
                (maxShadowDistance - ct.flashlightRadius)
              alpha = defaultAlpha * distanceFactor
            }
          } else if (Math.abs(angleDifference) <= extendedConeAngle / 2) {
            // Calculate alpha for the area between the cone and the extended cone
            const normalizedDifference =
              (Math.abs(angleDifference) - coneAngle / 2) /
              (extendedConeAngle / 2 - coneAngle / 2)
            alpha = defaultAlpha - normalizedDifference

            // Further decrease alpha based on distance beyond flashlightRadius
            if (distanceToPlayer > ct.flashlightRadius) {
              const distanceFactor =
                (maxShadowDistance - distanceToPlayer) /
                (maxShadowDistance - ct.flashlightRadius)
              alpha *= distanceFactor
            }
          }
        }

        enemy.shadow.setAlpha(alpha)

        const spriteAverageSize = (enemy.displayWidth + enemy.displayHeight) / 2

        // Position shadow slightly offset from the object's centre
        const shadowOffset = spriteAverageSize / 2
        enemy.shadow.x = enemy.x + Math.cos(angleToShadow) * shadowOffset
        enemy.shadow.y = enemy.y + Math.sin(angleToShadow) * shadowOffset

        const shadowWidth = spriteAverageSize
        const shadowHeight = spriteAverageSize * 3
        enemy.shadow.setDisplaySize(shadowWidth, shadowHeight)

        // Rotate shadow to point away from player
        enemy.shadow.setRotation(angleToShadow + Math.PI / 2)
      }
      return true
    })
  }
}

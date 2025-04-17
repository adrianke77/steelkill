import { Game } from '../scenes/Game'
import { MapObject } from '../interfaces'
import { Constants as ct, weaponConstants } from '../constants'
import { enemyWeapons } from '../constants/weapons'
import {
  EnemySprite,
  Projectile,
  ProjectileLightFields,
  WeaponPosition,
  WeaponSpec,
  SoundTracker,
  EnemyData,
  EnemyWeaponSpec,
  TerrainTile,
} from '../interfaces'
import {
  addFlameToProjectile,
  createLightFlash,
  createBloodSplat,
  destroyEnemyAndCreateCorpseDecals,
  renderExplosion,
  playMuzzleFlare,
  baseProjectileSparkConfig,
  createDustCloud,
} from '../rendering'
import { generateUniqueId, getSoundPan } from '../utils'

export class ProjectileManager {
  private scene: Game
  projectiles: Phaser.GameObjects.Group
  playerTracers: { [key: number]: number } = {}
  sounds: SoundTracker = {}
  soundInstances: { [key: string]: Phaser.Sound.BaseSound } = {}
  repeatingFireSounds: { [key: string]: Phaser.Sound.BaseSound } = {}
  weaponsFiringCount: { [key: string]: number } = {}
  repeatingFireFadeoutSounds: { [key: string]: Phaser.Tweens.Tween } = {}
  activeRepeatingWeaponsByIndex: { [weaponIndex: number]: string | null } = {}

  constructor(scene: Game) {
    this.scene = scene
    this.sounds = {}

    const addWeaponSounds = (weapons: WeaponSpec[] | EnemyWeaponSpec[]) => {
      weapons.forEach(weapon => {
        this.sounds[weapon.fireSound] = []
        if (weapon.explodeSound) {
          this.sounds[weapon.explodeSound] = []
        }
      })
    }

    addWeaponSounds(this.scene.player.weapons)
    addWeaponSounds(Object.values(enemyWeapons))

    this.projectiles = this.scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
    })
  }

  createProjectile(
    x: number,
    y: number,
    angle: number,
    weapon: WeaponSpec | EnemyWeaponSpec,
    hasTracer: boolean,
    enemySource?: boolean,
  ): void {
    const { startX, startY } = calculateProjectileStartPosition(
      x,
      y,
      angle,
      weapon.roundHeight,
    )
    const projectile = this.createProjectileSprite(startX, startY, weapon)
    projectile.weapon = weapon
    projectile.start = [startX, startY]
    if (enemySource) {
      projectile.enemySource = true
    }

    createLightFlash(this.scene, startX, startY, ct.muzzleFlashColor, 1, 2, 100)

    this.setupProjectilePhysics(projectile, weapon)

    const facing = angle - Math.PI / 2
    const spread = weapon.baseSpread
    const forwardAngle = Phaser.Math.FloatBetween(
      facing + spread,
      facing - spread,
    )

    this.setupProjectileDisplay(projectile, weapon, forwardAngle, hasTracer)
    this.setupProjectileMovement(projectile, weapon, forwardAngle)

    if (weapon.hasBoostFlame) {
      this.addBoostFlame(projectile, startX, startY, forwardAngle, weapon)
    }
    this.playWeaponFireSound(weapon, projectile)
  }

  checkRange(projectile: Projectile): boolean {
    const weapon = projectile.weapon
    if (!weapon.maxRange) {
      return false
    }
    const distance = Phaser.Math.Distance.Between(
      projectile.start[0],
      projectile.start[1],
      projectile.x,
      projectile.y,
    )
    if (distance > weapon.maxRange) {
      if (weapon.explodeRadius) {
        this.playExplosionSound(projectile)
        if (projectile.enemySource) {
          this.createExplosionHittingPlayer(projectile.x, projectile.y, weapon)
        } else {
          this.createExplosionHittingEnemy(projectile.x, projectile.y, weapon)
        }
      }
      this.destroyProjectile(projectile)
      return true
    }
    return false
  }

  private createProjectileSprite(
    startX: number,
    startY: number,
    weapon: WeaponSpec | EnemyWeaponSpec,
  ): Projectile {
    // Create the sprite in the effects layer
    const projectile = this.scene.addSpriteEffect(
      startX,
      startY,
      weapon.image,
    ) as Projectile

    // Add it to the physics group
    this.projectiles.add(projectile)
    projectile.setCollideWorldBounds(true)
    projectile.setName('projectile')
    const body = projectile.body as Phaser.Physics.Arcade.Body
    body.onWorldBounds = true
    // make collision body much longer if projectile is fast, to allow proper collision detection
    if (weapon.initialSpeed > 1000) {
      body.setSize(projectile.displayWidth, projectile.displayHeight * 4)
    }
    return projectile
  }

  private setupProjectilePhysics(
    projectile: Projectile,
    weapon: WeaponSpec | EnemyWeaponSpec,
  ): void {
    projectile.damage = weapon.damage
    projectile.penetration = weapon.penetration
    projectile.weapon = weapon
    if (weapon.tint) {
      projectile.setTint(weapon.tint)
    }
    // Add continuous collision detection for fast projectiles
    const body = projectile.body as Phaser.Physics.Arcade.Body
    body.useDamping = true
    body.setCollideWorldBounds(true)
    // Increase number of position iterations for fast moving objects
    body.moves = true
  }

  private setupProjectileDisplay(
    projectile: Projectile,
    weapon: WeaponSpec | EnemyWeaponSpec,
    forwardAngle: number,
    hasTracer: boolean,
  ): void {
    projectile.setDepth(ct.depths.projectile)
    projectile.setRotation(forwardAngle)
    if (hasTracer) {
      this.addLightToProjectile(
        projectile,
        weapon.tracerLightColor!,
        weapon.tracerLightIntensity!,
        'tracerLight',
        weapon.tracerLightRadius,
      )
      projectile.setTint(weapon.tracerProjectileColor!)
      projectile.setDisplaySize(
        weapon.tracerScaleUp! * weapon.roundHeight,
        weapon.tracerScaleUp! * weapon.roundWidth!,
      )
      projectile.hasTracer = true
    } else {
      projectile.setDisplaySize(weapon.roundHeight, weapon.roundWidth)
    }
    if (weapon.lightColor) {
      this.addLightToProjectile(
        projectile,
        weapon.lightColor,
        weapon.lightIntensity!,
        'light',
      )
    }
    if (weapon.trail) {
      this.scene.time.addEvent({
        delay: 5, // Adjust the delay for how frequently to create the trail effect
        callback: () => {
          if (!projectile.active) {
            return
          }
          const trailImage = this.scene.addImageEffect(
            projectile.x,
            projectile.y,
            weapon.image,
          )
          trailImage.setDisplaySize(weapon.roundHeight, weapon.roundWidth)
          trailImage.setRotation(forwardAngle)
          trailImage.setAlpha(0.5) // Initial alpha for the trail image
          trailImage.setPipeline('Light2D')
          if (weapon.trailTint) {
            trailImage.setTint(weapon.trailTint)
          }
          this.scene.tweens.add({
            targets: trailImage,
            alpha: 0,
            duration: weapon.trailDuration,
            onComplete: () => {
              trailImage.destroy()
            },
          })
        },
        callbackScope: this,
        loop: true,
      })
    }
  }

  private setupProjectileMovement(
    projectile: Projectile,
    weapon: any,
    forwardAngle: number,
  ): void {
    projectile.setVelocity(
      weapon.initialSpeed * Math.cos(forwardAngle),
      weapon.initialSpeed * Math.sin(forwardAngle),
    )
    if (weapon.acceleration) {
      projectile.setMaxVelocity(weapon.maxSpeed)
      projectile.setAcceleration(
        weapon.acceleration * Math.cos(forwardAngle),
        weapon.acceleration * Math.sin(forwardAngle),
      )
    }
  }

  private addLightToProjectile(
    projectile: Projectile,
    lightColor: number,
    lightIntensity: number,
    lightName: string,
    lightRadius?: number,
  ): void {
    projectile.setPipeline('Light2D')
    const light = this.scene.lights
      .addLight(projectile.x, projectile.y, 1000)
      .setColor(lightColor)
      .setIntensity(lightIntensity)
    if (lightRadius) {
      light.setRadius(ct.flashlightRadius)
    }
    projectile[lightName as ProjectileLightFields] = light
  }

  private addBoostFlame(
    projectile: Projectile,
    startX: number,
    startY: number,
    forwardAngle: number,
    weapon: WeaponSpec | EnemyWeaponSpec,
  ): void {
    addFlameToProjectile(this.scene, projectile, startX, startY, forwardAngle)
    projectile.setPipeline('Light2D')
    const light = this.scene.lights
      .addLight(projectile.x, projectile.y, projectile.displayWidth * 5)
      .setColor(weapon.boosterLightColor!)
      .setIntensity(weapon.boosterLightIntensity!)
    projectile.flameLight = light
  }

  projectileHitsTarget(
    projectile: Projectile,
    target: EnemySprite | TerrainTile | MapObject,
    // only used for hitting map objects
    collisionBody?: Phaser.GameObjects.Sprite,
  ): boolean {
    const weapon = projectile.weapon

    if (weapon?.explodeRadius) {
      this.playExplosionSound(projectile)
      if (projectile.enemySource) {
        this.createExplosionHittingPlayer(projectile.x, projectile.y, weapon)
      } else {
        this.createExplosionHittingEnemy(projectile.x, projectile.y, weapon)
      }
      this.destroyProjectile(projectile)
      return true
    }

    if (projectile!.penetration > target.armor) {
      this.applyProjectileDamageAndEffectsToTarget(
        projectile,
        target,
        1,
        collisionBody,
      )
      projectile.penetration -= target.armor / 2
      return false
    } else if (projectile!.penetration > target.armor / 2) {
      this.applyProjectileDamageAndEffectsToTarget(
        projectile,
        target,
        0.5,
        collisionBody,
      )
      this.destroyProjectile(projectile)
    } else if (projectile!.penetration < target.armor / 2) {
      this.applyProjectileDamageAndEffectsToTarget(
        projectile,
        target,
        0,
        collisionBody,
      )
      this.destroyProjectile(projectile)
    }
    return true
  }

  projectileHitsPlayer(projectile: Projectile): boolean {
    const player = this.scene.player.mechContainer
    const weapon = projectile.weapon
    // Handle explosion
    if (weapon?.explodeRadius) {
      this.playExplosionSound(projectile)
      this.createExplosionHittingPlayer(
        (projectile.x + player.x) / 2,
        (projectile.y + player.y) / 2,
        weapon,
      )
      this.destroyProjectile(projectile)
      return true
    }

    // Handle penetration
    if (projectile!.penetration > this.scene.player.armor) {
      this.applyProjectileDamageAndEffectsToPlayer(projectile, 1)
      projectile.penetration -= this.scene.player.armor / 2
      return false
    } else if (projectile!.penetration > this.scene.player.armor / 2) {
      this.applyProjectileDamageAndEffectsToPlayer(projectile, 0.5)
      this.destroyProjectile(projectile)
    } else if (projectile!.penetration < this.scene.player.armor / 2) {
      this.destroyProjectile(projectile)
    }
    return true
  }

  isEnemySprite(target: any): target is EnemySprite {
    return target && 'enemyData' in target
  }

  private applyProjectileDamageAndEffectsToTarget(
    projectile: Projectile,
    target: EnemySprite | TerrainTile | MapObject,
    damageFactor: number,
    // only used for hitting map objects
    collisionbody?: Phaser.GameObjects.Sprite,
  ): void {
    const damage = projectile.damage * damageFactor
    if ('entityType' in target && target.entityType === 'mapEntity') {
      target.health -= projectile.damage * damageFactor
      const directionRadians = Phaser.Math.Angle.Between(
        projectile.x,
        projectile.y,
        collisionbody!.x,
        collisionbody!.y,
      )
      this.projectileSpark(
        0.25 * projectile.x + 0.75 * collisionbody!.x,
        0.25 * projectile.y + 0.75 * collisionbody!.y,
        projectile,
        directionRadians,
      )
      if (target.health <= 0) {
        const directionRadians = Phaser.Math.Angle.Between(
          projectile.x,
          projectile.y,
          target.centreX,
          target.centreY,
        )

        this.scene.mapMgr.destroyMapObject(target, directionRadians)
      }
    } else if (target instanceof Phaser.Tilemaps.Tile) {
      const tileData = this.scene.terrainMgr.getTileData(target)
      // pixel target
      const tileX = target.getCenterX()
      const tileY = target.getCenterY()
      // tile coords
      const x = target.x
      const y = target.y
      target.health -= projectile.weapon.terrainDamageMultiplier
        ? damage * projectile.weapon.terrainDamageMultiplier
        : damage
      const directionRadians = Phaser.Math.Angle.Between(
        projectile.x,
        projectile.y,
        tileX,
        tileY,
      )
      this.projectileSpark(
        (projectile.x + tileX) / 2,
        (projectile.y + tileY) / 2,
        projectile,
        directionRadians,
      )
      createDustCloud(
        this.scene,
        (projectile.x + tileX) / 2,
        (projectile.y + tileY) / 2,
        0,
        0,
        1,
        3000,
        200,
        tileData.color,
      )
      if (target.health <= 0) {
        this.scene.terrainMgr.destroyTile(target)
        // Update autotiling around the destroyed tile
        this.scene.terrainMgr.updateAutotileAt(x, y, target.type)
      }
      return
    } else {
      this.applyProjectileDamageAndEffectsToEnemy(
        projectile,
        target as EnemySprite,
        damageFactor,
      )
    }
  }
  private applyProjectileDamageAndEffectsToEnemy(
    projectile: Projectile,
    enemy: EnemySprite,
    damageFactor: number,
  ): void {
    const enemyData = enemy.enemyData as EnemyData
    enemy.health -= projectile.damage * damageFactor
    const directionRadians = Phaser.Math.Angle.Between(
      projectile.x,
      projectile.y,
      enemy.x,
      enemy.y,
    )
    this.projectileSpark(
      0.25 * projectile.x + 0.75 * enemy.x,
      0.25 * projectile.y + 0.75 * enemy.y,
      projectile,
      directionRadians,
      enemyData,
    )
    if (!enemyData.tooSmallToBleedWhenHit) {
      createBloodSplat(
        this.scene,
        projectile.x,
        projectile.y,
        enemyData.bloodColor,
        25,
      )
    }
    if (enemy.health <= 0) {
      const directionRadians = Phaser.Math.Angle.Between(
        projectile.x,
        projectile.y,
        enemy.x,
        enemy.y,
      )
      destroyEnemyAndCreateCorpseDecals(
        this.scene,
        enemy,
        projectile.x,
        projectile.y,
        directionRadians,
      )
    }
  }

  private applyProjectileDamageAndEffectsToPlayer(
    projectile: Projectile,
    damageFactor: number,
  ): void {
    const player = this.scene.player
    player.health -= projectile.damage * damageFactor
    const directionRadians = Phaser.Math.Angle.Between(
      projectile.x,
      projectile.y,
      player.mechContainer.x,
      player.mechContainer.y,
    )
    this.projectileSpark(
      (projectile.x + player.mechContainer.x) / 2,
      (projectile.y + player.mechContainer.y) / 2,
      projectile,
      directionRadians,
    )
  }

  createExplosionHittingEnemy(
    x: number,
    y: number,
    weapon: WeaponSpec | EnemyWeaponSpec,
  ): void {
    const radius = weapon.explodeRadius!
    const baseDamage = weapon.explodeDamage!

    renderExplosion(this.scene, x, y, radius * 2, baseDamage, {
      color: weapon.explodeColor,
      scorchTint: weapon.scorchTint,
      explodeAfterGlowDuration: weapon.explodeAfterGlowDuration,
      explodeAfterGlowTint: weapon.explodeAfterGlowTint,
      explodeAfterGlowIntensity: weapon.explodeAfterGlowIntensity,
      explodeAfterGlowRadius: weapon.explodeAfterGlowRadius,
    })

    // Damage enemies within the explosion radius
    this.scene.enemyMgr.enemies.children.each(
      (enemy: Phaser.GameObjects.GameObject) => {
        const enemySprite = enemy as EnemySprite
        const distance = Phaser.Math.Distance.Between(
          x,
          y,
          enemySprite.x,
          enemySprite.y,
        )
        if (distance <= radius) {
          const damage = baseDamage * (0.5 + 0.5 * (1 - distance / radius))
          const effectiveDamage = Math.max(damage - enemySprite.armor, 0)
          enemySprite.health -= effectiveDamage
          createBloodSplat(
            this.scene,
            enemySprite.x,
            enemySprite.y,
            enemySprite.enemyData.bloodColor,
            100,
          )
          if (enemySprite.health <= 0) {
            const directionRadians = Phaser.Math.Angle.Between(
              x,
              y,
              enemySprite.x,
              enemySprite.y,
            )
            destroyEnemyAndCreateCorpseDecals(
              this.scene,
              enemySprite,
              x,
              y,
              directionRadians,
            )
          } else {
            const angle = Phaser.Math.Angle.Between(
              enemySprite.x,
              enemySprite.y,
              x,
              y,
            )
            // knockback by pixels
            const knockback = (effectiveDamage / enemySprite.health) * 5
            enemySprite.x -= Math.cos(angle) * knockback
            enemySprite.y -= Math.sin(angle) * knockback
          }
        }
        return true
      },
    )

    this.applyDamageToTerrainAndMapObjects(x, y, radius, baseDamage, weapon)
  }

  createExplosionHittingPlayer(
    x: number,
    y: number,
    weapon: WeaponSpec | EnemyWeaponSpec,
  ): void {
    const player = this.scene.player
    const radius = weapon.explodeRadius!
    const baseDamage = weapon.explodeDamage!
    renderExplosion(this.scene, x, y, radius * 2, baseDamage, {
      color: weapon.explodeColor,
      scorchTint: weapon.scorchTint,
      explodeAfterGlowDuration: weapon.explodeAfterGlowDuration,
      explodeAfterGlowTint: weapon.explodeAfterGlowTint,
      explodeAfterGlowIntensity: weapon.explodeAfterGlowIntensity,
      explodeAfterGlowRadius: weapon.explodeAfterGlowRadius,
    })

    // Player damage
    const distance = Phaser.Math.Distance.Between(
      x,
      y,
      player.mechContainer.x,
      player.mechContainer.y,
    )
    if (distance <= radius) {
      const damage = baseDamage * (0.5 + 0.5 * (1 - distance / radius))
      player.damagePlayer(damage - player.armor)
    }

    this.applyDamageToTerrainAndMapObjects(x, y, radius, baseDamage, weapon)
  }

  private applyDamageToTerrainAndMapObjects(
    x: number,
    y: number,
    radius: number,
    baseDamage: number,
    weapon: WeaponSpec | EnemyWeaponSpec,
  ): void {
    // terrain tile damage
    const tiles = this.scene.terrainMgr.map.getTilesWithinWorldXY(
      x - radius,
      y - radius,
      radius * 2,
      radius * 2,
      { isColliding: true },
      undefined,
      this.scene.terrainMgr.terrainLayer,
    )

    if (tiles) {
      tiles.forEach((tileObject: Phaser.Tilemaps.Tile) => {
        const tile = tileObject as TerrainTile
        const tileCenterX = tile.getCenterX()
        const tileCenterY = tile.getCenterY()
        const distance = Phaser.Math.Distance.Between(
          x,
          y,
          tileCenterX,
          tileCenterY,
        )

        if (distance <= radius) {
          let damage = baseDamage * (0.5 + 0.5 * (1 - distance / radius))
          if (weapon.terrainDamageMultiplier) {
            damage = damage * weapon.terrainDamageMultiplier
          }
          // explosions bypass half of armor
          if (damage > tile.armor / 2) {
            const effectiveDamage = damage * 10 - tile.armor / 2
            tile.health -= effectiveDamage

            if (tile.health <= 0) {
              this.scene.terrainMgr.destroyTile(tile)
            }
          }
        }
      })
    }

    for (const mapEntity of this.scene.mapMgr.mapObjects) {
      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        mapEntity.centreX,
        mapEntity.centreY,
      )
      if (distance <= radius) {
        const damage = baseDamage * (0.5 + 0.5 * (1 - distance / radius))

        if (damage > mapEntity.armor / 2) {
          const effectiveDamage = damage * 2 - mapEntity.armor / 2
          mapEntity.health -= effectiveDamage
          if (mapEntity.health <= 0) {
            // Destroy the map object
            const directionRadians = Phaser.Math.Angle.Between(
              x,
              y,
              mapEntity.centreX,
              mapEntity.centreY,
            )

            this.scene.mapMgr.destroyMapObject(mapEntity, directionRadians)
          }
        }
      }
    }
  }

  destroyProjectile(projectile: Projectile): void {
    if (projectile.flame) {
      projectile.flame.destroy()
    }
    if (projectile.light) {
      this.scene.lights.removeLight(projectile.light)
    }
    if (projectile.tracerLight) {
      this.scene.lights.removeLight(projectile.tracerLight)
    }
    if (projectile.flameLight) {
      this.scene.lights.removeLight(projectile.flameLight)
    }
    projectile.destroy()
  }

  projectileSpark(
    x: number,
    y: number,
    projectile: Projectile | undefined,
    radDirection?: number,
    enemyData?: EnemyData,
  ): void {
    const sparkColor = enemyData
      ? Phaser.Math.RND.pick([0xffffff, enemyData.bloodColor])
      : 0xffffff
    this.hitSpark(x, y, sparkColor, radDirection, 5, projectile)
  }

  hitSpark(
    x: number,
    y: number,
    particleTint: number,
    radDirection?: number,
    particles?: number,
    projectile?: Projectile,
    lifespan?: number,
  ): void {
    const config = baseProjectileSparkConfig
    if (radDirection) {
      const degDirection = Phaser.Math.RadToDeg(radDirection)
      // reverse angle so sparks are towards the projectile source
      const reversedDirection = Phaser.Math.Wrap(degDirection + 180, 0, 360)
      config.angle = {
        min: reversedDirection - 30,
        max: reversedDirection + 30,
      }
    } else {
      config.angle = { min: 0, max: 360 }
    }
    config.lifespan = lifespan || 150
    this.scene.projectileSparkEmitter.setConfig(config)
    this.scene.projectileSparkEmitter.setParticleTint(particleTint)
    this.scene.projectileSparkEmitter.emitParticleAt(x, y, particles || 5)
    if (projectile && projectile?.hasTracer) {
      const weapon = projectile.weapon
      createLightFlash(
        this.scene,
        x,
        y,
        weapon.tracerLightColor!,
        weapon.tracerHitFadeTime!,
        weapon.tracerHitLightIntensity!,
        weapon.tracerHitLightRadius!,
      )
    } else {
      createLightFlash(this.scene, x, y, particleTint, 50, 0.5, 100)
    }
  }

  playerShot = (
    delay: number,
    weaponPosition: WeaponPosition,
    weapon: WeaponSpec,
    hasTracer: boolean,
  ) => {
    this.scene.time.delayedCall(delay, () => {
      const rotation = this.scene.player.mechContainer.rotation
      const { startX, startY } = calculateWeaponStartPosition(
        this.scene,
        weaponPosition,
        rotation,
        10,
      )

      this.createProjectile(startX, startY, rotation, weapon, hasTracer)
      playMuzzleFlare(
        this.scene,
        startX,
        startY,
        rotation,
        this.scene.player.mechContainer.body!.velocity.x,
        this.scene.player.mechContainer.body!.velocity.y,
        weapon,
      )
    })
  }

  enemyShot = (
    delay: number,
    x: number,
    y: number,
    angle: number,
    weapon: EnemyWeaponSpec,
    hasTracer: boolean,
  ) => {
    this.scene.time.delayedCall(delay, () => {
      this.createProjectile(x, y, angle, weapon, hasTracer, true)
      playMuzzleFlare(
        this.scene,
        x,
        y,
        angle,
        this.scene.player.mechContainer.body!.velocity.x,
        this.scene.player.mechContainer.body!.velocity.y,
        weapon,
      )
    })
  }

  playWeaponFireSound = (
    weapon: WeaponSpec | EnemyWeaponSpec,
    projectile: Projectile,
  ) => {
    // for repeatingContinuousFireSound weapons, playing the sound is done elsewhere
    if (weapon.repeatingContinuousFireSound) {
      return
    }
    // if same sound was played very recently,
    // increase the sound's volume instead of playing another copy
    // usually only catches weapons firing simultaneously
    if (this.sounds[weapon.fireSound].length > 0) {
      const lastSoundTuple = this.sounds[weapon.fireSound].slice(-1)[0]
      const [, soundInstance, , lastFireTime, soundVolume] = lastSoundTuple
      if (lastFireTime && this.scene.time.now - lastFireTime < 25) {
        const newVol = soundVolume + 0.5
        const sound = soundInstance as Phaser.Sound.WebAudioSound
        sound.setVolume(newVol)
        const lastSoundIndex = this.sounds[weapon.fireSound].length - 1
        this.sounds[weapon.fireSound][lastSoundIndex][4] = newVol
        return
      }
    }
    if (this.sounds[weapon.fireSound].length > 20) {
      const [, sound, projectile] = this.sounds[weapon.fireSound].shift()!
      sound.destroy()
      if (projectile) {
        projectile.setData('fireSoundId', null)
      }
    }
    if (!this.soundInstances[weapon.fireSound]) {
      this.soundInstances[weapon.fireSound] = this.scene.sound.add(
        weapon.fireSound,
      )
    }
    const soundInstance = this.scene.sound.add(weapon.fireSound)
    if (weapon.fireSoundVol) {
      soundInstance.setVolume(weapon.fireSoundVol)
    }
    const uid = generateUniqueId()
    this.sounds[weapon.fireSound].push([
      uid,
      soundInstance,
      projectile,
      this.scene.time.now,
      weapon.fireSoundVol ? weapon.fireSoundVol : 1,
    ])
    projectile.setData('fireSoundInstance', soundInstance)
    const detune = weapon.fireAverageDetune
      ? weapon.fireAverageDetune +
        Phaser.Math.Between(-weapon.fireDetuneRange!, weapon.fireDetuneRange!)
      : Phaser.Math.Between(-100, 100)
    soundInstance.play({ detune })
    soundInstance.once('complete', () => {
      soundInstance.destroy()
      this.sounds[weapon.fireSound].splice(
        this.sounds[weapon.fireSound].findIndex(sound => sound[0] === uid),
        1,
      )
      if (projectile) {
        projectile.setData('fireSoundInstance', null)
      }
    })
  }

  playReloadSound = (weapon: WeaponSpec) => {
    if (!weapon.reloadSound) {
      return
    }
    const soundInstance = this.scene.sound.add(weapon.reloadSound)
    if (weapon.reloadSoundVol) {
      soundInstance.setVolume(weapon.reloadSoundVol)
    }
    soundInstance.play()
  }

  playExplosionSound = (projectile: Projectile) => {
    const weapon = projectile.weapon as WeaponSpec
    const explodeSound = weapon.explodeSound!
    if (this.sounds[explodeSound].length > 6) {
      const [, sound] = this.sounds[explodeSound].shift()!
      sound.destroy()
    }
    const soundInstance = this.scene.sound.add(explodeSound)
    if (weapon.explodeSoundVol) {
      soundInstance.setVolume(weapon.explodeSoundVol)
    }
    const uid = generateUniqueId()
    this.sounds[explodeSound].push([
      uid,
      soundInstance,
      projectile,
      this.scene.time.now,
      weapon.explodeSoundVol ? weapon.explodeSoundVol : 1,
    ])
    const pan = getSoundPan(
      projectile.x,
      projectile.y,
      ...this.scene.player.getPlayerCoords(),
    )

    // Randomize the pitch by setting a random detune value
    const detune = Phaser.Math.Between(-400, 400)
    soundInstance.play({ detune, pan })

    soundInstance.once('complete', () => {
      soundInstance.destroy()
      this.sounds[explodeSound].splice(
        this.sounds[explodeSound].findIndex(sound => sound[0] === uid),
        1,
      )
    })
  }

  private getActiveWeaponCountForSoundKey(soundKey: string): number {
    let count = 0
    for (const weaponIndex in this.activeRepeatingWeaponsByIndex) {
      if (this.activeRepeatingWeaponsByIndex[weaponIndex] === soundKey) {
        count++
      }
    }
    return count
  }

  handleRepeatingFireSound(weaponIndex: number, isActive: boolean) {
    const weapon = this.scene.player.weapons[weaponIndex]
    const soundKey = weapon.fireSound
    const baseVolume = weapon.fireSoundVol || 1

    // 1) Update our activeRepeatingWeaponsByIndex tracking
    if (isActive) {
      this.activeRepeatingWeaponsByIndex[weaponIndex] = soundKey
    } else {
      // If the weapon is set to the same soundKey, clear it
      if (this.activeRepeatingWeaponsByIndex[weaponIndex] === soundKey) {
        this.activeRepeatingWeaponsByIndex[weaponIndex] = null
      }
    }

    // 2) Count how many total weapons are currently using this soundKey
    const count = this.getActiveWeaponCountForSoundKey(soundKey)

    if (count <= 0) {
      // If no weapons are using this sound, fade out or stop if it’s playing
      if (this.repeatingFireSounds[soundKey]) {
        const soundInstance = this.repeatingFireSounds[
          soundKey
        ] as Phaser.Sound.WebAudioSound

        // Start fading out — use a separate object as tween target, so we don't modify the sound directly
        // this prevents issues with the sound being destroyed and the tween still trying to adjust the sound
        this.repeatingFireFadeoutSounds[soundKey] = this.scene.tweens.add({
          targets: { vol: soundInstance.volume || 1 },
          vol: 0,
          duration: 200,
          ease: 'Linear',
          onUpdate: (_, targetObj) => {
            // Only set volume if the sound is still valid
            if (soundInstance && soundInstance.manager) {
              soundInstance.setVolume(targetObj.vol)
            }
          },
          onComplete: () => {
            // Stop and destroy only if the sound still exists
            if (soundInstance && soundInstance.manager) {
              soundInstance.stop()
              soundInstance.destroy()
            }
            delete this.repeatingFireSounds[soundKey]
            delete this.repeatingFireFadeoutSounds[soundKey]
          },
        })
      }
      return
    }

    // If at least one weapon is active...
    // cancel fade out (if any)
    if (this.repeatingFireFadeoutSounds[soundKey]) {
      this.repeatingFireFadeoutSounds[soundKey].stop()
      delete this.repeatingFireFadeoutSounds[soundKey]
      // restore volume if we had a fade-out happening
      if (this.repeatingFireSounds[soundKey]) {
        ;(
          this.repeatingFireSounds[soundKey] as Phaser.Sound.WebAudioSound
        ).setVolume(baseVolume)
      }
    }

    if (!this.repeatingFireSounds[soundKey]) {
      // No existing loop: create one
      this.repeatingFireSounds[soundKey] = this.scene.sound.add(soundKey)
      this.repeatingFireSounds[soundKey].play({
        loop: true,
        volume: baseVolume,
      })
    } else {
      const additionalWeapons: number = count - 1
      // each additional weapon adds 30% of the base volume
      const addedVolume = baseVolume * 0.3 * additionalWeapons
      const newVolume: number = (baseVolume + addedVolume) as number
      ;(
        this.repeatingFireSounds[soundKey] as Phaser.Sound.WebAudioSound
      ).setVolume(newVolume)
    }
  }
}

// asset loading
const loadAssets = (
  scene: Game,
  weapons: Record<string, WeaponSpec | EnemyWeaponSpec>,
) => {
  Object.values(weapons).forEach(weapon => {
    if ('image' in weapon && weapon.image) {
      scene.load.image(weapon.image, `${weapon.image}.png`)
    }
    if ('fireSound' in weapon && weapon.fireSound) {
      scene.load.audio(weapon.fireSound, `audio/${weapon.fireSound}.mp3`)
    }
    if ('explodeSound' in weapon && weapon.explodeSound) {
      scene.load.audio(weapon.explodeSound, `audio/${weapon.explodeSound}.mp3`)
    }
    if ('reloadSound' in weapon && weapon.reloadSound) {
      scene.load.audio(weapon.reloadSound, `audio/${weapon.reloadSound}.mp3`)
    }
  })
}

export const loadProjectileAssets = (scene: Game) => {
  scene.load.image('scorch1', 'scorch2.png')
  loadAssets(scene, weaponConstants)
  loadAssets(scene, enemyWeapons)
}

// these two functions outside ProjectileManager as BeamManager also uses them

export const calculateWeaponStartPosition = (
  scene: Game,
  weaponPosition: WeaponPosition,
  rotation: number,
  forwardOffset: number,
): { startX: number; startY: number } => {
  const offsetX =
    weaponPosition[0] * Math.cos(rotation) -
    weaponPosition[1] * Math.sin(rotation)
  const offsetY =
    weaponPosition[0] * Math.sin(rotation) +
    weaponPosition[1] * Math.cos(rotation)
  const forwardX = forwardOffset * Math.cos(rotation - Math.PI / 2)
  const forwardY = forwardOffset * Math.sin(rotation - Math.PI / 2)
  const startX = scene.player.mechContainer.x + offsetX + forwardX
  const startY = scene.player.mechContainer.y + offsetY + forwardY

  return { startX, startY }
}

export const calculateProjectileStartPosition = (
  x: number,
  y: number,
  angle: number,
  roundHeight: number,
) => {
  const halfLength = roundHeight / 4
  const offsetX = halfLength * Math.cos(angle - Math.PI / 2)
  const offsetY = halfLength * Math.sin(angle - Math.PI / 2)
  return { startX: x + offsetX, startY: y + offsetY }
}

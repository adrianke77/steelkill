// ProjectileManager.ts
import { Game } from '../scenes/Game'
import { Constants as ct, weaponConstants, WeaponKey } from '../constants'
import {
  EnemySprite,
  Projectile,
  ProjectileLightFields,
  WeaponPosition,
  WeaponSpec,
  SoundTracker,
  EnemyData,
} from '../interfaces'
import {
  addFlameToProjectile,
  createLightFlash,
  createBloodSplat,
  destroyEnemyAndCreateCorpseDecals,
  renderExplosion,
  playMuzzleFlare,
  baseProjectileSparkConfig,
} from '../rendering'
import { generateUniqueId, getSoundPan } from '../utils'

export const loadProjectileAssets = (scene: Game) => {
  scene.load.image('scorch1', 'scorch1.png')
  Object.keys(weaponConstants).forEach(weaponKey => {
    const weapon = weaponConstants[weaponKey as WeaponKey] as WeaponSpec
    scene.load.image(weapon.image, `${weapon.image}.png`)
    scene.load.audio(weapon.fireSound, `audio/${weapon.fireSound}.mp3`)
    if (weapon.explodeSound) {
      scene.load.audio(weapon.explodeSound, `audio/${weapon.explodeSound}.mp3`)
    }
    if (weapon.reloadSound) {
      scene.load.audio(weapon.reloadSound, `audio/${weapon.reloadSound}.mp3`)
    }
  })
}

export class ProjectileManager {
  private scene: Game
  projectiles: Phaser.GameObjects.Group
  tracersTracking: { [key: number]: number } = {}
  sounds: SoundTracker = {}
  soundInstances: { [key: string]: Phaser.Sound.BaseSound } = {}

  constructor(scene: Game) {
    this.scene = scene
    this.sounds = {}
    this.scene.player.weapons.forEach(weapon => {
      this.sounds[weapon.fireSound] = []
      if (weapon.explodeSound) {
        this.sounds[weapon.explodeSound] = []
      }
    })
    this.projectiles = this.scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
    })
  }

  playerCreateProjectile(
    x: number,
    y: number,
    angle: number,
    weaponIndex: number,
    hasTracer: boolean,
  ): void {
    const weapon = this.scene.player.weapons[weaponIndex]
    const { startX, startY } = this.calculateProjectileStartPosition(
      x,
      y,
      angle,
      weapon.roundHeight,
    )
    const projectile = this.createProjectile(startX, startY, weapon.image)
    projectile.weapon = weapon

    createLightFlash(this.scene, startX, startY, ct.muzzleFlashColor, 1, 2, 100)

    this.setupProjectilePhysics(projectile, weapon, weaponIndex)

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

  enemyCreateProjectile(
    x: number,
    y: number,
    angle: number,
    enemy: EnemySprite,
  ): void {
    const enemyWeapon = enemy.enemyData.enemyWeapon as WeaponSpec;
    const projectile = this.createProjectile(x, y, enemyWeapon!.image);
    projectile.enemySource = true; // mark it as an enemy projectile
    projectile.damage = enemyWeapon!.damage;

    const forwardAngle = angle - Math.PI / 2;
    this.setupProjectilePhysics(projectile, enemyWeapon, 0); // Set up with enemy weapon

    projectile.setRotation(forwardAngle);
    projectile.setVelocity(
      enemyWeapon.initialSpeed * Math.cos(forwardAngle),
      enemyWeapon.initialSpeed * Math.sin(forwardAngle),
    );

    // Optional: Add effects such as lights, trail, etc.
    if (enemyWeapon.trail) {
      // Add trail similar to player projectiles
      this.setupProjectileDisplay(projectile, enemyWeapon, forwardAngle, false);
    }
  }

  private calculateProjectileStartPosition(
    x: number,
    y: number,
    angle: number,
    roundHeight: number,
  ) {
    const halfLength = roundHeight / 4
    const offsetX = halfLength * Math.cos(angle - Math.PI / 2)
    const offsetY = halfLength * Math.sin(angle - Math.PI / 2)
    return { startX: x + offsetX, startY: y + offsetY }
  }

  private createProjectile(
    startX: number,
    startY: number,
    image: string,
  ): Projectile {
    const projectile = this.scene.createInGroup(
      this.projectiles,
      startX,
      startY,
      image,
    ) as Projectile
    projectile.setCollideWorldBounds(true)
    projectile.setName('projectile')
    ;(projectile.body as Phaser.Physics.Arcade.Body).onWorldBounds = true
    return projectile
  }

  private setupProjectilePhysics(
    projectile: Projectile,
    weapon: WeaponSpec,
    weaponIndex: number,
  ): void {
    projectile.damage = weapon.damage
    projectile.penetration = weapon.penetration
    projectile.weaponIndex = weaponIndex
    if (weapon.tint) {
      projectile.setTint(weapon.tint)
    }
  }

  private setupProjectileDisplay(
    projectile: Projectile,
    weapon: WeaponSpec,
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
          const trailImage = this.scene.addImage(
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
      light.setRadius(lightRadius)
    }
    projectile[lightName as ProjectileLightFields] = light
  }

  private addBoostFlame(
    projectile: Projectile,
    startX: number,
    startY: number,
    forwardAngle: number,
    weapon: WeaponSpec,
  ): void {
    addFlameToProjectile(this.scene, projectile, startX, startY, forwardAngle)
    projectile.setPipeline('Light2D')
    const light = this.scene.lights
      .addLight(projectile.x, projectile.y, projectile.displayWidth * 5)
      .setColor(weapon.boosterLightColor!)
      .setIntensity(weapon.boosterLightIntensity!)
    projectile.flameLight = light
  }

  projectileHitsEnemy(projectile: Projectile, enemy: EnemySprite): boolean {
    const weapon = this.scene.player.weapons[projectile.weaponIndex]
    projectile.setData('weapon', weapon)

    // Handle explosion
    if (weapon?.explodeRadius) {
      this.playExplosionSound(projectile)
      this.createExplosion(
        (projectile.x + enemy.x) / 2,
        (projectile.y + enemy.y) / 2,
        weapon.explodeRadius,
        weapon.explodeDamage!,
      )
      this.destroyProjectile(projectile)
      return true
    }

    // Handle penetration
    if (projectile!.penetration > enemy.armor) {
      this.applyProjectileDamageAndEffects(projectile, enemy, 1)
      projectile.penetration -= enemy.armor / 2
      return false
    } else if (projectile!.penetration > enemy.armor / 2) {
      this.applyProjectileDamageAndEffects(projectile, enemy, 0.3)
      this.destroyProjectile(projectile)
    } else if (projectile!.penetration < enemy.armor / 2) {
      this.destroyProjectile(projectile)
    }
    return true
  }

  private applyProjectileDamageAndEffects(
    projectile: Projectile,
    enemy: EnemySprite,
    damageFactor: number
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
      (projectile.x + enemy.x) / 2,
      (projectile.y + enemy.y) / 2,
      enemyData,
      projectile,
      directionRadians,
    )
    if (!enemyData.tooSmallToBleedWhenHit) {
      createBloodSplat(this.scene, enemy, 20)
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

  createExplosion(
    x: number,
    y: number,
    radius: number,
    baseDamage: number,
  ): void {
    renderExplosion(this.scene, x, y, radius * 2, baseDamage)
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
          enemySprite.health -= Math.max(damage - enemySprite.armor, 0)
          createBloodSplat(this.scene, enemySprite, 30)
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
            enemySprite.x -= Math.cos(angle) * 5
            enemySprite.y -= Math.sin(angle) * 5
          }
        }
        return true
      },
    )
  }

  projectileSpark(
    x: number,
    y: number,
    enemyData: EnemyData,
    projectile: Projectile,
    radDirection?: number,
  ): void {
    this.hitSpark(
      x,
      y,
      Phaser.Math.RND.pick([0xffffff, enemyData.bloodColor]),
      radDirection,
      5,
      projectile,
    )
  }

  hitSpark(
    x: number,
    y: number,
    particleTint: number,
    radDirection?: number,
    particles?: number,
    projectile?: Projectile,
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
    this.scene.projectileSparkEmitter.setConfig(config)
    this.scene.projectileSparkEmitter.setParticleTint(particleTint)
    this.scene.projectileSparkEmitter.emitParticleAt(
      x,
      y,
      particles ? 5 : particles,
    )
    if (projectile?.hasTracer) {
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
      createLightFlash(this.scene, x, y, ct.muzzleFlashColor, 50, 2.5, 80)
    }
  }

  fireWeapon = (
    delay: number,
    weaponPosition: WeaponPosition,
    weaponIndex: number,
    weapon: WeaponSpec,
    hasTracer: boolean,
  ) => {
    this.scene.time.delayedCall(delay, () => {
      const rotation = this.scene.player.mechContainer.rotation
      const offsetX =
        weaponPosition[0] * Math.cos(rotation) -
        weaponPosition[1] * Math.sin(rotation)
      const offsetY =
        weaponPosition[0] * Math.sin(rotation) +
        weaponPosition[1] * Math.cos(rotation)
      const forwardOffset = 10
      const forwardX = forwardOffset * Math.cos(rotation - Math.PI / 2)
      const forwardY = forwardOffset * Math.sin(rotation - Math.PI / 2)
      const startX = this.scene.player.mechContainer.x + offsetX + forwardX
      const startY = this.scene.player.mechContainer.y + offsetY + forwardY

      this.playerCreateProjectile(
        startX,
        startY,
        rotation,
        weaponIndex,
        hasTracer,
      )
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

  playWeaponFireSound = (weapon: WeaponSpec, projectile: Projectile) => {
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
    const detune = Phaser.Math.Between(-100, 100)
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
    const weapon = projectile.getData('weapon') as WeaponSpec
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
}

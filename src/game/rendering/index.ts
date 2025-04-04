import { Game } from '../scenes/Game'
import { brightMuzzleFrames, Constants as ct } from '../constants'
import {
  EnemyData,
  EnemySprite,
  EnemyWeaponSpec,
  Projectile,
  WeaponSpec,
} from '../interfaces'
import { blendColors } from '../utils'

export function loadRenderingAssets(scene: Game) {
  scene.load.spritesheet('boostflame', 'boostflame.png', {
    frameWidth: 107,
    frameHeight: 48,
  })
  scene.load.spritesheet('blood', 'greyblood.png', {
    frameWidth: 50,
    frameHeight: 50,
  })
  scene.load.spritesheet('explosion', 'explosion.png', {
    frameWidth: 100,
    frameHeight: 96,
  })
  scene.load.spritesheet('muzzleflash', 'muzzleflash.png', {
    frameWidth: 165,
    frameHeight: 165,
  })
  scene.load.image('dust', 'dust.png')
}

export const baseProjectileSparkConfig = {
  lifespan: 150,
  speed: { min: 0, max: 300 },
  scale: { start: 4, end: 0 },
  rotate: { start: 0, end: 360 },
  emitting: false,
} as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig

export const baseDeathSprayConfig = {
  lifespan: 1000,
  scale: { start: 5, end: 0 },
  rotate: { start: 0, end: 360 },
  alpha: { start: 1, end: 0.2 },
  accelerationX: (particle: Phaser.GameObjects.Particles.Particle) =>
    -particle.velocityX, // Decelerate X
  accelerationY: (particle: Phaser.GameObjects.Particles.Particle) =>
    -particle.velocityY, // Decelerate Y
  emitting: false,
} as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig

export const secondaryEnemyDeathSprayConfig = {
  lifespan: 1000,
  scale: { start: 0.3, end: 0 },
  rotate: { start: 0, end: 360 },
  alpha: { start: 1, end: 0.2 },
  accelerationX: (particle: Phaser.GameObjects.Particles.Particle) =>
    -particle.velocityX, // Decelerate X
  accelerationY: (particle: Phaser.GameObjects.Particles.Particle) =>
    -particle.velocityY, // Decelerate Y
  emitting: false,
} as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig

export function createEmittersAndAnimations(scene: Game) {
  const graphics = scene.add.graphics()
  graphics.fillStyle(0xffffff, 1)
  graphics.fillCircle(0, 0, 20)
  graphics.generateTexture('whiteParticle', 1, 1)
  graphics.destroy()

  scene.projectileSparkEmitter = scene.addParticles(
    0,
    0,
    'whiteParticle',
    baseProjectileSparkConfig,
  )
  scene.projectileSparkEmitter.setDepth(ct.depths.projectileSpark)
  scene.projectileSparkEmitter.setPipeline('Light2D')

  scene.enemyDeathSprayEmitter = scene.addParticles(
    0,
    0,
    'whiteParticle',
    baseDeathSprayConfig,
  )
  scene.enemyDeathSprayEmitter.setDepth(ct.depths.bloodSpray)
  scene.enemyDeathSprayEmitter.setPipeline('Light2D')

  scene.secondaryEnemyDeathSprayEmitter = scene.addParticles(
    0,
    0,
    'whiteParticle',
    baseDeathSprayConfig,
  )
  scene.secondaryEnemyDeathSprayEmitter.setDepth(ct.depths.bloodSpray)
  scene.secondaryEnemyDeathSprayEmitter.setPipeline('Light2D')

  scene.anims.create({
    key: 'whiteant8',
    frames: scene.anims.generateFrameNumbers('whiteant8', { start: 0, end: 7 }),
    frameRate: 20,
    repeat: -1,
  })

  scene.anims.create({
    key: 'boostflame',
    frames: scene.anims.generateFrameNumbers('boostflame', {
      start: 0,
      end: 30,
    }),
    frameRate: 24,
    repeat: -1,
  })

  scene.anims.create({
    key: 'explosion',
    frames: scene.anims.generateFrameNumbers('explosion', {
      start: 0,
      end: 35,
    }),
    frameRate: 75,
    repeat: 0,
  })

  scene.anims.create({
    key: 'blood',
    frames: scene.anims.generateFrameNumbers('blood', { start: 0, end: 8 }),
    frameRate: 500,
    repeat: -1,
  })

  scene.anims.create({
    key: 'muzzleflash',
    frames: scene.anims.generateFrameNumbers('muzzleflash', {
      start: 0,
      end: 27,
    }),
    frameRate: 100,
    repeat: -1,
  })

  scene.bloodFrameNames = scene.anims
    .get('blood')
    .frames.map(frame => frame.frame.name)
}

export function drawDecal(scene: Game, image: Phaser.GameObjects.Image) {
  if (scene.combinedDecals.length === 0) {
    addCombinedDecal(scene)
  }
  if (scene.decalCount >= ct.decalsPerCombinedDecal) {
    tweenFadeDecal(scene, scene.combinedDecals.shift()!)
    addCombinedDecal(scene)
  }
  const currentTexture = scene.combinedDecals.slice(-1)[0].texture
  // strip existing Light 2d pipelines else this will affect the drawn image
  image.resetPipeline()
  image.clearAlpha()
  currentTexture.draw(image, image.x, image.y)
  image.destroy()
  scene.decalCount++
}

function addCombinedDecal(scene: Game) {
  const combinedTexture = new Phaser.GameObjects.RenderTexture(
    scene,
    0,
    0,
    scene.mapWidth,
    scene.mapHeight
  );
  const combinedDecalsImage = scene.addImage(0, 0, combinedTexture.texture)
  combinedDecalsImage.setOrigin(0, 0)
  combinedDecalsImage.setPipeline('Light2D')
  combinedDecalsImage.setDepth(ct.depths.decals)
  scene.decalCount = 0
  scene.combinedDecals.push({
    texture: combinedTexture,
    image: combinedDecalsImage,
  })
}

export function playMuzzleFlare(
  scene: Game,
  x: number,
  y: number,
  rotation: number,
  velocityX: number,
  velocityY: number,
  weapon: WeaponSpec | EnemyWeaponSpec,
): void {
  const flare = scene.addSpriteEffect(x, y, 'muzzleflash')
  flare.rotation = rotation - Math.PI / 2 // Adjust rotation to match mechContainer's direction
  const size = weapon.muzzleFlashSize ? 25 * weapon.muzzleFlashSize : 25
  flare.displayHeight = size
  flare.displayWidth = size
  const randomFrame = Phaser.Math.RND.pick(brightMuzzleFrames)
  flare.setFrame(randomFrame)
  flare.setPipeline('Light2D')

  scene.physics.add.existing(flare)
  const body = flare.body as Phaser.Physics.Arcade.Body
  body.setVelocity(velocityX, velocityY)

  createLightFlash(
    scene,
    x,
    y,
    ct.muzzleFlashColor,
    2,
    10,
    weapon.muzzleFlashSize ? weapon.muzzleFlashSize * 25 : 25,
  )
  scene.time.delayedCall(60, () => flare.destroy())
}

export function addFlameToProjectile(
  scene: Game,
  projectile: Projectile,
  x: number,
  y: number,
  forwardAngle: number,
) {
  const offsetX = Math.cos(forwardAngle) * projectile.displayHeight
  const offsetY = Math.sin(forwardAngle) * projectile.displayHeight
  const flame = scene.addSpriteEffect(x - offsetX, y - offsetY, 'boostflame')
  flame.setDisplaySize(projectile.displayWidth, projectile.displayHeight / 2)
  flame.setAngle(Phaser.Math.RadToDeg(forwardAngle - Math.PI)) // Set the angle of the flame to match the projectile's direction
  flame.play('boostflame')
  projectile.flame = flame
  projectile.flameOffsets = {
    x: offsetX,
    y: offsetY,
  }
  flame.setDepth(projectile.depth - 1)
  flame.setPipeline('Light2D')
}

export function createDustCloud(
  scene: Game,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  opacity: number,
  duration?: number,
  size?: number,
  tint?: number,
  skipProximityCheck?: boolean,
): void {
  if (!skipProximityCheck) {
    // Check for nearby dust clouds first
    const proximityThreshold = 20 // Adjust this value based on desired minimum distance
    const nearbyCloud = scene.viewMgr.dustClouds.getChildren().some(cloud => {
      const distance = Phaser.Math.Distance.Between(x, y, cloud.x, cloud.y)
      return distance < proximityThreshold
    })

    // Skip creation if nearby cloud found
    if (nearbyCloud) {
      return
    }
  }

  const dustCloud = scene.addSprite(x, y, 'dust')
  const initialSize = size !== undefined ? size / 2 : 50
  const finalSize = size

  const initialRotation = Phaser.Math.Between(0, 2 * Math.PI)
  const finalRotation =
    initialRotation + Phaser.Math.Between(-Math.PI / 16, Math.PI / 16)

  dustCloud.setRotation(initialRotation)
  dustCloud.setAlpha(opacity)
  dustCloud.setDisplaySize(initialSize, initialSize)
  dustCloud.setVelocity(directionX / 2, directionY / 2)
  dustCloud.setPipeline('Light2D', { lightFactor: 0.1 })
  dustCloud.setDepth(ct.depths.dustClouds)
  if (tint) {
    dustCloud.setTint(tint)
  }
  scene.viewMgr.dustClouds.add(dustCloud)
  if (scene.viewMgr.infraredIsOn) {
    dustCloud.visible = false
  }

  scene.tweens.add({
    targets: dustCloud,
    displayWidth: { from: initialSize, to: finalSize },
    displayHeight: { from: initialSize, to: finalSize },
    rotation: { from: initialRotation, to: finalRotation },
    duration: 1000, // Duration for the expansion in milliseconds
    ease: 'Quad.easeOut', // Easing function for smooth expansion
  })

  scene.tweens.add({
    targets: dustCloud,
    alpha: 0,
    displayWidth: finalSize,
    displayHeight: finalSize,
    duration: duration ? duration : 500,
    ease: 'Quad.easeOut',
    onComplete: () => {
      dustCloud.destroy()
    },
  })
}
export function createLightFlash(
  scene: Game,
  x: number,
  y: number,
  color: number,
  duration: number,
  intensity: number,
  radius: number,
): void {
  const flash = scene.lights.addLight(x, y, radius, color, intensity)

  scene.tweens.add({
    targets: flash,
    intensity: { from: intensity, to: 0 },
    radius: { from: radius, to: radius / 2 },
    duration: duration,
    onComplete: () => {
      scene.lights.removeLight(flash)
    },
  })
}

export function createBloodSplat(
  scene: Game,
  x: number,
  y: number,
  bloodColor: number,
  splatSize: number,
) {
  const bloodSplat = scene.addImage(
    x,
    y,
    'blood',
    Phaser.Utils.Array.GetRandom(scene.bloodFrameNames, 4),
  )
  bloodSplat.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
  bloodSplat.displayHeight = splatSize
  bloodSplat.displayWidth = splatSize
  bloodSplat.setTint(bloodColor)
  bloodSplat.setPipeline('Light2D')
  bloodSplat.setAlpha(1)
  drawDecal(scene, bloodSplat)
}
export function destroyEnemyAndCreateCorpseDecals(
  scene: Game,
  enemy: EnemySprite,
  deathCauseX: number,
  deathCauseY: number,
  radDirection?: number,
): void {
  const enemyData = enemy.enemyData as EnemyData
  if (!!enemy.randomSoundId && !!enemy.randomSound) {
    scene.enemyMgr.untrackRandomSound(enemy)
    enemy.randomSound.destroy()
  }
  enemy.destroy()
  createBloodSplat(
    scene,
    enemy.x,
    enemy.y,
    enemyData.bloodColor,
    enemyData.corpseSize * 1.5,
  )
  const deadEnemy = scene.addImage(enemy.x, enemy.y, enemyData.corpseImage, 8)
  deadEnemy.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
  deadEnemy.displayHeight = enemyData.corpseSize
  deadEnemy.displayWidth = enemyData.corpseSize
  deadEnemy.alpha = 0.5
  deadEnemy.setTint(enemyData.color)
  deadEnemy.setPipeline('Light2D')
  drawDecal(scene, deadEnemy)
  enemyDeathSpray(
    scene,
    (enemy.x + deathCauseX) / 2,
    (enemy.y + deathCauseY) / 2,
    enemyData,
    radDirection,
  )
  scene.enemyMgr.playDeathSound(enemy)
}

export function enemyDeathSpray(
  scene: Game,
  x: number,
  y: number,
  enemyData: EnemyData,
  radDirection?: number,
): void {
  // Always do one pass emitting 360° spray
  baseDeathSprayConfig.angle = {
    min: 0,
    max: 360,
  }
  baseDeathSprayConfig.speed = {
    min: enemyData.corpseSize * 0.2,
    max: enemyData.corpseSize * 1.0,
  }
  scene.enemyDeathSprayEmitter.setConfig(baseDeathSprayConfig)
  scene.enemyDeathSprayEmitter.setParticleTint(
    blendColors(enemyData.bloodColor, 0x000000, 0.6),
  )
  scene.enemyDeathSprayEmitter.emitParticleAt(x, y, enemyData.corpseSize / 2)

  // If we have a particular direction, emit extra particles more densely weighted around that angle
  if (radDirection !== undefined) {
    const degDirection = Phaser.Math.RadToDeg(radDirection)

    // Emit a second pass focusing on a narrower cone around radDirection
    baseDeathSprayConfig.angle = {
      min: degDirection - 40,
      max: degDirection + 40,
    }
    baseDeathSprayConfig.speed = {
      min: enemyData.corpseSize * 0.3,
      max: enemyData.corpseSize * 1.2,
    }
    scene.enemyDeathSprayEmitter.setConfig(baseDeathSprayConfig)
    scene.enemyDeathSprayEmitter.setParticleTint(
      blendColors(enemyData.bloodColor, 0x000000, 0.6),
    )
    scene.enemyDeathSprayEmitter.emitParticleAt(x, y, enemyData.corpseSize / 2)

    // Emit additional corpse fragments in a slightly wider range around radDirection
    baseDeathSprayConfig.angle = {
      min: degDirection - 60,
      max: degDirection + 60,
    }
    baseDeathSprayConfig.speed = {
      min: enemyData.corpseSize * 0.2,
      max: enemyData.corpseSize * 1.0,
    }
    scene.enemyDeathSprayEmitter.setConfig(baseDeathSprayConfig)
    scene.enemyDeathSprayEmitter.setParticleTint(
      blendColors(enemyData.color, 0x000000, 0.2),
    )
    scene.enemyDeathSprayEmitter.emitParticleAt(x, y, enemyData.corpseSize / 2)
  }

  // Also fire the secondary emitter for additional fragments/debris in all directions
  secondaryEnemyDeathSprayConfig.angle = { min: 0, max: 360 }
  secondaryEnemyDeathSprayConfig.speed = {
    min: enemyData.corpseSize * 0.1,
    max: enemyData.corpseSize * 0.8,
  }
  scene.secondaryEnemyDeathSprayEmitter.setConfig(
    secondaryEnemyDeathSprayConfig,
  )
  scene.secondaryEnemyDeathSprayEmitter.setParticleTint(
    blendColors(enemyData.color, 0x000000, 0.2),
  )
  scene.secondaryEnemyDeathSprayEmitter.emitParticleAt(
    x,
    y,
    enemyData.corpseSize,
  )
}
export function tweenFadeDecal(
  scene: Game,
  combinedDecal: {
    texture: Phaser.GameObjects.RenderTexture
    image: Phaser.GameObjects.Image
  },
) {
  scene.tweens.add({
    targets: combinedDecal.image,
    alpha: 0,
    duration: ct.DecalFadeTime,
    ease: 'Quadratic.In',
    onComplete: () => {
      combinedDecal.image.destroy()
      combinedDecal.texture.destroy()
    },
  })
}

export function renderExplosion(
  scene: Game,
  x: number,
  y: number,
  diameter: number,
  damage: number,
  optionals?: {
    color?: number
    scorchTint?: number
    explodeAfterGlowDuration?: number
    explodeAfterGlowTint?: number
    explodeAfterGlowIntensity?: number
    explodeAfterGlowRadius?: number
  },
) {
  const explosion = scene.addSpriteEffect(x, y, 'explosion')
  explosion.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
  const displayDiameter = Phaser.Math.FloatBetween(
    diameter * 1.2,
    diameter * 0.8,
  )
  explosion.displayHeight = displayDiameter + 10
  explosion.displayWidth = displayDiameter + 10
  explosion.setDepth(ct.depths.explosion)
  if (optionals && optionals.color) {
    explosion.setTint(optionals.color)
  }
  explosion.setAlpha(Phaser.Math.FloatBetween(0.6, 0.9))
  explosion.play('explosion')
  const scorch = scene.addImage(x, y, 'scorch1')
  scorch.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
  scorch.displayHeight = displayDiameter + 10
  scorch.displayWidth = displayDiameter + 10
  scorch.setAlpha(0.8)
  scorch.setTint(
    optionals && optionals.scorchTint ? optionals.scorchTint : 0x000000,
  )
  scorch.setPipeline('Light2D')
  drawDecal(scene, scorch)
  createLightFlash(
    scene,
    x,
    y,
    optionals && optionals.color ? optionals.color : ct.explosionColor,
    150,
    damage / 60,
    diameter * 3,
  )
  createDustCloud(scene, x, y, 0, 0, 0.5, 4000, diameter * 1.4, undefined, true)

  if (optionals && optionals.explodeAfterGlowDuration) {
    createLightFlash(
      scene,
      x,
      y,
      optionals.explodeAfterGlowTint!,
      optionals.explodeAfterGlowDuration,
      optionals.explodeAfterGlowIntensity!,
      optionals.explodeAfterGlowRadius!,
    )
  }
}

export function addCloudAtPlayermech(scene: Game, opacity: number): void {
  const currentPosX = scene.player.mechContainer.body!.position.x
  const currentPosY = scene.player.mechContainer.body!.position.y
  createDustCloud(
    scene,
    currentPosX + scene.player.playerMech.displayWidth / 2,
    currentPosY + scene.player.playerMech.displayHeight / 2,
    scene.player.mechContainer.body!.velocity.x,
    scene.player.mechContainer.body!.velocity.y,
    opacity,
    2000,
    200,
    undefined,
    true,
  )
}

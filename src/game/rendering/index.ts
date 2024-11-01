66 // renderUtils.ts
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
  lifespan: 100,
  speed: { min: 250, max: 500 },
  scale: { start: 0.4, end: 0 },
  rotate: { start: 0, end: 360 },
  emitting: false,
} as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig

export const baseDeathBurstConfig = {
  lifespan: 500,
  speed: { min: 200, max: 400 },
  scale: { start: 0.4, end: 0 },
  rotate: { start: 0, end: 360 },
  accelerationX: 50,
  accelerationY: 50,
  emitting: false,
} as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig

export function createEmittersAndAnimations(scene: Game) {
  const graphics = scene.add.graphics()
  graphics.fillStyle(0xffffff, 1)
  graphics.fillCircle(0, 0, 20)
  graphics.generateTexture('whiteParticle', 20, 20)
  graphics.destroy()

  scene.projectileSparkEmitter = scene.addParticles(
    0,
    0,
    'whiteParticle',
    baseProjectileSparkConfig,
  )
  scene.projectileSparkEmitter.setDepth(ct.depths.projectileSpark)
  scene.projectileSparkEmitter.setPipeline('Light2D')

  scene.enemyDeathBurstEmitter = scene.addParticles(
    0,
    0,
    'whiteParticle',
    baseDeathBurstConfig,
  )
  scene.enemyDeathBurstEmitter.setDepth(ct.depths.projectileSpark)
  scene.enemyDeathBurstEmitter.setPipeline('Light2D')

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
    tweenFade(scene, scene.combinedDecals.shift()!)
    addCombinedDecal(scene)
  }
  scene.combinedDecals.slice(-1)[0].texture.draw(image, image.x, image.y)
  image.destroy()
  scene.decalCount++
}

function addCombinedDecal(scene: Game) {
  const combinedTexture = scene.add.renderTexture(
    0,
    0,
    ct.fieldHeight,
    ct.fieldWidth,
  )
  combinedTexture.setBlendMode(Phaser.BlendModes.NORMAL)
  const combinedDecalsImage = scene.addImage(0, 0, combinedTexture.texture)
  combinedDecalsImage.setOrigin(0, 0)
  combinedDecalsImage.setPipeline('Light2D')
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
  const flare = scene.addSprite(x, y, 'muzzleflash')
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
  const flame = scene.addSprite(x - offsetX, y - offsetY, 'boostflame')
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
): void {
  const dustCloud = scene.addSprite(x, y, 'dust')
  const initialSize = size ? size : 50
  const finalSize = initialSize * 2

  const initialRotation = Phaser.Math.Between(0, 2 * Math.PI)
  const finalRotation =
    initialRotation + Phaser.Math.Between(-Math.PI / 8, Math.PI / 8)

  dustCloud.setRotation(initialRotation)
  dustCloud.setAlpha(opacity)
  dustCloud.setDisplaySize(initialSize, initialSize)
  dustCloud.setVelocity(directionX / 2, directionY / 2)
  dustCloud.setPipeline('Light2D')
  dustCloud.setDepth(ct.depths.dustClouds)

  scene.tweens.add({
    targets: dustCloud,
    displayWidth: { from: initialSize, to: finalSize },
    displayHeight: { from: initialSize, to: finalSize },
    rotation:{from: initialRotation, to: finalRotation},
    duration: 1000, // Duration for the expansion in milliseconds
    ease: 'Cubic.easeOut', // Easing function for smooth expansion
  })

  scene.tweens.add({
    targets: dustCloud,
    alpha: 0,
    displayWidth: initialSize,
    displayHeight: initialSize,
    duration: duration ? duration : 1000,
    ease: 'Linear',
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
  enemy: EnemySprite,
  splatSize: number,
) {
  const enemyData = enemy.enemyData as EnemyData
  const bloodSplat = scene.addImage(
    enemy.x,
    enemy.y,
    'blood',
    Phaser.Utils.Array.GetRandom(scene.bloodFrameNames),
  )
  bloodSplat.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
  bloodSplat.displayHeight = splatSize
  bloodSplat.displayWidth = splatSize
  bloodSplat.setTint(enemyData.bloodColor)
  bloodSplat.setPipeline('Light2D')
  bloodSplat.setAlpha(0.8)
  drawDecal(scene, bloodSplat)
  // tweenFade(scene, bloodSplat)
}

export function destroyEnemyAndCreateCorpseDecals(
  scene: Game,
  enemy: EnemySprite,
  deathCauseX: number,
  deathCauseY: number,
  radDirection?: number,
): void {
  if (!!enemy.randomSoundId && !!enemy.randomSound) {
    scene.enemyMgr.untrackRandomSound(enemy)
    enemy.randomSound.destroy()
  }
  enemy.destroy()
  createBloodSplat(scene, enemy, enemy.enemyData.corpseSize * 2)
  const enemyData = enemy.enemyData as EnemyData
  const deadEnemy = scene.addImage(enemy.x, enemy.y, enemyData.corpseImage, 8)
  deadEnemy.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
  deadEnemy.displayHeight = enemyData.corpseSize
  deadEnemy.displayWidth = enemyData.corpseSize
  deadEnemy.setTint(enemyData.color)
  deadEnemy.setPipeline('Light2D')
  drawDecal(scene, deadEnemy)
  enemyDeathBurst(
    scene,
    (enemy.x + deathCauseX) / 2,
    (enemy.y + deathCauseY) / 2,
    enemyData,
    radDirection,
  )
  scene.enemyMgr.playDeathSound(enemy)
}

function enemyDeathBurst(
  scene: Game,
  x: number,
  y: number,
  enemyData: EnemyData,
  radDirection?: number,
): void {
  const config = baseDeathBurstConfig
  if (radDirection) {
    const degDirection = Phaser.Math.RadToDeg(radDirection)
    config.angle = { min: degDirection - 30, max: degDirection + 30 }
  } else {
    config.angle = { min: 0, max: 360 }
  }
  scene.enemyDeathBurstEmitter.setConfig(config)
  scene.enemyDeathBurstEmitter.setParticleTint(
    blendColors(enemyData.bloodColor, 0x000000, Math.random()),
  )
  scene.enemyDeathBurstEmitter.emitParticleAt(x, y, 20)
}

export function tweenFade(
  scene: Game,
  combinedDecal: {
    texture: Phaser.GameObjects.RenderTexture
    image: Phaser.GameObjects.Image
  },
) {sssss
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
  const explosion = scene.addSprite(x, y, 'explosion')
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
  explosion.setAlpha(Phaser.Math.FloatBetween(0.7, 0.9))
  explosion.play('explosion')
  const scorch = scene.addSprite(x, y, 'scorch1')
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
    200,
    damage / 3,
    diameter * 2,
  )
  createDustCloud(scene, x, y, 0, 0, 0.5, 2000, diameter * 2)

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
  )
}

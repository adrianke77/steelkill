export interface WeaponSpec {
  name: string
  fireDelay: number
  image: string
  initialSpeed: number
  acceleration?: number
  maxSpeed?: number
  baseSpread: number
  roundHeight: number
  roundWidth: number
  damage: number
  penetration: number
  totalAmmo: number
  magSize: number
  reloadDelay: number
  maxRange?: number
  explodeRadius?: number
  explodeDamage?: number
  explodeSound?: string
  explodeSoundVol?: number
  explodeColor?: number
  burstFire?: number
  burstFireDelay?: number
  hasBoostFlame?: boolean
  boosterLightColor?: number
  boosterLightIntensity?: number
  muzzleFlashSize?: number
  tint?: number
  lightColor?: number
  lightIntensity?: number
  trail?: boolean
  trailDuration?: number
  trailTint?: number
  fireSound: string
  fireSoundVol?: number
  stopFireSoundOnHit?: boolean
  reloadSound: string
  reloadSoundVol?: number
  tracerRate?: number
  tracerLightColor?: number
  tracerLightIntensity?: number
  tracerProjectileColor?: number
  tracerLightRadius?: number
  tracerScaleUp?: number
  tracerHitFadeTime?: number
  tracerHitLightRadius?: number
  tracerHitLightIntensity?: number
}

export interface EnemyWeaponSpec
  extends Omit<
    WeaponSpec,
    'totalAmmo' | 'magSize' | 'reloadDelay' | 'reloadSound'
  > {}

export interface EnemyData {
  spawnPeriod: number
  speed: number
  health: number
  armor: number
  displaySize: number
  collisionSize: number
  bloodColor: number
  color: number
  walkAnimation: string
  corpseImage: string
  corpseSize: number
  spriteSheetKey: string
  directionTimerMax: number
  directionTimerMin: number
  randomSound?: string
  randomSoundChance?: number
  randomSoundVol?: number
  randomSoundLikelihood?: number // Likelihood of sound happening per direction change
  deathSound: string
  deathSoundVol?: number
  hitDamage: number
  hitDelay: number
  hitSound: string
  tooSmallToBleedWhenHit?: boolean
  weapons?: EnemyWeaponSpec[]
}

export interface EnemyDataMap {
  [key: string]: EnemyData
}

export interface EnemySprite extends Phaser.Physics.Arcade.Sprite {
  // adding data to the sprite here
  // as data manager data seems to disappear in collider callbacks
  health: number
  armor: number
  enemyData: EnemyData
  direction: string
  randomSound?: Phaser.Sound.WebAudioSound
  randomSoundId: string
  lastHitTime: number
  tracerTracking?: number[]
  lastWeaponFireTime?: number[]
}

export interface Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number
  penetration: number
  weaponIndex: number
  light: Phaser.GameObjects.Light
  tracerLight: Phaser.GameObjects.Light
  flameLight: Phaser.GameObjects.Light
  flame: Phaser.GameObjects.Sprite
  flameOffsets: {
    x: number
    y: number
  }
  weapon: WeaponSpec | EnemyWeaponSpec
  hasTracer?: boolean
  enemySource?: boolean
}

export type ProjectileLightFields = 'light' | 'flameLight' | 'tracerLight'

export type FourPositions = 'front' | 'back' | 'left' | 'right'

export type WeaponPosition = number[]

// uid, soundinstance, related sprite, the time sound started, last volume set
type SoundTuple = [
  string,
  Phaser.Sound.BaseSound,
  Projectile | EnemySprite,
  number,
  number,
]

export type SoundTracker = { [key: string]: SoundTuple[] }

export type DataFromReact = [string, any]

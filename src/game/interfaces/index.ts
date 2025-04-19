export interface ExtendedSprite extends Phaser.GameObjects.Sprite {
  originalAlpha?: number;
  originalTint?: number;
}

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
  terrainDamageMultiplier?: number
  terrainPenetrationMultiplier?: number
  totalAmmo: number
  magSize: number
  reloadDelay: number
  maxRange?: number
  explodeRadius?: number
  explodeDamage?: number
  explodeSound?: string
  explodeSoundVol?: number
  explodeDetuneMin?:number
  explodeDetuneMax?:number
  explodeColor?: number
  explodeAfterGlowDuration?: number
  explodeAfterGlowTint?: number
  explodeAfterGlowIntensity?: number
  explodeAfterGlowRadius?: number
  scorchTint?: number
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
  // firesounds must be unique for repeating sound weapons
  fireSound: string
  fireSoundVol: number
  fireDetuneRange?: number
  fireAverageDetune?: number
  repeatingContinuousFireSound?: boolean
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
  // beam attributes apply for both beam and lightning weapons
  isBeam?: boolean
  beamColor?: number
  beamWidth?: number
  beamParticleInitialSize?: number
  beamParticlesColor?: number
  beamParticlesDensity?: number // number of emitters along the length of the beam generating particles
  beamParticlesFadeTime?: number // time in ms for particles to fade out
  beamGlowWidth?: number // width of the glow around the beam
  beamGlowColor?: number // color of the glow around the beam
  beamGlowAlpha?: number // alpha of the glow around the beam
  beamLightRadius?: number // radius of point lights along beam
  beamLightIntensity?: number // intensity of point lights along beam
  beamHitLightRadius?: number // radius of point light at hit point
  beamHitLightIntensity?: number // intensity of point light at hit point
  renderAsLightning?: boolean
  lightningSegments?: number // number of segments in lightning beam
  lightningDisplacement?: number // magnitude of offsets of lightning segment points
  arcTargeting?: boolean // if true, enemy targets is selected from nearest one within an arc in front of the player
  arcTargetingAngle?: number // angle of the arc in front of the player in degrees
  chaining?: boolean // if true, beam will chain to nearby enemies
  chainRange?:number // max range of chain
  randomFlash?: number // chance of particles producing a random flash, only for beam weapons
  hasUnstableAmmoCount?: boolean // if true, ammo count will be unstable
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
  displayHeight: number
  displayWidth: number
  collisionSize: number
  bloodColor: number
  color?: number
  walkAnimation: string
  corpseImage: string
  corpseSize: number
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
  terrainBreaker?: boolean
  aiType?: string // e.g. 'ant', 'sniperBot'
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
  previousPosition?: { x: number; y: number }
  positionTimestamp?: number
  hasFiredOnStuck?: boolean
  shadow?: Phaser.GameObjects.Sprite
  enemyAI?: EnemyAI}

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
  start: [number, number]
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

export interface TerrainTile extends Phaser.Tilemaps.Tile {
  type: number // see tileProperties constants for different terrain types and properties
  health: number
  armor: number
}

// for storing properties of terrain tiles in map manager
export interface TerrainTileProperties {
  health: number
  armor: number
  color: number
  darkness: number
}

export interface TerrainChunk {
  sprite: Phaser.Physics.Arcade.Sprite;
  health: number;
  armor: number;
}

export interface MapObject {
  objectId: number;
  sprite: Phaser.GameObjects.Sprite;
  collisionBodies: Phaser.GameObjects.Sprite[];
  health: number;
  armor: number;
  averageColor: number;
  source: string;
  entityType: string;
  centreX: number;
  centreY: number;
  shadow?: Phaser.GameObjects.Sprite;
}

export interface DustCloud extends Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
  tweenAlpha: number
  infraredControlledAlpha: number
}

export interface OutlineLine {
  lineObject: Phaser.GameObjects.Line;
  lineGeom: Phaser.Geom.Line;
  originalColor: number;
}
export interface EnemyAI {
  update(enemy: EnemySprite, scene: Phaser.Scene, time: number): void
}
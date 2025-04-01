import { weapons } from './weapons'
import { enemies } from './enemies'

// tuplets: music file name, then relative volu
export const music = [
  // ['Plague Rat - Karl Casey @ White Bat Audio- bass boosted', 1],
  // ['Torn Flesh - Karl Casey @ White Bat Audio', 1.4],
  // ['Xenomorph - Karl Casey @ White Bat Audio - bass boosted', 1]
  ['horror-ambient-1', 1.5],
  // ['horror-ambient-2', 1.5],
]

export const weaponConstants = weapons

export type WeaponKey = keyof typeof weaponConstants

const depths = {
  minimap: 15000,
  enemy: 7000,
  player: 10000,
  bloodSpray: 7400,
  projectile: 8000,
  explosion: 12000,
  decals: 7500,
  particles: 7800,
  projectileSpark: 11500,
  terrain: 1,
  dustClouds: 11000,
  trees: 10500,
  buildings: 7000
}

export const Constants = {
  ambientLightColor: 0x151515,
  tileSize: 14,
  gameWidth: window.innerWidth,
  gameHeight: window.innerHeight,
  mapScaling: 1,
  decalsPerCombinedDecal: 5000,
  DecalFadeTime: 30000,
  musicVolume: 1.5,
  maxEnemies: 0,
  playerStartingX: 1000,
  playerStartingY: 1900,
  mechStepPeriod: 500,
  mechStepSoundVol: 3,
  mechStartingHealth: 500,
  mechDeathSound: 'mechexplosion',
  mechDeathSoundVolume: 2,
  enemyHitMechSoundVolume: 1.5,
  maxEnemySoundDistance: 700,
  LoudnessProximityExponent: 1.1,
  mechDimensions: [30, 30],
  boostLength: 50,
  boostWidth: 20,
  boostTint: 0xffbbff,
  explosionColor: 0xed6240,
  boosterLightColor: 0xffbbff,
  boostSoundVol: 0.8,
  muzzleFlashColor: 0xf9cf57,
  maxWalkVel: 70,
  maxBoostVel: 500,
  walkAccel: 100,
  boostAccel: 500,
  boostFadeTime: 400,
  boostCapacity: 20000,
  boostRegeneration: 10,
  boostConsumption: 20,
  deceleration: 70,
  playerInitialArmor: 10,
  startPosition: { y: 500, x: 900 },
  depths,
  MouseButtons: {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
  },
  enemyData: enemies,
  // front left is -15, -15
  weaponPositions: [
    [-12, -10], // far left
    [-7.5, -10], // mid left
    [7.5, -10], // mid right
    [12, -10], // far right
  ],
  defaultBeamSegmentCount: 80,
  defaultBeamDisplacement: 13,
  terrainOutlineUpdateInterval: 1000
}

export type MouseButtonsKeys = keyof typeof Constants.MouseButtons

// avoid faded/blank frames in spritesheet muzzleflash.png

const allMuzzleFrames = Phaser.Utils.Array.NumberArray(0, 31)

export const brightMuzzleFrames = allMuzzleFrames.filter(
  frameNo => ![0, 1, 2, 7, 12, 17, 22, 27].includes(Number(frameNo)),
)

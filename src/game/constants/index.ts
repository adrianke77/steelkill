import { weapons } from './weapons'
import { enemies } from './enemies'

// tuplets: music file name, then relative volu
export const music = [
  // ['Plague Rat - Karl Casey @ White Bat Audio- bass boosted', 1],
  // ['Torn Flesh - Karl Casey @ White Bat Audio', 1.4],
  // ['Xenomorph - Karl Casey @ White Bat Audio - bass boosted', 1]
  ['horror-ambient-1', 1.5],
  ['horror-ambient-2', 1.5],
]

export const weaponConstants = weapons

export type WeaponKey = keyof typeof weaponConstants

const depths = {
  minimap: 1500,
  enemy: 800,
  player: 1000,
  bloodSpray: 740,
  projectile: 800,
  explosion: 850,
  decals: 750,
  initialDeadBody: 760,
  particles: 780,
  projectileSpark: 1050,
  terrain: 742,
  dustClouds: 1100,
  trees: 1000,
  buildings: 745,
  rubble: 743,
  shadows: 744,
}

export const Constants = {
  ambientLightColor: 0x252525,
  infraredDustCloudAlphaFactor: 0.1,
  baseInfraredTerrainColor: 0xff00ff,
  tileSize: 8,
  gameWidth: window.innerWidth,
  gameHeight: window.innerHeight,
  tiledLoadedMapScaling: 0.3,
  mapScaling: 1,
  terrainDefaultFillProbability: 0.45,
  terrainDefaultIterations: 7,
  terrainAlpha:0.8,
  decalsPerCombinedDecal: 5000,
  DecalFadeTime: 30000,
  musicVolume: 1.5,
  maxEnemies: 60,
  playerStartingX: 1000,
  playerStartingY: 1900,
  flashlightAngleDegrees: 60,
  flashlightShadowDefaultAlpha: 0.8,
  flashlightEnemyShadowDefaultAlpha:0.3,
  flashlightRadius: 1000,
  shadowTextureDarkness: 0.09,
  // how often to update the shadows, lower is more often
  shadowUpdateRate: 7,
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
  maxBoostVel: 300,
  walkAccel: 100,
  boostAccel: 300,
  boostFadeTime: 400,
  boostCapacity: 2000,
  boostRegeneration: 5,
  boostConsumption: 15,
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
  terrainOutlineUpdateInterval: 1000,
}

export type MouseButtonsKeys = keyof typeof Constants.MouseButtons

// avoid faded/blank frames in spritesheet muzzleflash.png

const allMuzzleFrames = Phaser.Utils.Array.NumberArray(0, 31)

export const brightMuzzleFrames = allMuzzleFrames.filter(
  frameNo => ![0, 1, 2, 7, 12, 17, 22, 27].includes(Number(frameNo)),
)

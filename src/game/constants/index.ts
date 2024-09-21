import { weapons } from './weapons'
import { enemies } from './enemies'

export const music = ['horror-ambient-1', 'horror-ambient-2']

export const weaponConstants = weapons

export type WeaponKey = keyof typeof weaponConstants

const depths = {
  minimap: 15000,
  enemy: 9999,
  player: 9999,
  projectile: 8000,
  explosion: 10000,
  decals: 7500,
  projectileSpark: 10000,
}

export const Constants = {
  fieldWidth: 5000,
  fieldHeight: 5000,
  gameWidth: window.innerWidth,
  gameHeight: window.innerHeight,
  decalsPerCombinedDecal: 1500,
  DecalFadeTime: 60000,
  musicVolume: 1.5,
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
  maxWalkVel: 150,
  maxBoostVel: 300,
  walkAccel: 200,
  boostAccel: 400,
  boostFadeTime: 400,
  deceleration: 70,
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
    [12, -10], // far right
    [-7.5, -10], // mid left
    [7.5, -10], // mid right
  ],
  boostCapacity: 10000,
  boostRegeneration: 20,
  boostConsumption: 40,
}

export type MouseButtonsKeys = keyof typeof Constants.MouseButtons

// avoid faded/blank frames in spritesheet muzzleflash.png

const allMuzzleFrames = Phaser.Utils.Array.NumberArray(0, 31)

export const brightMuzzleFrames = allMuzzleFrames.filter(
  frameNo => ![0, 1, 2, 7, 12, 17, 22, 27].includes(Number(frameNo)),
)

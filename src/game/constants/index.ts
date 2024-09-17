import { EnemyDataMap } from '../interfaces'
import { weapons } from './weapons';

export const music = ['horror-ambient-1','horror-ambient-2']

export const weaponConstants = weapons ;

export type WeaponKey = keyof typeof weaponConstants;

export const Constants = {
  fieldWidth: 5000,
  fieldHeight: 5000,
  gameWidth: window.innerWidth,
  gameHeight: window.innerHeight,
  decalsPerCombinedDecal: 1500,
  DecalFadeTime: 60000,
  musicVolume: 1.5,
  mechStepPeriod: 500,
  mechStepSoundVol: 2,
  mechStartingHealth: 500,
  mechDeathSound: 'mechexplosion',
  mechDeathSoundVolume: 2,
  enemyHitMechSoundVolume: 1.5,
  maxEnemySoundDistance: 700,
  LoudnessProximityExponent: 1.1,
  mechDimensions: [30, 30],
  boostLength: 50,
  boostWidth: 20,
  explosionColor: 0xed6240,
  boosterLightColor: 0xed6240,
  boostSoundVol: 0.8,
  muzzleFlashColor: 0xf9cf57,
  maxWalkVel: 100,
  maxBoostVel: 300,
  walkAccel: 150,
  boostAccel: 400,
  boostFadeTime: 400,
  deceleration: 70,
  startPosition: { y: 500, x: 900 },
  depths: {
    enemy: 9999,
    player: 9999,
    projectile: 8000,
    enemyblood: 7500,
    enemybody: 7500,
    explosion: 10000,
    scorch: 7500,
    projectileSpark: 10000,
  },
  MouseButtons: {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
  },
  enemyData: {
    ant: {
      spawnPeriod: 25,
      speed: 100,
      health: 40,
      armor: 5,
      displaySize: 40,
      collisionSize: 35,
      bloodColor: 0x00aa00,
      color: 0x221111,
      walkAnimation: 'antwalk',
      corpseImage: 'blood',
      corpseSize: 50,
      spriteSheetKey: 'ant',
      randomSound: 'antsounds2',
      randomSoundVol: 1.5,
      randomSoundChance: 0.2,
      directionTimerMax: 750,
      directionTimerMin: 250,
      deathSound: 'antdeath',
      deathSoundVol: 0.6,
      hitDamage: 22,
      hitDelay: 500,
      hitSound: 'anthit',
      tooSmallToBleedWhenHit: true,
    },
  } as EnemyDataMap,
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

export type MouseButtonsKeys = keyof typeof Constants.MouseButtons;

// avoid faded/blank frames in spritesheet muzzleflash.png

const allMuzzleFrames = Phaser.Utils.Array.NumberArray(0, 31);

export const brightMuzzleFrames = allMuzzleFrames.filter(frameNo => ![0,1,2,7,12,17,22,27].includes(Number(frameNo)));
import { EnemyDataMap } from '../interfaces'
import { enemyWeapons } from './weapons'

export const enemies = {
  ant: {
    spawnPeriod: 100,
    speed: 50,
    health: 60,
    armor: 5,
    displaySize: 40,
    collisionSize: 35,
    bloodColor: 0x006600,
    color: 0x051005,
    walkAnimation: 'whiteant8',
    corpseImage: 'blood',
    corpseSize: 100,
    spriteSheetKey: 'whiteant8',
    randomSound: 'antsounds2',
    randomSoundVol: 2,
    randomSoundChance: 0.4,
    directionTimerMax: 750,
    directionTimerMin: 250,
    deathSound: 'antdeath',
    deathSoundVol: 2,
    hitDamage: 22,
    hitDelay: 500,
    hitSound: 'anthit',
    hitSoundVolume: 1,
    tooSmallToBleedWhenHit: true,
    terrainBreaker: true
  },
  fireant: {
    spawnPeriod: 1000,
    speed: 40,
    health: 300,
    armor: 10,
    displaySize: 60,
    collisionSize: 50,
    bloodColor: 0x006600,
    color: 0x300000,
    walkAnimation: 'whiteant8',
    corpseImage: 'blood',
    corpseSize: 200,
    spriteSheetKey: 'whiteant8',
    randomSound: 'antsounds2',
    randomSoundVol: 3,
    randomSoundChance: 0.4,
    directionTimerMax: 750,
    directionTimerMin: 250,
    deathSound: 'antdeath',
    deathSoundVol: 3,
    hitDamage: 40,
    hitDelay: 500,
    hitSoundVolume: 1,
    hitSound: 'anthit',
    tooSmallToBleedWhenHit: false,
    weapons: [enemyWeapons.enemyPlasmaSpit],
  },
} as EnemyDataMap

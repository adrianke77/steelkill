import { EnemyDataMap } from '../interfaces'
import { enemyWeapons } from './weapons'

export const enemies = {
  ant: {
    spawnPeriod: 100,
    speed: 150,
    health: 60,
    armor: 5,
    displayHeight: 40,
    displayWidth: 30,
    collisionSize: 35,
    bloodColor: 0x004000,
    color: 0x002060,
    walkAnimation: 'darkerant8',
    corpseImage: 'blood',
    corpseSize: 50,
    randomSound: 'antsounds2',
    randomSoundVol: 2,
    randomSoundChance: 0.4,
    directionTimerMax: 2000,
    directionTimerMin: 200,
    deathSound: 'antdeath',
    deathSoundVol: 2,
    hitDamage: 22,
    hitDelay: 500,
    hitSound: 'anthit',
    hitSoundVolume: 1,
    tooSmallToBleedWhenHit: true,
    terrainBreaker: true,
    aiType: 'ant',
  },
  fireant: {
    spawnPeriod: 1000,
    speed: 100,
    health: 300,
    armor: 10,
    displayHeight: 70,
    displayWidth: 45,
    collisionSize: 50,
    bloodColor: 0x004000,
    color: 0x400000,
    walkAnimation: 'darkerant8',
    corpseImage: 'blood',
    corpseSize: 80,
    randomSound: 'antsounds2',
    randomSoundVol: 3,
    randomSoundChance: 0.4,
    directionTimerMax: 2000,
    directionTimerMin: 200,
    deathSound: 'antdeath',
    deathSoundVol: 3,
    hitDamage: 40,
    hitDelay: 500,
    hitSoundVolume: 1,
    hitSound: 'anthit',
    tooSmallToBleedWhenHit: false,
    weapons: [enemyWeapons.enemyPlasmaSpit],
    aiType: 'ant',
  },
} as EnemyDataMap
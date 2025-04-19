import { EnemyAI } from '../interfaces'
import { AntAI } from './AntAI'

export const EnemyAIRegistry: { [key: string]: EnemyAI } = {
  ant: new AntAI(),
  // Add more as needed
}
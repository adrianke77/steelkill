import { GameOver } from './scenes/GameOver'
import { Game as MainGame } from './scenes/Game'
import { MainMenu } from './scenes/MainMenu'
import { Game } from 'phaser'
import { Preloader } from './scenes/Preloader'
import { Constants } from './constants'
import { EventBus } from '../EventBus'
import { DataFromReact } from './interfaces'

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: Constants.gameWidth,
  height: Constants.gameHeight,
  parent: 'game-container',
  backgroundColor: 0x660000,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      fps: 120,
    },
  },
  scene: [ Preloader, MainMenu, MainGame, GameOver],
  audio: {
    disableWebAudio: false, // Ensures Web Audio API is used
  },
  render: {
    maxLights: 200, // Set the maximum number of lights
  }
}

const StartGame = (parent: string) => {
  const game = new Game({ ...config, parent })
  EventBus.on('react-data-send', (dataFromReact: DataFromReact) => {
    game.registry.set([dataFromReact[0]], dataFromReact[1])
  })
  return game
}

export default StartGame

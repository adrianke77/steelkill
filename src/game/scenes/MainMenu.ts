import { GameObjects, Scene } from 'phaser'

import { EventBus } from '../../EventBus'

export class MainMenu extends Scene {
  background: GameObjects.Image
  logo: GameObjects.Image
  title: GameObjects.Text
  logoTween: Phaser.Tweens.Tween | null
  sceneName: string

  constructor() {
    super('MainMenu')
    this.sceneName = 'mainmenu'
  }

  preload() {
    // Load the background image asset
    this.load.setPath('assets')
    this.load.image('menubackground', 'mechbackground.jpg')

    document.body.style.cursor = 'default'
  }

  create() {
    // Get the dimensions of the game world
    const { width, height } = this.scale;

    // Add the image to the scene
    const background = this.add.image(width / 2, height / 2, 'menubackground');

    // Scale the image to fit the screen while maintaining aspect ratio
    const imageRatio = background.displayWidth / background.displayHeight;
    const screenRatio = width / height;

    if (screenRatio > imageRatio) {
      // Screen is wider than the image, so scale by height
      background.setDisplaySize(height * imageRatio, height);
    } else {
      // Screen is taller than the image, so scale by width
      background.setDisplaySize(width, width / imageRatio);
    }
    background.setTint(0x660000); // Initial red tint
    EventBus.emit('current-scene-ready', this)
  }

  startGame() {
    this.scene.start('Game')
  }
}

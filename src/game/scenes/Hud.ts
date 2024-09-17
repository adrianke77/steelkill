import Phaser from 'phaser'
import { Game } from './Game'
import { MinimapManager } from '../classes/MinimapManager'
import { CurvedScreenPostFxPipeline } from '../shaders/curvedScreenShader'
import { ScanlinesPostFxPipeline } from '../shaders/scanlinesShader'

export class HudScene extends Phaser.Scene {
  minimapMgr: MinimapManager

  constructor() {
    super({ key: 'HudScene' })
  }

  create() {
    console.log('creating hud scene')
    this.input.enabled = false

    const gameScene = this.scene.get('Game') as Game

    this.minimapMgr = new MinimapManager(this, gameScene)

    const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer

    renderer.pipelines.addPostPipeline(
      'CurvedScreenPostFxPipeline',
      CurvedScreenPostFxPipeline,
    )
    renderer.pipelines.addPostPipeline(
      'ScanlinesPostFxPipeline',
      ScanlinesPostFxPipeline,
    )

    this.cameras.main.setPostPipeline([
      'StaticPostFxPipeline',
      'ScanlinesPostFxPipeline',
      'CurvedScreenPostFxPipeline',
    ])
  }

  update() {
    // Draw the minimap
    console.log('drawing minimap')
    this.minimapMgr.drawMinimap()
  }
}

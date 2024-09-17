import { Game } from '../scenes/Game'
import { CurvedScreenPostFxPipeline } from '../shaders/curvedScreenShader'
import { ScanlinesPostFxPipeline } from '../shaders/scanlinesShader'
import { StaticPostFxPipeline } from '../shaders/staticShader'
import { InfraredPostFxPipeline } from '../shaders/infraredShader'
import { Constants as ct } from '../constants'

export class ViewManager {
  scene: Game
  camera: Phaser.Cameras.Scene2D.Camera
  infraredIsOn: boolean

  constructor(scene: Game) {
    this.scene = scene
    scene.lights.enable().setAmbientColor(0xbbbbbb)
    const renderer = scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer

    renderer.pipelines.addPostPipeline(
      'CurvedScreenPostFxPipeline',
      CurvedScreenPostFxPipeline,
    )
    renderer.pipelines.addPostPipeline(
      'ScanlinesPostFxPipeline',
      ScanlinesPostFxPipeline,
    )
    renderer.pipelines.addPostPipeline(
      'StaticPostFxPipeline',
      StaticPostFxPipeline,
    )
    renderer.pipelines.addPostPipeline(
      'InfraredPostFxPipeline',
      InfraredPostFxPipeline,
    )

    this.camera = scene.cameras.main
    this.camera.setBackgroundColor(0x333333)
    this.camera.setBounds(0, 0, 5000, 5000)
    this.camera.setSize(ct.gameWidth, ct.gameHeight)
    this.camera.startFollow(scene.player.mechContainer, true, 0.03, 0.03)
    this.camera.setPostPipeline([
      'StaticPostFxPipeline',
      'ScanlinesPostFxPipeline',
      'CurvedScreenPostFxPipeline',
    ])

    const background = scene.add.tileSprite(
      ct.fieldWidth/2,
      ct.fieldHeight/2,
      ct.fieldWidth,
      ct.fieldHeight,
      'background',
    )
    background.setDepth(-1)
    background.setPipeline('Light2D')
    this.infraredIsOn = false
  }

  updateCameraOffset(rotation: number): void {
    const offsetX = 200 * Math.cos(rotation + Math.PI / 2)
    const offsetY = 200 * Math.sin(rotation + Math.PI / 2)
    this.camera.setFollowOffset(offsetX, offsetY)
  }

  toggleInfrared(): void {
    this.infraredIsOn = !this.infraredIsOn
    if (this.infraredIsOn) {
      this.camera.resetPostPipeline()
      this.camera.setPostPipeline([
        'InfraredPostFxPipeline',
        'StaticPostFxPipeline',
        'ScanlinesPostFxPipeline',
        'CurvedScreenPostFxPipeline',
      ])
      this.scene.enemyMgr.switchEnemiesToInfraredColors()
    } else {
      this.camera.resetPostPipeline()
      this.camera.setPostPipeline([
        'StaticPostFxPipeline',
        'ScanlinesPostFxPipeline',
        'CurvedScreenPostFxPipeline',
      ])
      this.scene.enemyMgr.switchEnemiesToNonInfraredColors()
    }
  }
}

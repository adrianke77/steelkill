import { Game } from '../scenes/Game'
import { CurvedScreenPostFxPipeline } from '../shaders/curvedScreenShader'
import { ScanlinesPostFxPipeline } from '../shaders/scanlinesShader'
import { StaticPostFxPipeline } from '../shaders/staticShader'
import { InfraredPostFxPipeline } from '../shaders/infraredShader'
import { Constants as ct } from '../constants'

export class ViewManager {
  scene: Game
  mainCam: Phaser.Cameras.Scene2D.Camera
  miniMapCam: Phaser.Cameras.Scene2D.Camera
  infraredIsOn: boolean
  dustClouds: Phaser.GameObjects.Group
  background: Phaser.GameObjects.TileSprite 

  constructor(
    scene: Game,
  ) {

    this.scene = scene
    scene.lights.enable().setAmbientColor(ct.ambientLightColor)
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

    this.mainCam = scene.cameras.main
    this.mainCam.setBackgroundColor(0x111111)
    this.mainCam.setBounds(0, 0, ct.fieldWidth, ct.fieldHeight)
    this.mainCam.setSize(ct.gameWidth, ct.gameHeight)
    this.mainCam.setPostPipeline([
      'StaticPostFxPipeline',
      'ScanlinesPostFxPipeline',
      'CurvedScreenPostFxPipeline',
    ])
    this.mainCam.ignore(this.scene.minimapLayer)
    this.mainCam.startFollow(this.scene.player.mechContainer, true, 0.03, 0.03)

    this.miniMapCam = this.scene.cameras.add()
    this.miniMapCam.ignore(this.scene.mainLayer)
    this.miniMapCam.setPostPipeline([
      'StaticPostFxPipeline',
      'ScanlinesPostFxPipeline',
      'CurvedScreenPostFxPipeline',
    ])

    const background = scene.add.tileSprite(
      ct.fieldWidth / 2,
      ct.fieldHeight / 2,
      ct.fieldWidth,
      ct.fieldHeight,
      'background',
    )
    background.setDepth(-1)
    background.setPipeline('Light2D')
    this.background = background
    this.scene.mainLayer.add(background)
    this.infraredIsOn = false
    this.dustClouds = this.scene.add.group()
  }

  updateCameraOffset(rotation: number): void {
    const offsetX = 200 * Math.cos(rotation + Math.PI / 2)
    const offsetY = 200 * Math.sin(rotation + Math.PI / 2)
    this.mainCam.setFollowOffset(offsetX, offsetY)
    this.miniMapCam.setFollowOffset(offsetX, offsetY)
  }

  toggleInfrared(): void {
    this.infraredIsOn = !this.infraredIsOn
    if (this.infraredIsOn) {
      this.mainCam.resetPostPipeline()
      this.mainCam.setPostPipeline([
        'InfraredPostFxPipeline',
        'StaticPostFxPipeline',
        'ScanlinesPostFxPipeline',
        'CurvedScreenPostFxPipeline',
      ])
      this.scene.lights.setAmbientColor(0xFFFFFF)
      this.background.setTint(0x999999)
      this.dustClouds.children.iterate((dustCloud: Phaser.GameObjects.GameObject) => {
        (dustCloud as Phaser.GameObjects.Sprite).visible = false
        return true
      })
      this.scene.enemyMgr.switchEnemiesToInfraredColors()
    } else {
      this.mainCam.resetPostPipeline()
      this.mainCam.setPostPipeline([
        'StaticPostFxPipeline',
        'ScanlinesPostFxPipeline',
        'CurvedScreenPostFxPipeline',
      ])
      this.scene.lights.setAmbientColor(ct.ambientLightColor)
      this.background.clearTint() 
      this.dustClouds.children.iterate((dustCloud: Phaser.GameObjects.GameObject) => {
        (dustCloud as Phaser.GameObjects.Sprite).visible = true
        return true
      })
      this.scene.enemyMgr.switchEnemiesToNonInfraredColors()
    }
  }
}

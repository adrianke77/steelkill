import { Game } from '../scenes/Game'
import { CurvedScreenPostFxPipeline } from '../shaders/curvedScreenShader'
import { ScanlinesPostFxPipeline } from '../shaders/scanlinesShader'
import { StaticPostFxPipeline } from '../shaders/staticShader'
import { InfraredPostFxPipeline } from '../shaders/infraredShader'
import { Constants as ct } from '../constants'
import { FlashlightPostFxPipeline } from '../shaders/fragment/FlashlightPostFxPipeline'

export class ViewManager {
  scene: Game
  mainLayer: Phaser.GameObjects.Layer
  minimapLayer: Phaser.GameObjects.Layer
  mainCam: Phaser.Cameras.Scene2D.Camera
  miniMapCam: Phaser.Cameras.Scene2D.Camera
  infraredIsOn: boolean
  dustClouds: Phaser.GameObjects.Group
  background: Phaser.GameObjects.TileSprite
  darkOverlay: Phaser.GameObjects.Graphics
  flashlightPipeline: FlashlightPostFxPipeline

  // Added properties for a dedicated effects camera and layer
  effectsCam: Phaser.Cameras.Scene2D.Camera
  effectsLayer: Phaser.GameObjects.Layer

  constructor(scene: Game) {
    this.scene = scene

    scene.lights.enable().setAmbientColor(ct.ambientLightColor)
    const renderer = scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer

    this.mainLayer = scene.add.layer()
    this.minimapLayer = scene.add.layer()
    this.effectsLayer = scene.add.layer()

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

    // Add flashlight pipeline here
    renderer.pipelines.addPostPipeline(
      'FlashlightPostFxPipeline',
      FlashlightPostFxPipeline,
    )

    this.mainCam = scene.cameras.main
    this.mainCam.setBackgroundColor(0x111111)
    this.mainCam.setBounds(0, 0, ct.fieldWidth, ct.fieldHeight)
    this.mainCam.setSize(ct.gameWidth, ct.gameHeight)

    this.mainCam.setPostPipeline([
      'FlashlightPostFxPipeline',
      'StaticPostFxPipeline',
      'ScanlinesPostFxPipeline',
      'CurvedScreenPostFxPipeline',
    ])

    scene.events.once(Phaser.Scenes.Events.RENDER, () => {
      this.flashlightPipeline = this.mainCam.getPostPipeline(
        'FlashlightPostFxPipeline',
      ) as FlashlightPostFxPipeline
      this.flashlightPipeline.setRadius(800)
      this.flashlightPipeline.setConeAngle(Math.PI / 2)
    })

    this.miniMapCam = this.scene.cameras.add()
    this.miniMapCam.setPostPipeline([
      'StaticPostFxPipeline',
      'ScanlinesPostFxPipeline',
      'CurvedScreenPostFxPipeline',
    ])

    // Create and configure the effects layer/camera
    this.effectsCam = this.scene.cameras.add(0, 0, ct.gameWidth, ct.gameHeight)
    this.effectsCam.setName('EffectsCam')
    this.effectsCam.setBounds(0, 0, ct.fieldWidth, ct.fieldHeight)
    this.effectsCam.setFollowOffset(
      this.mainCam.followOffset.x,
      this.mainCam.followOffset.y,
    )
    this.effectsCam.setZoom(this.mainCam.zoom)
    this.effectsCam.setPostPipeline([
      'StaticPostFxPipeline',
      'ScanlinesPostFxPipeline',
      'CurvedScreenPostFxPipeline',
    ])

    this.mainCam.ignore(this.effectsLayer)
    this.mainCam.ignore(this.minimapLayer)
    this.miniMapCam.ignore(this.mainLayer)
    this.miniMapCam.ignore(this.effectsLayer)
    this.effectsCam.ignore(this.mainLayer)
    this.effectsCam.ignore(this.minimapLayer)

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
    this.mainLayer.add(background)
    this.infraredIsOn = false
    this.dustClouds = this.scene.add.group()
  }

  public startCamFollowingPlayerMech(): void {
    this.mainCam.startFollow(this.scene.player.mechContainer, false, 0.03, 0.03)
    // Sync the effectsCam follow and offset with the mainCam
    this.effectsCam.startFollow(
      this.scene.player.mechContainer,
      false,
      0.03,
      0.03,
    )
  }

  public updateCameraOffset(rotation: number): void {
    const offsetX = (this.mainCam.width / 4) * Math.cos(rotation + Math.PI / 2)
    const offsetY = (this.mainCam.height / 4) * Math.sin(rotation + Math.PI / 2)
    this.mainCam.setFollowOffset(offsetX, offsetY)
    this.miniMapCam.setFollowOffset(offsetX, offsetY)

    this.updateFlashlightCone(
      this.scene.player.mechContainer.x,
      this.scene.player.mechContainer.y,
      this.scene.player.mechContainer.rotation,
    )
    // Keep effectsCam offset/zoom in sync with mainCam
    this.effectsCam.setFollowOffset(offsetX, offsetY)
    this.effectsCam.setZoom(this.mainCam.zoom)
    // If you rotate the mainCam or apply other transformations, mirror them here:
    // this.effectsCam.rotation = this.mainCam.rotation
    // or any other transformations you apply to mainCam
  }

  public updateFlashlightCone(
    mechX: number,
    mechY: number,
    mechRotation: number,
  ): void {
    if (!this.flashlightPipeline) return

    const camera = this.scene.cameras.main

    // Convert mech’s world position to screen coordinates
    const dx = mechX - camera.worldView.x
    const dy = mechY - camera.worldView.y
    const scaledX = dx * camera.zoom
    const scaledY = dy * camera.zoom
    const unflippedScreenX = camera.x + scaledX
    const unflippedScreenY = camera.y + scaledY

    // Flip Y so the flashlight aligns correctly:
    // The pipeline uses a top-left origin, so we subtract from total renderer height.
    const rendererHeight = this.scene.renderer.height
    const flippedScreenY = rendererHeight - unflippedScreenY

    // Set light position in flipped screen coordinates
    this.flashlightPipeline.setLightPosition(unflippedScreenX, flippedScreenY)

    // Determine flashlight cone direction from the mech’s real rotation
    const dirX = Math.cos(-mechRotation + Math.PI / 2)
    const dirY = Math.sin(-mechRotation + Math.PI / 2)
    this.flashlightPipeline.setConeDirection(dirX, dirY)
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
      this.scene.lights.setAmbientColor(0xffffff)
      this.background.setTint(0x999999)
      this.dustClouds.children.iterate(
        (dustCloud: Phaser.GameObjects.GameObject) => {
          ;(dustCloud as Phaser.GameObjects.Sprite).visible = false
          return true
        },
      )
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
      this.dustClouds.children.iterate(
        (dustCloud: Phaser.GameObjects.GameObject) => {
          ;(dustCloud as Phaser.GameObjects.Sprite).visible = true
          return true
        },
      )
      this.scene.enemyMgr.switchEnemiesToNonInfraredColors()
    }
  }
}

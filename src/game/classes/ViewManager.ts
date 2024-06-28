import { Game } from '../scenes/Game';
import { CurvedScreenPostFxPipeline } from '../shaders/curvedScreenShader';
import { ScanlinesPostFxPipeline } from '../shaders/scanlinesShader';
import { StaticPostFxPipeline } from '../shaders/staticShader';
import { InfraredPostFxPipeline } from '../shaders/infraredShader';
import { Constants as ct } from '../constants';

export class ViewManager {
	scene: Game;
	camera: Phaser.Cameras.Scene2D.Camera;

	constructor(scene: Game) {

		scene.lights.enable().setAmbientColor(0xAAAAAA);
		const renderer = scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer

		renderer.pipelines.addPostPipeline('CurvedScreenPostFxPipeline', CurvedScreenPostFxPipeline,);
		renderer.pipelines.addPostPipeline('ScanlinesPostFxPipeline', ScanlinesPostFxPipeline)
		renderer.pipelines.addPostPipeline('StaticPostFxPipeline', StaticPostFxPipeline)
		renderer.pipelines.addPostPipeline('InfraredPostFxPipeline', InfraredPostFxPipeline)

		this.camera = scene.cameras.main;
		this.camera.setBackgroundColor(0x333333);
		this.camera.setBounds(0, 0, 5000, 5000);
		this.camera.setSize(ct.gameWidth, ct.gameHeight);
		this.camera.startFollow(scene.player.mechContainer, true, 0.03, 0.03);
		this.camera.setPostPipeline([StaticPostFxPipeline, ScanlinesPostFxPipeline, CurvedScreenPostFxPipeline])

		let background = scene.add.tileSprite(2500, 2500, 5000, 5000, 'background');
		background.setDepth(-1);
		background.setPipeline('Light2D');
	}

	updateCameraOffset(rotation: number): void {
		const offsetX = 200 * Math.cos(rotation + Math.PI / 2);
		const offsetY = 200 * Math.sin(rotation + Math.PI / 2);
		this.camera.setFollowOffset(offsetX, offsetY);
	}
}
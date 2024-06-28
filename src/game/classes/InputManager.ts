// InputManager.ts
import { Game } from '../scenes/Game';
import { Constants as ct } from '../constants';

export class InputManager {
	scene: Game;
	inputs: {
		up: Phaser.Input.Keyboard.Key,
		down: Phaser.Input.Keyboard.Key,
		left: Phaser.Input.Keyboard.Key,
		right: Phaser.Input.Keyboard.Key,
		boost: Phaser.Input.Keyboard.Key
	};
	mouseStates: {
		leftDown: boolean,
		middleDown: boolean,
		rightDown: boolean
	};

	constructor(scene: Game) {
		this.scene = scene;
		this.inputs = {
			up: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
			down: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
			left: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
			right: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
			boost: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
		};

		this.mouseStates = {
			leftDown: false,
			middleDown: false,
			rightDown: false
		};

		this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (pointer.button === ct.MouseButtons.LEFT) {
				this.mouseStates.leftDown = true;
			} else if (pointer.button === ct.MouseButtons.MIDDLE) {
				this.mouseStates.middleDown = true;
			} else if (pointer.button === ct.MouseButtons.RIGHT) {
				this.mouseStates.rightDown = true;
			}
		});
		this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
			if (pointer.button === ct.MouseButtons.LEFT) {
				this.mouseStates.leftDown = false;
			} else if (pointer.button === ct.MouseButtons.MIDDLE) {
				this.mouseStates.middleDown = false;
			} else if (pointer.button === ct.MouseButtons.RIGHT) {
				this.mouseStates.rightDown = false;
			}
		});
	}
}

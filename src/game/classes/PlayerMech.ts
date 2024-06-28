// PlayerMech.ts
import { Constants as ct } from '../constants';
import { FourPositions} from '../interfaces';
import { Game } from '../scenes/Game';
import { createLightFlash} from '../rendering';


export class PlayerMech {
	scene: Game;
	mechContainer: Phaser.GameObjects.Container;
	playerMech: Phaser.Physics.Arcade.Sprite;
	boostFlames: Record<FourPositions, Phaser.GameObjects.Sprite>;
	currentBoost: number;
	boostMax: number;
	boostOverload: boolean;

	constructor(scene: Game) {
		this.scene = scene;
		this.boostMax = ct.boostCapacity;
		this.currentBoost = ct.boostCapacity;
		this.boostOverload = false;

		this.playerMech = this.scene.physics.add.sprite(0, 0, 'mech');
		this.playerMech.displayWidth = ct.mechDimensions[0];
		this.playerMech.width = ct.mechDimensions[0];
		this.playerMech.displayHeight = ct.mechDimensions[1];
		this.playerMech.height = ct.mechDimensions[1];
		this.boostFlames = {
			front: this.scene.add.sprite(0, -this.playerMech.height / 2, 'boostflame').setVisible(false),
			back: this.scene.add.sprite(0, this.playerMech.height / 2, 'boostflame').setVisible(false),
			left: this.scene.add.sprite(-this.playerMech.width / 2, 0, 'boostflame').setVisible(false),
			right: this.scene.add.sprite(this.playerMech.width / 2, 0, 'boostflame').setVisible(false)
		};
		this.playerMech.setPipeline('Light2D');

		for (const position of Object.keys(this.boostFlames) as FourPositions[]) {
			const sprite = this.boostFlames[position];
			sprite.setOrigin(0, 0.5);
			sprite.play('boostflame');
			sprite.displayHeight = ct.boostWidth;
			sprite.displayWidth = ct.boostLength;
		}
		this.boostFlames.left.setRotation(Math.PI);
		this.boostFlames.front.setRotation(-Math.PI / 2);
		this.boostFlames.back.setRotation(Math.PI / 2);

		this.mechContainer = this.scene.add.container(ct.startPosition.x, ct.startPosition.y, [
			this.playerMech,
			this.boostFlames.front,
			this.boostFlames.back,
			this.boostFlames.left,
			this.boostFlames.right
		]);
		this.scene.physics.world.enable(this.mechContainer);
		this.mechContainer.setDepth(ct.depths.player);
		(this.mechContainer.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
	}

    getMechContainer(){
        return this.mechContainer
    }

	updateControlledAccelAndBoost(accel: number, isBoosting: boolean, inputs: any): void {
		const rotation = this.mechContainer.rotation;
		let angle: number = 0;


		const visibleFlame = (position: FourPositions): void => {
			const flame = this.boostFlames[position];
			flame.setVisible(true);
			createLightFlash(this.scene, flame.x + this.mechContainer.x, flame.y + this.mechContainer.y, ct.boosterLightColor, 10, 1, 100);
		};

		if (inputs.up.isDown && inputs.right.isDown) {
			angle = rotation - Math.PI / 4;
			if (isBoosting) {
				visibleFlame('back');
				visibleFlame('left');
			}
		} else if (inputs.up.isDown && inputs.left.isDown) {
			angle = rotation - Math.PI * 3 / 4;
			if (isBoosting) {
				visibleFlame('right');
				visibleFlame('back');
			}
		} else if (inputs.down.isDown && inputs.right.isDown) {
			angle = rotation + Math.PI / 4;
			if (isBoosting) {
				visibleFlame('left');
				visibleFlame('front');
			}
		} else if (inputs.down.isDown && inputs.left.isDown) {
			angle = rotation + Math.PI * 3 / 4;
			if (isBoosting) {
				visibleFlame('front');
				visibleFlame('right');
			}
		} else if (inputs.up.isDown) {
			angle = rotation - Math.PI / 2;
			if (isBoosting) {
				visibleFlame('back');
			}
		} else if (inputs.down.isDown) {
			angle = rotation + Math.PI / 2;
			if (isBoosting) {
				visibleFlame('front');
			}
		} else if (inputs.left.isDown) {
			angle = rotation - Math.PI;
			if (isBoosting) {
				visibleFlame('right');
			}
		} else if (inputs.right.isDown) {
			angle = rotation;
			if (isBoosting) {
				visibleFlame('left');
			}
		}

		let accelX = 0;
		let accelY = 0;

		accelX += accel * Math.cos(angle);
		accelY += accel * Math.sin(angle);
		(this.mechContainer.body as Phaser.Physics.Arcade.Body).setAcceleration(accelX, accelY);
	}
}
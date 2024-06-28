import { Game } from '../scenes/Game';
import { Constants as ct } from '../constants';

export class EnemyManager {
	scene: Game;
	enemies: Phaser.GameObjects.Group;

	constructor(scene: Game) {
		this.scene = scene;
		this.enemies = this.scene.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
	}

	createAnt(x: number, y: number): void {
		const ant = this.enemies.create(x, y, 'ant');
		this.resetDirectionTimer(ant);
		ant.health = ct.antHealth;
		ant.armor = 5;
		ant.displayHeight = ct.antDisplaySize;
		ant.displayWidth = ct.antDisplaySize;
		ant.setSize(ct.antCollisionSize * 2);
		ant.setTint(ct.antColor);
		ant.setDepth(ct.depths.ant);
		ant.play('antwalk');
		ant.setPipeline('Light2D');
	}

	resetDirectionTimer(sprite: Phaser.Physics.Arcade.Sprite): void {
		const directionTimer = Phaser.Math.Between(250, 750);
		const direction = this.getRandomDirection();
		sprite.setData('direction', direction);
		this.scene.time.delayedCall(directionTimer, this.resetDirectionTimer, [sprite], this);
	}

	getRandomDirection(): string {
		const randomValue = Math.random();
		if (randomValue < 0.25) return 'towards';
		if (randomValue < 0.5) return 'stop';
		if (randomValue < 0.75) return 'angled-left';
		return 'angled-right';
	}

	chasePlayer(sprite: Phaser.Physics.Arcade.Sprite, speed: number): void {
		const currentPosX = this.scene.player.mechContainer.body!.position.x;
		const currentPosY = this.scene.player.mechContainer.body!.position.y;
		const angle = Math.atan2(currentPosY - sprite.body!.position.y, currentPosX - sprite.body!.position.x);
		const direction = sprite.getData('direction');

		sprite.rotation = angle + Math.PI / 2;
		switch (direction) {
			case 'towards':
				sprite.setVelocity(speed*3 * Math.cos(angle), speed*3 * Math.sin(angle));
				break;
			case 'stop':
				sprite.setVelocity(0, 0);
				break;
			case 'angled-left':
				const leftAngle = angle - Math.PI / 4;
				sprite.setVelocity(speed * Math.cos(leftAngle), speed * Math.sin(leftAngle));
				break;
			case 'angled-right':
				const rightAngle = angle + Math.PI / 4;
				sprite.setVelocity(speed * Math.cos(rightAngle), speed * Math.sin(rightAngle));
				break;
		}
	}
}

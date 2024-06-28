// renderUtils.ts
import { Game } from '../scenes/Game';
import { Constants as ct } from '../constants';
import { EnemySprite, Projectile, WeaponSpec } from '../interfaces';
import { blendColors } from '../utils';

export function createEmittersAndAnimations(scene: Game) {
	scene.projectileSparkEmitter = scene.add.particles(0, 0, 'whiteParticle', {
		lifespan: 50,
		speed: { min: 200, max: 350 },
		scale: { start: 0.4, end: 0 },
		rotate: { start: 0, end: 360 },
		emitting: false,
		tint: { onEmit: () => Phaser.Math.RND.pick([0xffffff, ct.antBloodColor]) }
	});
	scene.projectileSparkEmitter.setDepth(ct.depths.projectileSpark);

	scene.enemyDeathBurstEmitter = scene.add.particles(0, 0, 'whiteParticle', {
		lifespan: 500,
		speed: { min: 20, max: 80 },
		scale: { start: 0.4, end: 0 },
		rotate: { start: 0, end: 360 },
		emitting: false,
		tint: { onEmit: () => blendColors(ct.antBloodColor, 0x000000, Math.random()) }
	});
	scene.enemyDeathBurstEmitter.setDepth(ct.depths.projectileSpark);

	scene.anims.create({
		key: 'antwalk',
		frames: scene.anims.generateFrameNumbers('ant', { start: 0, end: 61 }),
		frameRate: 100,
		repeat: -1
	});

	scene.anims.create({
		key: 'boostflame',
		frames: scene.anims.generateFrameNumbers('boostflame', { start: 0, end: 30 }),
		frameRate: 24,
		repeat: -1
	});

	scene.anims.create({
		key: 'explosion',
		frames: scene.anims.generateFrameNumbers('explosion', { start: 0, end: 35 }),
		frameRate: 75,
		repeat: 0
	});

	scene.anims.create({
		key: 'blood',
		frames: scene.anims.generateFrameNumbers('blood', { start: 0, end: 8 }),
		frameRate: 500,
		repeat: -1
	});

	scene.anims.create({
		key: 'muzzleflash',
		frames: scene.anims.generateFrameNumbers('muzzleflash', { start: 0, end: 27 }),
		frameRate: 100,
		repeat: -1
	});

	scene.bloodFrameNames = scene.anims.get('blood').frames.map(frame => frame.frame.name);
}

export function playMuzzleFlare(scene: Game, x: number, y: number, rotation: number, velocityX: number, velocityY: number, weapon: WeaponSpec): void {
	const flare = scene.add.sprite(x, y, 'muzzleflash');
	flare.rotation = rotation - Math.PI / 2; // Adjust rotation to match mechContainer's direction
	const size = weapon.muzzleFlashSize ? 25 * weapon.muzzleFlashSize : 25;
	flare.displayHeight = size;
	flare.displayWidth = size;
	const randomFrame = Phaser.Math.Between(0, 27);
	flare.setFrame(randomFrame);

	scene.physics.add.existing(flare);
	const body = flare.body as Phaser.Physics.Arcade.Body;
	body.setVelocity(velocityX, velocityY);

	createLightFlash(scene, x, y, ct.muzzleFlashColor, 2, 10, 10);
	scene.time.delayedCall(100, () => flare.destroy());
}

export function addFlameToProjectile(scene: Game, projectile: Projectile, x: number, y: number, forwardAngle: number) {
	const offsetX = Math.cos(forwardAngle) * (projectile.displayHeight);
	const offsetY = Math.sin(forwardAngle) * (projectile.displayHeight);
	const flame = scene.add.sprite(x - offsetX, y - offsetY, 'boostflame');
	flame.setDisplaySize(projectile.displayWidth, projectile.displayHeight / 2);
	flame.setAngle(Phaser.Math.RadToDeg(forwardAngle - Math.PI));  // Set the angle of the flame to match the projectile's direction
	flame.play('boostflame');
	projectile.flame = flame;
	projectile.flameOffsets = {
		x: offsetX,
		y: offsetY
	};
	flame.setDepth(projectile.depth - 1);
}

export function createDustCloud(scene: Game, x: number, y: number, directionX: number, directionY: number, opacity: number): void {
	const dustCloud = scene.physics.add.sprite(x, y, 'dust');
	dustCloud.setRotation(Phaser.Math.Between(0, 2 * Math.PI));

	dustCloud.setAlpha(opacity);
	dustCloud.setDisplaySize(50, 50);
	dustCloud.setVelocity(directionX / 2, directionY / 2);

	scene.tweens.add({
		targets: dustCloud,
		alpha: 0,
		displayWidth: 100,
		displayHeight: 100,
		duration: 1000,
		onComplete: () => {
			dustCloud.destroy();
		}
	});
}

export function createLightFlash(scene: Game, x: number, y: number, color: number, duration: number, intensity: number, radius: number): void {
	const flash = scene.lights.addLight(x, y, radius, color, intensity);

	scene.tweens.add({
		targets: flash,
		intensity: { from: intensity, to: 0 },
		duration: duration,
		onComplete: () => {
			scene.lights.removeLight(flash);
		}
	});
}

export function createBloodSplat(scene: Game, ant: EnemySprite, splatSize: number) {
	const bloodSplat = scene.add.image(ant.x, ant.y, 'blood', Phaser.Utils.Array.GetRandom(scene.bloodFrameNames));
	bloodSplat.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
	bloodSplat.displayHeight = splatSize;
	bloodSplat.displayWidth = splatSize;
	bloodSplat.setDepth(ct.depths.antblood);
	bloodSplat.setTint(ct.antBloodColor);
	bloodSplat.setPipeline('Light2D');
	scene.decals.add(bloodSplat);
	tweenFade(scene, bloodSplat);
}

export function createDeadAnt(scene: Game, enemySprite: EnemySprite) {
	enemyDeathBurst(scene, enemySprite.x, enemySprite.y);
	const deadAnt = scene.add.image(enemySprite.x, enemySprite.y, 'blood', 8);
	deadAnt.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
	deadAnt.displayHeight = 80;
	deadAnt.displayWidth = 80;
	deadAnt.setDepth(ct.depths.antbody);
	deadAnt.setTint(ct.antColor);
	deadAnt.setPipeline('Light2D');
	scene.decals.add(deadAnt);
	tweenFade(scene, deadAnt);
}

function enemyDeathBurst(scene: Game, x: number, y: number): void {
	scene.enemyDeathBurstEmitter.emitParticleAt(x, y, 10);
}


export function tweenFade(scene: Game, image: Phaser.GameObjects.Image) {
	scene.tweens.add({
		targets: image,
		alpha: 0,
		duration: ct.DecalFadeTime,
		ease: 'Quadratic.In',
		onComplete: () => {
			image.destroy();
		}
	});
}

export function renderExplosion(scene: Game, x: number, y: number, diameter: number, damage: number) {
	const explosion = scene.add.sprite(x, y, 'explosion');
	explosion.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
	const displayDiameter = Phaser.Math.FloatBetween(diameter*1.2, diameter*0.8)
	explosion.displayHeight = displayDiameter + 10;
	explosion.displayWidth = displayDiameter + 10;
	explosion.setDepth(ct.depths.explosion);
	explosion.setAlpha(0.7);
	explosion.play('explosion');
	const scorch = scene.add.sprite(x, y, 'scorch1');
	scorch.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
	scorch.displayHeight = displayDiameter + 10;
	scorch.displayWidth = displayDiameter + 10;
	scorch.setDepth(ct.depths.scorch);
	scorch.setAlpha(0.75);
	scene.tweens.add({
		targets: scorch,
		alpha: 0,            // Target alpha value
		duration: ct.DecalFadeTime,      // Duration of the fade (in milliseconds)
		ease: 'Linear',      // Easing function
		onComplete: () => {
			scorch.destroy();
		}
	});
	createLightFlash(scene, x, y, ct.explosionColor, 200, damage / 3, diameter * 2);
}

export function addCloudAtPlayermech(scene: Game, opacity: number): void {
	const currentPosX = scene.player.mechContainer.body!.position.x;
	const currentPosY = scene.player.mechContainer.body!.position.y;
	createDustCloud(
		scene,
		currentPosX + scene.player.mechContainer.width / 2,
		currentPosY + scene.player.mechContainer.height / 2,
		scene.player.mechContainer.body!.velocity.x,
		scene.player.mechContainer.body!.velocity.y,
		opacity
	);
}
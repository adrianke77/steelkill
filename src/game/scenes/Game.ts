import { Scene } from 'phaser';
import { EventBus } from '../../EventBus';
import { getVectMag } from '../utils';
import { Constants as ct } from '../constants';
import { createEmittersAndAnimations, addCloudAtPlayermech } from '../rendering';
import { PlayerMech } from '../classes/PlayerMech';
import { ProjectileManager } from '../classes/ProjectileManager';
import { EnemyManager } from '../classes/EnemyManager';
import { InputManager } from '../classes/InputManager';
import { ViewManager } from '../classes/ViewManager';
import { WeaponSpec, EnemySprite, Projectile, FourPositions } from '../interfaces';

export class Game extends Scene {
	viewMgr: ViewManager;
	player: PlayerMech;
	projectileMgr: ProjectileManager;
	enemyMgr: EnemyManager;
	inputMgr: InputManager;
	lastWalkCloudTime: number;
	lastWeaponFireTime: [number, number, number, number];
	magCount: [number, number, number, number];
	remainingAmmo: [number, number, number, number];
	lastReloadStart: [number, number, number, number]; // zero indicates not reloading
	lastAntSpawnTime: number;
	playerSkidding: boolean;
	bloodFrameNames: string[];
	sceneName: string;
	decals: Phaser.GameObjects.Group;
	projectileSparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
	enemyDeathBurstEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

	constructor() {
		super('Game');
		this.sceneName = 'game';
	}

	endGame() {
		this.scene.start('MainMenu');
	}

	preload() {
		this.load.setPath('assets');
		this.load.image('background', 'darksand.jpg');
		this.load.image('mech', 'mech.png');
		this.load.image('dust', 'dust.png');
		this.load.image('bullet1', 'bullet1.png');
		this.load.image('scorch1', 'scorch1.png');
		this.load.image('missile', 'missile.png');
		this.load.spritesheet('ant', 'whiteant.png', { frameWidth: 202, frameHeight: 248 });
		this.load.spritesheet('boostflame', 'boostflame.png', { frameWidth: 107, frameHeight: 48 });
		this.load.spritesheet('blood', 'greyblood.png', { frameWidth: 50, frameHeight: 50 });
		this.load.spritesheet('explosion', 'explosion.png', { frameWidth: 100, frameHeight: 96 });
		this.load.spritesheet('muzzleflash', 'muzzleflash.png', { frameWidth: 166, frameHeight: 165 });

		// Placeholder explosion particle
		var graphics = this.add.graphics();
		graphics.fillStyle(0xFFFFFF, 1);
		graphics.fillCircle(0, 0, 20);

		// Create a texture from the graphics object
		graphics.generateTexture('whiteParticle', 20, 20);
		graphics.destroy();
	}

	create() {
		createEmittersAndAnimations(this);

		this.physics.world.setBounds(0, 0, 5000, 5000);

		this.decals = this.add.group({
			classType: Phaser.GameObjects.Image,
			runChildUpdate: false,
		});

		this.player = new PlayerMech(this);
		this.viewMgr = new ViewManager(this);
		this.projectileMgr = new ProjectileManager(this);
		this.enemyMgr = new EnemyManager(this);
		this.inputMgr = new InputManager(this);

		this.lastWalkCloudTime = 0;
		this.lastWeaponFireTime = [0, 0, 0, 0];
		this.lastAntSpawnTime = 0;
		this.playerSkidding = false;

		this.magCount = [0, 0, 0, 0];
		for (let i = 0; i < ct.weapons.length; i++) {
			this.magCount[i] = ct.weapons[i].magSize;
		}

		this.lastReloadStart = [0, 0, 0, 0];

		this.remainingAmmo = [0, 0, 0, 0];
		for (let i = 0; i < ct.weapons.length; i++) {
			this.remainingAmmo[i] = ct.weapons[i].totalAmmo - ct.weapons[i].magSize;
		}

		EventBus.emit('mag-count', this.magCount);
		EventBus.emit('remaining-ammo', this.remainingAmmo);

		this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
			if (body.gameObject.name === 'projectile') {
				const projectile = body.gameObject as Projectile;
				this.lights.removeLight(projectile.light);
				if (projectile.flame) {
					projectile.flame.destroy();
				}
				projectile.destroy();
			}
		});

		this.physics.add.collider(this.enemyMgr.enemies, this.enemyMgr.enemies);

		this.physics.add.collider(
			this.projectileMgr.projectiles,
			this.enemyMgr.enemies,
			undefined,
			(bullet, ant) => {
				return this.projectileMgr.projectileHitsEnemy(bullet as Projectile, ant as EnemySprite);
			},
			this
		);

		EventBus.emit('current-scene-ready', this);
	}

	update(time: number) {
		this.enemyMgr.enemies.children.iterate((ant: Phaser.GameObjects.GameObject): boolean => {
			this.enemyMgr.chasePlayer(ant as Phaser.Physics.Arcade.Sprite, ct.antSpeed);
			return true;
		});

		this.projectileMgr.projectiles.children.iterate((projectile: Phaser.GameObjects.GameObject): boolean => {
			const projectileSprite = projectile as Projectile;
			if (projectileSprite.light) {
				projectileSprite.light.setPosition(projectileSprite.x, projectileSprite.y);
			}
			if (projectileSprite.flame) {
				const offsetX = projectileSprite.flameOffsets.x;
				const offsetY = projectileSprite.flameOffsets.y;
				projectileSprite.flame.setPosition(projectileSprite.x - offsetX, projectileSprite.y - offsetY);
			}
			return true;
		});

		const pointer = this.input.activePointer;
		this.player.mechContainer.rotation = Phaser.Math.Angle.Between(this.player.mechContainer.x, this.player.mechContainer.y, pointer.worldX, pointer.worldY) + Math.PI / 2;

		this.viewMgr.updateCameraOffset(this.player.mechContainer.rotation);

		let isBoosting = this.inputMgr.inputs.boost.isDown && this.player.currentBoost > 0 && !this.player.boostOverload;

		// reset boost overload if above 1/4 of capacity
		if (!!this.player.boostOverload && this.player.currentBoost > this.player.boostMax / 4) {
			this.player.boostOverload = false
		}

		//regen
		this.player.currentBoost = Math.min(this.player.currentBoost + ct.boostRegeneration, ct.boostCapacity)
		//spend
		if (isBoosting) {
			this.player.currentBoost = this.player.currentBoost - ct.boostConsumption
			if (this.player.currentBoost <= 0) {
				this.player.boostOverload = true
			}
		}
		//update
		EventBus.emit('boost-status', this.player.currentBoost, this.player.boostOverload);

		const firing = this.inputMgr.mouseStates.leftDown;

		const maxVel = isBoosting ? ct.maxBoostVel : ct.maxWalkVel;
		const accel = isBoosting ? ct.boostAccel : ct.walkAccel;

		const stopVelocity = 20;
		const currentVelX = this.player.mechContainer.body!.velocity.x;
		const currentVelY = this.player.mechContainer.body!.velocity.y;
		const velocMag = getVectMag(currentVelX, currentVelY);

		for (const position of Object.keys(this.player.boostFlames) as FourPositions[]) {
			this.player.boostFlames[position].setVisible(false);
		}

		this.player.updateControlledAccelAndBoost(accel, isBoosting, this.inputMgr.inputs);

		if (this.playerSkidding) {
			addCloudAtPlayermech(this, 0.1);
		}

		if (!this.playerSkidding && isBoosting && velocMag > ct.maxWalkVel) {
			this.playerSkidding = true;
		}
		if (!isBoosting && velocMag < ct.maxWalkVel) {
			this.playerSkidding = false;
		}

		if (time - ct.antSpawnPeriod > this.lastAntSpawnTime && this.enemyMgr.enemies.getChildren().length < 1000) {
			this.lastAntSpawnTime = time;
			this.enemyMgr.createAnt(Phaser.Math.Between(0, this.cameras.main.worldView.width), 20);
		}

		if (firing) {
			ct.weapons.forEach((weapon, index) => {
				if (time - this.lastWeaponFireTime[index] > weapon.fireDelay) {
					this.playerWeaponFire(index, isBoosting, time);
					this.lastWeaponFireTime[index] = time;
				}
			});
		}

		if (!isBoosting &&
			(
				this.inputMgr.inputs.up.isDown ||
				this.inputMgr.inputs.down.isDown ||
				this.inputMgr.inputs.left.isDown ||
				this.inputMgr.inputs.right.isDown
			)
		) {
			if (time - ct.walkCloudPeriod > this.lastWalkCloudTime) {
				addCloudAtPlayermech(this, 0.5);
				this.lastWalkCloudTime = time;
			}
		}

		if (this.inputMgr.inputs.up.isUp &&
			this.inputMgr.inputs.down.isUp &&
			this.inputMgr.inputs.left.isUp &&
			this.inputMgr.inputs.right.isUp
		) {
			if (velocMag < stopVelocity) {
				(this.player.mechContainer.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
			} else {
				const appliedDecel = this.playerSkidding ? ct.skidDecel : ct.deceleration;
				const decelerationX = Math.sign(currentVelX) * Math.min(Math.abs(currentVelX), appliedDecel);
				const decelerationY = Math.sign(currentVelY) * Math.min(Math.abs(currentVelY), appliedDecel);

				(this.player.mechContainer.body as Phaser.Physics.Arcade.Body).setAcceleration(-decelerationX, -decelerationY);
			}
		}

		if (velocMag > maxVel) {
			const scale = maxVel / velocMag;
			(this.player.mechContainer.body as Phaser.Physics.Arcade.Body).setVelocity(currentVelX * scale, currentVelY * scale);
		}
	}

	changeScene() {
		this.scene.start('GameOver');
	}

	playerWeaponFire(weaponIndex: number, isUnstable: boolean, time: number): void {
		const weaponPosition = ct.weaponPositions[weaponIndex];
		const weapon = ct.weapons[weaponIndex] as WeaponSpec;
	
		// Check if the weapon is reloading
		if (this.lastReloadStart[weaponIndex] !== 0) {
			if (time - this.lastReloadStart[weaponIndex] >= weapon.reloadDelay) {
				this.finishReload(weaponIndex, weapon);
			} else {
				// Still reloading, cannot fire
				EventBus.emit('reload-status', this.lastReloadStart.map((startTime) => startTime !== 0));
				return;
			}
		}
	
		const ammoReduction = weapon.burstFire ? weapon.burstFire : 1;
	
		// Check if there is enough ammo in the magazine for the burst
		if (this.magCount[weaponIndex] < ammoReduction) {
			// Start reloading if out of ammo
			if (this.remainingAmmo[weaponIndex] > 0) {
				this.startReload(weaponIndex, time, weapon.reloadDelay);
				return;
			} else {
				// No ammo left to reload, cannot fire
				EventBus.emit('reload-status', this.lastReloadStart.map((startTime) => startTime !== 0));
				return;
			}
		}
	
		// Reduce ammo count in magazine by the determined amount
		this.magCount[weaponIndex] -= ammoReduction;
		EventBus.emit('mag-count', this.magCount);
	
		// Fire the weapon
		if (!!weapon.burstFire && !!weapon.burstFireDelay) {
			for (let i = 0; i < weapon.burstFire; i++) {
				this.projectileMgr.fireProjectile(i * weapon.burstFireDelay, weaponPosition, weaponIndex, isUnstable, weapon);
			}
		} else {
			this.projectileMgr.fireProjectile(0, weaponPosition, weaponIndex, isUnstable, weapon);
		}
	
		// If the magazine is now empty or does not have enough ammo for another burst, start reloading immediately
		if (this.magCount[weaponIndex] < ammoReduction && this.remainingAmmo[weaponIndex] > 0) {
			this.startReload(weaponIndex, time, weapon.reloadDelay);
		} else {
			// Update reloading status
			EventBus.emit('reload-status', this.lastReloadStart.map((startTime) => startTime !== 0));
		}
	}

	startReload(weaponIndex: number, startTime: number, reloadDelay: number): void {
		this.lastReloadStart[weaponIndex] = startTime;
		EventBus.emit('reload-status', this.lastReloadStart.map((startTime) => startTime !== 0));

		this.time.addEvent({
			delay: reloadDelay,
			callback: () => {
				const weapon = ct.weapons[weaponIndex] as WeaponSpec;
				this.finishReload(weaponIndex, weapon);
			},
			callbackScope: this
		});
	}

	finishReload(weaponIndex: number, weapon: WeaponSpec): void {
		this.lastReloadStart[weaponIndex] = 0;
		const ammoToReload = weapon.magSize - this.magCount[weaponIndex];
		this.magCount[weaponIndex] = weapon.magSize; // Refill the magazine
		this.remainingAmmo[weaponIndex] -= ammoToReload; // Deduct reloaded ammo from remaining ammo
		EventBus.emit('mag-count', this.magCount);
		EventBus.emit('remaining-ammo', this.remainingAmmo);
		EventBus.emit('reload-status', this.lastReloadStart.map((startTime) => startTime !== 0));
	}
}

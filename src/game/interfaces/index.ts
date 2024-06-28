export interface WeaponSpec {
	name:string,
	fireDelay: number,
	image: string,
	initialSpeed: number,
	acceleration?: number,
	maxSpeed?: number,
	baseSpread: number,
	roundHeight: number,
	roundWidth: number,
	damage: number,
	penetration: number,
	totalAmmo:number,
	magSize:number,
	reloadDelay:number,
	explodeRadius?: number,
	explodeDamage?: number,
	burstFire?: number,
	burstFireDelay?: number,
	hasBoostFlame?: boolean,
	muzzleFlashSize?: number,
	tint?: number,
	lightColor?: number,
	lightIntensity?: number,
	trail?: boolean,
	trailDuration? : number
}

export interface EnemySprite extends Phaser.Physics.Arcade.Sprite {
	health: number,
	armor: number
}

export interface Projectile extends Phaser.Physics.Arcade.Sprite {
	damage: number,
	penetration: number,
	weaponIndex: number,
	light: Phaser.GameObjects.Light,
	flame: Phaser.GameObjects.Sprite
	flameOffsets: {
		x: number,
		y: number
	}
	trailEvent: Phaser.Time.TimerEvent
}

export type FourPositions = 'front' | 'back' | 'left' | 'right';

export type WeaponPosition = number[]
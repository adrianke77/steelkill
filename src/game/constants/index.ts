import { WeaponSpec } from "../interfaces";

export const Constants = {
	gameWidth: window.innerWidth,
	gameHeight: window.innerHeight,
	DecalFadeTime: 15000,
	walkCloudPeriod: 300,
	antSpawnPeriod: 25,
	antSpeed: 100,
	antHealth: 40,
	antDisplaySize: 40,
	antCollisionSize: 40,
	mechDimensions: [30, 30],
	boostLength: 50,
	boostWidth: 20,
	antBloodColor: 0x00AA00,
	antColor: 0x111111,
	explosionColor: 0xed6240,
	boosterLightColor: 0xed6240,
	muzzleFlashColor: 0xF9CF57,
	maxWalkVel: 100,
	maxBoostVel: 300,
	walkAccel: 150,
	boostAccel: 400,
	deceleration: 70,
	skidDecel: 30,
	startPosition: { y: 500, x: 900 },
	depths: {
		ant: 9999,
		player: 9999,
		projectile: 8000,
		antblood: 7500,
		antbody: 7500,
		explosion: 10000,
		scorch: 8000,
		projectileSpark: 10000
	},
	MouseButtons: {
		LEFT: 0,
		MIDDLE: 1,
		RIGHT: 2
	},
	weapons: [
		{	
			name: '12.7mm HMG',
			fireDelay: 25,
			image: 'bullet1',
			initialSpeed: 1200,
			baseSpread: 0.1,
			roundHeight: 25,
			roundWidth: 3,
			damage: 5,
			penetration: 4,
			muzzleFlashSize: 1,
			totalAmmo:6000,
			magSize:400,
			reloadDelay:3000
		},
		{	
			name: '12.7mm HMG',
			fireDelay: 25,
			image: 'bullet1',
			initialSpeed: 1200,
			baseSpread: 0.05,
			roundHeight: 25,
			roundWidth: 3,
			damage: 5,
			penetration: 4,
			muzzleFlashSize: 1,
			totalAmmo:6000,
			magSize:400,
			reloadDelay:3000
		},
		{	
			name: 'Hydra 84 RKT',
			fireDelay: 3000,
			image: 'missile',
			initialSpeed: 0,
			acceleration: 1000,
			maxSpeed: 2000,
			baseSpread: 0.05,
			roundHeight: 20,
			roundWidth: 10,
			damage: 0,
			explodeRadius: 70,
			explodeDamage: 65,
			penetration: 10,
			burstFire: 6,
			burstFireDelay: 100,
			hasBoostFlame: true,
			muzzleFlashSize: 1,
			totalAmmo:300,
			magSize:30,
			reloadDelay:5000
		},
		{	
			name: 'MK 43 DN-RAIL',
			fireDelay: 2000,
			image: 'bullet1',
			initialSpeed: 4000,
			baseSpread: 0.05,
			roundHeight: 80,
			roundWidth: 8,
			damage: 40,
			penetration: 70,
			tint: 0x7DF9FF,
			lightColor: 0x7DF9FF,
			lightIntensity: 5,
			muzzleFlashSize: 3,
			totalAmmo:100,
			magSize:1,
			reloadDelay:2000,
			trail: true,
			trailDuration: 1000
		}
	] as WeaponSpec[],
	weaponPositions: [
		[-15, -15], // far left
		[15, -15],  // far right
		[-7.5, -15], // mid left
		[7.5, -15]   // mid right
	],
	boostCapacity: 5000,
	boostRegeneration: 20,
	boostConsumption: 40
};


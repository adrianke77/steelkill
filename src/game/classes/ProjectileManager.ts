// ProjectileManager.ts
import { Game } from '../scenes/Game';
import { Constants as ct } from '../constants';
import { EnemySprite, Projectile, WeaponPosition, WeaponSpec } from '../interfaces';
import {
    addFlameToProjectile,
    createLightFlash,
    createBloodSplat,
    createDeadAnt,
    renderExplosion,
    playMuzzleFlare
} from '../rendering';

export class ProjectileManager {
    private scene: Game;
    projectiles: Phaser.GameObjects.Group;

    constructor(scene: Game) {
        this.scene = scene;
        this.projectiles = this.scene.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
    }
    playerCreateProjectile(x: number, y: number, angle: number, weaponIndex: number, isUnstable: boolean): void {
        const weapon = ct.weapons[weaponIndex];
        const { startX, startY } = this.calculateStartPosition(x, y, angle, weapon.roundHeight);
        const projectile = this.createProjectile(startX, startY, weapon.image);

        createLightFlash(this.scene, startX, startY, ct.muzzleFlashColor, 1, 2, 100);

        this.setupProjectilePhysics(projectile, weapon, weaponIndex);

        const facing = angle - Math.PI / 2;
        const spread = isUnstable ? weapon.baseSpread * 1.5 : weapon.baseSpread;
        const forwardAngle = Phaser.Math.FloatBetween(facing + spread, facing - spread);

        this.setupProjectileDisplay(projectile, weapon, forwardAngle);
        this.setupProjectileMovement(projectile, weapon, forwardAngle);

        if (weapon.lightColor) {
            this.addLightToProjectile(projectile, weapon.lightColor, weapon.lightIntensity!);
        }
        if (weapon.hasBoostFlame) {
            this.addBoostFlame(projectile, startX, startY, forwardAngle, weapon);
        }
    }

    private calculateStartPosition(x: number, y: number, angle: number, roundHeight: number) {
        const halfLength = roundHeight / 2;
        const offsetX = halfLength * Math.cos(angle - Math.PI / 2);
        const offsetY = halfLength * Math.sin(angle - Math.PI / 2);
        return { startX: x + offsetX, startY: y + offsetY };
    }

    private createProjectile(startX: number, startY: number, image: string): Projectile {
        const projectile = this.projectiles.create(startX, startY, image) as Projectile;
        projectile.setCollideWorldBounds(true);
        projectile.setName('projectile');
        (projectile.body as Phaser.Physics.Arcade.Body).onWorldBounds = true;
        return projectile;
    }

    private setupProjectilePhysics(projectile: Projectile, weapon: WeaponSpec, weaponIndex:number): void {
        projectile.damage = weapon.damage;
        projectile.penetration = weapon.penetration;
        projectile.weaponIndex = weaponIndex;
        if (weapon.tint) {
            projectile.setTint(weapon.tint);
        }
    }

    private setupProjectileDisplay(projectile: Projectile, weapon: any, forwardAngle: number): void {
        projectile.setDisplaySize(weapon.roundHeight, weapon.roundWidth);
        projectile.setDepth(ct.depths.projectile);
        projectile.setRotation(forwardAngle);
        if (weapon.trail) {
            this.scene.time.addEvent({
                delay: 10, // Adjust the delay for how frequently to create the trail effect
                callback: () => {
                    if (!projectile.active) {
                        return;
                    }
                    const trailImage = this.scene.add.image(projectile.x, projectile.y, weapon.image);
                    console.log('createdimage')
                    trailImage.setDisplaySize(weapon.roundHeight, weapon.roundWidth);
                    trailImage.setRotation(forwardAngle);
                    trailImage.setAlpha(0.5); // Initial alpha for the trail image

                    this.scene.tweens.add({
                        targets: trailImage,
                        alpha: 0,
                        duration: 1000, // Adjust the duration for how long the trail should fade out
                        onComplete: () => {
                            trailImage.destroy();
                        }
                    });
                },
                callbackScope: this,
                loop: true
            });
        }
    }

    private setupProjectileMovement(projectile: Projectile, weapon: any, forwardAngle: number): void {
        projectile.setVelocity(weapon.initialSpeed * Math.cos(forwardAngle), weapon.initialSpeed * Math.sin(forwardAngle));
        if (weapon.acceleration) {
            projectile.setMaxVelocity(weapon.maxSpeed);
            projectile.setAcceleration(
                weapon.acceleration * Math.cos(forwardAngle),
                weapon.acceleration * Math.sin(forwardAngle)
            );
        }
    }

    private addLightToProjectile(projectile: Projectile, lightColor: number, lightIntensity: number): void {
        projectile.setPipeline('Light2D');
        const light = this.scene.lights.addLight(projectile.x, projectile.y, 1000)
            .setColor(lightColor)
            .setIntensity(lightIntensity);
        projectile.light = light;
    }

    private addBoostFlame(projectile: Projectile, startX: number, startY: number, forwardAngle: number, weapon: any): void {
        addFlameToProjectile(this.scene, projectile, startX, startY, forwardAngle);
        projectile.setPipeline('Light2D');
        const light = this.scene.lights.addLight(projectile.x, projectile.y, projectile.displayWidth * 5)
            .setColor(ct.boosterLightColor)
            .setIntensity(weapon.acceleration / 1000);
        projectile.light = light;
    }

    projectileHitsEnemy(projectile: Projectile, enemy: EnemySprite): boolean {
        const weapon = ct.weapons[projectile.weaponIndex];

        // Handle explosion
        if (weapon?.explodeRadius) {
            this.createExplosion((projectile.x + enemy.x) / 2, (projectile.y + enemy.y) / 2, weapon.explodeRadius, weapon.explodeDamage!);
            this.destroyProjectile(projectile);
            return true;
        }

        // Helper function to handle damage and effects
        const applyDamageAndEffects = () => {
            enemy.health -= projectile.damage;
            this.projectileSpark((projectile.x + enemy.x) / 2, (projectile.y + enemy.y) / 2);
            createBloodSplat(this.scene, enemy, 30);
            if (enemy.health <= 0) {
                enemy.destroy();
                createDeadAnt(this.scene, enemy);
            }
        };

        // Handle penetration
        if (projectile!.penetration > enemy.armor) {
            applyDamageAndEffects();
            projectile.penetration -= enemy.armor / 2;
            return false;
        } else if (projectile!.penetration > enemy.armor / 2) {
            applyDamageAndEffects();
            this.destroyProjectile(projectile);
        } else if (projectile!.penetration < enemy.armor / 2) {
            this.destroyProjectile(projectile);
        }
        return true;
    }

    private destroyProjectile(projectile: Projectile): void {
        if (projectile.flame) {
            projectile.flame.destroy();
        }
        if (projectile.light) {
            this.scene.lights.removeLight(projectile.light);
        }
        projectile.destroy();
    }

    createExplosion(x: number, y: number, radius: number, baseDamage: number): void {
        renderExplosion(this.scene, x, y, radius * 2, baseDamage);
        this.scene.enemyMgr.enemies.children.each((enemy: Phaser.GameObjects.GameObject) => {
            const enemySprite = enemy as EnemySprite;
            const distance = Phaser.Math.Distance.Between(x, y, enemySprite.x, enemySprite.y);
            if (distance <= radius) {
                const damage = baseDamage * (0.5 + 0.5 * (1 - distance / radius));
                (enemySprite).health -= Math.max(damage - (enemySprite).armor, 0);
                createBloodSplat(this.scene, enemySprite, 30);
                if ((enemySprite).health <= 0) {
                    createBloodSplat(this.scene, enemySprite, 60);
                    createDeadAnt(this.scene, enemySprite);
                    enemySprite.destroy();
                } else {
                    const angle = Phaser.Math.Angle.Between(enemySprite.x, enemySprite.y, x, y);
                    enemySprite.x -= Math.cos(angle) * 5;
                    enemySprite.y -= Math.sin(angle) * 5;
                }
            }
            return true;
        });
    }

    projectileSpark(x: number, y: number): void {
        this.scene.projectileSparkEmitter.emitParticleAt(x, y, 10);
        createLightFlash(this.scene, x, y, ct.muzzleFlashColor, 1, 2, 80);
    }

    fireProjectile = (delay: number, weaponPosition: WeaponPosition, weaponIndex: number, isUnstable: boolean, weapon: WeaponSpec) => {
        this.scene.time.delayedCall(delay, () => {
            const rotation = this.scene.player.mechContainer.rotation;
            const offsetX = weaponPosition[0] * Math.cos(rotation) - weaponPosition[1] * Math.sin(rotation);
            const offsetY = weaponPosition[0] * Math.sin(rotation) + weaponPosition[1] * Math.cos(rotation);
            const startX = this.scene.player.mechContainer.x + offsetX;
            const startY = this.scene.player.mechContainer.y + offsetY;

            this.scene.projectileMgr.playerCreateProjectile(startX, startY, rotation, weaponIndex, isUnstable);
            playMuzzleFlare(
                this.scene,
                startX,
                startY,
                rotation,
                this.scene.player.mechContainer.body!.velocity.x,
                this.scene.player.mechContainer.body!.velocity.y,
                weapon
            );
        });
    };
}

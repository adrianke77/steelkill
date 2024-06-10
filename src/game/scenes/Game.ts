import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

const walkCloudPeriod = 300;
const antSpawnPeriod = 100;
const antSpeed = 50;
const antHealth = 40;
const antDisplaySize = 40;
const antCollisionSize = 30;
const mechDimensions = [15, 15];
const gunPositions = {
    a: [-4, 4],
    b: [4, 4],
    c: [],
    d: []
};
const antBloodColor = 0x00AA00;
const deadAntColor = 0x001000;
const fireballColor = 0xC25811;
const maxWalkVel = 75;
const maxBoostVel = 200;
const deceleration = 70;
const skidDecel = 30;
const startPosition = {
    y: 500,
    x: 900
};
type FourPositions = 'front' | 'back' | 'left' | 'right';
const depths = {
    ant: 9999,
    player: 9999,
    projectile: 8000,
    antblood: 1
}
const weapons = [
    {
        fireDelay: 50,
        image: 'bullet1',
        initialSpeed: 800,
        baseSpread: 0.1,
        roundHeight: 10,
        roundWidth: 2,
        damage: 5,
        explodeRadius: 0,
        explodeDamage: 0,
        penetration: 4
    }, {
        fireDelay: 75,
        image: 'bullet1',
        initialSpeed: 1200,
        baseSpread: 0.05,
        roundHeight: 15,
        roundWidth: 3,
        damage: 5,
        explodeRadius: 0,
        explodeDamage: 0,
        penetration: 4
    }, {
        fireDelay: 1000,
        image: 'bullet1',
        initialSpeed: 1500,
        baseSpread: 0.05,
        roundHeight: 40,
        roundWidth: 10,
        damage: 20,
        explodeRadius: 150,
        explodeDamage: 50,
        penetration: 10
    }, {
        fireDelay: 9999,
        image: 'bullet1',
        initialSpeed: 3000,
        baseSpread: 0.05,
        roundHeight: 30,
        roundWidth: 7,
        damage: 30,
        explodeRadius: 0,
        explodeDamage: 0,
        penetration: 20
    }
]

const MouseButtons = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2
};

interface WeaponSpec {
    fireDelay: number,
    image: string,
    initialSpeed: number,
    baseSpread: number,
    roundHeight: number,
    roundWidth: number,
    damage: number,
    explodeRadius: number,
    explodeDamage: number,
    penetration: number
}

interface AntSprite extends Phaser.Physics.Arcade.Sprite {
    health: number,
    armor: number
}

interface Projectile extends Phaser.Physics.Arcade.Sprite {
    damage: number,
    penetration: number,
    weaponIndex: number
}

// move to util functions file later
const getVectMag = (x: number, y: number): number => {
    return Math.sqrt(x ** 2 + y ** 2);
}

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameText: Phaser.GameObjects.Text;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    playerMech: Phaser.Physics.Arcade.Sprite;
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
    gunPositions: {
        left: [number, number],
        right: [number, number]
    };
    playerSkidding: boolean;
    lastWalkCloudTime: number;
    weapons: [WeaponSpec, WeaponSpec, WeaponSpec, WeaponSpec];
    lastWeaponFireTime: [number, number, number, number];
    bulletSparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    explosionEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    lastAntSpawnTime: number;
    ants: Phaser.GameObjects.Group;
    bullets: Phaser.GameObjects.Group;
    antsAILastUpdateTime: number;
    bloodFrameNames: string[];
    boostFlames: Record<FourPositions, Phaser.GameObjects.Sprite>;
    mechContainer: Phaser.GameObjects.Container;
    wasNotBoosting: boolean

    constructor() {
        super('Game');
    }

    preload() {
        this.load.setPath('assets');

        this.load.image('mech', 'mech.png');
        this.load.image('dust', 'dust.png');
        this.load.image('bullet1', 'bullet1.png');
        this.load.image('background', 'darksand.jpg');
        this.load.spritesheet('ant', 'antwalk.png', { frameWidth: 202, frameHeight: 248 });
        this.load.spritesheet('boostflame', 'boostflame.png', { frameWidth: 214, frameHeight: 96 });
        this.load.spritesheet('blood', 'greyblood.png', { frameWidth: 100, frameHeight: 100 });

        // Placeholder explosion particle
        var graphics = this.add.graphics();
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(0, 0, 20);

        // Create a texture from the graphics object
        graphics.generateTexture('whiteParticle', 20, 20);
        graphics.destroy();
    }

    create() {
        this.bulletSparkEmitter = this.add.particles(0, 0, 'whiteParticle', {
            lifespan: 200,
            speed: { min: 200, max: 350 },
            scale: { start: 0.4, end: 0 },
            rotate: { start: 0, end: 360 },
            emitting: false,
            tint: { onEmit: () => Phaser.Math.RND.pick([0xffffff, antBloodColor]) }
        });

        this.explosionEmitter = this.add.particles(0, 0, 'whiteParticle', {
            x: 400,
            y: 300,
            speed: 200,
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 500,
            emitting: false,
            tint: fireballColor
        });

        this.anims.create({
            key: 'antwalk',
            frames: this.anims.generateFrameNumbers('ant', { start: 0, end: 61 }),
            frameRate: 100,
            repeat: -1
        });

        this.anims.create({
            key: 'boostflame',
            frames: this.anims.generateFrameNumbers('boostflame', { start: 0, end: 30 }),
            frameRate: 500,
            repeat: -1
        });

        this.anims.create({
            key: 'blood',
            frames: this.anims.generateFrameNumbers('blood', { start: 0, end: 8 }),
            frameRate: 500,
            repeat: -1
        });

        this.bloodFrameNames = this.anims.get('blood').frames.map(frame => frame.frame.name);

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x333333);

        // Set world bounds
        this.physics.world.setBounds(0, 0, 5000, 5000);
        this.camera.setBounds(0, 0, 5000, 5000);
        let background = this.add.tileSprite(0, 0, 10000, 10000, 'background');
        background.setScale(0.5)
        background.setDepth(-1)

        // Set camera size
        this.camera.setSize(window.innerWidth - 300, window.innerHeight);

        this.playerMech = this.physics.add.sprite(0, 0, 'mech');
        this.playerMech.displayWidth = mechDimensions[0];
        this.playerMech.width = mechDimensions[0];
        this.playerMech.displayHeight = mechDimensions[1];
        this.playerMech.height = mechDimensions[1];
        this.boostFlames = {
            front: this.add.sprite(0, -this.playerMech.height / 2, 'boostflame').setVisible(false),
            back: this.add.sprite(0, this.playerMech.height / 2, 'boostflame').setVisible(false),
            left: this.add.sprite(-this.playerMech.width / 2, 0, 'boostflame').setVisible(false),
            right: this.add.sprite(this.playerMech.width / 2, 0, 'boostflame').setVisible(false)
        };

        for (const position of Object.keys(this.boostFlames) as FourPositions[]) {
            const sprite = this.boostFlames[position];
            sprite.setOrigin(0, 0.5)
            sprite.play('boostflame')
            sprite.displayHeight = 10;
            sprite.displayWidth = 20;
        }
        this.boostFlames.left.setRotation(Math.PI)
        this.boostFlames.front.setRotation(-Math.PI / 2)
        this.boostFlames.back.setRotation(Math.PI / 2)

        this.mechContainer = this.add.container(startPosition.x, startPosition.y, [
            this.playerMech,
            this.boostFlames.front,
            this.boostFlames.back,
            this.boostFlames.left,
            this.boostFlames.right
        ]);
        this.physics.world.enable(this.mechContainer);
        this.mechContainer.setDepth(depths.player);
        (this.mechContainer.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

        // Set the camera to follow the mech container, with an offset of 300 pixels to the back
        this.camera.startFollow(this.mechContainer, true, 0.03, 0.03);

        this.wasNotBoosting = true;

        // WASD bindings
        this.inputs = {
            up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            boost: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        };

        this.lastWalkCloudTime = 0;
        this.lastWeaponFireTime = [0, 0, 0, 0];
        EventBus.emit('current-scene-ready', this);

        this.mouseStates = {
            leftDown: false,
            middleDown: false,
            rightDown: false
        };

        // mouse inputs
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.button === MouseButtons.LEFT) {
                this.mouseStates.leftDown = true;
            } else if (pointer.button === MouseButtons.MIDDLE) {
                this.mouseStates.middleDown = true;
            } else if (pointer.button === MouseButtons.RIGHT) {
                this.mouseStates.rightDown = true;
            }
        });
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (pointer.button === MouseButtons.LEFT) {
                this.mouseStates.leftDown = false;
            } else if (pointer.button === MouseButtons.MIDDLE) {
                this.mouseStates.middleDown = false;
            } else if (pointer.button === MouseButtons.RIGHT) {
                this.mouseStates.rightDown = false;
            }
        });

        // World bounds collision listener
        this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
            if (body.gameObject.name === 'projectile') {
                body.gameObject.destroy();
            }
        }, this);

        this.lastAntSpawnTime = 0;
        this.ants = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
        this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
        this.physics.add.collider(this.ants, this.ants);

        this.physics.add.collider(
            this.bullets,
            this.ants,
            (bullet, ant) => {
                this.projectileHitsAnt(bullet as Projectile, ant as AntSprite);
            },
            undefined,
            this
        );
    }

    update(time: number) {
        this.ants.children.iterate((ant: Phaser.GameObjects.GameObject): boolean => {
            this.chasePlayer(ant as Phaser.Physics.Arcade.Sprite, antSpeed);
            return true
        });

        // Rotate container to face mouse
        const pointer = this.input.activePointer;
        this.mechContainer.rotation = Phaser.Math.Angle.Between(this.mechContainer.x, this.mechContainer.y, pointer.worldX, pointer.worldY) + Math.PI / 2;


        // Update camera offset based on player's rotation
        const offsetX = 200 * Math.cos(this.mechContainer.rotation + Math.PI / 2);
        const offsetY = 200 * Math.sin(this.mechContainer.rotation + Math.PI / 2);
        this.camera.setFollowOffset(offsetX, offsetY);

        // Control acceleration and velocity
        const isBoosting = this.inputs.boost.isDown;
        const firing = this.mouseStates.leftDown;

        const maxVel = isBoosting ? maxBoostVel : maxWalkVel;
        const accel = isBoosting ? 200 : 100;

        // friction stop entirely if below this value
        const stopVelocity = 20;

        const currentVelX = this.mechContainer.body!.velocity.x;
        const currentVelY = this.mechContainer.body!.velocity.y;
        const velocMag = getVectMag(currentVelX, currentVelY);

        // reset boostflames visiblity, updateControlledAccelAndBoost will add the visible flames again
        for (const position of Object.keys(this.boostFlames) as FourPositions[]) {
            this.boostFlames[position].setVisible(false)
        }


        this.updateControlledAccelAndBoost(accel, isBoosting);

        if (this.playerSkidding) {
            this.addCloudAtPlayermech(0.1);
        }

        // skidding state update
        if (!this.playerSkidding && isBoosting && velocMag > maxWalkVel) {
            this.playerSkidding = true;
        }
        if (!isBoosting && velocMag < maxWalkVel) {
            this.playerSkidding = false;
        }

        // enemy spawning

        if (time - antSpawnPeriod > this.lastAntSpawnTime) {
            this.lastAntSpawnTime = time;
            this.createAnt(Phaser.Math.Between(0, this.cameras.main.worldView.width), 20);
        }

        if (firing) {
            weapons.forEach((weapon, index) => {
                if (time - this.lastWeaponFireTime[index] > weapon.fireDelay) {
                    this.playerWeaponFire(index, isBoosting);
                    this.lastWeaponFireTime[index] = time;
                }
            });
        }

        // walk clouds
        if (!isBoosting &&
            (
                this.inputs.up.isDown ||
                this.inputs.down.isDown ||
                this.inputs.left.isDown ||
                this.inputs.right.isDown
            )
        ) {
            if (time - walkCloudPeriod > this.lastWalkCloudTime) {
                this.addCloudAtPlayermech(0.5);
                this.lastWalkCloudTime = time;
            }
        }

        // Decelerate if no key is pressed
        if (this.inputs.up.isUp &&
            this.inputs.down.isUp &&
            this.inputs.left.isUp &&
            this.inputs.right.isUp
        ) {
            // stop entirely if velocity low
            if (velocMag < stopVelocity) {
                (this.mechContainer.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
            } else {
                const appliedDecel = this.playerSkidding ? skidDecel : deceleration;
                const decelerationX = Math.sign(currentVelX) * Math.min(Math.abs(currentVelX), appliedDecel);
                const decelerationY = Math.sign(currentVelY) * Math.min(Math.abs(currentVelY), appliedDecel);

                (this.mechContainer.body as Phaser.Physics.Arcade.Body).setAcceleration(-decelerationX, -decelerationY);
            }
        }

        // Clamp the velocity if not skidding
        if (velocMag > maxVel) {
            const scale = maxVel / velocMag;
            (this.mechContainer.body as Phaser.Physics.Arcade.Body).setVelocity(currentVelX * scale, currentVelY * scale);
        }
    }

    changeScene() {
        this.scene.start('GameOver');
    }

    updateControlledAccelAndBoost(accel: number, isBoosting: boolean) {
        const rotation = this.mechContainer.rotation;
        let angle: number = 0;

        if (this.inputs.up.isDown && this.inputs.right.isDown) {
            angle = rotation - Math.PI / 4;
            if (isBoosting) {
                this.boostFlames.back.setVisible(true)
                this.boostFlames.left.setVisible(true)
            }
        } else if (this.inputs.up.isDown && this.inputs.left.isDown) {
            angle = rotation - Math.PI * 3 / 4;
            if (isBoosting) {
                this.boostFlames.right.setVisible(true)
                this.boostFlames.back.setVisible(true)
            }
        } else if (this.inputs.down.isDown && this.inputs.right.isDown) {
            angle = rotation + Math.PI / 4;
            if (isBoosting) {
                this.boostFlames.left.setVisible(true)
                this.boostFlames.front.setVisible(true)
            }
        } else if (this.inputs.down.isDown && this.inputs.left.isDown) {
            angle = rotation + Math.PI * 3 / 4;
            if (isBoosting) {
                this.boostFlames.front.setVisible(true)
                this.boostFlames.right.setVisible(true)
            }
        } else if (this.inputs.up.isDown) {
            angle = rotation - Math.PI / 2;
            if (isBoosting) {
                this.boostFlames.back.setVisible(true)
            }
        } else if (this.inputs.down.isDown) {
            angle = rotation + Math.PI / 2;
            if (isBoosting) {
                this.boostFlames.front.setVisible(true)
            }
        } else if (this.inputs.left.isDown) {
            angle = rotation - Math.PI;
            if (isBoosting) {
                this.boostFlames.right.setVisible(true)
            }
        } else if (this.inputs.right.isDown) {
            angle = rotation;
            if (isBoosting) {
                this.boostFlames.left.setVisible(true)
            }
        }

        let accelX = 0;
        let accelY = 0;

        accelX += accel * Math.cos(angle);
        accelY += accel * Math.sin(angle);
        (this.mechContainer.body as Phaser.Physics.Arcade.Body).setAcceleration(accelX, accelY);
    }

    addCloudAtPlayermech(opacity: number): void {
        const currentPosX = this.mechContainer.body!.position.x;
        const currentPosY = this.mechContainer.body!.position.y;
        this.createDustCloud(
            currentPosX + this.mechContainer.width / 2,
            currentPosY + this.mechContainer.height / 2,
            this.mechContainer.body!.velocity.x,
            this.mechContainer.body!.velocity.y,
            opacity
        );
    }

    createDustCloud(x: number, y: number, directionX: number, directionY: number, opacity: number): void {
        const dustCloud = this.physics.add.sprite(x, y, 'dust');
        dustCloud.setRotation(Phaser.Math.Between(0, 2 * Math.PI));

        dustCloud.setAlpha(opacity);
        dustCloud.setDisplaySize(50, 50);
        dustCloud.setVelocity(directionX / 2, directionY / 2);

        this.tweens.add({
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

    playerWeaponFire(index: number, isUnstable: boolean): void {
        const currentPosX = this.mechContainer.body!.position.x;
        const currentPosY = this.mechContainer.body!.position.y;
        this.createProjectile(
            currentPosX + this.mechContainer.width / 2,
            currentPosY + this.mechContainer.height / 2,
            this.mechContainer.rotation,
            index,
            isUnstable
        );
    }

    createProjectile(x: number, y: number, angle: number, weaponIndex: number, isUnstable: boolean): void {
        const gun = weapons[weaponIndex];
        const projectile = this.bullets.create(x, y, gun.image) as Projectile;
        projectile.setName('projectile');
        const facing = angle - Math.PI / 2;
        const spread = isUnstable ? gun.baseSpread * 1.5 : gun.baseSpread;
        const forwardAngle = Phaser.Math.FloatBetween(facing + spread, facing - spread);
        projectile.setDisplaySize(gun.roundHeight, gun.roundWidth);
        projectile.setDepth(depths.projectile);
        projectile.setRotation(forwardAngle);
        projectile.setVelocity(gun.initialSpeed * Math.cos(forwardAngle), gun.initialSpeed * Math.sin(forwardAngle));
        projectile.damage = gun.damage;
        projectile.penetration = gun.penetration;
        projectile.weaponIndex = weaponIndex

        // Enable collision with world bounds
        projectile.setCollideWorldBounds(true);
    }

    bulletSpark(x: number, y: number): void {
        this.bulletSparkEmitter.emitParticleAt(x, y, 10);
    }

    createAnt(x: number, y: number): void {
        const ant = this.ants.create(x, y, 'ant');
        this.chasePlayer(ant, antSpeed);
        ant.health = antHealth;
        ant.armor = 5;
        ant.displayHeight = antDisplaySize;
        ant.displayWidth = antDisplaySize;
        ant.setSize(antCollisionSize);
        ant.setDepth(depths.ant);
        ant.play('antwalk');
    }

    chasePlayer(sprite: Phaser.Physics.Arcade.Sprite, speed: number): void {
        const currentPosX = this.mechContainer.body!.position.x;
        const currentPosY = this.mechContainer.body!.position.y;
        const angle = Math.atan2(currentPosY - sprite.body!.position.y, currentPosX - sprite.body!.position.x);
        sprite.rotation = angle + Math.PI / 2;
        sprite.setVelocity(speed * Math.cos(angle), speed * Math.sin(angle));
    }

    projectileHitsAnt(projectile: Projectile, ant: AntSprite): void {
        const weapon = weapons[projectile.weaponIndex]
        console.log(weapon)

        // Handle explosion
        if (weapon?.explodeRadius) {
            this.createExplosion(projectile.x, projectile.y, weapon.explodeRadius, weapon.explodeDamage);
            projectile.destroy();
            return;
        }

        // Helper function to handle damage and effects
        const applyDamageAndEffects = () => {
            ant.health -= projectile.damage;
            this.bulletSpark((projectile.x + ant.x) / 2, (projectile.y + ant.y) / 2);
            this.createBloodSplat(ant)
            if (ant.health <= 0) {
                ant.destroy();
                this.createDeadAnt(ant)
            }
        };

        // Handle penetration
        if (weapon!.penetration > ant.armor) {
            applyDamageAndEffects();
            // Reduce penetration value
            projectile.penetration -= ant.armor / 2;
        } else if (weapon!.penetration > ant.armor / 2) {
            // If penetration is less than ant armor but more than half the armor, do full damage and destroy projectile
            applyDamageAndEffects();
            projectile.destroy();
        } else {
            projectile.destroy();
        }

        // Destroy projectile if its penetration is too low
        if (projectile.penetration <= 0) {
            projectile.destroy();
        }
    }

    createExplosion(x: number, y: number, radius: number, baseDamage: number): void {
        this.emitExplosion(400,300,fireballColor,x,y,20)

        this.ants.children.each((ant: Phaser.GameObjects.GameObject) => {
            const antSprite = ant as AntSprite
            const distance = Phaser.Math.Distance.Between(x, y, antSprite.x, antSprite.y);
            if (distance <= radius) {
                var delay = (distance / 200) * 500; // Maximum distance mapped to 500ms
                const damage = baseDamage * (1 - distance / radius);
                this.time.delayedCall(delay, () => {
                    (antSprite).health -= Math.max(damage - (antSprite).armor, 0);
                    this.createBloodSplat(ant)
                    if ((antSprite).health <= 0) {
                        this.createBloodSplat(antSprite)
                        this.createDeadAnt(antSprite)
                        antSprite.destroy();
                        this.emitExplosion(200,300,deadAntColor,antSprite.x,antSprite.y,10)
                    }
                }, [], this);

            }
            return true
        });
    }

    emitExplosion(speed: number, lifespan: number, particleTint: number, x: number, y: number, noOfParticles:number) {
        this.explosionEmitter.setParticleSpeed(speed)
        this.explosionEmitter.setParticleLifespan(lifespan)
        this.explosionEmitter.setParticleTint(particleTint)
        this.explosionEmitter.emitParticleAt(x, y, noOfParticles);
    }

    createBloodSplat(ant: AntSprite) {
        const bloodsplat = this.add.image(ant.x, ant.y, 'blood', Phaser.Utils.Array.GetRandom(this.bloodFrameNames));
        bloodsplat.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
        bloodsplat.displayHeight = 40;
        bloodsplat.displayWidth = 40;
        bloodsplat.setDepth(depths.antblood);
        bloodsplat.setTint(antBloodColor);
    }

    createDeadAnt(ant: AntSprite) {
        const deadAnt = this.add.image(ant.x, ant.y, 'blood', 8);
        deadAnt.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
        deadAnt.displayHeight = 60;
        deadAnt.displayWidth = 60;
        deadAnt.setTint(deadAntColor);
    }
}

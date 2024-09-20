import { Scene } from 'phaser';
import { EventBus } from '../../EventBus';
import { Constants as ct, music } from '../constants';
import {
  createEmittersAndAnimations,
  loadRenderingAssets,
} from '../rendering';
import { loadMechAssets, PlayerMech } from '../classes/PlayerMech';
import {
  ProjectileManager,
  loadProjectileAssets,
} from '../classes/ProjectileManager';
import { EnemyManager, loadEnemyAssets } from '../classes/EnemyManager';
import { InputManager } from '../classes/InputManager';
import { ViewManager } from '../classes/ViewManager';
import { MinimapManager } from '../classes/MinimapManager';
import {
  WeaponSpec,
  EnemySprite,
  Projectile,
  EnemyData,
} from '../interfaces';

export class Game extends Scene {
  minimapLayer: Phaser.GameObjects.Layer;
  mainLayer: Phaser.GameObjects.Layer;
  viewMgr: ViewManager;
  player: PlayerMech;
  projectileMgr: ProjectileManager;
  enemyMgr: EnemyManager;
  inputMgr: InputManager;
  minimapMgr: MinimapManager;
  lastWeaponFireTime: [number, number, number, number];
  magCount: [number, number, number, number];
  remainingAmmo: [number, number, number, number];
  lastReloadStart: [number, number, number, number]; // zero indicates not reloading
  lastEnemySpawnTimes: { [key: string]: number };
  bloodFrameNames: string[];
  sceneName: string;
  decals: Phaser.GameObjects.Group;
  projectileSparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  enemyDeathBurstEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  combinedDecals: {
    texture: Phaser.GameObjects.RenderTexture;
    image: Phaser.GameObjects.Image;
  }[];
  decalCount: number;
  fpsText: Phaser.GameObjects.Text;
  combatMusic: Phaser.Sound.BaseSound;

  constructor() {
    super('Game');
    this.sceneName = 'game';
  }

  endGame() {
    this.combatMusic.stop();
    this.scene.start('MainMenu');
  }

  preload() {
    this.sound.volume = 0.4;
    this.load.setPath('assets');
    music.forEach((fileName) => {
      this.load.audio(fileName, `audio/music/${fileName}.mp3`);
    });
    loadProjectileAssets(this);
    loadRenderingAssets(this);
    loadEnemyAssets(this);
    loadMechAssets(this);
    this.load.image('background', 'darksand.jpg');
    this.game.canvas.addEventListener(
      'contextmenu',
      (event) => {
        event.preventDefault();
      },
      false,
    );
  }

  create() {
    document.body.style.cursor = "url('./assets/crosshair.svg') 16 16, auto";

    this.mainLayer = this.add.layer();
    this.minimapLayer = this.add.layer();

    this.combatMusic = this.sound.add(
      music[Phaser.Math.Between(0, music.length - 1)],
    );
    this.combatMusic.play({
      loop: true,
      volume: ct.musicVolume,
    });
    createEmittersAndAnimations(this);

    this.physics.world.setBounds(0, 0, 5000, 5000);
    this.decals = this.add.group({
      classType: Phaser.GameObjects.Image,
      runChildUpdate: false,
    });
    this.combinedDecals = [];

    this.enemyMgr = new EnemyManager(this);
    this.player = new PlayerMech(this);
    this.viewMgr = new ViewManager(this);
    this.projectileMgr = new ProjectileManager(this);
    this.inputMgr = new InputManager(this);
    this.minimapMgr = new MinimapManager(this);

    this.inputMgr.initializeInputs();

    this.lastWeaponFireTime = [0, 0, 0, 0];
    this.lastEnemySpawnTimes = {};
    for (const enemyKey of Object.keys(ct.enemyData)) {
      this.lastEnemySpawnTimes[enemyKey] = 0;
    }

    this.magCount = [0, 0, 0, 0];
    for (let i = 0; i < this.player.weapons.length; i++) {
      this.magCount[i] = this.player.weapons[i].magSize;
    }

    this.lastReloadStart = [0, 0, 0, 0];

    this.remainingAmmo = [0, 0, 0, 0];
    for (let i = 0; i < this.player.weapons.length; i++) {
      this.remainingAmmo[i] =
        this.player.weapons[i].totalAmmo - this.player.weapons[i].magSize;
    }

    EventBus.emit('mag-count', this.magCount);
    EventBus.emit('remaining-ammo', this.remainingAmmo);

    this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
      if (body.gameObject.name === 'projectile') {
        const projectile = body.gameObject as Projectile;
        this.projectileMgr.destroyProjectile(projectile);
      }
    });

    this.physics.add.collider(this.enemyMgr.enemies, this.enemyMgr.enemies);

    this.physics.add.collider(
      this.player.mechContainer,
      this.enemyMgr.enemies,
      undefined,
      (_, enemy) => {
        return this.player.enemyHitsPlayer(enemy as EnemySprite);
      },
      this,
    );

    this.physics.add.collider(
      this.projectileMgr.projectiles,
      this.enemyMgr.enemies,
      undefined,
      (projectile, enemy) => {
        return this.projectileMgr.projectileHitsEnemy(
          projectile as Projectile,
          enemy as EnemySprite,
        );
      },
      this,
    );

    this.fpsText = this.add.text(10, 10, '', {
      fontSize: '16px',
      color: '#FFFFFF',
    });
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(10000);
    EventBus.emit('current-scene-ready', this);
  }

  update(time: number) {
    this.fpsText.setText(`FPS: ${this.game.loop.actualFps.toFixed(2)}`);

    this.enemyMgr.enemies.children.iterate(
      (enemy: Phaser.GameObjects.GameObject): boolean => {
        const enemySprite = enemy as EnemySprite;
        const enemyData = enemySprite.enemyData as EnemyData;
        this.enemyMgr.chasePlayer(enemySprite, enemyData.speed);
        return true;
      },
    );

    this.projectileMgr.projectiles.children.iterate(
      (projectile: Phaser.GameObjects.GameObject): boolean => {
        const projectileSprite = projectile as Projectile;

        ['light', 'flameLight', 'tracerLight'].forEach((lightType) => {
          const light = projectileSprite[lightType as keyof Projectile] as Phaser.GameObjects.Light;
          if (light) {
            light.setPosition(projectileSprite.x, projectileSprite.y);
          }
        });

        if (projectileSprite.flame) {
          const { x: offsetX, y: offsetY } = projectileSprite.flameOffsets;
          projectileSprite.flame.setPosition(
            projectileSprite.x - offsetX,
            projectileSprite.y - offsetY,
          );
        }
        return true;
      },
    );

    // Update player motion
    this.player.update(time);

    // Ant generation for combat demo
    if (
      time - ct.enemyData.ant.spawnPeriod > this.lastEnemySpawnTimes.ant &&
      this.enemyMgr.enemies.getChildren().length < 300
    ) {
      this.lastEnemySpawnTimes.ant = time;
      this.enemyMgr.createEnemy(
        Phaser.Math.Between(0, ct.fieldWidth),
        0,
        ct.enemyData.ant,
      );
    }

    Object.entries(this.inputMgr.customBindingStates).forEach(
      ([weaponIndex, isActive]) => {
        if (isActive) {
          const index = Number(weaponIndex);
          const weapon = this.player.weapons[index];
          if (time - this.lastWeaponFireTime[index] > weapon.fireDelay) {
            this.playerWeaponFire(index, time);
            this.lastWeaponFireTime[index] = time;
          }
        }
      },
    );

    this.minimapMgr.drawMinimap();
  }

  changeScene() {
    this.scene.start('GameOver');
  }

  addImage(
    x: number,
    y: number,
    texture: string | Phaser.Textures.Texture,
    frame?: string | number,
  ) {
    const image = this.add.image(x, y, texture, frame);
    this.mainLayer.add(image);
    return image;
  }

  addSprite(x: number, y: number, key: string, frame?: string | number) {
    const sprite = this.physics.add.sprite(x, y, key, frame);
    this.mainLayer.add(sprite);
    return sprite;
  }

  addContainer(
    x: number,
    y: number,
    children: Phaser.GameObjects.GameObject[],
  ) {
    const container = this.add.container(x, y, children);
    this.mainLayer.add(container);
    return container;
  }

  addParticles(
    x?: number,
    y?: number,
    texture?: string | Phaser.Textures.Texture,
    config?: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  ) {
    const particles = this.add.particles(x, y, texture, config);
    this.mainLayer.add(particles);
    return particles;
  }

  createInGroup(
    group: Phaser.GameObjects.Group,
    x?: number,
    y?: number,
    key?: string,
    frame?: string | number,
    visible?: boolean,
    active?: boolean,
  ) {
    const member = group.create(x, y, key, frame, visible, active);
    this.mainLayer.add(member);
    return member;
  }

  playerWeaponFire(weaponIndex: number, time: number): void {
    const weaponPosition = ct.weaponPositions[weaponIndex];
    const weapon = this.player.weapons[weaponIndex] as WeaponSpec;

    if (this.isWeaponReloading(weaponIndex, time, weapon)) {
      return;
    }
    const ammoReduction = weapon.burstFire ? weapon.burstFire : 1;

    if (!this.canFireWeapon(weaponIndex, ammoReduction)) {
      this.startReload(weaponIndex, time, weapon.reloadDelay);
      return;
    }

    // Reduce ammo count in magazine by the determined amount
    this.magCount[weaponIndex] -= ammoReduction;
    EventBus.emit('mag-count', this.magCount);

    // Handle tracers
    let hasTracer = false;
    if (weapon.tracerRate) {
      if (this.projectileMgr.tracersTracking[weaponIndex] === undefined) {
        this.projectileMgr.tracersTracking[weaponIndex] = weaponIndex;
      } else {
        if (
          this.projectileMgr.tracersTracking[weaponIndex] >= weapon.tracerRate
        ) {
          this.projectileMgr.tracersTracking[weaponIndex] = 1;
          hasTracer = true;
        } else {
          this.projectileMgr.tracersTracking[weaponIndex]++;
        }
      }
    }

    // Fire the weapon
    if (!!weapon.burstFire && !!weapon.burstFireDelay) {
      for (let i = 0; i < weapon.burstFire; i++) {
        this.projectileMgr.fireWeapon(
          i * weapon.burstFireDelay,
          weaponPosition,
          weaponIndex,
          weapon,
          hasTracer,
        );
      }
    } else {
      this.projectileMgr.fireWeapon(
        0,
        weaponPosition,
        weaponIndex,
        weapon,
        hasTracer,
      );
    }

    // If the magazine is now empty or does not have enough ammo for another burst, start reloading immediately
    if (
      this.magCount[weaponIndex] < ammoReduction &&
      this.remainingAmmo[weaponIndex] > 0
    ) {
      this.startReload(weaponIndex, time, weapon.reloadDelay);
    } else {
      // Update reloading status
      EventBus.emit(
        'reload-status',
        this.lastReloadStart.map((startTime) => startTime !== 0),
      );
    }
  }

  private isWeaponReloading(
    weaponIndex: number,
    time: number,
    weapon: WeaponSpec,
  ): boolean {
    if (this.lastReloadStart[weaponIndex] !== 0) {
      if (time - this.lastReloadStart[weaponIndex] >= weapon.reloadDelay) {
        this.finishReload(weaponIndex, weapon);
      } else {
        EventBus.emit(
          'reload-status',
          this.lastReloadStart.map((startTime) => startTime !== 0),
        );
        return true;
      }
    }
    return false;
  }

  private canFireWeapon(
    weaponIndex: number,
    ammoReduction: number,
  ): boolean {
    if (this.magCount[weaponIndex] < ammoReduction) {
      if (this.remainingAmmo[weaponIndex] > 0) {
        return false; // Need to reload
      } else {
        EventBus.emit(
          'reload-status',
          this.lastReloadStart.map((startTime) => startTime !== 0),
        );
        return false; // No ammo left
      }
    }
    return true;
  }

  startReload(
    weaponIndex: number,
    startTime: number,
    reloadDelay: number,
  ): void {
    this.projectileMgr.playReloadSound(this.player.weapons[weaponIndex]);
    this.lastReloadStart[weaponIndex] = startTime;
    EventBus.emit(
      'reload-status',
      this.lastReloadStart.map((startTime) => startTime !== 0),
    );

    this.time.addEvent({
      delay: reloadDelay,
      callback: () => {
        const weapon = this.player.weapons[weaponIndex] as WeaponSpec;
        this.finishReload(weaponIndex, weapon);
      },
      callbackScope: this,
    });
  }

  finishReload(weaponIndex: number, weapon: WeaponSpec): void {
    this.lastReloadStart[weaponIndex] = 0;
    const ammoToReload = weapon.magSize - this.magCount[weaponIndex];
    this.magCount[weaponIndex] = weapon.magSize; // Refill the magazine
    this.remainingAmmo[weaponIndex] -= ammoToReload; // Deduct reloaded ammo from remaining ammo
    EventBus.emit('mag-count', this.magCount);
    EventBus.emit('remaining-ammo', this.remainingAmmo);
    EventBus.emit(
      'reload-status',
      this.lastReloadStart.map((startTime) => startTime !== 0),
    );
  }
}

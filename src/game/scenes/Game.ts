// Game.ts

import { Scene } from 'phaser'
import { EventBus } from '../../EventBus'
import { Constants as ct, music } from '../constants'
import { createEmittersAndAnimations, loadRenderingAssets } from '../rendering'
import { loadMechAssets, PlayerMech } from '../classes/PlayerMech'
import {
  ProjectileManager,
  loadProjectileAssets,
} from '../classes/ProjectileManager'
import { EnemyManager, loadEnemyAssets } from '../classes/EnemyManager'
import { InputManager } from '../classes/InputManager'
import { ViewManager } from '../classes/ViewManager'
import { MinimapManager } from '../classes/MinimapManager'
import { BeamManager } from '../classes/BeamManager'
import { WeaponSpec, EnemySprite, Projectile } from '../interfaces'
import { TerrainManager, loadTerrainAssets } from '../classes/TerrainManager' // Import TerrainManager

export class Game extends Scene {
  minimapLayer: Phaser.GameObjects.Layer
  mainLayer: Phaser.GameObjects.Layer

  terrainMgr: TerrainManager // Add TerrainManager property

  viewMgr: ViewManager
  player: PlayerMech
  projectileMgr: ProjectileManager
  enemyMgr: EnemyManager
  inputMgr: InputManager
  minimapMgr: MinimapManager
  beamMgr: BeamManager

  lastWeaponFireTime: [number, number, number, number]
  magCount: [number, number, number, number]
  remainingAmmo: [number, number, number, number]
  lastReloadStart: [number, number, number, number] // zero indicates not reloading
  lastEnemySpawnTimes: { [key: string]: number }
  bloodFrameNames: string[]
  sceneName: string
  decals: Phaser.GameObjects.Group
  projectileSparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter
  enemyDeathBurstEmitter: Phaser.GameObjects.Particles.ParticleEmitter
  secondaryEnemyDeathBurstEmitter: Phaser.GameObjects.Particles.ParticleEmitter
  combinedDecals: {
    texture: Phaser.GameObjects.RenderTexture
    image: Phaser.GameObjects.Image
  }[]
  decalCount: number
  fpsText: Phaser.GameObjects.Text
  combatMusic: Phaser.Sound.BaseSound

  constructor() {
    super('Game')
    this.sceneName = 'game'
  }

  endGame() {
    this.sound.stopAll()
    this.scene.start('MainMenu')
  }
  preload() {
    this.sound.volume = 0.4
    this.load.setPath('assets')

    // Load music files
    music.forEach(fileName => {
      this.load.audio(fileName, `audio/music/${fileName}.mp3`)
    })

    // Load other assets
    loadProjectileAssets(this)
    loadRenderingAssets(this)
    loadEnemyAssets(this)
    loadMechAssets(this)
    loadTerrainAssets(this)
    this.load.image('background', 'darksand.jpg')

    // Prevent default context menu
    this.game.canvas.addEventListener(
      'contextmenu',
      event => {
        event.preventDefault()
      },
      false,
    )
  }
  create() {
    document.body.style.cursor = "url('./assets/crosshair.svg') 16 16, auto"

    this.mainLayer = this.add.layer()
    this.minimapLayer = this.add.layer()

    this.combatMusic = this.sound.add(
      music[Phaser.Math.Between(0, music.length - 1)],
    )
    this.combatMusic.play({
      loop: true,
      volume: ct.musicVolume,
    })
    createEmittersAndAnimations(this)

    this.physics.world.setBounds(0, 0, ct.fieldHeight, ct.fieldWidth)
    this.decals = this.add.group({
      classType: Phaser.GameObjects.Image,
      runChildUpdate: false,
    })
    this.combinedDecals = []

    this.enemyMgr = new EnemyManager(this)
    this.player = new PlayerMech(this)
    this.viewMgr = new ViewManager(this)
    this.projectileMgr = new ProjectileManager(this)
    this.beamMgr = new BeamManager(this)
    this.inputMgr = new InputManager(this)
    this.minimapMgr = new MinimapManager(this)

    // Instantiate the TerrainManager
    this.terrainMgr = new TerrainManager(this)

    this.inputMgr.initializeInputs()

    this.lastWeaponFireTime = [0, 0, 0, 0]
    this.lastEnemySpawnTimes = {}
    for (const enemyKey of Object.keys(ct.enemyData)) {
      this.lastEnemySpawnTimes[enemyKey] = 0
    }

    this.magCount = [0, 0, 0, 0]
    for (let i = 0; i < this.player.weapons.length; i++) {
      this.magCount[i] = this.player.weapons[i].magSize
    }

    this.lastReloadStart = [0, 0, 0, 0]

    this.remainingAmmo = [0, 0, 0, 0]
    for (let i = 0; i < this.player.weapons.length; i++) {
      this.remainingAmmo[i] =
        this.player.weapons[i].totalAmmo - this.player.weapons[i].magSize
    }

    EventBus.emit('mag-count', this.magCount)
    EventBus.emit('remaining-ammo', this.remainingAmmo)

    this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
      if (body.gameObject.name === 'projectile') {
        const projectile = body.gameObject as Projectile
        this.projectileMgr.destroyProjectile(projectile)
      }
    })

    this.physics.add.collider(this.enemyMgr.enemies, this.enemyMgr.enemies)

    this.physics.add.collider(
      this.player.mechContainer,
      this.enemyMgr.enemies,
      undefined,
      (_, enemy) => {
        return this.player.enemyHitsPlayer(enemy as EnemySprite)
      },
      this,
    )

    this.physics.add.collider(
      this.projectileMgr.projectiles,
      this.enemyMgr.enemies,
      undefined,
      (object1, object2) => {
        const projectile = object1 as Projectile
        const enemy = object2 as EnemySprite
        if (projectile.enemySource === true) {
          return false
        }
        return this.projectileMgr.projectileHitsTarget(projectile, enemy)
      },
      this,
    )

    this.physics.add.overlap(
      this.projectileMgr.projectiles,
      this.player.mechContainer,
      projectileSprite => {
        const projectile = projectileSprite as Projectile
        if (projectile.enemySource) {
          this.projectileMgr.projectileHitsPlayer(projectile)
        }
      },
      undefined,
      this,
    )

    this.fpsText = this.add.text(10, 10, '', {
      fontSize: '16px',
      color: '#FFFFFF',
    })
    this.fpsText.setScrollFactor(0)
    this.fpsText.setDepth(10000)
    EventBus.emit('current-scene-ready', this)
  }

  update(time: number) {
    this.fpsText.setText(`FPS: ${this.game.loop.actualFps.toFixed(2)}`)

    this.enemyMgr.enemies.children.iterate(
      (enemy: Phaser.GameObjects.GameObject): boolean => {
        const enemySprite = enemy as EnemySprite
        const enemyData = enemySprite.enemyData
        this.enemyMgr.chasePlayer(enemySprite, enemyData.speed)
        return true
      },
    )

    this.projectileMgr.projectiles.children.iterate(
      (projectile: Phaser.GameObjects.GameObject): boolean => {
        const projectileSprite = projectile as Projectile
        if (!projectileSprite) {
          return true
        }
        const projectileDestroyed =
          this.projectileMgr.checkRange(projectileSprite)
        if (projectileDestroyed) {
          return true
        }

        const lights = ['light', 'flameLight', 'tracerLight']
        lights.forEach(lightType => {
          const light = projectileSprite[
            lightType as keyof Projectile
          ] as Phaser.GameObjects.Light
          if (light) {
            light.setPosition(projectileSprite.x, projectileSprite.y)
          }
        })

        if (projectileSprite.flame) {
          const { x: offsetX, y: offsetY } = projectileSprite.flameOffsets
          projectileSprite.flame.setPosition(
            projectileSprite.x - offsetX,
            projectileSprite.y - offsetY,
          )
        }
        return true
      },
    )

    this.player.updatePlayerMotion(time)

    // General enemy spawning
    Object.entries(ct.enemyData).forEach(([enemyKey, enemyData]) => {
      if (
        time - enemyData.spawnPeriod > this.lastEnemySpawnTimes[enemyKey] &&
        this.enemyMgr.enemies.getChildren().length < ct.maxEnemies
      ) {
        this.lastEnemySpawnTimes[enemyKey] = time

        const minDistanceFromTerrainInTiles = 3
        const maxAttempts = 10
        let spawnX: number | undefined
        const spawnY = 100 // Enemies a small space away from top border

        // Attempt to find a spawn position along the top edge away from terrain
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const x = Phaser.Math.Between(0, ct.fieldWidth)
          const tileX = Math.floor(x / ct.tileSize)
          const tileY = Math.floor(spawnY / ct.tileSize)

          // Check if the position is at least 3 tiles away from any terrain
          if (
            !this.terrainMgr.isTerrainNear(
              tileX,
              tileY,
              minDistanceFromTerrainInTiles,
            )
          ) {
            spawnX = x
            break
          }
        }

        if (spawnX !== undefined) {
          this.enemyMgr.createEnemy(spawnX, spawnY, enemyData)
        } else {
          // Optional: Handle the case where no suitable position was found
          console.warn(
            'No suitable spawn position found for enemy along the top edge.',
          )
        }
      }
    })

    this.beamMgr.updateBeams(time)

    // Weapon firing
    Object.entries(this.inputMgr.customBindingStates).forEach(
      ([weaponIndexStr, isActive]) => {
        const weaponIndex = Number(weaponIndexStr)
        const weapon = this.player.weapons[weaponIndex]

        if (weapon.isBeam) {
          if (isActive) {
            if (!this.beamMgr.activeBeams[weaponIndex]) {
              this.beamMgr.startBeam(weaponIndex)
            }
          } else {
            this.beamMgr.stopBeam(weaponIndex)
          }
        } else {
          if (isActive) {
            // Add a check to see if the weapon is not reloading
            if (!this.isWeaponReloading(weaponIndex, time, weapon)) {
              // Start the continuous firing sound if applicable
              if (weapon.repeatingContinuousFireSound) {
                this.projectileMgr.handleRepeatingFireSound(weaponIndex, true)
              }

              if (
                time - this.lastWeaponFireTime[weaponIndex] >
                weapon.fireDelay
              ) {
                this.playerWeaponFire(weaponIndex, time)
                this.lastWeaponFireTime[weaponIndex] = time
              }
            }
          } else {
            // Stop the continuous firing sound if applicable
            if (weapon.repeatingContinuousFireSound) {
              this.projectileMgr.handleRepeatingFireSound(weaponIndex, false)
            }
          }
        }
      },
    )

    this.minimapMgr.drawMinimap()
  }

  addImage(
    x: number,
    y: number,
    texture: string | Phaser.Textures.Texture,
    frame?: string | number,
  ) {
    const image = this.add.image(x, y, texture, frame)
    this.mainLayer.add(image)
    return image
  }

  addSprite(x: number, y: number, key: string, frame?: string | number) {
    const sprite = this.physics.add.sprite(x, y, key, frame)
    this.mainLayer.add(sprite)
    return sprite
  }

  addContainer(
    x: number,
    y: number,
    children: Phaser.GameObjects.GameObject[],
  ) {
    const container = this.add.container(x, y, children)
    this.mainLayer.add(container)
    return container
  }

  addParticles(
    x?: number,
    y?: number,
    texture?: string | Phaser.Textures.Texture,
    config?: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  ) {
    const particles = this.add.particles(x, y, texture, config)
    this.mainLayer.add(particles)
    return particles
  }

  addGraphicsFiltering(graphics: Phaser.GameObjects.Graphics) {
    this.mainLayer.add(graphics)
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
    const member = group.create(x, y, key, frame, visible, active)
    this.mainLayer.add(member)
    return member
  }

  playerWeaponFire(weaponIndex: number, time: number): void {
    const weaponPosition = ct.weaponPositions[weaponIndex]
    const weapon = this.player.weapons[weaponIndex] as WeaponSpec

    if (this.isWeaponReloading(weaponIndex, time, weapon)) {
      return
    }
    const ammoReduction = weapon.burstFire ? weapon.burstFire : 1

    const ammoCheck = this.canFireWeapon(weaponIndex, ammoReduction)
    if (!ammoCheck) {
      if (ammoCheck === null) {
        return
      } else {
        this.startReload(weaponIndex, time, weapon.reloadDelay)
        return
      }
    }

    // Reduce ammo count in magazine by the determined amount
    this.magCount[weaponIndex] -= ammoReduction
    EventBus.emit('mag-count', this.magCount)

    // Handle tracers
    let hasTracer = false
    let tracker = this.projectileMgr.playerTracers[weaponIndex]
    if (weapon.tracerRate) {
      if (weapon.tracerRate === 1) {
        // If tracerRate is 1, every shot should have a tracer
        hasTracer = true
      } else {
        if (tracker === undefined) {
          // Initialize the tracer counter for this weapon
          tracker = weaponIndex
          hasTracer = true // First shot should be a tracer
        } else {
          if (tracker >= weapon.tracerRate) {
            tracker = 1
            hasTracer = true
          } else {
            tracker++
          }
        }
        this.projectileMgr.playerTracers[weaponIndex] = tracker
      }
    }

    // Fire the weapon
    if (!!weapon.burstFire && !!weapon.burstFireDelay) {
      for (let i = 0; i < weapon.burstFire; i++) {
        this.projectileMgr.playerShot(
          i * weapon.burstFireDelay,
          weaponPosition,
          weapon,
          hasTracer,
        )
      }
    } else {
      this.projectileMgr.playerShot(0, weaponPosition, weapon, hasTracer)
    }

    // If the magazine is now empty or does not have enough ammo for another burst, start reloading immediately
    if (
      this.magCount[weaponIndex] < ammoReduction &&
      this.remainingAmmo[weaponIndex] > 0
    ) {
      this.startReload(weaponIndex, time, weapon.reloadDelay)
    } else {
      // Update reloading status
      EventBus.emit(
        'reload-status',
        this.lastReloadStart.map(startTime => startTime !== 0),
      )
    }
  }

  private isWeaponReloading(
    weaponIndex: number,
    time: number,
    weapon: WeaponSpec,
  ): boolean {
    if (this.lastReloadStart[weaponIndex] !== 0) {
      if (time - this.lastReloadStart[weaponIndex] >= weapon.reloadDelay) {
        this.finishReload(weaponIndex, weapon)
      } else {
        EventBus.emit(
          'reload-status',
          this.lastReloadStart.map(startTime => startTime !== 0),
        )
        return true
      }
    }
    return false
  }

  // returns true if can fire, false if need to reload, null if no ammo entirely
  private canFireWeapon(
    weaponIndex: number,
    ammoReduction: number,
  ): boolean | null {
    if (this.magCount[weaponIndex] < ammoReduction) {
      if (this.remainingAmmo[weaponIndex] > 0) {
        return false // Need to reload
      } else {
        EventBus.emit(
          'reload-status',
          this.lastReloadStart.map(startTime => startTime !== 0),
        )
        return null // No ammo left
      }
    }
    return true
  }

  startReload(
    weaponIndex: number,
    startTime: number,
    reloadDelay: number,
  ): void {
    // Stop the repeating fire sound for the weapon that's reloading
    this.projectileMgr.handleRepeatingFireSound(weaponIndex, false);
  
    // Play the reload sound for the weapon
    const weapon = this.player.weapons[weaponIndex] as WeaponSpec;
    this.projectileMgr.playReloadSound(weapon);
  
    // Update the last reload start time
    this.lastReloadStart[weaponIndex] = startTime;
    EventBus.emit(
      'reload-status',
      this.lastReloadStart.map((startTime) => startTime !== 0),
    );
  
    // Schedule the reload completion
    this.time.addEvent({
      delay: reloadDelay,
      callback: () => {
        this.finishReload(weaponIndex, weapon);
      },
      callbackScope: this,
    });
  }

  finishReload(weaponIndex: number, weapon: WeaponSpec): void {
    this.lastReloadStart[weaponIndex] = 0
    const ammoToReload = weapon.magSize - this.magCount[weaponIndex]
    this.magCount[weaponIndex] = weapon.magSize // Refill the magazine
    this.remainingAmmo[weaponIndex] -= ammoToReload // Deduct reloaded ammo from remaining ammo
    EventBus.emit('mag-count', this.magCount)
    EventBus.emit('remaining-ammo', this.remainingAmmo)
    EventBus.emit(
      'reload-status',
      this.lastReloadStart.map(startTime => startTime !== 0),
    )
  }
}

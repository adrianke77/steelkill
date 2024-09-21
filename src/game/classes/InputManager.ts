import { Game } from '../scenes/Game'
import { dataStore } from '../../DataStore'

type bindingTuplet = [string, string]

const infaredToggleKey = 'V'

export class InputManager {
  scene: Game
  moveBindings: { [key: string]: string }
  // tracks if the key for the function is currently held down
  moveBindingStates: { [key: string]: boolean }
  // tracks if the weapon group is currently active ( i.e. the button or key is held down )
  customBindingStates: { [key: number]: boolean }
  customBinding: bindingTuplet[]

  constructor(scene: Game) {
    this.scene = scene
    this.customBinding = dataStore.data.inputToWeaponMaps
    this.moveBindings = dataStore.data.moveBindings
    console.log(this.moveBindings)
    // sample data: [ ['0', 'mouse'], ['0', 'mouse'], ['1', 'mouse'], ['2', 'mouse'] ]
    this.customBindingStates = {
      0: false,
      1: false,
      2: false,
      3: false,
    }
    this.moveBindings = dataStore.data.moveBindings
    this.moveBindingStates = {
      up: false,
      down: false,
      left: false,
      right: false,
      boost: false,
      infrared: false,
    }
  }

  initializeInputs() {
    // Disable the right-click context menu
    this.scene.input.mouse!.disableContextMenu()
    // Generalized input handling
    this.scene.input.enabled = true;
    this.scene.input.keyboard!.enabled = true;
    this.scene.input.keyboard!.on('keydown', (event: KeyboardEvent) =>
      this.updateKeyboardInputState(event.key.toUpperCase(),true),
    )
    this.scene.input.keyboard!.on('keyup', (event: KeyboardEvent) =>
      this.updateKeyboardInputState(event.key.toUpperCase(),false),
    )

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>{
      this.updateMouseInputState(pointer.buttons)
    })

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) =>{
      this.updateMouseInputState(pointer.buttons)
    })
  }

  getMoveBindings() {
    return this.moveBindings
  }

  updateKeyboardInputState(pressedKey: string, isPressed: boolean) {
    if (pressedKey === infaredToggleKey && isPressed) {
      this.scene.viewMgr.toggleInfrared()
      return
    }

    let processed = false
      Object.entries(this.moveBindings).forEach(([command, keyboardKey]) => {
        if (keyboardKey === pressedKey) {
          this.moveBindingStates[command] = isPressed
          processed = true
        }
      })
    if (processed) {
      return
    }
    this.customBinding.forEach((binding: bindingTuplet, index: number) => {
      const boundDevice = binding[1]
      const boundKey = binding[0]
      if (boundDevice === 'key' && boundKey === pressedKey) {
        this.customBindingStates[index] = isPressed
      }
    })
  }

  updateMouseInputState(buttonsBitmask: number) {
    // note for future reference: remember buttons 1 and 2 are right and middle in native MouseEvent, but are middle and right in Phaser
    // this is already flipped in WeapionsSelector React component
    this.customBinding.forEach((binding: bindingTuplet, index: number) => {
      const boundDevice = binding[1]
      const boundButton = parseInt(binding[0])
  
      if (boundDevice === 'mouse') {
        const isPressed = (buttonsBitmask & (1 << boundButton)) !== 0
        this.customBindingStates[index] = isPressed
      }
    })
  }

  disableListeners() {
    this.scene.input.keyboard!.removeAllListeners()
    this.scene.input.removeAllListeners()
    this.customBindingStates = {
      0: false,
      1: false,
      2: false,
      3: false,
    }
    this.moveBindingStates = {
      up: false,
      down: false,
      left: false,
      right: false,
      boost: false,
      infrared: false,
    }

  }
}

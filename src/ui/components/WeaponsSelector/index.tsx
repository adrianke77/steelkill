import { useState, useCallback, useEffect } from 'react'
import { weaponConstants } from '../../../game/constants'
import { dataStore } from '../../../DataStore'

const initialWeapons = ['boltAP', 'boltAP', 'boltHE', 'boltHE']
const initialBindings = [
  ['0', 'mouse'],
  ['0', 'mouse'],
  ['1', 'mouse'],
  ['1', 'mouse'],
]

const reservedKeys = [' ', 'w', 'a', 's', 'd', ' ', 'v']

dataStore.data.weapons = initialWeapons
dataStore.data.inputToWeaponMaps = initialBindings

export const WeaponSelector = () => {
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>(
    dataStore.data.weapons as string[],
  )

  const [keyBindings, setKeyBindings] = useState<string[][]>(
    dataStore.data.inputToWeaponMaps as string[][],
  )
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const handleWeaponChange = (index: number, newWeapon: string) => {
    const updatedWeapons = [...selectedWeapons]
    updatedWeapons[index] = newWeapon
    setSelectedWeapons(updatedWeapons)
    dataStore.data.weapons = updatedWeapons
  }

  const handleKeyBindingChange = useCallback(
    (event: KeyboardEvent | MouseEvent) => {
      if (focusedIndex !== null) {
        let binding: [string, string]
        if (event instanceof MouseEvent) {
          let button = event.button.toString()
          // buttons 1 and 2 are inverted in phaser.js
          if (button === '1') {
            button = '2'
          } else if (button === '2') {
            button = '1'
          }
          binding = [button, 'mouse']
        } else {
          const key = event.key.toLowerCase()
          if (reservedKeys.includes(key)) {
            alert(
              `"${key === ' ' ? 'Spacebar' : key}" is reserved for movement or other game functions. Please choose another key.`,
            )
            ;(event.target as HTMLElement).blur()
            return
          }
          binding = [event.key, 'key']
        }
        dataStore.data.inputToWeaponMaps[focusedIndex] = binding
        const updatedBindings = [...keyBindings]
        updatedBindings[focusedIndex] = binding
        setKeyBindings(updatedBindings)
        setFocusedIndex(null)
        event.preventDefault()
        ;(event.target as HTMLElement).blur()
      }
    },
    [focusedIndex, keyBindings],
  )

  useEffect(() => {
    if (focusedIndex !== null) {
      // Add event listeners when an input is focused
      window.addEventListener('keydown', handleKeyBindingChange)
      window.addEventListener('mousedown', handleKeyBindingChange)

      // Cleanup listeners when focus changes or the component unmounts
      return () => {
        window.removeEventListener('keydown', handleKeyBindingChange)
        window.removeEventListener('mousedown', handleKeyBindingChange)
      }
    }
  }, [focusedIndex, handleKeyBindingChange])

  const handleFocus = (index: number) => {
    setFocusedIndex(index)
  }

  const renderBindingDisplay = (i: number): string => {
    const device = keyBindings[i][1]
    let buttonOrKey = keyBindings[i][0]
    if (buttonOrKey === ' ') {
      buttonOrKey = 'SPACE'
    }
    return `${device} ${buttonOrKey}`
  }

  return (
    <div className="hudFont" style={{ marginTop: 15, width:800}}>
      {/* Added headers for columns */}
      <div style={{ display: 'flex', marginBottom: 15 }}>
        <div style={{width: '20%',textAlign:'center' }}></div>
        <div style={{width: '40%',textAlign:'center'  }}>Click to select weapons :</div>
        <div style={{width: '40%',textAlign:'center'  }}>Click to bind key / button :</div>
      </div>

      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ marginBottom: 15, display: 'flex' }}>
          {/* Weapon Mount label column */}
          <div style={{width: '20%',textAlign:'center'  }}>
            <label htmlFor={`weapon-select-${i}`}>Weapon {i + 1}:&nbsp;&nbsp;</label>
          </div>
  
          {/* Weapon selection dropdown column */}
          <div style={{ width: '40%',textAlign:'center' }}>
            <select
              id={`weapon-select-${i}`}
              value={selectedWeapons[i]}
              onChange={e => handleWeaponChange(i, e.target.value)}
              className="lcdphoneFont"
              style={{ padding: 3 }}
            >
              {Object.keys(weaponConstants).map(key => {
                return (
                  <option key={key} value={key} style={{ fontWeight: 900 }}>
                    {weaponConstants[key].name}
                  </option>
                )
              })}
            </select>
          </div>
  
          {/* Key binding input column */}
          <div style={{  width: '40%',textAlign:'center'  }}>
            <input
              type="text"
              value={renderBindingDisplay(i)}
              placeholder="Bind key or mouse button"
              onFocus={() => handleFocus(i)}
              onBlur={() => setFocusedIndex(null)}
              readOnly
              className="key-binding-input lcdphoneFont"
              style={{
                padding: 3,
                userSelect: 'none',
                cursor: 'pointer',
                width: 250,
              }}
              onContextMenu={e => e.preventDefault()} // Disable right-click context menu
            />
          </div>
        </div>
      ))}
    </div>
  )
  
  
}

export default WeaponSelector

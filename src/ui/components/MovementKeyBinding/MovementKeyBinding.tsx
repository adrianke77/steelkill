import { useState, useCallback, useEffect } from 'react'
import { dataStore } from '../../../DataStore'

const reservedKeys = ['v']

const intialMoveBindings = {
  up: 'W',
  down: 'S',
  left: 'A',
  right: 'D',
  boost: ' ',
}

type Movements = keyof typeof intialMoveBindings

dataStore.data.moveBindings =
  Object.keys(dataStore.data.moveBindings).length > 0
    ? dataStore.data.moveBindings
    : intialMoveBindings

export const MovementsBinding = () => {
  const [moveBindings, setMoveBindings] = useState(
    dataStore.data.moveBindings,
  )
  const [focusedKey, setFocusedKey] = useState<string | null>(null)

  const handleKeyBindingChange = useCallback(
    (event: KeyboardEvent) => {
      if (focusedKey) {
        const key = event.key.toLowerCase()
        if (reservedKeys.includes(key)) {
          alert(
            `"${key === ' ' ? 'Spacebar' : key}" is reserved other game functions. Please choose another key.`,
          )
          ;(event.target as HTMLElement).blur()
          return
        }
        const updatedBindings = { ...moveBindings }
        updatedBindings[focusedKey as Movements] = event.key.toUpperCase()
        setMoveBindings(updatedBindings)
        dataStore.data.moveBindings = updatedBindings
        setFocusedKey(null)
        event.preventDefault()
        ;(event.target as HTMLElement).blur()
      }
    },
    [focusedKey, moveBindings],
  )

  useEffect(() => {
    if (focusedKey !== null) {
      // Add event listener when an input is focused
      window.addEventListener('keydown', handleKeyBindingChange)

      // Cleanup listeners when the input is blurred or the component unmounts
      return () => {
        window.removeEventListener('keydown', handleKeyBindingChange)
      }
    }
  }, [focusedKey, handleKeyBindingChange])

  const handleFocus = (key: string) => {
    setFocusedKey(key)
  }

  const renderBindingDisplay = (key: string): string => {
    const binding = moveBindings[key as Movements]
    return binding === ' ' ? 'SPACE' : binding.toUpperCase()
  }

  return (
    <div className="hudFont" style={{ marginTop: 15, width: 800 }}>
      <div style={{ display: 'flex', marginBottom: 15 }}>
        <div style={{ width: '40%', textAlign: 'center', fontSize: 15 }}>
          Movements
        </div>
        <div style={{ width: '60%', textAlign: 'center', fontSize: 15 }}>
          CLICK TO BIND KEY / BUTTON
        </div>
      </div>

      {['up', 'down', 'left', 'right', 'boost'].map(key => (
        <div key={key} style={{ marginBottom: 15, display: 'flex' }}>
          <div style={{ width: '40%', textAlign: 'center' }}>
            <label>
              {key === 'boost'
                ? 'Boost'
                : `Move ${key.charAt(0).toUpperCase() + key.slice(1)}`}
            </label>
          </div>

          <div style={{ width: '60%', textAlign: 'center' }}>
            <input
              type="text"
              value={renderBindingDisplay(key)}
              placeholder="Bind key"
              onFocus={() => handleFocus(key)}
              onBlur={() => setFocusedKey(null)}
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

export default MovementsBinding

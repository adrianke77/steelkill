import { useRef, useState } from 'react'
import { IRefPhaserGame, PhaserGame } from './game/PhaserGame'
import { MainMenu } from './game/scenes/MainMenu'
import { Game } from './game/scenes/Game'
import { WeaponSelector } from './ui/components/WeaponsSelector'
import { WeaponsInfo } from './ui/components/WeaponInfo'
import { EventDataProvider } from './ui/context/HUDContext'
import { BoostInfo } from './ui/components/BoostInfo'
import { MechHealthInfo } from './ui/components/MechHealthInfo'

import { EventBus } from './EventBus'
import { dataStore } from './DataStore'
import MovementKeyBinding from './ui/components/MovementKeyBinding/MovementKeyBinding'

interface GameScene extends Phaser.Scene {
  sceneName: string
}

function App() {
  //  References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null)
  const [sceneName, setSceneName] = useState('')

  dataStore.data['testDatakey'] = { testDataKey: 'testDataValue' }

  const startGame = () => {
    // test data send
    EventBus.emit('react-data-send', [
      'testDatakey',
      { testDataKey2: 'testDataValue' },
    ])
    if (phaserRef.current) {
      const scene = phaserRef.current.scene as MainMenu
      if (scene) {
        scene.startGame()
      }
    }
  }

  const endGame = () => {
    if (phaserRef.current) {
      const scene = phaserRef.current.scene as Game
      if (scene) {
        scene.endGame()
      }
    }
  }

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    const gameScene = scene as GameScene
    setSceneName(gameScene.sceneName)
  }

  return (
    <EventDataProvider>
      <div id="app">
        <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
        {sceneName === 'mainmenu' && (
          <div className="startScreenCentre flexCenter">
            <div
              className="hudFont"
              style={{ fontSize: '2rem', marginBottom: 10 }}
            >
              Deadnought
            </div>
            <div
              className="hudFont"
              style={{ fontSize: '1rem', marginBottom: '1.4rem' }}
            >
              Combat Demo
            </div>
            <div
              className=" flexCenter"
              style={{
                fontSize: '0.7rem',
                marginBottom: '5rem',
              }}
            >
              <b>
                the mech is made of dead flesh and blood. kill strange horrors with steel and fire.
              </b>
            </div>
            <div
              className="hudFont flexCenter"
              style={{ fontSize: '0.8rem', marginBottom: '1.4rem' }}
            >
              <div style={{ marginBottom: '0.5rem' }}>
                <b>mouse</b> : &nbsp;&nbsp;aim
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <b>V</b> : &nbsp;&nbsp;infrared vision
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <b>MOVE KEY + BOOST</b> : &nbsp;&nbsp;rocket boosted drifting
              </div>
            </div>
            <WeaponSelector />
            <br />
            <MovementKeyBinding />
            <div
              className="lcdphoneFont flexCenter"
              style={{
                color: 'white',
                fontSize: '1.5rem',
                fontStyle: 'italic',
                marginBottom: '5rem',
                marginTop: '2rem',
              }}
            >
              <b>
                suggestion: there are other weapons to try in this demo, try
                switching them up!
              </b>
            </div>
            <button
              className="button"
              style={{
                marginTop: 30,
                fontSize: '1rem',
                backgroundColor: 'red',
              }}
              onClick={startGame}
            >
              Start Game
            </button>
          </div>
        )}
        {sceneName === 'game' && (
          <div
            className="lowerLeftHud"
            style={{ pointerEvents: 'none', fontSize: 18 }}
          >
            <WeaponsInfo weapons={dataStore.data.weaponsData} />
            <BoostInfo />
            <MechHealthInfo />
            <br></br>
            <button
              className="button"
              onClick={endGame}
              style={{ pointerEvents: 'all', backgroundColor: 'red' }}
            >
              End Game
            </button>
          </div>
        )}
      </div>
    </EventDataProvider>
  )
}

export default App

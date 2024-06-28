import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './game/PhaserGame';
import { MainMenu } from './game/scenes/MainMenu';
import { Game } from './game/scenes/Game';
import { WeaponsInfo } from './ui/components/WeaponInfo';
import { Constants } from './game/constants';
import { AmmoProvider } from './ui/context/HUDContext';
import { BoostInfo } from './ui/components/BoostInfo';

interface GameScene extends Phaser.Scene {
    sceneName: string
}

function App() {
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [sceneName, setSceneName] = useState('')

    const startGame = () => {
        if (phaserRef.current) {
            const scene = phaserRef.current.scene as MainMenu;
            if (scene) {
                scene.startGame();
            }
        }
    }

    const endGame = () => {
        if (phaserRef.current) {
            const scene = phaserRef.current.scene as Game;
            if (scene) {
                scene.endGame();
            }
        }
    }

    // Event emitted from the PhaserGame component
    const currentScene = (scene: Phaser.Scene) => {
        const gameScene = scene as GameScene
        setSceneName(gameScene.sceneName)
    }

    return (
        <AmmoProvider>
            <div id="app">
                <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
                {
                    sceneName === 'mainmenu' &&
                    <button className="button screenCenter" onClick={startGame}>Start Game</button>
                }
                {
                    sceneName === 'game' &&
                    <div className='lowerLeftHud'>
                        <WeaponsInfo weapons={Constants.weapons} />
                        <BoostInfo />
                        <button className="button" onClick={endGame}>End Game</button>
                    </div>
                }
            </div>
        </AmmoProvider>
    )
}

export default App

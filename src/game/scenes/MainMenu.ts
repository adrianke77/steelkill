import { GameObjects, Scene } from 'phaser';

import { EventBus } from '../../EventBus';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;
    sceneName: string

    constructor ()
    {
        super('MainMenu');
        this.sceneName = 'mainmenu'
    }

    create ()
    {
        EventBus.emit('current-scene-ready', this);
    }
    
    startGame ()
    {
        this.scene.start('Game');
    }

}

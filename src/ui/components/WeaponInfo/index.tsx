import { WeaponSpec } from '../../../game/interfaces'
import { useHUDData } from '../../context/HUDContext'

export const WeaponsInfo = ({
  weapons,
}: {
  weapons: WeaponSpec[]
}): React.JSX.Element => {
  const { magCount, remainingAmmo, isReloading } = useHUDData()

  return (
    <div className="hudFont">
      {weapons.map((weapon, index) => {
        let ammo = magCount[index]
        let remAmmo = remainingAmmo[index]
        let status = 'READY'
        if (ammo <= 0 && remAmmo <= 0) {
          status = 'OUT OF AMMO'
          ammo = 0
          remAmmo = 0
        } else if (isReloading[index]) {
          status = 'RELOADING'
        }
        return (
          <div key={index}>
            <div>{weapon.name} </div>
            <div>
              {ammo} / {weapon.magSize} == R: {remAmmo}
            </div>
            <div>{status}</div>
            <div>---</div>
            <br />
          </div>
        )
      })}
    </div>
  )
}

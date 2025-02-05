import { WeaponSpec } from '../../../game/interfaces'
import { useHUDData } from '../../context/HUDContext'
import { useEffect, useState } from 'react'

const styles = {
  filled: {
    color: 'rgba(175,175,175, 1)',
  },
  empty: {
    opacity: 0.2,
    color: 'rgba(0,0,0, 1)',
  },
  ammoCount: {
    marginLeft: '8px',
  },
  remainingAmmoCount: {
    color: 'lightgreen',
  },
}

export const WeaponsInfo = ({
  weapons,
}: {
  weapons: WeaponSpec[]
}): React.JSX.Element => {
  const { magCount, remainingAmmo, isReloading } = useHUDData()
  const [displayValues, setDisplayValues] = useState(magCount)

  useEffect(() => {
    const updateMagCount = (weapon: WeaponSpec, index: number) => {
      const fluctuation = (Math.random() - 0.5) * (weapon.magSize * 0.02)
      setDisplayValues(current => {
        const newValues = [...current]
        newValues[index] = magCount[index] + fluctuation
        return newValues
      })
    }

    const intervals = weapons.map((weapon, index) => {
      updateMagCount(weapon, index)
      if (!weapon.hasUnstableAmmoCount) return null

      return setInterval(() => {
        updateMagCount(weapon, index)
      }, 400)
    })

    return () =>
      intervals.forEach(interval => interval && clearInterval(interval))
  }, [magCount, weapons])

  return (
    <div className="hudFont">
      {weapons.map((weapon, index) => {
        let ammo = weapon.hasUnstableAmmoCount
          ? displayValues[index]
          : magCount[index]
        let remAmmo = remainingAmmo[index]
        let status = 'READY'
        if (ammo <= 0 && remAmmo <= 0) {
          status = 'OUT OF AMMO'
          ammo = 0
          remAmmo = 0
        } else if (isReloading[index]) {
          status = 'RELOADING'
        }

        const barLength = 30
        const filledLength = Math.round(
          (magCount[index] / weapon.magSize) * barLength,
        )
        const emptyLength = barLength - filledLength

        return (
          <div key={index}>
            <div>{weapon.name}</div>
            <div>
              <span>[</span>
              <span style={styles.filled}>{'|'.repeat(filledLength)}</span>
              <span style={styles.empty}>{'|'.repeat(emptyLength)}</span>
              <span>] --</span>
              <span style={styles.ammoCount}>
                {weapon.hasUnstableAmmoCount ? ammo.toFixed(1) : ammo}
              </span>
            </div>
            <div>Status: {status}</div>
            <div>
              Remaining Ammo:{' '}
              <span style={styles.remainingAmmoCount}>{remAmmo}</span>
            </div>
            <div>---</div>
            <br />
          </div>
        )
      })}
    </div>
  )
}

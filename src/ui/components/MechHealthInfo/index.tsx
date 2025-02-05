import { useHUDData } from '../../context/HUDContext'
import { Constants } from '../../../game/constants'

const styles = {
  empty: {
    color: 'rgba(144, 238, 144, 0.2)',
  },
  healthCount: {
    marginLeft: '8px',
  },
}

const getHealthColor = (percentage: number) => {
  // Solid red at 30% or below
  if (percentage <= 30) {
    return `hsl(0, 100%, 50%)`
  }
  
  const RED_HUE = 0
  const YELLOW_HUE = 60
  const GREEN_HUE = 120
  
  let hue
  if (percentage < 60) {
    // Map 20-60% health from red to yellow
    const normalizedPercentage = (percentage - 20) * (1 / 40)
    hue = RED_HUE + (normalizedPercentage * (YELLOW_HUE - RED_HUE))
  } else {
    // Map 60-100% health from yellow to green
    hue = YELLOW_HUE + ((percentage - 60) * ((GREEN_HUE - YELLOW_HUE) / 40))
  }

  return `hsl(${hue}, 100%, 75%)`
}


export const MechHealthInfo = (): React.JSX.Element => {
  const { playerHealthLeft } = useHUDData()
  const healthPercentage = Math.max(
    (playerHealthLeft / Constants.mechStartingHealth) * 100,
    0,
  )

  const barLength = 50
  const filledLength = Math.round(
    (playerHealthLeft / Constants.mechStartingHealth) * barLength,
  )
  const emptyLength = barLength - filledLength

  const style = { color: getHealthColor(healthPercentage) }

  return (
    <div className="hudFont">
      <p>
        <div>Integrity:</div>
        <span>[ </span>
        <span style={style}>{'|'.repeat(filledLength)}</span>
        <span style={styles.empty}>{'|'.repeat(emptyLength)}</span>
        <span> ] </span>
        <span style={styles.healthCount}>{healthPercentage.toFixed(2)}%</span>
      </p>
    </div>
  )
}

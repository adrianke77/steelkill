import { useHUDData } from '../../context/HUDContext'
import { Constants } from '../../../game/constants'

export const MechHealthInfo = (): React.JSX.Element => {
  const { playerHealthLeft } = useHUDData()
  const healthPercentage = Math.max(
    (playerHealthLeft / Constants.mechStartingHealth) * 100,
    0,
  )
  const healthStyle =
    healthPercentage > 60
      ? { color: 'lightgreen' }
      : healthPercentage > 30
        ? { color: 'yellow' }
        : { color: 'orangered' }

  return (
    <div className="hudFont">
      <p>
        Mech Integrity:
        <div style={healthStyle}>{healthPercentage.toFixed(2)}%</div>
      </p>
    </div>
  )
}

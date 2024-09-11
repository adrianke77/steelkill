import { useHUDData } from '../../context/HUDContext'
import { Constants } from '../../../game/constants'

export const BoostInfo = (): React.JSX.Element => {
  const { boostLeft } = useHUDData()
  const boostPercentage = Math.max(
    (boostLeft / Constants.boostCapacity) * 100,
    0,
  )
  const style =
  boostPercentage > 60
    ? { color: 'lightgreen' }
    : boostPercentage > 30
      ? { color: 'yellow' }
      : { color: 'orangered' }

  return (
    <div className="hudFont">
      <p>
        Boost Energy: <div style={style}>{boostLeft} / {Constants.boostCapacity}</div>
      </p>
    </div>
  )
}

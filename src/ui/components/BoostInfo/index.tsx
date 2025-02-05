import { useHUDData } from '../../context/HUDContext'
import { Constants } from '../../../game/constants'
import { useEffect, useState } from 'react'

const styles = {
  filled: {
    color: 'rgb(200, 100, 200)'
  },
  empty: {
    color: 'rgba(128, 0, 128, 0.2)'
  },
  boostCount: {
    marginLeft: '8px'
  }
}

const getFluctuation = (): number => {
  const fluctuation = (Math.random() - 0.5) * (Constants.boostCapacity * 0.04)
  return fluctuation
}

export const BoostInfo = (): React.JSX.Element => {
  const { boostLeft } = useHUDData()
  const [displayValue, setDisplayValue] = useState(boostLeft)
  
  // Update display value immediately when boostLeft changes
  useEffect(() => {
    setDisplayValue(boostLeft + getFluctuation())
  }, [boostLeft])
  
  // Add fluctuation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayValue(boostLeft + getFluctuation())
    }, 200)

    return () => clearInterval(interval)
  }, [boostLeft])
  
  const barLength = 50
  const filledLength = Math.round((boostLeft / Constants.boostCapacity) * barLength)
  const emptyLength = barLength - filledLength

  return (
    <div className="hudFont">
      <div>Boost Energy:</div>
      <div>
        <span>[ </span>
        <span style={styles.filled}>{'|'.repeat(filledLength)}</span>
        <span style={styles.empty}>{'|'.repeat(emptyLength)}</span>
        <span> ] </span>
        <span style={styles.boostCount}>{displayValue.toFixed(1)}</span>
      </div>
    </div>
  )
}
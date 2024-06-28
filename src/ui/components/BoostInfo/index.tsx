import { useHUDData } from '../../context/HUDContext';
import { Constants } from '../../../game/constants';

export const BoostInfo = (): React.JSX.Element => {
  const {boostLeft} = useHUDData()

  return (
    <div className='hudFont'>
      <p>Boost: {boostLeft} / {Constants.boostCapacity}</p>
    </div>
  );
};

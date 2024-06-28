import React, { createContext, useContext, useState, useEffect } from 'react';
import { EventBus } from '../../../EventBus'

interface HUDContextType {
  magCount: number[];
  remainingAmmo: number[];
  isReloading: boolean[];
  boostLeft: number
}

const HUDContext = createContext<HUDContextType | undefined>(undefined);

export const AmmoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [magCount, setMagCount] = useState([0, 0, 0, 0]);
  const [remainingAmmo, setRemainingAmmo] = useState([0, 0, 0, 0]);
  const [isReloading, setIsReloading] = useState([false, false, false, false]);
  const [boostLeft, setBoostLeft] = useState(0);

  useEffect(() => {
    const handleMagCount = (data: number[]) => setMagCount(data);
    const handleRemainingAmmo = (data: number[]) => setRemainingAmmo(data);
    const handleReloadStatus = (data: boolean[]) => setIsReloading(data);
    const handleBoostStatus = (data: number) => setBoostLeft(data);

    EventBus.on('mag-count', handleMagCount);
    EventBus.on('remaining-ammo', handleRemainingAmmo);
    EventBus.on('reload-status', handleReloadStatus);
    EventBus.on('boost-status', handleBoostStatus);

    return () => {
      EventBus.off('mag-count', handleMagCount);
      EventBus.off('remaining-ammo', handleRemainingAmmo);
      EventBus.off('reload-status', handleReloadStatus);
      EventBus.off('boost-status', handleBoostStatus);
    };
  }, []);

  return (
    <HUDContext.Provider value={{ magCount, remainingAmmo, isReloading, boostLeft }}>
      {children}
    </HUDContext.Provider>
  );
};

export const useHUDData = (): HUDContextType => {
  const context = useContext(HUDContext);
  if (!context) {
    throw new Error('useHUDData must be used within an AmmoProvider');
  }
  return context;
};
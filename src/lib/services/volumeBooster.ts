import {NativeModules, Platform} from 'react-native';

const {VolumeBooster} = NativeModules;

/**
 * Sets volume boost level beyond 100% (range 1.0 to 2.0).
 * 1.0 = normal volume (booster disabled, 0 gain).
 * 2.0 = 200% volume (+18 dB audio loudness boost).
 */
export const setVolumeBoost = async (level: number): Promise<number> => {
  if (Platform.OS !== 'android' || !VolumeBooster?.setBoost) {
    return 1.0;
  }
  try {
    return await VolumeBooster.setBoost(level);
  } catch (err) {
    console.warn('[VolumeBooster] failed to set boost:', err);
    return 1.0;
  }
};

/**
 * Disables the loudness booster and resets gain to 0.
 */
export const resetVolumeBoost = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !VolumeBooster?.resetBoost) {
    return false;
  }
  try {
    return await VolumeBooster.resetBoost();
  } catch {
    return false;
  }
};

/**
 * Returns the current boost level.
 */
export const getVolumeBoost = async (): Promise<number> => {
  if (Platform.OS !== 'android' || !VolumeBooster?.getBoost) {
    return 1.0;
  }
  try {
    return await VolumeBooster.getBoost();
  } catch {
    return 1.0;
  }
};

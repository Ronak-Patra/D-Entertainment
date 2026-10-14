import {NativeModules, Platform} from 'react-native';

export type LauncherIcon = 'white' | 'tomato' | 'gray' | 'blue' | 'lavender';

type LauncherIconModule = {
  setIcon: (icon: LauncherIcon) => Promise<LauncherIcon>;
  setPipPlaybackActive: (active: boolean) => void;
  enterGlobalPip: () => Promise<boolean>;
  checkPipPermission: () => Promise<boolean>;
  openPipSettings: () => Promise<boolean>;
};

const nativeModule = NativeModules.LauncherIconModule as
  | LauncherIconModule
  | undefined;

export const setLauncherIcon = async (icon: LauncherIcon): Promise<void> => {
  if (Platform.OS !== 'android') return;
  if (!nativeModule) {
    throw new Error('Launcher icon module is unavailable. Rebuild the Android app.');
  }
  await nativeModule.setIcon(icon);
};

export const triggerGlobalPip = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !nativeModule?.enterGlobalPip) return false;
  try {
    const hasPermission = await nativeModule.checkPipPermission?.();
    if (hasPermission === false) {
      await nativeModule.openPipSettings?.();
      return false;
    }
    return await nativeModule.enterGlobalPip();
  } catch {
    return false;
  }
};

export const checkPipPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !nativeModule?.checkPipPermission) return true;
  try {
    return await nativeModule.checkPipPermission();
  } catch {
    return true;
  }
};

export const openPipSettings = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !nativeModule?.openPipSettings) return false;
  try {
    return await nativeModule.openPipSettings();
  } catch {
    return false;
  }
};

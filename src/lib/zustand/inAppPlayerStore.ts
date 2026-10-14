import {create} from 'zustand';
import {NativeModules, Platform} from 'react-native';
import {EpisodeLink} from '../providers/types';

const syncNativePipPlayback = (active: boolean) => {
  if (Platform.OS === 'android') {
    try {
      NativeModules.LauncherIconModule?.setPipPlaybackActive(active);
    } catch {}
  }
};

export interface PlayerParams {
  link?: string;
  directUrl?: string;
  type?: 'movie' | 'show' | 'series' | string;
  providerValue?: string;
  poster?: {poster?: string; background?: string};
  primaryTitle?: string;
  secondaryTitle?: string;
  infoUrl?: string;
  episodeList?: EpisodeLink[];
  linkIndex?: number;
  alwaysCast?: boolean;
}

interface InAppPlayerState {
  isOpen: boolean;
  isPip: boolean;
  isGlobalPip: boolean;
  isPlaying: boolean;
  params: PlayerParams | null;
  togglePlayback?: () => void;
  registerTogglePlayback: (fn: (() => void) | undefined) => void;
  openPlayer: (params: PlayerParams) => void;
  closePlayer: () => void;
  setPip: (isPip: boolean) => void;
  setGlobalPip: (isGlobalPip: boolean) => void;
  setPlaying: (isPlaying: boolean) => void;
}

export const useInAppPlayerStore = create<InAppPlayerState>((set, get) => ({
  isOpen: false,
  isPip: false,
  isGlobalPip: false,
  isPlaying: true,
  params: null,
  togglePlayback: undefined,
  registerTogglePlayback: (fn) => set({togglePlayback: fn}),
  openPlayer: (params) => {
    syncNativePipPlayback(true);
    set({isOpen: true, isPip: false, isGlobalPip: false, isPlaying: true, params});
  },
  closePlayer: () => {
    syncNativePipPlayback(false);
    set({isOpen: false, isPip: false, isGlobalPip: false, isPlaying: false, params: null, togglePlayback: undefined});
  },
  setPip: (isPip) => {
    syncNativePipPlayback(get().isOpen);
    set({isPip});
  },
  setGlobalPip: (isGlobalPip) => set({isGlobalPip}),
  setPlaying: (isPlaying) => {
    syncNativePipPlayback(get().isOpen);
    set({isPlaying});
  },
}));

if (Platform.OS === 'android') {
  try {
    const {DeviceEventEmitter} = require('react-native');
    DeviceEventEmitter.addListener('onSystemPipChanged', (isInPip: boolean) => {
      useInAppPlayerStore.getState().setGlobalPip(Boolean(isInPip));
    });
  } catch {}
}

import {create} from 'zustand';
import {settingsStorage} from '../storage';

interface NavigationPreferencesState {
  hideDownloadsTab: boolean;
  setHideDownloadsTab: (hide: boolean) => void;
  showContinueWatching: boolean;
  setShowContinueWatching: (show: boolean) => void;
  disableDrawer: boolean;
  setDisableDrawer: (disabled: boolean) => void;
  showHamburgerMenu: boolean;
  setShowHamburgerMenu: (show: boolean) => void;
}

const useNavigationPreferencesStore = create<NavigationPreferencesState>(
  set => ({
    hideDownloadsTab: settingsStorage.hideDownloadsTab(),
    setHideDownloadsTab: hide => {
      settingsStorage.setHideDownloadsTab(hide);
      set({hideDownloadsTab: hide});
    },
    showContinueWatching: settingsStorage.showContinueWatching(),
    setShowContinueWatching: show => {
      settingsStorage.setShowContinueWatching(show);
      set({showContinueWatching: show});
    },
    disableDrawer: settingsStorage.isDisableDrawer(),
    setDisableDrawer: disabled => {
      settingsStorage.setDisableDrawer(disabled);
      set({disableDrawer: disabled});
    },
    showHamburgerMenu: settingsStorage.showHamburgerMenu(),
    setShowHamburgerMenu: show => {
      settingsStorage.setShowHamburgerMenu(show);
      set({showHamburgerMenu: show});
    },
  }),
);

export default useNavigationPreferencesStore;

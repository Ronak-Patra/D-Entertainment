import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {MMKVLoader} from 'react-native-mmkv-storage';
// import {ProvidersList, providersList} from '../constants';
import {extensionStorage, ProviderExtension} from '../storage/extensionStorage';
import {settingsStorage} from '../storage/SettingsStorage';
import {providersStorage} from '../storage/ProvidersStorage';
import {sortInstalledProviders} from '../providerOrder';

const storage = new MMKVLoader().initialize();

export interface Content {
  provider: ProviderExtension;
  setProvider: (type: ProviderExtension) => void;
  // Extension-based provider management
  installedProviders: ProviderExtension[];
  availableProviders: ProviderExtension[];
  setInstalledProviders: (providers: ProviderExtension[]) => void;
  setAvailableProviders: (providers: ProviderExtension[]) => void;
  activeExtensionProvider: ProviderExtension | null;
  setActiveExtensionProvider: (provider: ProviderExtension | null) => void;
  ensureValidProviderSelected: () => void;
}

const useContentStore = create<Content>()(
  persist(
    (set, _get) => ({
      provider: {
        value: '',
        display_name: '',
        type: 'global',
        installed: false,
        disabled: false,
        version: '0.0.1',
        icon: '',
        source: {author: '', url: ''},
        installedAt: 0,
        lastUpdated: 0,
      },
      installedProviders: sortInstalledProviders(
        extensionStorage
          .getInstalledProviders()
          .filter(p => !providersStorage.getDisabledProviders().includes(p.value)),
        settingsStorage.getProviderOrder(),
      ),
      availableProviders: [],
      activeExtensionProvider: null,

      setProvider: (provider: ProviderExtension) => set({provider}),

      // Kept in the order the user dragged them to in the provider drawer.
      setInstalledProviders: (providers: ProviderExtension[]) => {
        const sorted = sortInstalledProviders(
          providers,
          settingsStorage.getProviderOrder(),
        );
        set(state => {
          let currentProvider = state.provider;
          if (!currentProvider?.value || currentProvider.value === '') {
            if (sorted.length > 0) {
              currentProvider = sorted[0];
            }
          }
          return {
            installedProviders: sorted,
            provider: currentProvider,
          };
        });
      },

      setAvailableProviders: (providers: ProviderExtension[]) =>
        set({availableProviders: providers}),

      setActiveExtensionProvider: (provider: ProviderExtension | null) =>
        set({activeExtensionProvider: provider}),

      ensureValidProviderSelected: () => {
        set(state => {
          if (!state.provider?.value || state.provider.value === '') {
            if (state.installedProviders.length > 0) {
              return {provider: state.installedProviders[0]};
            }
          }
          return {};
        });
      },
    }),
    {
      name: 'content-storage',
      storage: createJSONStorage(() => storage as any), // Only persist certain fields
      partialize: state => ({
        provider: state.provider,
        activeExtensionProvider: state.activeExtensionProvider,
      }),
    },
  ),
);

export default useContentStore;

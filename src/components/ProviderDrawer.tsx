import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {View, Text, BackHandler} from 'react-native';
// The gesture handler ScrollView lets a held row take over from scrolling.
import {ScrollView} from 'react-native-gesture-handler';
import React, {useEffect} from 'react';
import useContentStore from '../lib/zustand/contentStore';
import {MaterialIcons} from '@expo/vector-icons';
import {useM3Colors} from '../theme/M3PaletteContext';
import {isTV} from '../lib/tv';
import {TVFocusable, TVFocusGuide} from './tv';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';
import ProviderIcon from './ProviderIcon';
import ReorderableProviderList from './ReorderableProviderList';

interface ProviderDrawerProps {
  onClose: () => void;
  /** The mobile drawer renders its content while closed. */
  isOpen?: boolean;
  onSelectProvider?: (
    provider: import('../lib/storage/extensionStorage').ProviderExtension,
  ) => void;
}

const ProviderDrawer = ({
  onClose,
  isOpen = true,
  onSelectProvider,
}: ProviderDrawerProps) => {
  const provider = useContentStore(state => state.provider);
  const setProvider = useContentStore(state => state.setProvider);
  const rawInstalled = useContentStore(state => state.installedProviders);
  const installedProviders = React.useMemo(() => {
    const {providersStorage} = require('../lib/storage');
    const disabled = providersStorage.getDisabledProviders();
    return rawInstalled.filter((p: any) => !disabled.includes(p.value));
  }, [rawInstalled]);
  const hasSelectedProvider = installedProviders.some(
    item => item.value === provider.value,
  );
  const primary = useM3Colors().primary;
  const insets = useSafeAreaInsets();
  const focusBorderColor = useTVFocusBorderColor(primary);
  const mountTimeRef = React.useRef<number>(Date.now());

  const handleClose = React.useCallback(() => {
    if (Date.now() - mountTimeRef.current < 350) return;
    onClose();
  }, [onClose]);

  const handleSelectProvider = React.useCallback(
    (item: any) => {
      if (Date.now() - mountTimeRef.current < 350) return;
      if (onSelectProvider) onSelectProvider(item);
      else {
        setProvider(item);
        onClose();
      }
    },
    [setProvider, onClose, onSelectProvider],
  );

  useEffect(() => {
    // A closed drawer must not swallow back presses for the whole app.
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose, isOpen]);

  return (
    <View
      className="flex-1"
      style={{backgroundColor: isTV ? '#121214' : 'rgba(0,0,0,0.85)'}}>
      <View
        style={{
          borderBottomColor: 'rgba(255,255,255,0.1)',
          borderBottomWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 16,
          paddingHorizontal: 16,
          paddingTop: isTV ? 28 : insets.top + 12,
        }}>
        <View>
          <Text className="text-white text-2xl font-bold">Select Provider</Text>
          <Text className="text-gray-400 mt-1 text-sm">Content source</Text>
        </View>
        {isTV ? (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Close drawer"
            hasTVPreferredFocus={false}
            onPress={handleClose}
            borderRadius={20}
            focusScale={1.1}
            focusBorderColor={focusBorderColor}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              height: 40,
              justifyContent: 'center',
              width: 40,
            }}>
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TVFocusable>
        ) : null}
      </View>

      <TVFocusGuide
        autoFocus={true}
        trapFocusLeft={true}
        trapFocusRight={true}
        trapFocusUp={true}
        trapFocusDown={true}
        style={{flex: 1}}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-2">
          
          {/* All Providers Option */}
          <TVFocusable
            onPress={() => handleSelectProvider({
              value: 'all',
              display_name: 'All Providers',
              version: '1.0.0',
              type: 'combined',
            })}
            borderRadius={12}
            focusScale={1.03}
            focusBorderColor={focusBorderColor}
            style={{
              alignItems: 'center',
              backgroundColor: provider.value === 'all'
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(255, 255, 255, 0.04)',
              borderRadius: 12,
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginVertical: 3,
              paddingHorizontal: 16,
              paddingVertical: 13,
            }}>
            {({focused}) => (
              <>
                <View style={{alignItems: 'center', flexDirection: 'row'}}>
                  <ProviderIcon
                    uri=""
                    name="All Providers"
                    size={24}
                    background="rgba(255, 255, 255, 0.08)"
                    color={focused || provider.value === 'all' ? primary : '#888'}
                  />
                  <Text
                    style={{
                      color: focused || provider.value === 'all' ? '#FFFFFF' : '#B0B0B0',
                      fontSize: 16.5,
                      fontWeight: focused || provider.value === 'all' ? '700' : '500',
                      marginLeft: 10,
                    }}>
                    All Providers
                  </Text>
                </View>
                {provider.value === 'all' && (
                  <MaterialIcons name="check" size={22} color={primary} />
                )}
              </>
            )}
          </TVFocusable>

          {/* TV keeps a plain list: rows are picked with the remote. */}
          {isTV &&
            installedProviders.map((item, index) => {
              const isSelected = provider.value === item.value;
              const isPreferred = hasSelectedProvider ? isSelected : index === 0;

              return (
                <TVFocusable
                  key={item.value}
                  hasTVPreferredFocus={isPreferred}
                  onPress={() => handleSelectProvider(item)}
                  borderRadius={12}
                  focusScale={1.03}
                  focusBorderColor={focusBorderColor}
                  style={{
                    alignItems: 'center',
                    backgroundColor: isSelected
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(255, 255, 255, 0.04)',
                    borderRadius: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginVertical: 3,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                  }}>
                  {({focused}) => (
                    <>
                      <View
                        style={{alignItems: 'center', flexDirection: 'row'}}>
                        <ProviderIcon
                          uri={item.icon}
                          name={item.display_name}
                          size={24}
                          background="rgba(255, 255, 255, 0.08)"
                          color={focused || isSelected ? primary : '#888'}
                        />
                        <Text
                          style={{
                            color:
                              focused || isSelected ? '#FFFFFF' : '#B0B0B0',
                            fontSize: 16.5,
                            fontWeight: focused || isSelected ? '700' : '500',
                            marginLeft: 10,
                          }}>
                          {item.display_name}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialIcons name="check" size={22} color={primary} />
                      )}
                    </>
                  )}
                </TVFocusable>
              );
            })}
          {!isTV && (
            <ReorderableProviderList
              providers={installedProviders}
              selectedValue={provider.value}
              primary={primary}
              onSelect={handleSelectProvider}
            />
          )}
          <View className="h-16" />
        </ScrollView>
      </TVFocusGuide>
    </View>
  );
};

export default ProviderDrawer;

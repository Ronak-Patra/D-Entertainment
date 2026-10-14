import {useInAppPlayerStore} from '../lib/zustand/inAppPlayerStore';
import {View, Text, StatusBar, TouchableOpacity, UIManager, findNodeHandle} from 'react-native';
import React from 'react';
import {useState} from 'react';
import useContentStore from '../lib/zustand/contentStore';
import Animated, {FadeInRight} from 'react-native-reanimated';
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {settingsStorage} from '../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {RootStackParamList} from '../App';
import {useM3Colors} from '../theme/M3PaletteContext';
import * as DocumentPicker from 'expo-document-picker';
import {TVFocusable} from './tv';
import {isTV} from '../lib/tv/constants';

const Tutorial = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const colors = useM3Colors();
  const {provider: currentProvider, installedProviders} = useContentStore(
    state => state,
  );
  const hasNoProvider = !installedProviders || installedProviders.length === 0;
  const [showTutorial, setShowTutorial] = useState<boolean>(hasNoProvider);
  const installButtonRef = React.useRef<View>(null);

  // A fresh TV install can leave native focus on the full-screen React root.
  // Request focus after the tutorial button has mounted so the first D-pad
  // press starts from a real control.
  useFocusEffect(
    React.useCallback(() => {
      if (!isTV || !showTutorial) return;
      const timer = setTimeout(() => {
        const handle = findNodeHandle(installButtonRef.current);
        if (handle) {
          UIManager.dispatchViewManagerCommand(handle, 'requestTVFocus', []);
        }
      }, 450);
      return () => clearTimeout(timer);
    }, [showTutorial]),
  );

  // Handle default provider setup
  React.useEffect(() => {
    if (!installedProviders || installedProviders.length === 0) {
      setShowTutorial(true);
    } else {
      if (!currentProvider || !currentProvider.value) {
        useContentStore.getState().setProvider(installedProviders[0]);
      }
      setShowTutorial(false);
    }
  }, [installedProviders, currentProvider]);

  // Handle status bar color
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBackgroundColor('#121212');
      StatusBar.setBarStyle('light-content');

      return () => {
        StatusBar.setBackgroundColor('#121212');
        StatusBar.setBarStyle('light-content');
      };
    }, []),
  );

  const handleGoToExtensions = () => {
    // Add haptic feedback
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    const parentNav = navigation.getParent();
    if (parentNav) {
      (parentNav as any).navigate('SettingsStack', {
        screen: 'Extensions',
      });
    } else {
      (navigation as any).navigate('SettingsStack', {
        screen: 'Extensions',
      });
    }
  };

  const handlePlayLocalFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      multiple: false,
      copyToCacheDirectory: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const video = result.assets[0];
    useInAppPlayerStore.getState().openPlayer( {
      linkIndex: 0,
      episodeList: [
        {
          id: video.uri,
          title: video.name || 'Local video',
          link: video.uri,
        },
      ],
      directUrl: video.uri,
      type: 'mp4',
      primaryTitle: video.name || 'Local video',
      poster: {},
    });
  };

  return showTutorial ? (
    <View
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: colors.background || '#121212',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      className="z-50">
      <Animated.View
        entering={FadeInRight.duration(500)}
        className="rounded-2xl p-6 w-full max-w-sm items-center">
        <MaterialCommunityIcons
          name="package-variant-closed"
          size={64}
          color={colors.onSurfaceVariant}
          style={{marginBottom: 16}}
        />
        <Text
          style={{
            color: colors.onSurface,
            fontSize: 24,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 16,
          }}>
          No Provider Installed
        </Text>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontSize: 16,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 24,
          }}>
          Connect your cloud provider to play network streams or play local
          content.
        </Text>
        <TVFocusable
          ref={installButtonRef}
          onPress={handleGoToExtensions}
          hasTVPreferredFocus={true}
          accessibilityLabel="Install Cloud Providers"
          accessibilityRole="button"
          borderRadius={12}
          focusBorderColor={colors.onPrimary}
          style={{width: '100%'}}>
          <View
            className="px-6 py-3 rounded-xl w-full flex-row items-center justify-center"
            style={{backgroundColor: colors.primary}}>
            <MaterialCommunityIcons
              name="download"
              size={20}
              color={colors.onPrimary}
            />
            <Text
              style={{
                color: colors.onPrimary,
                fontSize: 16,
                fontWeight: '600',
                marginLeft: 8,
              }}>
              Install Cloud Providers
            </Text>
          </View>
        </TVFocusable>
        <TVFocusable
          onPress={handlePlayLocalFile}
          accessibilityLabel="Play local file"
          accessibilityRole="button"
          borderRadius={12}
          style={{width: '100%', marginTop: 12}}>
          <View
            className="px-6 py-3 rounded-xl w-full flex-row items-center justify-center"
            style={{
              backgroundColor: colors.secondaryContainer,
              borderColor: colors.outline,
              borderWidth: 1,
            }}>
            <MaterialCommunityIcons
              name="play-circle-outline"
              size={20}
              color={colors.onSecondaryContainer}
            />
            <Text
              style={{
                color: colors.onSecondaryContainer,
                fontSize: 16,
                fontWeight: '600',
                marginLeft: 8,
              }}>
              Play local file
            </Text>
          </View>
        </TVFocusable>
      </Animated.View>
    </View>
  ) : null;
};

export default Tutorial;

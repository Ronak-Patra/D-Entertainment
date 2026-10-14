import {useFocusEffect} from '@react-navigation/native';
import {View, ScrollView, ToastAndroid, BackHandler} from 'react-native';
import React, {useState, useRef, useCallback} from 'react';
import * as Application from 'expo-application';
import SettingsRow from '../../components/ui/SettingsRow';
import SettingsSection from '../../components/ui/SettingsSection';
import SettingsSwitchRow from '../../components/ui/SettingsSwitchRow';
import AppText from '../../components/ui/Text';
import LoadingIndicator from '../../components/ui/LoadingIndicator';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import {isTV} from '../../lib/tv';
import {
  isDetailedLoggingEnabled,
  setDetailedLogging,
  shareLogs,
} from '../../lib/logging/vegaLog';
import {useRemoteStore} from '../../lib/remote/remoteStore';

const About = ({navigation}: any) => {
  const colors = useM3Colors();
  const backRef = useRef<View>(null);
  const [detailedLogging, setDetailedLoggingState] = useState(
    isDetailedLoggingEnabled,
  );
  const [exportingLogs, setExportingLogs] = useState(false);

  const exportLogs = async () => {
    setExportingLogs(true);
    try {
      const device = useRemoteStore.getState().connectedDevice;
      await shareLogs(
        device
          ? `Receiver ${device.type}: ${[device.manufacturer, device.model, device.name]
              .filter(Boolean)
              .join(' ')}`
          : undefined,
      );
    } catch (error: any) {
      ToastAndroid.show(
        error?.message || 'Could not export logs',
        ToastAndroid.SHORT,
      );
    } finally {
      setExportingLogs(false);
    }
  };

  // Register only while this screen is focused. A hidden screen in a
  // mounted tab or stack must not swallow back presses.
  useFocusEffect(
    useCallback(() => {
      if (!isTV) {
        return;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [navigation]),
  );

  return (
    <TVFocusGuide autoFocus={true} trapFocusRight={true} trapFocusDown={true} style={{flex: 1}}>
      <ScrollView
        focusable={false}
        accessible={false}
        style={{flex: 1, backgroundColor: colors.background}}
        contentContainerStyle={{padding: 20, paddingBottom: 40}}
        showsVerticalScrollIndicator={false}>
        <View className="mb-7">
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
            <TVFocusable
              ref={backRef}
              hasTVPreferredFocus={isTV}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              borderRadius={22}
              style={{
                alignItems: 'center',
                height: 44,
                justifyContent: 'center',
                marginRight: 10,
                width: 44,
              }}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={28}
                color={colors.onBackground}
              />
            </TVFocusable>
            <AppText
              role="headlineLargeEmphasized"
              className="text-m3-on-background">
              About D Entertainment
            </AppText>
          </View>
          <AppText role="bodyLarge" className="mt-1 text-m3-on-surface-variant">
            App information and diagnostics
          </AppText>
        </View>

        <SettingsSection title="App">
          <SettingsRow
            title="Version"
            description={`D Entertainment ${Application.nativeApplicationVersion || ''}`}
            icon="information-outline"
            divider={false}
          />
        </SettingsSection>

        {!isTV && (
          <SettingsSection title="Troubleshooting">
            <SettingsSwitchRow
              title="Detailed logging"
              description="Records more detail for bug reports. Keeps up to 2 MB of logs. Turns off after 24 hours."
              value={detailedLogging}
              onValueChange={next => {
                setDetailedLoggingState(next);
                setDetailedLogging(next);
              }}
            />
            <SettingsRow
              title="Export logs"
              description="Share recent app logs with the developer. Links and sign-in data are removed."
              icon="file-document-outline"
              divider={false}
              trailing={
                exportingLogs ? <LoadingIndicator size={14} /> : undefined
              }
              onPress={exportingLogs ? undefined : exportLogs}
            />
          </SettingsSection>
        )}
      </ScrollView>
    </TVFocusGuide>
  );
};

export default About;

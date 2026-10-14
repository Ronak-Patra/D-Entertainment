import React, {useState} from 'react';
import {Platform, Pressable, View} from 'react-native';
import {isDynamicColorAvailable} from '@expo/ui/jetpack-compose';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useThemeStore from '../../../lib/zustand/themeStore';
import {M3_SEEDS} from '../../../theme/seeds';
import {useM3Colors} from '../../../theme/M3PaletteContext';
import AppText from '../../../components/ui/Text';
import Surface from '../../../components/ui/Surface';
import SettingsSwitchRow from '../../../components/ui/SettingsSwitchRow';
import {settingsStorage} from '../../../lib/storage';
import {TVFocusable} from '../../../components/tv/TVFocusable';

const AppearancePreference = () => {
  const source = useThemeStore(state => state.source);
  const setSource = useThemeStore(state => state.setSource);
  const primary = useThemeStore(state => state.primary);
  const setPrimary = useThemeStore(state => state.setPrimary);
  const colors = useM3Colors();
  const [dynamicInfoAccentEnabled, setDynamicInfoAccentEnabled] = useState(() =>
    settingsStorage.isDynamicInfoAccentEnabled(),
  );

  const wallpaperActive = source === 'wallpaper';

  return (
    <View className="mb-6">
      <AppText role="labelLarge" className="mb-3 text-m3-on-surface-variant">
        Appearance
      </AppText>
      <Surface level="low" className="overflow-hidden">
        <TVFocusable
          testID="accent-source-wallpaper"
          disabled={!isDynamicColorAvailable}
          onPress={() => setSource('wallpaper')}
          borderRadius={12}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
          }}>
          <View
            className="mr-4 h-11 w-11 items-center justify-center rounded-2xl"
            style={{backgroundColor: colors.tertiaryContainer}}>
            <MaterialCommunityIcons
              name="wallpaper"
              size={22}
              color={colors.onTertiaryContainer}
            />
          </View>
          <View className="mr-4 flex-1 shrink">
            <AppText
              role="bodyLargeEmphasized"
              numberOfLines={1}
              className="text-m3-on-surface">
              Wallpaper colors
            </AppText>
            <AppText
              role="bodySmall"
              numberOfLines={2}
              className="mt-1 text-m3-on-surface-variant">
              {isDynamicColorAvailable
                ? 'Match the system Material You palette'
                : 'Requires Android 12 or newer'}
            </AppText>
          </View>
          {wallpaperActive && isDynamicColorAvailable ? (
            <MaterialCommunityIcons
              name="check-circle"
              size={22}
              color={colors.primary}
            />
          ) : null}
        </TVFocusable>

        <View className="h-px bg-m3-outline-variant" />

        <View className="p-4">
          <AppText role="bodyLargeEmphasized" className="text-m3-on-surface">
            Accent color
          </AppText>
          <AppText role="bodySmall" className="mt-1 text-m3-on-surface-variant">
            Choose a curated seed for D Entertainment's dark palette
          </AppText>
          <View className="mt-4 flex-row flex-wrap gap-3">
            {M3_SEEDS.map(seed => {
              const isSelected =
                source === 'custom' &&
                primary.toLowerCase() === seed.color.toLowerCase();
              return (
                <TVFocusable
                  key={seed.color}
                  testID={`accent-seed-${seed.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${seed.name} accent color`}
                  accessibilityState={{selected: isSelected}}
                  borderRadius={18}
                  onPress={() => {
                    setSource('custom');
                    setPrimary(seed.color);
                  }}
                  style={{
                    backgroundColor: seed.color,
                    borderColor: isSelected
                      ? colors.onSurface
                      : colors.outlineVariant,
                    borderRadius: 18,
                    borderWidth: isSelected ? 3 : 1,
                    height: 52,
                    width: 52,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <MaterialCommunityIcons
                    name={isSelected ? 'check' : 'palette'}
                    size={22}
                    color={isSelected ? colors.scrim : '#17100F'}
                  />
                </TVFocusable>
              );
            })}
          </View>
        </View>

        <View className="h-px bg-m3-outline-variant" />

        <SettingsSwitchRow
          title="Dynamic info accent"
          description="Match the info page accent to each title's artwork"
          value={dynamicInfoAccentEnabled}
          onValueChange={enabled => {
            setDynamicInfoAccentEnabled(enabled);
            settingsStorage.setDynamicInfoAccentEnabled(enabled);
          }}
        />
      </Surface>
    </View>
  );
};

export default AppearancePreference;

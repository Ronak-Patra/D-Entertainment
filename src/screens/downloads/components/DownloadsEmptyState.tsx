import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {View, findNodeHandle} from 'react-native';
import {TVFocusable} from '../../../components/tv';
import AppText from '../../../components/ui/Text';
import {isTV} from '../../../lib/tv';
import {useTVFocusBorderColor} from '../../../lib/tv/useTVFocusBorderColor';
import useTVNavigationStore from '../../../lib/zustand/tvNavigationStore';
import {useM3Colors} from '../../../theme/M3PaletteContext';

interface DownloadsEmptyStateProps {
  onExplore: () => void;
  onPlayLocalVideo?: () => void;
  exploreButtonRef?: React.RefObject<any>;
  onExploreLayout?: () => void;
  preferredFocus?: boolean;
}

export const DownloadsEmptyState: React.FC<DownloadsEmptyStateProps> = ({
  onExplore,
  onPlayLocalVideo,
  exploreButtonRef,
  onExploreLayout,
  preferredFocus = true,
}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();

  return (
    <View className="items-center justify-center py-20">
      <MaterialCommunityIcons
        name="download-off-outline"
        size={72}
        color={colors.onSurfaceVariant}
      />
      <AppText
        role="bodyLarge"
        className="mt-4 text-center text-m3-on-surface-variant">
        Your downloaded library is empty
      </AppText>
      <View className="mt-6 flex-row flex-wrap items-center justify-center gap-3">
        {onPlayLocalVideo ? (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Play Local Video"
            onPress={onPlayLocalVideo}
            borderRadius={20}
            focusScale={1.06}
            focusBorderColor={focusBorderColor}
            style={{
              alignItems: 'center',
              backgroundColor: colors.surfaceContainerHigh,
              borderRadius: 20,
              flexDirection: 'row',
              gap: 8,
              justifyContent: 'center',
              minHeight: 44,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}>
            <MaterialCommunityIcons
              name="folder-play-outline"
              size={20}
              color={colors.primary}
            />
            <AppText
              role="labelLargeEmphasized"
              style={{color: colors.primary, fontWeight: '700'}}>
              Play Local Video
            </AppText>
          </TVFocusable>
        ) : null}
        <TVFocusable
          ref={exploreButtonRef}
          onLayout={onExploreLayout}
          hasTVPreferredFocus={isTV && preferredFocus}
          accessibilityRole="button"
          accessibilityLabel="Explore Content"
          onPress={onExplore}
          onFocus={() => {
            if (exploreButtonRef?.current) {
              const handle = findNodeHandle(exploreButtonRef.current);
              if (handle) {
                useTVNavigationStore
                  .getState()
                  .setActiveScreenFocusHandle(handle);
              }
            }
          }}
          borderRadius={20}
          focusScale={1.06}
          focusBorderColor={focusBorderColor}
          style={{
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderRadius: 20,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 44,
            paddingHorizontal: 20,
            paddingVertical: 10,
          }}>
          <MaterialIcons name="explore" size={20} color={colors.onPrimary} />
          <AppText
            role="labelLargeEmphasized"
            style={{color: colors.onPrimary, fontWeight: '700'}}>
            Explore Content
          </AppText>
        </TVFocusable>
      </View>
    </View>
  );
};

export default React.memo(DownloadsEmptyState);

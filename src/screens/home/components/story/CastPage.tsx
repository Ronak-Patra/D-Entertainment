import React from 'react';
import { Image, Linking, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppText from '../../../../components/ui/Text';
import { useM3Colors } from '../../../../theme/M3PaletteContext';
import type { TmdbStoryData } from '../../../../lib/hooks/useTmdbStory';
import { TVFocusable } from '../../../../components/tv';
import { getTmdbImage, SectionHeading } from './storyUtils';
import {isTV} from '../../../../lib/tv/constants';

interface CastPageProps {
  data: TmdbStoryData;
  onInteract?: () => void;
  onPersonPress?: (id: string | number, name: string) => void;
}

export const CastPage: React.FC<CastPageProps> = ({ data, onInteract, onPersonPress }) => {
  const colors = useM3Colors();

  return (
    <>
      <SectionHeading icon="account-group-outline" title="Cast" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {data.cast.map(person => {
          const image = getTmdbImage(person.profilePath, 'w342');
          return (
            <TVFocusable
              key={person.id}
              borderRadius={22}
              focusScale={1.03}
              onPress={() => {
                onInteract?.();
                if (onPersonPress && person.id) {
                  onPersonPress(person.id, person.name);
                } else if (
                  typeof person.id === 'string' &&
                  person.id.startsWith('nm')
                ) {
                  Linking.openURL(`https://www.imdb.com/name/${person.id}/`);
                } else if (person.id) {
                  Linking.openURL(
                    `https://www.themoviedb.org/person/${person.id}`,
                  );
                }
              }}
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderRadius: 22,
                flexBasis: isTV ? undefined : '47%',
                flexGrow: isTV ? 0 : 1,
                overflow: 'hidden',
                width: isTV ? 170 : undefined,
              }}>
              {image ? (
                <Image
                  source={{ uri: image }}
                  resizeMode="cover"
                  resizeMethod="resize"
                  style={{
                    aspectRatio: 0.78,
                    backgroundColor: colors.surfaceContainer,
                    width: '100%',
                  }}
                />
              ) : (
                <View
                  style={{
                    alignItems: 'center',
                    aspectRatio: 0.78,
                    backgroundColor: colors.surfaceContainer,
                    justifyContent: 'center',
                    width: '100%',
                  }}>
                  <MaterialCommunityIcons
                    name="account"
                    size={64}
                    color={colors.outline}
                  />
                </View>
              )}
              <View style={{ padding: 12 }}>
                <AppText
                  role="labelLargeEmphasized"
                  numberOfLines={2}
                  style={{ color: colors.onSurface }}>
                  {person.name}
                </AppText>
                {person.character ? (
                  <AppText
                    role="bodySmall"
                    numberOfLines={2}
                    style={{ color: colors.onSurfaceVariant, marginTop: 3 }}>
                    {person.character}
                  </AppText>
                ) : null}
              </View>
            </TVFocusable>
          );
        })}
      </View>
    </>
  );
};

export default CastPage;

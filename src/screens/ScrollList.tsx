import ScreenSafeArea from '../components/ui/ScreenSafeArea';
import { View, Pressable, useWindowDimensions } from 'react-native';
import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList, SearchStackParamList } from '../App';
import { Post } from '../lib/providers/types';
import { Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import useContentStore from '../lib/zustand/contentStore';
import { settingsStorage } from '../lib/storage';
import { FlashList } from '@shopify/flash-list';
import { BlurView } from 'expo-blur';
import SkeletonLoader from '../components/Skeleton';
import { providerManager } from '../lib/services/ProviderManager';
import IconButton from '../components/ui/IconButton';
import AppText from '../components/ui/Text';
import { useM3Colors } from '../theme/M3PaletteContext';
import { parseAspectRatio } from '../components/MediaPosterCard';
import { isTV, useTVRemote } from '../lib/tv';
import { useTVFocusBorderColor } from '../lib/tv/useTVFocusBorderColor';
import {
  useSafeIsNavFocused,
  useTVNavFocusMemory,
} from '../lib/tv/useTVNavFocusMemory';

type Props = NativeStackScreenProps<HomeStackParamList, 'ScrollList'>;

type ListItem = Post | { id: string; isSkeleton: true };

const GRID_POSTER_WIDTH = 100;
const GRID_POSTER_HEIGHT = 150;
const LIST_POSTER_WIDTH = 70;
const LIST_POSTER_HEIGHT = 100;
// Screen container uses p-4 and each grid cell uses m-3 on both sides.
const GRID_SCREEN_PADDING = 16;
const GRID_ITEM_MARGIN = 12;
const GRID_POSTER_ASPECT_RATIO = GRID_POSTER_HEIGHT / GRID_POSTER_WIDTH;

const ScrollListCard = memo(({
  item,
  viewType,
  gridPosterWidth,
  dominantRatio,
  hasTVPreferredFocus,
  onPress,
  onTVFocus,
}: {
  item: Post;
  viewType: number;
  gridPosterWidth: number;
  dominantRatio: number;
  hasTVPreferredFocus: boolean;
  onPress: () => void;
  onTVFocus?: () => void;
}) => {
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const [isFocused, setIsFocused] = useState(false);
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    setImageError(false);
  }, [item.image]);
  const pressableRef = useRef<View>(null);
  const isNavFocused = useSafeIsNavFocused();
  const {
    preferredFocus,
    onFocus: rememberFocus,
    onBlur: forgetFocus,
  } = useTVNavFocusMemory({
    ref: pressableRef,
    isNavFocused,
    hasTVPreferredFocus,
  });

  const lastPressTime = useRef<number>(0);
  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastPressTime.current < 300) return;
    lastPressTime.current = now;
    onPress();
  }, [onPress]);

  useTVRemote(
    evt => {
      if (
        isFocused &&
        (evt.eventType === 'select' || evt.eventType === 'playPause') &&
        (evt.eventKeyAction === undefined || evt.eventKeyAction === 1)
      ) {
        handlePress();
      }
    },
    isTV && isFocused,
  );

  const itemRatio = parseAspectRatio(item.aspectRatio, dominantRatio);
  const cardHeight = Math.round(gridPosterWidth / itemRatio);
  const activeBorderRadius =
    typeof item.borderRadius === 'number' && item.borderRadius >= 0
      ? item.borderRadius
      : 10;
  const rawTag =
    item.cornerTag ??
    item.tag ??
    (item as any).badge ??
    (item as any).rating;
  const activeTag = rawTag != null ? String(rawTag).trim() : '';

  const listWidth = itemRatio > 1.2 ? 110 : LIST_POSTER_WIDTH;
  const listHeight = Math.round(listWidth / itemRatio);

  return (
    <Pressable
      ref={pressableRef}
      focusable={true}
      isTVSelectable={true}
      hasTVPreferredFocus={preferredFocus}
      onFocus={() => {
        setIsFocused(true);
        rememberFocus();
        onTVFocus?.();
      }}
      onBlur={() => {
        setIsFocused(false);
        forgetFocus();
      }}
      onPress={handlePress}
      style={{
        zIndex: isFocused ? 999 : 1,
        transform: [{scale: isFocused ? 1.05 : 1}],
      }}
      className={
        viewType === 1
          ? 'flex flex-col m-3 items-center'
          : 'flex-row m-3 items-center'
      }>
      <View
        style={{
          position: 'relative',
          width: viewType === 1 ? gridPosterWidth : listWidth,
          height: viewType === 1 ? cardHeight : listHeight,
          borderRadius: activeBorderRadius,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainerHigh,
          // Fixed width so focus does not shrink the poster.
          borderWidth: isTV ? 3 : 1,
          borderColor: isFocused ? focusBorderColor : 'rgba(255, 255, 255, 0.08)',
        }}>
        {item.image && !imageError ? (
          <Image
            source={{uri: item.image}}
            onError={() => setImageError(true)}
            resizeMode="cover"
            resizeMethod="resize"
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceContainerHighest,
            }}>
            <Image
              source={require('../../assets/icon.png')}
              resizeMode="contain"
              style={{
                width: '50%',
                height: '50%',
                opacity: 0.8,
              }}
            />
          </View>
        )}
        {activeTag.length > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              borderRadius: 5,
              overflow: 'hidden',
              zIndex: 10,
              elevation: 6,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 4,
            }}>
            <BlurView
              intensity={45}
              tint="systemMaterialDark"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.20)',
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}>
              <AppText
                role="labelSmallEmphasized"
                style={{
                  color: '#FFFFFF',
                  fontWeight: '800',
                  fontSize: 9.5,
                  letterSpacing: 0.5,
                  textShadowColor: 'rgba(0, 0, 0, 0.85)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}>
                {activeTag.toUpperCase()}
              </AppText>
            </BlurView>
          </View>
        ) : null}
      </View>
      <AppText
        role={viewType === 1 ? 'bodySmall' : 'bodyLargeEmphasized'}
        numberOfLines={2}
        style={
          viewType === 1
            ? { width: gridPosterWidth, marginTop: 6 }
            : undefined
        }
        className={
          viewType === 1
            ? `text-center ${isFocused ? 'text-white font-bold' : 'text-m3-on-surface'}`
            : `ml-3.5 flex-1 ${isFocused ? 'text-white font-bold' : 'text-m3-on-surface'}`
        }>
        {item.title}
      </AppText>
    </Pressable>
  );
});

const ScrollList = ({ route }: Props): React.ReactElement => {
  const colors = useM3Colors();
  const { width: windowWidth } = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [posts, setPosts] = useState<Post[]>([]);
  const { filter, providerValue } = route.params;
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEnd, setIsEnd] = useState<boolean>(false);
  const provider = useContentStore(state => state.provider);
  const [viewType, setViewType] = useState<number>(
    settingsStorage.getListViewType(),
  );
  // FlashList recycles cells, so "index === 0" turns true again whenever a
  // cell is reused for the first item. Only claim focus until a card has it.
  const [initialCardFocused, setInitialCardFocused] = useState(false);
  const markInitialCardFocused = useCallback(
    () => setInitialCardFocused(true),
    [],
  );

  // Compute dominant aspect ratio from posts to size grid columns appropriately
  const dominantRatio = useMemo(() => {
    const postWithRatio = posts.find(p => p && p.aspectRatio != null);
    return postWithRatio
      ? parseAspectRatio(postWithRatio.aspectRatio, 2 / 3)
      : 2 / 3;
  }, [posts]);

  // Derive the grid from the available width and aspect ratio
  const gridAvailableWidth = windowWidth - GRID_SCREEN_PADDING * 2;
  const isLandscapeCatalog = dominantRatio > 1.2;
  const targetPosterWidth = isLandscapeCatalog ? 160 : GRID_POSTER_WIDTH;
  const minColumns = isLandscapeCatalog
    ? (windowWidth < 360 ? 1 : 2)
    : (windowWidth < 350 ? 2 : 3);
  const gridColumns = Math.max(
    minColumns,
    Math.floor(
      gridAvailableWidth / (targetPosterWidth + GRID_ITEM_MARGIN * 2),
    ),
  );
  const gridPosterWidth =
    Math.floor(gridAvailableWidth / gridColumns) - GRID_ITEM_MARGIN * 2;
  const numColumns = viewType === 1 ? gridColumns : 1;

  const isSearch = Boolean(route.params?.isSearch);
  const activeProviderValue = providerValue || provider?.value || '';

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchPosts = async () => {
      if (isEnd) return;

      if (!activeProviderValue) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // Promise chain instead of try/catch/finally: React Compiler skips any
      // component with a finally clause or conditionals inside a try block.
      let getNewPosts: Promise<Post[]>;
      const fetchWithTimeout = <T,>(
        promise: Promise<T>,
        timeoutMs: number,
        fallback: T,
      ): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs)),
        ]);
      };

      if (activeProviderValue === 'all') {
        const { CUSTOM_HUBS, getRecencyScore, extractYearFromTitle } = await import('../lib/getHomepagedata');
        const { extensionStorage, providersStorage } = await import('../lib/storage');
        const { deduplicatePosts } = await import('../lib/providers/deduplicatePosts');
        const installed = extensionStorage.getInstalledProviders();
        const disabled = providersStorage.getDisabledProviders();
        let activeProviders = installed.filter(
          p => !disabled.includes(p.value) && p.value !== 'all',
        );
        if (activeProviders.length === 0) {
          const storeProviders = useContentStore.getState().installedProviders;
          activeProviders = storeProviders.filter(
            p => !disabled.includes(p.value) && p.value !== 'all',
          );
        }

        if (isSearch) {
          const searchTargets = activeProviders.slice(0, 6);
          const promises = searchTargets.map(p =>
            fetchWithTimeout(
              providerManager
                .getSearchPosts({
                  searchQuery: filter,
                  page,
                  providerValue: p.value,
                  signal,
                })
                .then(res => (res || []).map(item => ({ ...item, provider: p.value })))
                .catch(() => [] as Post[]),
              6500,
              [] as Post[],
            ),
          );
          getNewPosts = Promise.all(promises).then(lists =>
            deduplicatePosts(lists.flat()),
          );
        } else {
          const hub = CUSTOM_HUBS.find(
            h =>
              h.title.toLowerCase() === filter.toLowerCase() ||
              h.title.toLowerCase() === (route.params.title || '').toLowerCase(),
          );
          const keywords = hub?.keywords || [filter.toLowerCase()];
          const isLatest = hub?.title === 'Latest Releases' || hub?.title === 'New Releases';

          // Rank and select top matching providers for this hub
          let targetProviders = activeProviders;
          if (!isLatest && hub) {
            const scored = activeProviders.map(p => {
              let score = 0;
              const type = (p.type || '').toLowerCase();
              const val = (p.value || '').toLowerCase();
              const name = (p.display_name || '').toLowerCase();
              if (hub.title === 'Anime' && (type === 'anime' || val.includes('anime'))) score += 50;
              if (hub.title.includes('K-Drama') && (type === 'drama' || val.includes('drama'))) score += 50;
              if ((hub.title.includes('Bollywood') || hub.title.includes('South')) && (type === 'india' || val.includes('bolly') || val.includes('hindi') || val.includes('south'))) score += 50;
              if (hub.title.includes('Hollywood')) {
                if (type === 'english' || type === 'global') score += 70;
                if (type === 'india') score -= 30;
                if (val.includes('holly') || name.includes('holly') || val.includes('english')) score += 40;
                if (val.includes('bolly') || val.includes('desi') || name.includes('bolly')) score -= 40;
              }
              for (const kw of keywords) {
                if (val.includes(kw) || name.includes(kw)) score += 20;
              }
              return { provider: p, score };
            });
            scored.sort((a, b) => b.score - a.score);
            targetProviders = scored.slice(0, 4).map(s => s.provider);
          } else {
            targetProviders = activeProviders.slice(0, 5);
          }

          const promises = targetProviders.map(async p => {
            try {
              const catalogs = await fetchWithTimeout(
                providerManager.getCatalog({ providerValue: p.value, signal }),
                4500,
                [],
              );
              let matched = catalogs.find(f =>
                keywords.some(
                  k =>
                    (f.title && f.title.toLowerCase().includes(k)) ||
                    (f.filter && f.filter.toLowerCase().includes(k)),
                ),
              );
              if (!matched) {
                if (isLatest) matched = catalogs[0];
                else if (hub?.title === 'Trending') matched = catalogs[1] || catalogs[0];
                else if (
                  hub?.title.includes('Hollywood') ||
                  hub?.title === 'Anime' ||
                  hub?.title.includes('K-Drama')
                ) {
                  matched = undefined;
                } else {
                  matched = catalogs[0];
                }
              }
              if (matched) {
                const res = await fetchWithTimeout(
                  providerManager.getPosts({
                    filter: matched.filter,
                    page,
                    providerValue: p.value,
                    signal,
                  }),
                  6500,
                  [],
                );
                let mapped = (res || []).map(item => ({ ...item, provider: p.value }));
                if (hub?.title.includes('Hollywood')) {
                  mapped = mapped.filter(item => {
                    const t = (item.title || '').toLowerCase();
                    const tag = (item.tag || '').toLowerCase();
                    if (/bollywood|punjabi|bengali|marathi|gujarati|bhojpuri|desi|tollywood|kollywood/i.test(t)) return false;
                    if (/bollywood|punjabi|bengali|marathi|gujarati|bhojpuri|desi/i.test(tag)) return false;
                    if (/hindi movie|hindi original|hindi web/i.test(t) && !/hollywood|english|dubbed|dual audio/i.test(t)) return false;
                    return true;
                  });
                }
                return mapped;
              }
            } catch {}
            return [] as Post[];
          });

          getNewPosts = Promise.all(promises).then(lists => {
            const unique = deduplicatePosts(lists.flat());
            if (isLatest) {
              unique.sort((a, b) => getRecencyScore(b) - getRecencyScore(a));
            } else if (hub?.title === 'Trending') {
              unique.sort((a, b) => {
                const rA = parseFloat(String(a.rating || 0)) || 0;
                const rB = parseFloat(String(b.rating || 0)) || 0;
                if (rA !== rB) return rB - rA;
                return extractYearFromTitle(b.title) - extractYearFromTitle(a.title);
              });
            }
            return unique;
          });
        }
      } else {
        getNewPosts = isSearch
          ? fetchWithTimeout(
              providerManager.getSearchPosts({
                searchQuery: filter,
                page,
                providerValue: activeProviderValue,
                signal,
              }),
              10000,
              [] as Post[],
            )
          : fetchWithTimeout(
              providerManager.getPosts({
                filter,
                page,
                providerValue: activeProviderValue,
                signal,
              }),
              10000,
              [] as Post[],
            );
      }

      await getNewPosts
        .then(newPosts => {
          if (cancelled || signal.aborted) return;

          if (!newPosts || newPosts.length === 0) {
            setIsEnd(true);
            return;
          }

          setPosts(prev => (page === 1 ? newPosts : [...prev, ...newPosts]));
        })
        .catch(error => {
          if (cancelled || signal.aborted || (error as any)?.name === 'AbortError') return;
          console.error('Error fetching posts:', error);
          setIsEnd(true);
        });

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    fetchPosts();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, filter, activeProviderValue, isSearch]);

  const onEndReached = async () => {
    // Don't trigger more loading if we're already loading, at the end, or initial posts haven't arrived
    if (isLoading || isEnd || posts.length === 0) {
      return;
    }
    setPage(prevPage => prevPage + 1);
  };

  const skeletons: ListItem[] = Array.from({
    length: viewType === 1 ? gridColumns * 3 : 6,
  }).map((_, i) => ({ id: `skeleton-${i}`, isSkeleton: true }));
  const listData: ListItem[] =
    posts.length === 0 && isLoading ? skeletons : posts;

  const renderSkeletonItem = () => {
    const defaultSkeletonHeight = Math.round(gridPosterWidth / dominantRatio);
    const listSkeletonWidth = dominantRatio > 1.2 ? 110 : LIST_POSTER_WIDTH;
    const listSkeletonHeight = Math.round(listSkeletonWidth / dominantRatio);

    return (
      <View
        className={
          viewType === 1
            ? 'flex flex-col m-3 items-center'
            : 'flex-row m-3 items-center'
        }>
        <SkeletonLoader
          height={viewType === 1 ? defaultSkeletonHeight : listSkeletonHeight}
          width={viewType === 1 ? gridPosterWidth : listSkeletonWidth}
          marginVertical={0}
        />
        <SkeletonLoader
          height={viewType === 1 ? 12 : 18}
          width={viewType === 1 ? gridPosterWidth : '65%'}
          marginVertical={viewType === 1 ? 8 : 0}
          style={viewType === 1 ? undefined : { marginLeft: 12 }}
        />
      </View>
    );
  };

  // The footer sits outside the grid, so it is not laid out into columns.
  // Render a full row of placeholders instead of a single stray one.
  const renderLoadingMoreSkeletons = () => (
    <View className={viewType === 1 ? 'flex-row flex-wrap' : ''}>
      {Array.from({ length: viewType === 1 ? gridColumns : 2 }).map((_, i) => (
        <View key={`footer-skeleton-${i}`}>{renderSkeletonItem()}</View>
      ))}
    </View>
  );

  return (
    <ScreenSafeArea className="h-full w-full bg-m3-background p-4">
      <View className="w-full px-4 font-semibold my-6 flex-row justify-between items-center">
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1}}>
          <IconButton
            icon="arrow-left"
            label="Back"
            onPress={() => navigation.goBack()}
          />
          <AppText
            role="headlineLargeEmphasized"
            numberOfLines={1}
            className="flex-1 text-m3-on-background">
            {route.params.title}
          </AppText>
        </View>
        <IconButton
          icon={viewType === 1 ? 'view-grid-outline' : 'view-list-outline'}
          label={viewType === 1 ? 'Switch to list view' : 'Switch to grid view'}
          onPress={() => {
            const newViewType = viewType === 1 ? 2 : 1;
            setViewType(newViewType);
            settingsStorage.setListViewType(newViewType);
          }}
        />
      </View>
      <View className="flex-1 w-full">
        <FlashList
          ListFooterComponent={
            <View className={posts.length > 0 && isLoading ? 'mb-16' : ''}>
              {posts.length > 0 && isLoading
                ? renderLoadingMoreSkeletons()
                : null}
              <View className="h-32" />
            </View>
          }
          data={listData}
          numColumns={numColumns}
          key={`view-type-${viewType}-${numColumns}-${Math.round(dominantRatio * 100)}`}
          contentContainerStyle={{ paddingBottom: 80 }}
          keyExtractor={(item, i) =>
            'isSkeleton' in item ? item.id : `${item.title}-${i}`
          }
          renderItem={({ item, index }) => {
            if ('isSkeleton' in item) {
              return renderSkeletonItem();
            }

            return (
              <ScrollListCard
                item={item}
                viewType={viewType}
                gridPosterWidth={gridPosterWidth}
                dominantRatio={dominantRatio}
                hasTVPreferredFocus={isTV && index === 0 && !initialCardFocused}
                onTVFocus={initialCardFocused ? undefined : markInitialCardFocused}
                onPress={() =>
                  navigation.navigate('Info', {
                    link: item.link,
                    provider: (item as any)?.provider || (route.params.providerValue !== 'all' ? route.params.providerValue : undefined) || (provider.value !== 'all' ? provider.value : undefined),
                    poster: item?.image,
                    title: item.title,
                  })
                }
              />
            );
          }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
        />
        {!isLoading && posts.length === 0 ? (
          <View className="w-full h-full flex items-center justify-center">
            <AppText
              role="titleLargeEmphasized"
              className="text-center text-m3-on-surface-variant">
              No Content Found
            </AppText>
          </View>
        ) : null}
      </View>
    </ScreenSafeArea>
  );
};

export default ScrollList;

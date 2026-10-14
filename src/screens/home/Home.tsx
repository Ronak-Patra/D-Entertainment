import {useStagedHomeRows} from '../../lib/hooks/useStagedHomeRows';
import {scheduleWhenIdle} from '../../lib/performance/idleWork';
import {type ProviderExtension} from '../../lib/storage/extensionStorage';
import {
  beginUIInteraction,
  endUIInteraction,
} from '../../lib/performance/idleWork';
import {RefreshControl, View, Modal, Pressable, ScrollView} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import Slider from '../../components/Slider';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import HeroOptimized from '../../components/Hero';
import {mainStorage} from '../../lib/storage';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import {syncFromSharedFolder} from '../../lib/sync/syncService';
import {
  useHomePageData,
  getRandomHeroPosts,
  clearHeroCache,
} from '../../lib/hooks/useHomePageData';
import ProviderDrawer from '../../components/ProviderDrawer';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../App';
import {Drawer} from 'react-native-drawer-layout';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {Post} from '../../lib/providers/types';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {StatusBar} from 'expo-status-bar';
import AppText from '../../components/ui/Text';
import {useM3Colors} from '../../theme/M3PaletteContext';
import ContinueWatching from '../../components/ContinueWatching';
import StatusBarScrim from '../../components/ui/StatusBarScrim';
import {isTV} from '../../lib/tv/constants';
import useNavigationPreferencesStore from '../../lib/zustand/navigationPreferencesStore';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

type HomeRow = {
  key: string;
  isLoading: boolean;
  title: string;
  filter: string;
  posts: Post[];
  error?: string;
  deferPosts?: boolean;
};

const EMPTY_POSTS: Post[] = [];

const homeRowKey = (row: HomeRow) => row.key;

// Phones share structural recycling types; TV retains its focus/scroll policy.
const homeRowType = (row: HomeRow) =>
  isTV ? row.key : row.isLoading ? 'loading' : 'catalog';

// TV focus can only move to rows that are mounted. Keep about two rows ahead
// ready so fast D-pad presses do not run past the rendered content.
const HOME_DRAW_DISTANCE = isTV ? 800 : 250;

export const CATEGORY_TABS = [
  'All',
  'Anime',
  'K-Drama',
  'Trending & New',
  'Bollywood & South Indian',
  'Hollywood',
  'OTT Series',
] as const;

export type CategoryTab = typeof CATEGORY_TABS[number];

const Home = ({}: Props) => {
  const colors = useM3Colors();
  const isFocused = useIsFocused();
  const [statusBarScrimVisible, setStatusBarScrimVisible] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Keep Home controls/hero paused until the closing slide completes.
  const [drawerSceneActive, setDrawerSceneActive] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [heroVisible, setHeroVisible] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('All');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'All' | 'Movies' | 'Web-Series'>('All');
  const showContinueWatching = useNavigationPreferencesStore(
    state => state.showContinueWatching,
  );

  const disableDrawer = useNavigationPreferencesStore(
    state => state.disableDrawer,
  );

  const provider = useContentStore(state => state.provider);
  const pendingProvider = React.useRef<ProviderExtension | null>(null);
  const selectProvider = useCallback((item: ProviderExtension) => {
    pendingProvider.current = item;
    setIsDrawerOpen(false);
  }, []);
  const finishDrawerTransition = useCallback((closing: boolean) => {
    endUIInteraction('home-drawer');
    if (closing) {
      setIsDrawerOpen(false);
      setDrawerSceneActive(false);
    }
    if (closing && pendingProvider.current) {
      const selected = pendingProvider.current;
      pendingProvider.current = null;
      useContentStore.getState().setProvider(selected);
    }
  }, []);
  const installedProviders = useContentStore(state => state.installedProviders);
  const setHeroes = useHeroStore(state => state.setHeroes);

  // Auto-select provider when providers are installed but none selected
  useEffect(() => {
    if (installedProviders && installedProviders.length > 0 && (!provider?.value || provider.value === '')) {
      useContentStore.getState().setProvider(installedProviders[0]);
    }
  }, [installedProviders, provider?.value]);

  // React Query for home page data with better error handling
  const {
    data: homeData = [],
    isLoading,
    catalog: skeletonCatalog,
    error,
    refetch,
    // isStale,
  } = useHomePageData({
    provider,
    enabled: !!(installedProviders?.length && provider?.value),
  });

  useEffect(
    () => () => {
      [
        'home-scroll',
        'home-momentum',
        'home-drawer',
        'home-drawer-gesture',
      ].forEach(endUIInteraction);
    },
    [],
  );

  // Memoized scroll handler
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent?.contentOffset?.y ?? 0;
    setStatusBarScrimVisible(offsetY > 12);
    setIsAtTop(offsetY <= 0);
    setHeroVisible(offsetY < 410);
  }, []);

  // Heroes are kept per provider, so a refetch does not pick new ones.
  const heroPosts = useMemo(
    () => getRandomHeroPosts(homeData, provider?.value),
    [homeData, provider?.value],
  );

  React.useEffect(() => {
    setHeroes(heroPosts);
  }, [heroPosts, setHeroes]);

  useFocusEffect(
    useCallback(() => {
      return scheduleWhenIdle(() => syncFromSharedFolder());
    }, []),
  );

  // Optimized refresh handler
  // Promise chain instead of try/finally: React Compiler skips any component
  // that contains a finally clause.
  const handleRefresh = useCallback(() => {
    setManualRefreshing(true);
    const refresh = async () => {
      // Clear hero cache to get a new random hero on refresh
      clearHeroCache(provider?.value);
      await Promise.race([
        Promise.allSettled([
          refetch(),
          syncFromSharedFolder().catch(e =>
            console.warn('[VegaSync] Home refresh sync failed:', e),
          ),
        ]),
        new Promise(resolve => setTimeout(resolve, 10000)),
      ]);
    };
    return refresh()
      .catch(refreshError => {
        console.error('Error refreshing home data:', refreshError);
      })
      .then(() => {
        setTimeout(() => {
          setManualRefreshing(false);
        }, 50);
      });
  }, [refetch, provider.value]);

  // Rows of the vertical list. The list mounts only the rows near the screen,
  // so opening Home no longer builds every catalog row and its posters at once.
  const rows = useMemo<HomeRow[]>(
    () =>
      isLoading
        ? skeletonCatalog.map((item, index) => ({
            key: JSON.stringify([
              provider.source?.author,
              provider.value,
              item.filter,
              index,
            ]),
            isLoading: true,
            title: item.title,
            filter: item.filter,
            posts: EMPTY_POSTS,
          }))
        : homeData.map((item, index) => ({
            key: JSON.stringify([
              provider.source?.author,
              provider.value,
              item.filter,
              index,
            ]),
            isLoading: !!item.isLoading,
            title: item.title,
            filter: item.filter,
            posts: item.Posts,
            error: item.error,
          })),
    [
      isLoading,
      skeletonCatalog,
      homeData,
      provider.value,
      provider.source?.author,
    ],
  );

  const staged = useStagedHomeRows(rows, JSON.stringify([
    provider.source?.author, provider.source?.url, provider.value, provider.version,
  ]), !isTV, isFocused);
  // Derive the active filtered and sorted rows based on activeCategory & mediaTypeFilter
  const displayRows = useMemo(() => {
    const isSeriesPost = (post: any, row?: any): boolean => {
      const title = (post.title || '').toLowerCase();
      const link = (post.link || '').toLowerCase();
      const cornerTag = (post.cornerTag || '').toLowerCase();
      const tag = (post.tag || '').toLowerCase();
      const combinedMeta = `${cornerTag} ${tag}`;
      const rowTitle = (row?.title || '').toLowerCase();

      // Explicit Episode indicators in cornerTag or tag (e.g., "EP 16", "Ep.1", "16/16", "Ongoing", "12 Eps", "Episode 5")
      if (
        /\b(ep|eps|episode|episodes)[\s.:-]*\d+/i.test(combinedMeta) ||
        /\b\d+\s*(?:eps?|episodes)\b/i.test(combinedMeta) ||
        /\b\d+\s*\/\s*\d+\b/i.test(combinedMeta) ||
        /\b(s\d+|s\d+\s*e\d+|e\d+|season|seasons|ongoing|completed)\b/i.test(combinedMeta) ||
        /\b(k-drama|kdrama|c-drama|cdrama|j-drama|jdrama|asian drama|drama|web series|tv series|series)\b/i.test(tag)
      ) {
        return true;
      }

      // Title markers for series/episodes/dramas
      if (
        /\b(s\d+|season|episode|ep\s*\d+|eps\s*\d+|e\d+|series|k-drama|kdrama|c-drama|cdrama|asian drama|anime|drama|batch|all episodes|complete series)\b/i.test(title)
      ) {
        return true;
      }

      // Link markers for drama/series URLs
      if (
        /\/series\/|\/show\/|\/tv\/|\/tv-show|\/web-series|\/season\/|\/drama-detail\/|\/drama\/|\/kshow\/|\/asian-drama\/|\/anime\//i.test(link) ||
        /-episode-|\/episode\/|\/ep-\d+|\/ep\d+/i.test(link)
      ) {
        return true;
      }

      // If the row itself is a drama/series row and the post does NOT explicitly say it is a standalone movie/film
      if (
        /k-drama|kdrama|asian drama|web series|ott series|tv series|tv shows/i.test(rowTitle) &&
        !/\b(movie|film)\b/i.test(`${title} ${combinedMeta}`)
      ) {
        return true;
      }

      return false;
    };


    const matchesCategory = (row: any, cat: CategoryTab): boolean => {
      if (cat === 'All') return true;
      const title = (row.title || '').toLowerCase();
      const filter = (row.filter || '').toLowerCase();

      switch (cat) {
        case 'Anime':
          return /anime|donghua|manga|animation/i.test(title) || /anime/i.test(filter);
        case 'K-Drama':
          return /k-drama|kdrama|korean|asian drama|c-drama|cdrama/i.test(title) || /kdrama|k-drama|korean/i.test(filter);
        case 'Trending & New':
          return /trending|popular|top|hot|featured|new|latest|recent|release/i.test(title) || /trending|latest|new/i.test(filter);
        case 'Bollywood & South Indian':
          return (
            /bollywood|hindi|desi|indian|south|telugu|tamil|malayalam|kannada|tollywood|kollywood/i.test(
              title,
            ) || /bollywood|hindi|south|telugu|tamil/i.test(filter)
          );
        case 'Hollywood':
          return /hollywood|english|international|western/i.test(title) || /hollywood|english/i.test(filter);
        case 'OTT Series':
          return /netflix|prime|hotstar|jiocinema|zee5|hulu|apple|ott|web series/i.test(title) || /ott|series/i.test(filter);
        default:
          return true;
      }
    };

    // Filter rows by category tab
    let candidateRows = staged.rows.filter((row: any) => matchesCategory(row, activeCategory));

    // Fallback: If single provider without matching catalog titles, filter posts inside rows
    if (candidateRows.length === 0 && activeCategory !== 'All') {
      const getCategoryRegex = (cat: CategoryTab): RegExp | null => {
        switch (cat) {
          case 'Anime': return /anime|donghua|animation/i;
          case 'K-Drama': return /k-drama|kdrama|korean|c-drama|cdrama/i;
          case 'Bollywood & South Indian': return /bollywood|hindi|south|telugu|tamil|malayalam|kannada|tollywood|kollywood|desi|indian/i;
          case 'Hollywood': return /hollywood|english/i;
          case 'OTT Series': return /netflix|prime|hotstar|jiocinema|zee5|apple/i;
          default: return null;
        }
      };
      const catRegex = getCategoryRegex(activeCategory);
      if (catRegex) {
        candidateRows = staged.rows
          .map((row: any) => ({
            ...row,
            posts: (row.posts || []).filter((p: any) =>
              catRegex.test(p.title || '') || catRegex.test(p.tag || '') || catRegex.test(p.cornerTag || '')
            ),
          }))
          .filter((row: any) => row.posts.length > 0);
      }
    }

    if (candidateRows.length === 0 && activeCategory === 'All') {
      candidateRows = staged.rows;
    }

    return candidateRows
      .filter((row: any) => (row.posts && row.posts.length > 0) || row.isLoading)
      .map((row: any) => {
        if (!row.posts || row.posts.length === 0) {
          return {
            ...row,
            key: `${row.key}_${activeCategory}_${mediaTypeFilter}`,
          };
        }

        let filteredPosts = [...row.posts];

        if (activeCategory === 'Hollywood' || (row.title && row.title.toLowerCase().includes('hollywood'))) {
          filteredPosts = filteredPosts.filter(p => {
            const t = (p.title || '').toLowerCase();
            const tag = (p.tag || '').toLowerCase();
            if (/bollywood|punjabi|bengali|marathi|gujarati|bhojpuri|desi|tollywood|kollywood/i.test(t)) return false;
            if (/bollywood|punjabi|bengali|marathi|gujarati|bhojpuri|desi/i.test(tag)) return false;
            if (/hindi movie|hindi original|hindi web/i.test(t) && !/hollywood|english|dubbed|dual audio/i.test(t)) return false;
            return true;
          });
        }

        // Filter by mediaTypeFilter (Movies vs Web-Series)
        if (mediaTypeFilter === 'Movies') {
          filteredPosts = filteredPosts.filter(p => !isSeriesPost(p, row));
        } else if (mediaTypeFilter === 'Web-Series') {
          filteredPosts = filteredPosts.filter(p => isSeriesPost(p, row));
        }

        return {
          ...row,
          key: `${row.key}_${activeCategory}_${mediaTypeFilter}`,
          posts: filteredPosts,
        };
      })
      .filter((row: any) => (row.posts && row.posts.length > 0) || row.isLoading);
  }, [staged.rows, activeCategory, mediaTypeFilter]);

  const providerValue = provider?.value;
  const renderRow = useCallback(
    ({item}: {item: HomeRow}) => (
      <Slider
        isLoading={item.isLoading}
        title={item.title}
        posts={item.posts}
        filter={item.filter}
        providerValue={providerValue}
        scrollKey={item.key}
        error={item.error}
        deferPosts={item.deferPosts}
      />
    ),
    [providerValue],
  );

  const openDrawer = useCallback(() => {
    setDrawerSceneActive(true);
    setIsDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const acknowledgeNativeClose = useCallback(() => {
    // The library already animates overlay/gesture closes on the UI thread.
    // Commit controlled state in finishDrawerTransition, after that slide.
  }, []);
  const startDrawerTransition = useCallback(() => beginUIInteraction('home-drawer'), []);
  const startDrawerGesture = useCallback(() => beginUIInteraction('home-drawer-gesture'), []);
  const endDrawerGesture = useCallback(() => endUIInteraction('home-drawer-gesture'), []);

  // Memoized error message - only show if there is no cached data and an error occurred
  const errorComponent = useMemo(() => {
    if (homeData.length > 0 || isLoading || !error) {
      return null;
    }

    return (
      <View className="m-4 min-h-64 flex-1 items-center justify-center rounded-3xl bg-m3-error-container p-4">
        <AppText
          role="titleMediumEmphasized"
          className="text-center text-m3-on-error-container">
          {error?.message || 'Failed to load content'}
        </AppText>
        <AppText
          role="bodyMedium"
          className="mt-1 text-center text-m3-on-error-container">
          Pull to refresh and try again
        </AppText>
      </View>
    );
  }, [error, isLoading, homeData.length]);

  // Early return only when truly no providers are installed
  if (!installedProviders || installedProviders.length === 0) {
    return <Tutorial />;
  }

  return (
    <QueryErrorBoundary>
      <GestureHandlerRootView style={{flex: 1}}>
        <StatusBarScrim visible={statusBarScrimVisible} />
        <View className="flex-1 bg-m3-background">
          <Drawer
            open={!isTV && isDrawerOpen}
            onOpen={openDrawer}
            onClose={acknowledgeNativeClose}
            onTransitionStart={startDrawerTransition}
            onTransitionEnd={finishDrawerTransition}
            onGestureStart={startDrawerGesture}
            onGestureEnd={endDrawerGesture}
            onGestureCancel={endDrawerGesture}
            drawerPosition="left"
            drawerType="front"
            drawerStyle={{width: 200, backgroundColor: 'transparent'}}
            swipeEdgeWidth={disableDrawer ? 0 : 70}
            swipeEnabled={!disableDrawer && !isTV}
            renderDrawerContent={() =>
              !disableDrawer && !isTV ? (
                <ProviderDrawer
                  isOpen={isDrawerOpen}
                  onSelectProvider={selectProvider}
                  onClose={closeDrawer}
                />
              ) : null
            }>
            <StatusBar style="light" />

            <FlashList
              data={displayRows}
              extraData={`${activeCategory}_${mediaTypeFilter}`}
              onViewableItemsChanged={staged.onViewableItemsChanged}
              renderItem={renderRow}
              keyExtractor={homeRowKey}
              getItemType={homeRowType}
              drawDistance={HOME_DRAW_DISTANCE}
              maxItemsInRecyclePool={isTV ? undefined : 4}
              onScrollBeginDrag={() => beginUIInteraction('home-scroll')}
              onScrollEndDrag={() => endUIInteraction('home-scroll')}
              onMomentumScrollBegin={() => beginUIInteraction('home-momentum')}
              onMomentumScrollEnd={() => endUIInteraction('home-momentum')}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={{backgroundColor: colors.background}}
              contentContainerStyle={{paddingBottom: isTV ? 120 : 32}}
              ListEmptyComponent={
                !isLoading ? (
                  <View style={{paddingVertical: 48, alignItems: 'center', justifyContent: 'center'}}>
                    <AppText role="titleMediumEmphasized" style={{color: colors.onSurfaceVariant}}>
                      No content found for "{activeCategory}"
                    </AppText>
                    <AppText role="bodySmall" style={{color: colors.outline, marginTop: 4}}>
                      Try selecting "All" or switching media filters.
                    </AppText>
                  </View>
                ) : null
              }
              refreshControl={
                <RefreshControl
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                  progressBackgroundColor={colors.surfaceContainer}
                  refreshing={manualRefreshing}
                  onRefresh={handleRefresh}
                  enabled={isAtTop || manualRefreshing}
                />
              }
              ListHeaderComponent={
                <>
                  <HeroOptimized
                    isDrawerOpen={isTV ? isDrawerOpen : drawerSceneActive}
                    isVisible={heroVisible}
                    onOpenDrawer={openDrawer}
                  />
                  {/* Dual Filter Header: Smart Category Tabs + Media Type */}
                  <View style={{paddingTop: 16, paddingBottom: 6}}>
                    {/* Filter Row 1: Smart Category Tabs */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        flexDirection: 'row',
                        paddingHorizontal: 20,
                        paddingBottom: 8,
                        gap: 8,
                      }}>
                      {CATEGORY_TABS.map(cat => (
                        <Pressable
                          key={`cat-${cat}`}
                          onPress={() => setActiveCategory(cat)}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 7,
                            borderRadius: 20,
                            backgroundColor:
                              activeCategory === cat
                                ? colors.primary
                                : colors.surfaceContainerHigh,
                          }}>
                          <AppText
                            role="labelLargeEmphasized"
                            style={{
                              color:
                                activeCategory === cat
                                  ? colors.onPrimary
                                  : colors.onSurface,
                            }}>
                            {cat}
                          </AppText>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {/* Filter Row 2: Media Type (All / Movies / Web-Series) */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        flexDirection: 'row',
                        paddingHorizontal: 20,
                        paddingTop: 2,
                        paddingBottom: 6,
                        gap: 8,
                      }}>
                      {(['All', 'Movies', 'Web-Series'] as const).map(type => (
                        <Pressable
                          key={`type-${type}`}
                          onPress={() => setMediaTypeFilter(type)}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 7,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor:
                              mediaTypeFilter === type
                                ? colors.secondary
                                : 'transparent',
                            backgroundColor:
                              mediaTypeFilter === type
                                ? colors.secondaryContainer
                                : colors.surfaceContainerLow,
                          }}>
                          <AppText
                            role="labelLargeEmphasized"
                            style={{
                              color:
                                mediaTypeFilter === type
                                  ? colors.onSecondaryContainer
                                  : colors.onSurfaceVariant,
                            }}>
                            {type === 'Web-Series' ? 'Web Series' : type}
                          </AppText>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                  {showContinueWatching && <ContinueWatching />}
                </>
              }
              ListFooterComponent={
                <View className="pb-8">
                  {errorComponent}
                  <View className="h-8" />
                </View>
              }
            />
          </Drawer>

          {isTV && isDrawerOpen ? (
            <Modal
              transparent
              visible={isDrawerOpen}
              animationType="fade"
              statusBarTranslucent
              onRequestClose={() => setIsDrawerOpen(false)}>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  backgroundColor: 'rgba(0, 0, 0, 0.72)',
                }}>
                <View
                  style={{
                    width: 340,
                    height: '100%',
                    backgroundColor: '#121214',
                  }}>
                  <ProviderDrawer onClose={() => setIsDrawerOpen(false)} />
                </View>
                <Pressable
                  style={{flex: 1}}
                  onPress={() => setIsDrawerOpen(false)}
                  focusable={false}
                />
              </View>
            </Modal>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </QueryErrorBoundary>
  );
};

export default React.memo(Home);

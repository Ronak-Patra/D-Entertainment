import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTmdbStory, type TmdbStoryData } from '../../../lib/hooks/useTmdbStory';
import { useM3Colors, useM3HostTheme } from '../../../theme/M3PaletteContext';
import { TVFocusGuide } from '../../../components/tv';
import { isTV } from '../../../lib/tv/constants';
import { useTVRemote } from '../../../lib/tv/useTVRemote';
import type { StoryPage } from './story/storyUtils';
import AboutPage from './story/AboutPage';
import TrailerPage from './story/TrailerPage';
import CastPage from './story/CastPage';
import BoxOfficePage from './story/BoxOfficePage';
import RatingsPage from './story/RatingsPage';
import FactsPage from './story/FactsPage';
import RelatedPage from './story/RelatedPage';
import CollectionPage from './story/CollectionPage';
import StoryControls from './story/StoryControls';
import StoryFallbackView from './story/StoryFallbackView';

interface InfoStoryModalProps {
  fallbackBackdrop?: string;
  fallbackOverview?: string;
  fallbackTitle?: string;
  fallbackYear?: string | number;
  imdbId?: string;
  onClose: () => void;
  tmdbId?: number | string;
  type?: string;
  visible: boolean;
  onPersonPress?: (id: string | number, name: string) => void;
}

const InfoStoryModal = ({
  fallbackBackdrop,
  fallbackOverview,
  fallbackTitle,
  fallbackYear,
  imdbId,
  onClose,
  tmdbId,
  type,
  visible,
  onPersonPress,
}: InfoStoryModalProps) => {
  const colors = useM3Colors();
  const hostTheme = useM3HostTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);
  const storyListRef = useRef<FlatList<StoryPage>>(null);
  const scrollRefs = useRef<Record<number, ScrollView | null>>({});
  const scrollOffsets = useRef<Record<number, number>>({});
  const touchStart = useRef<{ time: number; x: number; y: number } | undefined>(
    undefined,
  );
  const isInteractingRef = useRef(false);

  const handleInteract = useCallback(() => {
    isInteractingRef.current = true;
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 400);
  }, []);

  const { data: rawData, error, isFetching, refetch } = useTmdbStory({
    enabled: visible,
    imdbId,
    tmdbId,
    type,
    title: fallbackTitle,
    year: fallbackYear,
  });

  const data = useMemo<TmdbStoryData | undefined>(() => {
    if (rawData) return rawData;
    if (fallbackTitle || fallbackOverview || fallbackBackdrop) {
      return {
        id: tmdbId || imdbId || fallbackTitle || 'story-fallback',
        mediaType: (type === 'tv' || type === 'series' ? 'tv' : 'movie') as any,
        title: fallbackTitle || 'Untitled',
        overview: fallbackOverview,
        backdropPath: fallbackBackdrop,
        backdropPaths: fallbackBackdrop ? [fallbackBackdrop] : [],
        posterPath: fallbackBackdrop,
        genres: [],
        cast: [],
        creators: [],
        companies: [],
        countries: [],
        networks: [],
        keywords: [],
        collectionItems: [],
        trailers: [],
      };
    }
    return undefined;
  }, [rawData, fallbackTitle, fallbackOverview, fallbackBackdrop, tmdbId, imdbId, type]);

  const pages = useMemo<StoryPage[]>(() => {
    const items: StoryPage[] = [
      { icon: 'movie-open-outline', key: 'about', title: 'About' },
    ];
    if (data?.trailers?.length || data?.trailerKey || data?.trailerUrl) {
      items.push({
        icon: 'movie-play-outline',
        key: 'trailer',
        title: 'Trailer',
      });
    }
    if (data?.cast.length) {
      items.push({
        icon: 'account-group-outline',
        key: 'cast',
        title: 'Cast',
      });
    }
    if (
      data?.productionBudget ||
      data?.worldwideGross ||
      data?.domesticGross ||
      data?.openingWeekendGross
    ) {
      items.push({
        icon: 'currency-usd',
        key: 'boxoffice',
        title: 'Box Office',
      });
    }
    if (data?.ratingsHistogram?.length || data?.featuredReview) {
      items.push({
        icon: 'chart-bar',
        key: 'ratings',
        title: 'Reviews',
      });
    }
    items.push({ icon: 'chart-box-outline', key: 'facts', title: 'Facts' });
    if (data?.relatedTitles?.length) {
      items.push({
        icon: 'movie-filter-outline',
        key: 'related',
        title: 'Recommendations',
      });
    }
    if (data?.collectionItems.length) {
      items.push({
        icon:
          data.mediaType === 'tv'
            ? 'television-classic'
            : 'filmstrip-box-multiple',
        key: 'collection',
        title: data.mediaType === 'tv' ? 'Seasons' : 'Collection',
      });
    }
    return items;
  }, [data]);

  useEffect(() => {
    if (visible) {
      setPageIndex(0);
      scrollOffsets.current = {};
    }
  }, [visible]);

  const goToPage = useCallback(
    (nextIndex: number) => {
      const targetIndex = Math.max(0, Math.min(nextIndex, pages.length - 1));
      setPageIndex(targetIndex);
      storyListRef.current?.scrollToOffset({
        animated: true,
        offset: targetIndex * width,
      });
    },
    [pages.length, width],
  );

  useTVRemote(
    useCallback(
      evt => {
        if (!visible) return;
        // On Android TV, key events emit on ACTION_DOWN (0) and ACTION_UP (1).
        // Only process ACTION_DOWN (0) or undefined to avoid double-stepping pages.
        if (evt?.eventKeyAction !== undefined && evt.eventKeyAction !== 0) {
          return;
        }

        const eventType = evt?.eventType;
        if (eventType === 'left') {
          if (pageIndex > 0) {
            goToPage(pageIndex - 1);
          }
        } else if (eventType === 'right') {
          if (pageIndex < pages.length - 1) {
            goToPage(pageIndex + 1);
          }
        } else if (eventType === 'back' || eventType === 'menu') {
          onClose();
        } else if (eventType === 'up') {
          const currentY = scrollOffsets.current[pageIndex] || 0;
          scrollRefs.current[pageIndex]?.scrollTo({
            y: Math.max(0, currentY - 220),
            animated: true,
          });
        } else if (eventType === 'down') {
          const currentY = scrollOffsets.current[pageIndex] || 0;
          scrollRefs.current[pageIndex]?.scrollTo({
            y: currentY + 220,
            animated: true,
          });
        }
      },
      [goToPage, onClose, pageIndex, pages.length, visible],
    ),
    visible,
  );

  useEffect(() => {
    if (!visible || !isTV) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backSub.remove();
  }, [visible, onClose]);

  const handleStoryTap = (x: number) => {
    if (x >= width / 2) {
      if (pageIndex >= pages.length - 1) {
        onClose();
        return;
      }
      goToPage(pageIndex + 1);
      return;
    }

    if (pageIndex > 0) {
      goToPage(pageIndex - 1);
    }
  };

  const renderPage = ({ item, index }: { item: StoryPage; index: number }) => {
    if (!data) {
      return null;
    }
    return (
      <ScrollView
        ref={ref => {
          scrollRefs.current[index] = ref;
        }}
        onScroll={e => {
          scrollOffsets.current[index] = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        style={{ width }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 48,
          paddingHorizontal: 20,
          paddingTop: 86,
        }}>
        {item.key === 'about' ? (
          <AboutPage
            data={data}
            fallbackBackdrop={fallbackBackdrop}
            fallbackOverview={fallbackOverview}
            fallbackTitle={fallbackTitle}
          />
        ) : item.key === 'trailer' ? (
          <TrailerPage
            active={pageIndex === pages.indexOf(item)}
            data={data}
            onInteract={handleInteract}
          />
        ) : item.key === 'cast' ? (
          <CastPage data={data} onInteract={handleInteract} onPersonPress={onPersonPress} />
        ) : item.key === 'boxoffice' ? (
          <BoxOfficePage data={data} />
        ) : item.key === 'ratings' ? (
          <RatingsPage data={data} onInteract={handleInteract} />
        ) : item.key === 'related' ? (
          <RelatedPage data={data} onInteract={handleInteract} />
        ) : item.key === 'collection' ? (
          <CollectionPage data={data} />
        ) : (
          <FactsPage data={data} />
        )}
      </ScrollView>
    );
  };

  const modalContent = (
    <TVFocusGuide autoFocus={true} style={{ flex: 1 }}>
      <SafeAreaView
          edges={['top', 'bottom']}
          onTouchCancel={
            isTV
              ? undefined
              : () => {
                  touchStart.current = undefined;
                }
          }
          onTouchEnd={
            isTV
              ? undefined
              : event => {
                  const start = touchStart.current;
                  touchStart.current = undefined;
                  if (isInteractingRef.current) {
                    isInteractingRef.current = false;
                    return;
                  }
                  if (!data || !start) {
                    return;
                  }
                  const { pageX, pageY, timestamp } = event.nativeEvent;
                  const isTap =
                    Math.abs(pageX - start.x) <= 12 &&
                    Math.abs(pageY - start.y) <= 12 &&
                    timestamp - start.time <= 500;
                  const isBelowStoryHeader = pageY > insets.top + 58;
                  if (isTap && isBelowStoryHeader) {
                    handleStoryTap(pageX);
                  }
                }
          }
          onTouchStart={
            isTV
              ? undefined
              : event => {
                  const { pageX, pageY, timestamp } = event.nativeEvent;
                  touchStart.current = { time: timestamp, x: pageX, y: pageY };
                }
          }
          style={{ backgroundColor: colors.background, flex: 1 }}>
        <StatusBar style="light" />
        <View
          pointerEvents="none"
          style={{
            backgroundColor: colors.primary,
            borderRadius: 260,
            height: 520,
            left: -150,
            opacity: 0.07,
            position: 'absolute',
            top: -180,
            width: 520,
          }}
        />

        {data ? (
          <FlatList
            key={`${data.id}-${visible}`}
            ref={storyListRef}
            data={pages}
            extraData={pageIndex}
            horizontal
            pagingEnabled
            bounces={false}
            keyExtractor={item => item.key}
            renderItem={renderPage}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={event => {
              setPageIndex(
                Math.round(event.nativeEvent.contentOffset.x / width),
              );
            }}
          />
        ) : (
          <StoryFallbackView
            colors={colors}
            error={error}
            hostTheme={hostTheme}
            isFetching={isFetching}
            refetch={refetch}
          />
        )}

        <StoryControls
          colors={colors}
          goToPage={goToPage}
          insetsBottom={insets.bottom}
          insetsTop={insets.top}
          onClose={onClose}
          pageIndex={pageIndex}
          pages={pages}
        />
      </SafeAreaView>
    </TVFocusGuide>
  );

  return (
    <Modal
      animationType={isTV ? 'none' : 'slide'}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}>
      {modalContent}
    </Modal>
  );
};

export default InfoStoryModal;

import React, {useState, useEffect, useCallback} from 'react';
import {View, FlatList, StyleSheet, useWindowDimensions} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../App';
import ScreenSafeArea from '../components/ui/ScreenSafeArea';
import AppText from '../components/ui/Text';
import {useM3Colors} from '../theme/M3PaletteContext';
import IconButton from '../components/ui/IconButton';
import {settingsStorage} from '../lib/storage';
import MediaPosterCard from '../components/MediaPosterCard';
import {TVFocusGuide} from '../components/tv';
import { getTmdbApiKey } from '../lib/services/apiKeys';
import LoadingIndicator from '../components/ui/LoadingIndicator';
import SkeletonLoader from '../components/Skeleton';

type Props = NativeStackScreenProps<SearchStackParamList, 'Explore'>;

const Explore = ({route, navigation}: Props) => {
  const colors = useM3Colors();
  const { personId, personName, initialGenre, initialYear, initialCountry } = route.params || {};
  
  const [genre, setGenre] = useState(initialGenre || '');
  const [year, setYear] = useState(initialYear || '');
  const [country, setCountry] = useState(initialCountry || '');
  const [results, setResults] = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const tmdbKey = getTmdbApiKey();

  useEffect(() => {
    if (!tmdbKey) return;
    
    const controller = new AbortController();
    const signal = controller.signal;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let url = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1`;
        
        if (personId) {
          url += `&with_people=${personId}`;
        }
        if (genre) {
          url += `&with_genres=${genre}`;
        }
        if (year) {
          url += `&primary_release_year=${year}`;
        }
        if (country) {
          url += `&with_origin_country=${country}`;
        }

        const res = await fetch(url, {signal});
        if (signal.aborted) return;
        const data = await res.json();
        if (signal.aborted) return;

        if (data.results) {
          const mapped = data.results.map((item: any) => {
            const title = item.title || item.name || 'Unknown';
            return {
              title,
              image: item.poster_path
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : item.backdrop_path
                  ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
                  : undefined,
              link: title,
              rating: item.vote_average,
              provider: 'TMDB',
            };
          });
          setResults(mapped);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error(e);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setIsInitialLoad(false);
        }
      }
    }, isInitialLoad ? 0 : 250);
    
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tmdbKey, personId, genre, year, country, isInitialLoad]);

  const {width: windowWidth} = useWindowDimensions();
  const cardWidth = Math.max(90, Math.floor((windowWidth - 32 - 24) / 3));
  
  return (
    <ScreenSafeArea className="h-full w-full bg-m3-background">
      <View className="mt-6 px-4 flex flex-row items-center gap-x-3 mb-4">
        <IconButton
          icon="arrow-left"
          label="Back"
          onPress={() => navigation.goBack()}
        />
        <AppText role="headlineMediumEmphasized" className="flex-1 text-m3-on-background">
          Explore {personName ? `- ${personName}` : ''}
        </AppText>
        {loading && !isInitialLoad && (
          <LoadingIndicator size={18} color={colors.primary} />
        )}
      </View>
      
      {!tmdbKey ? (
        <View style={{paddingHorizontal: 20, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <AppText role="bodyLarge" style={{color: colors.onSurfaceVariant, textAlign: 'center'}}>
            TMDB API Key missing. Please add it in Settings &gt; Preferences to enable Advanced Search.
          </AppText>
        </View>
      ) : (
        <View style={{flex: 1}}>
          {results.length === 0 && isInitialLoad ? (
            <View style={{flex: 1, paddingHorizontal: 16, paddingTop: 8}}>
              <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                {Array.from({length: 9}).map((_, i) => (
                  <View key={`skeleton-${i}`} style={{margin: 4, width: cardWidth}}>
                    <SkeletonLoader
                      width={cardWidth}
                      height={Math.round(cardWidth * 1.5)}
                      marginVertical={0}
                      style={{borderRadius: 12}}
                    />
                    <View style={{marginTop: 6}}>
                      <SkeletonLoader
                        width={Math.round(cardWidth * 0.8)}
                        height={12}
                        marginVertical={0}
                        style={{borderRadius: 4}}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : results.length === 0 && !isInitialLoad && !loading ? (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24}}>
              <AppText role="titleMedium" style={{color: colors.onSurface, textAlign: 'center', marginBottom: 6}}>
                No titles found
              </AppText>
              <AppText role="bodyMedium" style={{color: colors.onSurfaceVariant, textAlign: 'center'}}>
                Try adjusting your genre, year, or country filters
              </AppText>
            </View>
          ) : (
            <TVFocusGuide style={{flex: 1}} autoFocus trapFocusDown trapFocusRight trapFocusLeft trapFocusUp>
              <FlatList
                data={results}
                keyExtractor={(item, idx) => `${item.title}-${idx}`}
                numColumns={3}
                contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8}}
                renderItem={({item}) => (
                  <View style={{margin: 4, width: cardWidth}}>
                    <MediaPosterCard
                      title={item.title}
                      poster={item.image}
                      width={cardWidth}
                      badge={item.rating ? Number(item.rating).toFixed(1) : undefined}
                      onPress={() => navigation.navigate('SearchResults', {filter: item.title})}
                    />
                  </View>
                )}
              />
            </TVFocusGuide>
          )}
        </View>
      )}
    </ScreenSafeArea>
  );
};

export default Explore;

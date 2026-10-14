import {View, FlatList, Text, Keyboard, TouchableOpacity, ScrollView} from 'react-native';
import React, {useState, useEffect, useCallback, memo, useRef} from 'react';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchStackParamList, TabStackParamList} from '../App';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {MMKV} from '../lib/Mmkv';
import DropdownField from '../components/ui/DropdownField';
import Button from '../components/ui/Button';
import ScreenSafeArea from '../components/ui/ScreenSafeArea';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {searchOMDB} from '../lib/services/omdb';
import {OMDBResult} from '../types/omdb';
import {fetchIMDbSuggestions, type IMDbSuggestion} from '../lib/services/imdbSuggestions';
import {sanitizeSearchQuery} from '../lib/utils/helpers';
import SearchSuggestions from '../components/search/SearchSuggestions';
import SearchHistory from '../components/search/SearchHistory';

import IconButton from '../components/ui/IconButton';
import AppText from '../components/ui/Text';
import SearchField, {type SearchFieldRef} from '../components/ui/SearchField';
import {useM3Colors} from '../theme/M3PaletteContext';
import {TVFocusable, TVFocusGuide} from '../components/tv';
import {isTV} from '../lib/tv';


const MAX_VISIBLE_RESULTS = 15; // Limit number of animated items to prevent excessive callbacks
const MAX_HISTORY_ITEMS = 30; // Maximum number of history items to store

// Memoized search result item to prevent unnecessary re-renders
const SearchResultItem = memo(
  ({item, onPress}: {item: OMDBResult; onPress: (title: string) => void}) => {
    const colors = useM3Colors();
    const handlePress = useCallback(() => {
      onPress(item.Title);
    }, [item.Title, onPress]);

    return (
      <View style={{paddingHorizontal: 16, paddingVertical: 5}}>
        <TVFocusable
          onPress={handlePress}
          borderRadius={20}
          focusScale={1}
          showFocusBorder={true}
          focusedStyle={{
            backgroundColor: colors.surfaceContainerHigh,
          }}
          accessibilityRole="button"
          accessibilityLabel={`Search result: ${item.Title}`}
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderRadius: 20,
            padding: 14,
          }}>
          <View style={{alignItems: 'center', flexDirection: 'row'}}>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.secondaryContainer,
                borderRadius: 16,
                height: 44,
                justifyContent: 'center',
                marginRight: 14,
                width: 44,
              }}>
              <MaterialCommunityIcons
                name={item.Type === 'series' ? 'television' : 'movie-open'}
                size={22}
                color={colors.onSecondaryContainer}
              />
            </View>
            <View style={{flex: 1}}>
              <AppText
                role="bodyLargeEmphasized"
                style={{color: colors.onSurface}}>
                {item.Title}
              </AppText>
              <AppText
                role="bodySmall"
                style={{color: colors.onSurfaceVariant, marginTop: 2}}>
                {item.Type === 'series' ? 'TV Show' : 'Movie'} • {item.Year}
              </AppText>
            </View>
            <MaterialCommunityIcons
              name="arrow-top-right"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </View>
        </TVFocusable>
      </View>
    );
  },
);



const HeaderContainer = isTV ? View : Animated.View;
const AnimatedContainer = Animated.View;

const Search = () => {
  const colors = useM3Colors();
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [searchText, setSearchText] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [searchFieldNode, setSearchFieldNode] = useState<number | null>(null);
  const [clearBtnNode, setClearBtnNode] = useState<number | null>(null);
  const [firstItemNode, setFirstItemNode] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<IMDbSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    MMKV.getArray<string>('searchHistory') || [],
  );
  const [searchResults, setSearchResults] = useState<OMDBResult[]>([]);
  const [activeTab, setActiveTab] = useState<'recent' | 'advanced'>('recent');
  const route = useRoute<RouteProp<SearchStackParamList, 'Search'>>();
  const searchFieldRef = useRef<SearchFieldRef>(null);
  const suppressSuggestionsRef = useRef(false);
  const lastResetKeyRef = useRef<number | undefined>(undefined);

  const resetToDefaultPage = useCallback(() => {
    suppressSuggestionsRef.current = false;
    setSearchText('');
    setSuggestions([]);
    setSearchResults([]);
    setSelectedGenre('');
    setSelectedYear('');
    setSelectedCountry('');
    setActiveTab('recent');
    Keyboard.dismiss();
    searchFieldRef.current?.blur();
  }, []);

  // Reset when App.tsx delivers a new resetKey param upon tab press
  useEffect(() => {
    if (route.params?.resetKey && route.params.resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = route.params.resetKey;
      resetToDefaultPage();
    }
  }, [route.params?.resetKey, resetToDefaultPage]);

  // Direct bottom tab press listener fallback
  useEffect(() => {
    const tabNavigation =
      navigation.getParent<BottomTabNavigationProp<TabStackParamList>>();
    if (!tabNavigation) {
      return;
    }

    const unsubscribeTabPress = tabNavigation.addListener('tabPress', event => {
      const state = tabNavigation.getState();
      const targetRoute = state.routes.find(r => r.key === event.target);
      const isSearchTab =
        targetRoute?.name === 'SearchStack' ||
        (typeof event.target === 'string' && event.target.startsWith('SearchStack'));
      if (!isSearchTab) {
        return;
      }

      if (!navigation.isFocused()) {
        try {
          navigation.popToTop();
        } catch {
          // ignore
        }
      }
      resetToDefaultPage();
    });

    return () => {
      unsubscribeTabPress();
    };
  }, [navigation, resetToDefaultPage]);

  // Debounced IMDb search suggestions (spelling completer). The timers live
  // in effects so the screen stays compatible with React Compiler.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const clean = searchText.trim();
      if (clean.length >= 2 && !suppressSuggestionsRef.current) {
        const results = await fetchIMDbSuggestions(clean);
        if (!cancelled) {
          setSuggestions(results);
        }
      } else {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchText]);

  // Debounced OMDB search
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (searchText.length >= 2) {
        setSearchResults([]); // Clear previous results
        const results = await searchOMDB(searchText);
        if (cancelled) {
          return;
        }
        if (results.length > 0) {
          // Remove duplicates based on imdbID
          const uniqueResults = results.reduce((acc, current) => {
            const x = acc.find(
              (item: OMDBResult) => item.imdbID === current.imdbID,
            );
            if (!x) {
              return acc.concat([current]);
            } else {
              return acc;
            }
          }, [] as OMDBResult[]);

          // Limit the number of results to prevent excessive animations
          setSearchResults(uniqueResults.slice(0, MAX_VISIBLE_RESULTS));
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchText]);

  const handleTextChange = useCallback((text: string) => {
    suppressSuggestionsRef.current = false;
    setSearchText(text);
  }, []);

  const handleClear = useCallback(() => {
    suppressSuggestionsRef.current = false;
    setSearchText('');
    setSuggestions([]);
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      Keyboard.dismiss();
      suppressSuggestionsRef.current = true;
      setSuggestions([]);
      const trimmed = text.trim();
      if (trimmed) {
        // Save to search history
        const prevSearches = MMKV.getArray<string>('searchHistory') || [];
        if (!prevSearches.includes(trimmed)) {
          const newSearches = [trimmed, ...prevSearches].slice(
            0,
            MAX_HISTORY_ITEMS,
          );
          MMKV.setArray('searchHistory', newSearches);
          setSearchHistory(newSearches);
        }

        navigation.navigate('SearchResults', {
          filter: trimmed,
        });
      }
    },
    [navigation],
  );

  const handleSelectSuggestion = useCallback(
    (title: string) => {
      const cleanTitle = sanitizeSearchQuery(title);
      Keyboard.dismiss();
      suppressSuggestionsRef.current = true;
      setSuggestions([]);
      setSearchText(cleanTitle);
      handleSearch(cleanTitle);
    },
    [handleSearch],
  );

  // Fill the field for editing; suggestions refresh for the new text.
  const handleFillSuggestion = useCallback((title: string) => {
    setSearchText(sanitizeSearchQuery(title));
  }, []);

  const removeHistoryItem = useCallback(
    (search: string) => {
      const newSearches = searchHistory.filter(item => item !== search);
      MMKV.setArray('searchHistory', newSearches);
      setSearchHistory(newSearches);
    },
    [searchHistory],
  );

  const clearHistory = useCallback(() => {
    MMKV.setArray('searchHistory', []);
    setSearchHistory([]);
  }, []);

  const handleResultPress = useCallback(
    (title: string) => {
      // Save to search history
      const prevSearches = MMKV.getArray<string>('searchHistory') || [];
      if (!prevSearches.includes(title)) {
        const newSearches = [title, ...prevSearches].slice(
          0,
          MAX_HISTORY_ITEMS,
        );
        MMKV.setArray('searchHistory', newSearches);
        setSearchHistory(newSearches);
      }
      navigation.navigate('SearchResults', {
        filter: title,
      });
    },
    [navigation],
  );

  // Memoized render function for search results
  const renderSearchResult = useCallback(
    ({item}: {item: OMDBResult}) => (
      <SearchResultItem item={item} onPress={handleResultPress} />
    ),
    [handleResultPress],
  );

  const searchResultKeyExtractor = useCallback(
    (item: OMDBResult) => item.imdbID.toString(),
    [],
  );

  const showSuggestions =
    searchText.trim().length >= 2 && suggestions.length > 0;

  return (
    <ScreenSafeArea className="flex-1 bg-m3-background">
      {/* Title Section */}
      <HeaderContainer
        {...(!isTV ? {entering: FadeInDown.duration(300)} : {})}
        className="px-4 pt-5">
        <AppText
          role="bodyLarge"
          style={{color: colors.onSurfaceVariant, marginBottom: 18}}>
          Search across all providers
        </AppText>
        <View className="flex-row items-center space-x-3 mb-3">
          <View className="flex-1">
            <SearchField
              ref={searchFieldRef}
              value={searchText}
              onChangeText={handleTextChange}
              onSubmit={handleSearch}
              onClear={handleClear}
              placeholder="Search movies, shows..."
              nextFocusDown={firstItemNode}
              nextFocusRight={isTV && searchText.length > 0 ? clearBtnNode : undefined}
              onNodeHandle={setSearchFieldNode}
            />
          </View>
          {isTV && searchText.length > 0 && (
            <IconButton
              icon="close"
              label="Clear search"
              onPress={handleClear}
              size={18}
              nextFocusLeft={searchFieldNode}
              nextFocusDown={firstItemNode}
              onNodeHandle={setClearBtnNode}
            />
          )}
        </View>
      </HeaderContainer>

      {/* Search Content */}
      <View className="flex-1">
        <View className="flex-1">
          {showSuggestions ? (
            <View style={{flex: 1}}>
              <SearchSuggestions
                suggestions={suggestions}
                onSelectSuggestion={handleSelectSuggestion}
                onFillSuggestion={handleFillSuggestion}
                searchFieldNodeHandle={searchFieldNode}
                onFirstItemNodeHandle={setFirstItemNode}
              />
            </View>
          ) : searchResults.length > 0 ? (
            <TVFocusGuide trapFocusLeft={true} trapFocusRight={true} autoFocus={false} style={{flex: 1}}>
              <FlatList
                data={searchResults}
                keyExtractor={searchResultKeyExtractor}
                renderItem={renderSearchResult}
                contentContainerStyle={{paddingTop: 4}}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                windowSize={10}
                initialNumToRender={10}
                keyboardShouldPersistTaps="handled"
              />
            </TVFocusGuide>
          ) : (
            <View style={{flex: 1}}>
              {/* Tab Selector when not searching */}
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                  gap: 10,
                }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setActiveTab('recent')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor:
                      activeTab === 'recent'
                        ? colors.primary
                        : colors.surfaceContainerHigh,
                  }}>
                  <MaterialCommunityIcons
                    name="history"
                    size={16}
                    color={
                      activeTab === 'recent'
                        ? colors.onPrimary
                        : colors.onSurfaceVariant
                    }
                    style={{marginRight: 6}}
                  />
                  <AppText
                    role="labelLarge"
                    style={{
                      color:
                        activeTab === 'recent'
                          ? colors.onPrimary
                          : colors.onSurface,
                      fontWeight: activeTab === 'recent' ? '700' : '500',
                    }}>
                    Recent Searches {searchHistory.length > 0 ? `(${searchHistory.length})` : ''}
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setActiveTab('advanced')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor:
                      activeTab === 'advanced'
                        ? colors.primary
                        : colors.surfaceContainerHigh,
                  }}>
                  <MaterialCommunityIcons
                    name="filter-variant"
                    size={16}
                    color={
                      activeTab === 'advanced'
                        ? colors.onPrimary
                        : colors.onSurfaceVariant
                    }
                    style={{marginRight: 6}}
                  />
                  <AppText
                    role="labelLarge"
                    style={{
                      color:
                        activeTab === 'advanced'
                          ? colors.onPrimary
                          : colors.onSurface,
                      fontWeight: activeTab === 'advanced' ? '700' : '500',
                    }}>
                    Advanced Search
                  </AppText>
                </TouchableOpacity>
              </View>

              {activeTab === 'recent' ? (
                searchHistory.length > 0 ? (
                  <View style={{flex: 1}}>
                    <SearchHistory
                      history={searchHistory}
                      onSelectSearch={handleSearch}
                      onRemoveSearch={removeHistoryItem}
                      onClearHistory={clearHistory}
                      searchFieldNodeHandle={searchFieldNode}
                      onFirstItemNodeHandle={setFirstItemNode}
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 32,
                    }}>
                    <MaterialCommunityIcons
                      name="history"
                      size={48}
                      color={colors.onSurfaceVariant}
                      style={{opacity: 0.5, marginBottom: 12}}
                    />
                    <AppText
                      role="titleMedium"
                      style={{color: colors.onSurface, textAlign: 'center'}}>
                      No recent searches
                    </AppText>
                    <AppText
                      role="bodyMedium"
                      style={{
                        color: colors.onSurfaceVariant,
                        textAlign: 'center',
                        marginTop: 4,
                        marginBottom: 16,
                      }}>
                      Use search above or explore genres and filters
                    </AppText>
                    <Button
                      variant="tonal"
                      compact
                      onPress={() => setActiveTab('advanced')}>
                      Open Advanced Search
                    </Button>
                  </View>
                )
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32}}>
                  <AppText
                    role="titleLargeEmphasized"
                    className="text-m3-on-surface mb-2">
                    Filter by Genre, Year & Country
                  </AppText>
                  <AppText
                    role="bodyMedium"
                    style={{color: colors.onSurfaceVariant, marginBottom: 16}}>
                    Find movies and shows by selecting custom parameters
                  </AppText>

                  <View className="flex-row gap-x-3 mb-4">
                    <View className="flex-1">
                      <DropdownField
                        options={[
                          { id: '', name: 'Any Genre' },
                          { id: '28', name: 'Action' },
                          { id: '12', name: 'Adventure' },
                          { id: '16', name: 'Animation' },
                          { id: '35', name: 'Comedy' },
                          { id: '80', name: 'Crime' },
                          { id: '99', name: 'Documentary' },
                          { id: '18', name: 'Drama' },
                          { id: '10751', name: 'Family' },
                          { id: '14', name: 'Fantasy' },
                          { id: '36', name: 'History' },
                          { id: '27', name: 'Horror' },
                          { id: '10402', name: 'Music' },
                          { id: '9648', name: 'Mystery' },
                          { id: '10749', name: 'Romance' },
                          { id: '878', name: 'Science Fiction' },
                          { id: '10770', name: 'TV Movie' },
                          { id: '53', name: 'Thriller' },
                          { id: '10752', name: 'War' },
                          { id: '37', name: 'Western' },
                        ]}
                        value={{ id: selectedGenre, name: '' }}
                        getKey={(o) => o.id}
                        getLabel={(o) => o.id === '' ? 'Any Genre' : o.name}
                        onChange={(o) => setSelectedGenre(o.id)}
                        placeholder="Genre"
                      />
                    </View>
                    <View className="flex-1">
                      <DropdownField
                        options={[
                          { id: '', name: 'Any Year' },
                          ...Array.from({length: 50}, (_, i) => {
                            const y = new Date().getFullYear() - i;
                            return { id: String(y), name: String(y) };
                          })
                        ]}
                        value={{ id: selectedYear, name: '' }}
                        getKey={(o) => o.id}
                        getLabel={(o) => o.id === '' ? 'Any Year' : o.name}
                        onChange={(o) => setSelectedYear(o.id)}
                        placeholder="Year"
                      />
                    </View>
                    <View className="flex-1">
                      <DropdownField
                        options={[
                          { id: '', name: 'Any Country' },
                          { id: 'US', name: 'United States' },
                          { id: 'GB', name: 'United Kingdom' },
                          { id: 'JP', name: 'Japan' },
                          { id: 'KR', name: 'South Korea' },
                          { id: 'IN', name: 'India' },
                          { id: 'FR', name: 'France' },
                          { id: 'DE', name: 'Germany' },
                          { id: 'IT', name: 'Italy' },
                          { id: 'ES', name: 'Spain' },
                          { id: 'CA', name: 'Canada' },
                          { id: 'AU', name: 'Australia' },
                          { id: 'CN', name: 'China' },
                        ]}
                        value={{ id: selectedCountry, name: '' }}
                        getKey={(o) => o.id}
                        getLabel={(o) => o.id === '' ? 'Any Country' : o.name}
                        onChange={(o) => setSelectedCountry(o.id)}
                        placeholder="Country"
                      />
                    </View>
                  </View>

                  <Button
                    onPress={() => {
                      navigation.navigate('Explore', {
                        initialGenre: selectedGenre,
                        initialYear: selectedYear,
                        initialCountry: selectedCountry
                      });
                    }}
                    disabled={!selectedGenre && !selectedYear && !selectedCountry}
                    style={{width: "100%", marginTop: 8}}>
                    Explore Filters
                  </Button>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    </ScreenSafeArea>
  );
};

export default Search;

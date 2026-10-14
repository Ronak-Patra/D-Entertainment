import {Content} from './zustand/contentStore';
import {Catalog, Post} from './providers/types';
import {providerManager} from './services/ProviderManager';
import {throwIfProviderAborted} from './sandbox/abort';
import {ProviderExtension} from './storage/extensionStorage';
import {deduplicatePosts} from './providers/deduplicatePosts';

export interface HomePageData {
  title: string;
  Posts: Post[];
  filter: string;
  error?: string;
  isLoading?: boolean;
}

interface HomeLoadOptions {
  catalogs?: Catalog[];
  previousData?: HomePageData[];
  onCategory?: (data: HomePageData[]) => void;
  installedProviders?: ProviderExtension[];
}

const currentYear = new Date().getFullYear();

export const CUSTOM_HUBS = [
  {
    title: 'Latest Releases',
    keywords: [
      'latest',
      'new',
      'recent',
      'recently',
      'releases',
      'today',
      currentYear.toString(),
      (currentYear - 1).toString(),
    ],
  },
  {
    title: 'Trending',
    keywords: ['trending', 'popular', 'top', 'hot', 'featured'],
  },
  {
    title: 'Bollywood & South Indian',
    keywords: [
      'bollywood',
      'hindi',
      'indian',
      'desi',
      'south',
      'telugu',
      'tamil',
      'malayalam',
      'kannada',
      'tollywood',
      'kollywood',
      'dubbed',
      'hindi dubbed',
      'dual audio',
    ],
  },
  {
    title: 'Hollywood & International',
    keywords: [
      'hollywood',
      'english',
      'foreign',
      'international',
      'western',
    ],
  },
  {
    title: 'Netflix, Amazon Prime, Disney+ Hotstar, JioCinema/ZEE5',
    keywords: [
      'netflix',
      'amazon',
      'prime',
      'disney',
      'hotstar',
      'jiocinema',
      'zee5',
      'zee',
      'hulu',
      'apple',
      'ott',
      'web series',
      'series',
    ],
  },
  {
    title: 'Anime',
    keywords: ['anime', 'donghua', 'animation', 'japanese'],
  },
  {
    title: 'K-Drama & Asian Dramas',
    keywords: ['korean', 'k-drama', 'kdrama', 'drama', 'asian', 'chinese', 'cdrama'],
  },
];

export const extractYearFromTitle = (title: string): number => {
  const match = title.match(/\b(19\d\d|20\d\d)\b/);
  return match ? parseInt(match[1], 10) : 0;
};

export const getRecencyScore = (post: Post): number => {
  let score = 0;
  const title = (post.title || '').toLowerCase();
  const tag = (post.cornerTag || post.tag || '').toLowerCase();
  const year = extractYearFromTitle(post.title);

  // Year bonus
  if (year === currentYear) {
    score += 500;
  } else if (year === currentYear - 1) {
    score += 250;
  } else if (year > 0) {
    score += Math.max(0, year - 2000);
  }

  // Today / Freshness keywords
  if (/\b(today|new|latest|just added)\b/i.test(tag) || /\b(today|new|latest|just added)\b/i.test(title)) {
    score += 300;
  }

  // Web series episode releases
  if (/\b(s\d+\s*e(p)?\s*\d+|episode|season\s*\d+)\b/i.test(title) || /\b(e(p)?\s*\d+)\b/i.test(tag)) {
    score += 150;
  }

  return score;
};

export const getHomePageDataOptimized = async (
  _activeProvider: Content['provider'],
  signal: AbortSignal,
  options: HomeLoadOptions = {},
): Promise<HomePageData[]> => {
  throwIfProviderAborted(signal);
  
  let providers = options.installedProviders?.filter(p => !p.disabled && p.value !== 'all') || [];
  if (providers.length === 0) {
    const { extensionStorage, providersStorage } = await import('./storage');
    const installed = extensionStorage.getInstalledProviders();
    const disabled = providersStorage.getDisabledProviders();
    providers = installed.filter(p => !disabled.includes(p.value) && p.value !== 'all');
  }
  if (providers.length === 0) {
    throw new Error('No active providers found');
  }

  const rows: HomePageData[] = CUSTOM_HUBS.map(hub => {
    const previous = options.previousData?.find(row => row.filter === hub.title);
    return {
      title: hub.title,
      filter: hub.title,
      Posts: previous?.Posts ?? [],
      isLoading: !previous || previous.isLoading === true,
    };
  });

  const publish = () => {
    throwIfProviderAborted(signal);
    options.onCategory?.([...rows]);
  };
  publish();

  // Dynamically score and rank installed providers for a given hub without hardcoding
  const getCandidatesForHub = (
    hubTitle: string,
    hubKeywords: string[],
    availableProviders: ProviderExtension[],
  ): ProviderExtension[] => {
    const scored = availableProviders.map(p => {
      let score = 0;
      const type = (p.type || '').toLowerCase();
      const val = (p.value || '').toLowerCase();
      const name = (p.display_name || '').toLowerCase();

      if (hubTitle === 'Anime') {
        if (type === 'anime') score += 60;
        if (val.includes('anime') || name.includes('anime')) score += 30;
      } else if (hubTitle.includes('K-Drama')) {
        if (type === 'drama') score += 60;
        if (val.includes('drama') || name.includes('drama') || val.includes('asian')) score += 30;
      } else if (hubTitle.includes('Bollywood') || hubTitle.includes('South')) {
        if (type === 'india') score += 50;
        if (val.includes('bolly') || val.includes('movie') || val.includes('desi') || val.includes('hindi')) score += 20;
      } else if (hubTitle.includes('Hollywood')) {
        if (type === 'english' || type === 'global') score += 70;
        if (type === 'india') score -= 30;
        if (val.includes('holly') || name.includes('holly') || val.includes('english')) score += 40;
        if (val.includes('bolly') || val.includes('desi') || name.includes('bolly')) score -= 40;
      } else {
        // Trending, New Releases, OTT
        if (type === 'global' || type === 'english' || type === 'india') score += 25;
      }

      for (const kw of hubKeywords) {
        if (val.includes(kw)) score += 15;
        if (name.includes(kw)) score += 15;
      }

      // Add a slight random jitter so multiple matching providers rotate dynamically on refresh
      score += Math.random() * 5;

      return { provider: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.provider);
  };

  let successes = 0;

  const catalogCache = new Map<string, Catalog[]>();
  const getProviderCatalog = async (providerValue: string): Promise<Catalog[]> => {
    if (catalogCache.has(providerValue)) {
      return catalogCache.get(providerValue)!;
    }
    try {
      const cats = await providerManager.getCatalog({ providerValue, signal });
      catalogCache.set(providerValue, cats || []);
      return cats || [];
    } catch {
      return [];
    }
  };

  // Helper to fetch posts with timeout and safe fallback
  const fetchHubFromProvider = async (
    targetProvider: ProviderExtension,
    hub: {title: string; keywords: string[]},
    hubIndex: number,
  ): Promise<Post[]> => {
    const fetchWithTimeout = async () => {
      const catalogs = await getProviderCatalog(targetProvider.value);

      let matchedFilter = catalogs.find(f =>
        hub.keywords.some(
          k =>
            (f.title && f.title.toLowerCase().includes(k)) ||
            (f.filter && f.filter.toLowerCase().includes(k)),
        ),
      );

      if (!matchedFilter) {
        if (hub.title === 'Latest Releases' || hub.title === 'New Releases') {
          matchedFilter = catalogs[0];
        } else if (hub.title === 'Trending') {
          matchedFilter = catalogs[1] || catalogs[0];
        } else if (
          hub.title.includes('Hollywood') ||
          hub.title === 'Anime' ||
          hub.title.includes('K-Drama')
        ) {
          // Strictly require a matching catalog for specialized hubs!
          // Never fall back to catalogs[0] (which injects Bollywood into Hollywood).
          return [];
        } else if (catalogs.length > 1) {
          matchedFilter = catalogs[hubIndex % catalogs.length];
        } else {
          matchedFilter = catalogs[0];
        }
      }

      let fetchedPosts: Post[] = [];
      const filterToFetch = matchedFilter?.filter ?? '';
      try {
        const fetched = await providerManager.getPosts({
          filter: filterToFetch,
          page: 1,
          providerValue: targetProvider.value,
          signal,
        });

        fetchedPosts = (fetched || []).map(p => ({
          ...p,
          provider: targetProvider.value,
        }));
      } catch {
        // Fallback below
      }

      if (
        fetchedPosts.length === 0 &&
        catalogs[0]?.filter &&
        catalogs[0].filter !== filterToFetch &&
        !hub.title.includes('Hollywood') &&
        hub.title !== 'Anime' &&
        !hub.title.includes('K-Drama')
      ) {
        try {
          const fallbackFetched = await providerManager.getPosts({
            filter: catalogs[0].filter,
            page: 1,
            providerValue: targetProvider.value,
            signal,
          });
          fetchedPosts = (fallbackFetched || []).map(p => ({
            ...p,
            provider: targetProvider.value,
          }));
        } catch {
          // ignore
        }
      }

      if (hub.title.includes('Hollywood')) {
        fetchedPosts = fetchedPosts.filter(p => {
          const t = (p.title || '').toLowerCase();
          const tag = (p.tag || '').toLowerCase();
          if (/bollywood|punjabi|bengali|marathi|gujarati|bhojpuri|desi|tollywood|kollywood/i.test(t)) return false;
          if (/bollywood|punjabi|bengali|marathi|gujarati|bhojpuri|desi/i.test(tag)) return false;
          if (/hindi movie|hindi original|hindi web/i.test(t) && !/hollywood|english|dubbed|dual audio/i.test(t)) return false;
          return true;
        });
      }

      return fetchedPosts;
    };

    return await Promise.race([
      fetchWithTimeout(),
      new Promise<Post[]>((_, reject) =>
        setTimeout(() => reject(new Error('Provider timeout')), 12000),
      ),
    ]);
  };

  // Process hubs in small concurrent chunks (2 at a time) to avoid socket starvation and scraping bottlenecks
  const chunkSize = 2;
  for (let i = 0; i < CUSTOM_HUBS.length; i += chunkSize) {
    throwIfProviderAborted(signal);
    const chunkIndices = CUSTOM_HUBS.slice(i, i + chunkSize).map((_, idx) => i + idx);

    await Promise.allSettled(
      chunkIndices.map(async hubIdx => {
        const hub = CUSTOM_HUBS[hubIdx];
        const isLatestReleases = hub.title === 'Latest Releases' || hub.title === 'New Releases';
        let posts: Post[] = [];

        if (isLatestReleases) {
          // For Latest Releases, gather latest releases across ALL active providers concurrently!
          const providerResults: Post[][] = [];
          const topProviders = providers.slice(0, 6);
          await Promise.allSettled(
            topProviders.map(async p => {
              try {
                const res = await fetchHubFromProvider(p, hub, hubIdx);
                if (res && res.length > 0) {
                  providerResults.push(res);
                }
              } catch (err) {
                console.warn(`[getHomePageData] Latest releases fetch failed for provider ${p.value}:`, err);
              }
            }),
          );

          // Round-robin / interleave newest items from all providers
          // so that the newest releases from every provider are at the very beginning of the row
          const maxLen = Math.max(0, ...providerResults.map(r => r.length));
          for (let idx = 0; idx < maxLen; idx++) {
            for (const resList of providerResults) {
              if (idx < resList.length) {
                posts.push(resList[idx]);
              }
            }
          }
        } else {
          const candidates = getCandidatesForHub(hub.title, hub.keywords, providers);
          // Try up to 3 best candidate providers sequentially
          for (let c = 0; c < Math.min(3, candidates.length); c++) {
            const candidate = candidates[c];
            try {
              const res = await fetchHubFromProvider(candidate, hub, hubIdx);
              if (res && res.length > 0) {
                posts = res;
                break;
              }
            } catch (err) {
              console.warn(`[getHomePageData] ${candidate.value} failed for ${hub.title}, trying fallback...`, err);
            }
          }
        }

        // Retain previous cached posts if fresh scrape returned 0
        if (posts.length === 0) {
          const previous = options.previousData?.find(row => row.filter === hub.title);
          if (previous?.Posts && previous.Posts.length > 0) {
            posts = previous.Posts;
          }
        }

        const unique = deduplicatePosts(posts);

        if (isLatestReleases) {
          // Prioritize by recency score: today's releases, current year, new series episodes first!
          unique.sort((a, b) => {
            const scoreA = getRecencyScore(a);
            const scoreB = getRecencyScore(b);
            if (scoreA !== scoreB) {
              return scoreB - scoreA;
            }
            return 0;
          });
        } else if (hub.title === 'Trending') {
          unique.sort((a, b) => {
            const rA = parseFloat(String(a.rating || 0)) || 0;
            const rB = parseFloat(String(b.rating || 0)) || 0;
            if (rA !== rB) return rB - rA;
            return extractYearFromTitle(b.title) - extractYearFromTitle(a.title);
          });
        }

        if (unique.length > 0) successes++;

        rows[hubIdx] = {
          title: hub.title,
          filter: hub.title,
          Posts: unique,
          isLoading: false,
          error: undefined,
        };

        publish();
      }),
    );
  }

  throwIfProviderAborted(signal);
  const totalPostsAcrossRows = rows.reduce((acc, r) => acc + (r.Posts?.length || 0), 0);
  if (successes === 0 && totalPostsAcrossRows === 0) {
    throw new Error('Failed to load any content hubs');
  }
  return rows;
};

// Dispatch logic based on activeProvider
export const getHomePageData = async (
  activeProvider: Content['provider'],
  signal: AbortSignal,
  options: HomeLoadOptions = {},
): Promise<HomePageData[]> => {
  if (activeProvider.value === 'all') {
    return getHomePageDataOptimized(activeProvider, signal, options);
  }

  throwIfProviderAborted(signal);
  const catalogs =
    options.catalogs ??
    (await providerManager.getCatalog({
      providerValue: activeProvider.value,
      signal,
    }));
  throwIfProviderAborted(signal);
  const rows: HomePageData[] = catalogs.map(item => {
    const previous = options.previousData?.find(
      row => row.filter === item.filter,
    );
    return {
      title: item.title,
      filter: item.filter,
      Posts: previous?.Posts ?? [],
      isLoading: !previous || previous.isLoading === true,
    };
  });
  
  let cursor = 0;
  let successes = 0;
  const publish = () => {
    throwIfProviderAborted(signal);
    options.onCategory?.([...rows]);
  };
  publish();
  
  const worker = async () => {
    while (cursor < catalogs.length) {
      throwIfProviderAborted(signal);
      const index = cursor++;
      const catalog = catalogs[index];
      try {
        const posts = await providerManager.getPosts({
          filter: catalog.filter,
          page: 1,
          providerValue: activeProvider.value,
          signal,
        });
        throwIfProviderAborted(signal);
        if (posts.length > 0) successes++;
        rows[index] = {
          title: catalog.title,
          filter: catalog.filter,
          Posts: posts,
        };
      } catch (error) {
        throwIfProviderAborted(signal);
        const rawMsg = error instanceof Error ? error.message : '';
        const isNetworkErr = /unable to resolve host|network error|econnrefused|enotfound|timeout/i.test(rawMsg);
        rows[index] = {
          title: catalog.title,
          filter: catalog.filter,
          Posts: rows[index].Posts,
          error: isNetworkErr ? 'Content temporarily unavailable' : (rawMsg || 'Failed to load category'),
        };
      }
      publish();
    }
  };
  
  await Promise.all(Array.from({length: Math.min(2, catalogs.length)}, worker));
  throwIfProviderAborted(signal);
  if (successes === 0) throw new Error('Failed to load any content categories');
  return rows;
};

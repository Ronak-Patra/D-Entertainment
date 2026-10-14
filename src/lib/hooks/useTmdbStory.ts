import axios from 'axios';
import Constants from 'expo-constants';
import {useQuery} from '@tanstack/react-query';
import {settingsStorage} from '../storage';
import { getTmdbApiKey as getRotatedTmdbApiKey } from '../services/apiKeys';

export type TmdbMediaType = 'movie' | 'tv';

export interface TmdbStoryCastMember {
  id: number | string;
  name: string;
  character?: string;
  profilePath?: string;
}

export interface TmdbStoryCollectionItem {
  id: number | string;
  title: string;
  subtitle?: string;
  imagePath?: string;
}

export interface StoryVideo {
  id: string;
  name?: string;
  url?: string;
  thumbnail?: string;
  youtubeKey?: string;
}

export interface RatingHistogramEntry {
  rating: number;
  voteCount: number;
}

export interface FeaturedReview {
  author?: string;
  summary?: string;
  text?: string;
  rating?: number;
  date?: string;
}

export interface RelatedTitle {
  id: string;
  title: string;
  image?: string;
  rating?: number;
  voteCount?: number;
  mediaType: TmdbMediaType;
}

export interface TmdbStoryData {
  id: number | string;
  mediaType: TmdbMediaType;
  title: string;
  tagline?: string;
  overview?: string;
  backdropPath?: string;
  backdropPaths: string[];
  posterPath?: string;
  trailerKey?: string;
  trailerName?: string;
  trailerUrl?: string;
  trailerThumbnail?: string;
  trailers?: StoryVideo[];
  releaseDate?: string;
  runtime?: number;
  genres: string[];
  rating?: number;
  voteCount?: number;
  popularity?: number;
  trendingRank?: number;
  meterRank?: number;
  certification?: string;
  status?: string;
  originalLanguage?: string;
  cast: TmdbStoryCastMember[];
  creators: string[];
  companies: string[];
  countries: string[];
  networks: string[];
  keywords: string[];
  collectionTitle?: string;
  collectionItems: TmdbStoryCollectionItem[];
  metascore?: number;
  productionBudget?: number;
  openingWeekendGross?: number;
  domesticGross?: number;
  worldwideGross?: number;
  ratingsHistogram?: RatingHistogramEntry[];
  featuredReview?: FeaturedReview;
  relatedTitles?: RelatedTitle[];
  watchlistCount?: string;
  awardsText?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  upcomingSeason?: string;
}

interface UseTmdbStoryOptions {
  enabled: boolean;
  imdbId?: string;
  tmdbId?: number | string;
  type?: string;
  title?: string;
  year?: string | number;
}

interface TmdbFindResult {
  id: number;
}

const TMDB_API_URL = 'https://api.themoviedb.org/3';

export const getProxyApiUrl = (): string =>
  String(
    Constants.expoConfig?.extra?.proxyApiUrl ||
      process.env.EXPO_PUBLIC_PROXY_API_URL ||
      '',
  ).trim();

export const getTmdbApiKey = (): string =>
  getRotatedTmdbApiKey() ||
  String(Constants.expoConfig?.extra?.tmdbApiKey || '').trim();

const getPreferredMediaType = (type?: string): TmdbMediaType =>
  type?.toLowerCase() === 'series' || type?.toLowerCase() === 'tv'
    ? 'tv'
    : 'movie';

const getImagePath = (path?: string | null): string | undefined =>
  path ? (path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w780${path}`) : undefined;

const getMovieCertification = (details: any): string | undefined => {
  const releases = details.release_dates?.results ?? [];
  const country =
    releases.find((item: any) => item.iso_3166_1 === 'US') ?? releases[0];
  return country?.release_dates
    ?.find((item: any) => item.certification)
    ?.certification?.trim();
};

const getTvCertification = (details: any): string | undefined => {
  const ratings = details.content_ratings?.results ?? [];
  const country =
    ratings.find((item: any) => item.iso_3166_1 === 'US') ?? ratings[0];
  return country?.rating?.trim();
};

function parseProxyResponse(json: any): TmdbStoryData | null {
  if (!json?.success) return null;

  const raw = json.raw;
  const aboveTheFold = raw?.aboveTheFoldData;
  const mainColumn = raw?.mainColumnData;

  const isTv = json.type === 'tvSeries' || json.type === 'tvMiniSeries' || json.isSeries === true;
  const mediaType: TmdbMediaType = isTv ? 'tv' : 'movie';

  const primaryVideos = (aboveTheFold?.primaryVideos?.edges?.map((e: any) => e.node) ?? aboveTheFold?.primaryVideos ?? []) as any[];
  const trailersList: StoryVideo[] = [];
  primaryVideos.forEach((v: any, index: number) => {
    const playUrl = v.playbackURLs?.find((p: any) =>
      p.url?.endsWith('.mp4') || p.mimeType?.includes('mp4') || p.videoMimeType?.includes('mp4')
    )?.url ?? v.playbackURLs?.[0]?.url;
    if (playUrl) {
      trailersList.push({
        id: v.id || `video-${index}`,
        name: v.name?.value,
        url: playUrl,
        thumbnail: v.thumbnail?.url,
      });
    }
  });

  const trailer = aboveTheFold?.primaryVideos?.edges?.[0]?.node ?? aboveTheFold?.primaryVideos?.[0];
  const trailerPlayback = trailer?.playbackURLs?.find((p: any) =>
    p.url?.endsWith('.mp4') || p.mimeType?.includes('mp4') || p.videoMimeType?.includes('mp4')
  ) ?? trailer?.playbackURLs?.[0];

  if (trailersList.length === 0 && (trailerPlayback?.url || trailer?.name?.value)) {
    trailersList.push({
      id: 'primary-trailer',
      name: trailer?.name?.value,
      url: trailerPlayback?.url,
      thumbnail: trailer?.thumbnail?.url,
    });
  }

  const histogram = mainColumn?.aggregateRatingsBreakdown?.histogram?.histogramValues;
  const meterRanking = aboveTheFold?.meterRanking;
  const engagementStats = aboveTheFold?.engagementStatistics;
  const awards = mainColumn?.prestigiousAwardSummary;

  const rawCastV2 = mainColumn?.castV2;
  const castCredits: any[] = Array.isArray(rawCastV2)
    ? rawCastV2.flatMap((group: any) => group.credits ?? [])
    : (rawCastV2?.credits ?? rawCastV2?.edges ?? []);

  const cast: TmdbStoryCastMember[] = castCredits.slice(0, 24).map((credit: any) => {
    const person = credit.name ?? credit.node?.name ?? credit;
    const character = credit.creditedRoles?.[0]?.characters?.[0]?.name
      ?? credit.characters?.[0]
      ?? credit.character;
    return {
      id: person.id,
      name: person.nameText ?? person.name,
      character: character || undefined,
      profilePath: person.primaryImage?.url || undefined,
    };
  });

  if (cast.length === 0) {
    (json.cast ?? []).slice(0, 24).forEach((person: any) => {
      cast.push({
        id: person.id,
        name: person.name,
        character: person.characters?.[0] || undefined,
        profilePath: undefined,
      });
    });
  }

  const featuredReviews = aboveTheFold?.featuredReviews?.edges ?? (Array.isArray(aboveTheFold?.featuredReviews) ? aboveTheFold.featuredReviews : []);
  const review = featuredReviews[0]?.node ?? featuredReviews[0];
  const featuredReview = review ? {
    author: review.author?.nickName || review.author?.displayName || undefined,
    summary: review.summary?.originalText || undefined,
    text: review.text?.originalText || undefined,
    rating: review.authorRating || undefined,
    date: review.submissionDate || undefined,
  } : undefined;

  const principalCredits = mainColumn?.principalCredits ?? [];
  const creatorGroup = principalCredits.find((c: any) =>
    ['creator', 'director', 'writer'].includes(c.category?.id)
  );
  const creatorsFromPrincipal = (creatorGroup?.credits ?? [])
    .map((c: any) => c.name?.nameText || c.name?.name)
    .filter(Boolean);

  const legacyDirectors = json.credits?.director ?? json.credits?.creator ?? [];
  const creators = (creatorsFromPrincipal.length > 0
    ? creatorsFromPrincipal
    : legacyDirectors.map((d: any) => d.name)
  ).filter(Boolean);

  const stars = json.credits?.stars ?? [];

  if (cast.length === 0 && stars.length > 0) {
    stars.forEach((s: any) => {
      cast.push({ id: s.id, name: s.name, profilePath: undefined });
    });
  }

  const episodes = mainColumn?.episodes;
  const currentYear = new Date().getFullYear();
  const years = (episodes?.years ?? []).map((y: any) => y.year).filter(Boolean);
  const futureYears = years.filter((y: number) => y > currentYear);
  const spotlightSeason = parseInt(episodes?.episodeSpotlight?.[0]?.series?.displayableEpisodeNumber?.displayableSeason?.season, 10);
  const totalRawSeasons = episodes?.seasons?.length ?? episodes?.displayableSeasons?.length ?? 0;

  let totalSeasons: number | undefined;
  let upcomingSeason: string | undefined;

  if (isTv) {
    if (json.type === 'tvMiniSeries') {
      totalSeasons = 1;
    } else if (spotlightSeason && spotlightSeason > 0 && spotlightSeason <= totalRawSeasons) {
      totalSeasons = spotlightSeason;
      if (totalRawSeasons > spotlightSeason && futureYears.length > 0) {
        const nextSeasonNum = spotlightSeason + 1;
        const nextYear = futureYears[0];
        upcomingSeason = `Season ${nextSeasonNum} (${nextYear})`;
      }
    } else if (futureYears.length > 0 && totalRawSeasons > 1) {
      const futureSeasonsCount = futureYears.length;
      totalSeasons = Math.max(1, totalRawSeasons - futureSeasonsCount);
      const nextSeasonNum = totalSeasons + 1;
      const nextYear = futureYears[0];
      upcomingSeason = `Season ${nextSeasonNum} (${nextYear})`;
    } else {
      totalSeasons = totalRawSeasons || undefined;
    }
  }
  const totalEpisodes = episodes?.totalEpisodes?.total || episodes?.episodes?.total || undefined;

  let awardsText: string | undefined;
  if (awards) {
    const parts: string[] = [];
    if (awards.wins) parts.push(`${awards.wins} wins`);
    if (awards.nominations) parts.push(`${awards.nominations} nominations`);
    if (awards.award?.text) parts.push(awards.award.text);
    awardsText = parts.join(' · ') || undefined;
  }

  const collectionItems: TmdbStoryCollectionItem[] = [];

  return {
    id: json.id,
    mediaType,
    title: json.title || json.originalTitle || '',
    tagline: undefined,
    overview: json.plot || undefined,
    backdropPaths: (mainColumn?.titleMainImages ?? [])
      .filter((img: any) => img.url && img.width && img.height && img.width / img.height >= 1.25)
      .map((img: any) => img.url),
    posterPath: json.poster?.url || undefined,
    trailerKey: undefined,
    trailerName: trailersList[0]?.name || undefined,
    trailerUrl: trailersList[0]?.url || undefined,
    trailerThumbnail: trailersList[0]?.thumbnail || undefined,
    trailers: trailersList,
    releaseDate: json.releaseDate || undefined,
    runtime: json.runtimeSeconds ? Math.round(json.runtimeSeconds / 60) : undefined,
    genres: json.genres ?? [],
    rating:
      typeof json.rating === 'number'
        ? json.rating
        : json.rating
          ? parseFloat(String(json.rating)) || undefined
          : undefined,
    voteCount: json.voteCount || undefined,
    popularity: undefined,
    trendingRank: undefined,
    meterRank: meterRanking?.currentRank || undefined,
    certification: json.certificate || undefined,
    status: aboveTheFold?.productionStatus?.currentProductionStage?.text || undefined,
    originalLanguage: undefined,
    cast,
    creators: creators.slice(0, 5),
    companies: [],
    countries: [],
    networks: [],
    keywords: json.keywords ?? [],
    collectionTitle: isTv ? 'Seasons' : undefined,
    collectionItems,
    metascore: json.metascore || undefined,
    productionBudget: mainColumn?.productionBudget?.budget?.amount || undefined,
    openingWeekendGross: mainColumn?.openingWeekendGross?.gross?.total?.amount || undefined,
    domesticGross: mainColumn?.lifetimeGross?.total?.amount || undefined,
    worldwideGross: mainColumn?.worldwideGross?.total?.amount || undefined,
    ratingsHistogram: histogram
      ? histogram.map((h: any) => ({ rating: h.rating, voteCount: h.voteCount }))
      : undefined,
    featuredReview,
    relatedTitles: json.raw.mainColumnData?.moreLikeThisTitles
      ? json.raw.mainColumnData.moreLikeThisTitles.map((t: any) => {
          const rawRating = t.ratingsSummary?.aggregateRating;
          const parsedRating =
            typeof rawRating === 'number'
              ? rawRating
              : rawRating
                ? parseFloat(String(rawRating))
                : undefined;
          return {
            id: t.id,
            title: t.titleText || t.originalTitleText,
            image: t.primaryImage?.url || undefined,
            rating:
              parsedRating !== undefined && !isNaN(parsedRating)
                ? parsedRating
                : undefined,
            voteCount: t.ratingsSummary?.voteCount || undefined,
            mediaType: t.titleType?.id === 'tvSeries' ? 'tv' : 'movie',
          };
        })
      : undefined,
    watchlistCount: engagementStats?.watchlistStatistics?.displayableCount || undefined,
    awardsText,
    totalSeasons,
    totalEpisodes,
    upcomingSeason,
  };
}

async function fetchProxyStory(imdbId: string, signal?: AbortSignal): Promise<TmdbStoryData | null> {
  const proxyUrl = getProxyApiUrl();
  if (!proxyUrl) return null;

  try {
    const response = await axios.get(proxyUrl, {
      params: { url: imdbId },
      signal,
      timeout: 15000,
    });
    return parseProxyResponse(response.data);
  } catch (e) {
    console.warn('[Story] Proxy API failed, will try TMDB fallback:', e);
    return null;
  }
}

const resolveTmdbIdentity = async ({
  apiKey,
  imdbId,
  preferredType,
  signal,
  tmdbId,
  title,
  year,
}: {
  apiKey: string;
  imdbId?: string;
  preferredType: TmdbMediaType;
  signal?: AbortSignal;
  tmdbId?: number | string;
  title?: string;
  year?: string | number;
}): Promise<{id: number; mediaType: TmdbMediaType}> => {
  const directId = Number(tmdbId);
  if (Number.isFinite(directId) && directId > 0) {
    return {id: directId, mediaType: preferredType};
  }

  if (imdbId) {
    const response = await axios.get(`${TMDB_API_URL}/find/${imdbId}`, {
      params: {
        api_key: apiKey,
        external_source: 'imdb_id',
        language: 'en-US',
      },
      signal,
      timeout: 10000,
    });
    const preferredResults: TmdbFindResult[] =
      preferredType === 'tv'
        ? (response.data?.tv_results ?? [])
        : (response.data?.movie_results ?? []);
    const fallbackResults: TmdbFindResult[] =
      preferredType === 'tv'
        ? (response.data?.movie_results ?? [])
        : (response.data?.tv_results ?? []);
    const result = preferredResults[0] ?? fallbackResults[0];
    if (result?.id) {
      return {
        id: result.id,
        mediaType: preferredResults[0]
          ? preferredType
          : preferredType === 'tv'
            ? 'movie'
            : 'tv',
      };
    }
  }

  if (title) {
    const cleanTitle = title
      .replace(/\b(1080p|720p|480p|2160p|4k|hdr|web-dl|bluray|x264|x265|hevc|h264|aac|dual audio|hindi dubbed|hindi|english|tamil|telugu|kannada|malayalam|bengali|org|multi|rip|complete|all episodes|uncut|hdrip|webrip)\b/gi, '')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/\b(season\s*\d+|s\d+|episode\s*\d+|ep\s*\d+)\b/gi, '')
      .replace(/[-_.:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let searchYear = year;
    if (!searchYear) {
      const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) searchYear = yearMatch[1];
    }

    const queriesToTry = Array.from(new Set([
      cleanTitle.length > 1 ? cleanTitle : title,
      cleanTitle.split(/\s+/).slice(0, 4).join(' '),
      title.split(/[:-]/)[0].trim(),
    ])).filter(q => q && q.length > 1);

    for (const query of queriesToTry) {
      const endpoint = preferredType === 'tv' ? 'search/tv' : 'search/movie';
      const params: any = {
        api_key: apiKey,
        query,
        language: 'en-US',
        page: 1,
      };
      if (searchYear) {
        if (preferredType === 'tv') params.first_air_date_year = searchYear;
        else params.primary_release_year = searchYear;
      }

      let response = await axios.get(`${TMDB_API_URL}/${endpoint}`, {
        params,
        signal,
        timeout: 10000,
      }).catch(() => null);

      let results = response?.data?.results ?? [];
      if (results.length === 0 && searchYear) {
        // Retry without year constraint
        delete params.first_air_date_year;
        delete params.primary_release_year;
        response = await axios.get(`${TMDB_API_URL}/${endpoint}`, {
          params,
          signal,
          timeout: 10000,
        }).catch(() => null);
        results = response?.data?.results ?? [];
      }

      if (results.length === 0) {
        // Try search/multi
        response = await axios.get(`${TMDB_API_URL}/search/multi`, {
          params: {api_key: apiKey, query, language: 'en-US', page: 1},
          signal,
          timeout: 10000,
        }).catch(() => null);
        results = (response?.data?.results ?? []).filter(
          (r: any) => r.media_type === 'movie' || r.media_type === 'tv',
        );
        if (results.length > 0) {
          return {id: results[0].id, mediaType: results[0].media_type as TmdbMediaType};
        }
      }

      if (results.length > 0) {
        return {id: results[0].id, mediaType: preferredType};
      }
    }

    // Try OMDB title search fallback to get IMDb ID
    try {
      const omdbKey = (await import('../services/apiKeys')).getOmdbApiKey();
      if (omdbKey && cleanTitle) {
        const omdbRes = await axios.get('https://www.omdbapi.com/', {
          params: {apikey: omdbKey, t: cleanTitle},
          signal,
          timeout: 8000,
        }).catch(() => null);
        const imdbFromOmdb = omdbRes?.data?.imdbID;
        if (imdbFromOmdb) {
          const tmdbFindRes = await axios.get(`${TMDB_API_URL}/find/${imdbFromOmdb}`, {
            params: {api_key: apiKey, external_source: 'imdb_id', language: 'en-US'},
            signal,
            timeout: 8000,
          }).catch(() => null);
          const findResults = (preferredType === 'tv' ? tmdbFindRes?.data?.tv_results : tmdbFindRes?.data?.movie_results) || tmdbFindRes?.data?.movie_results || tmdbFindRes?.data?.tv_results;
          if (findResults && findResults[0]?.id) {
            return {id: findResults[0].id, mediaType: preferredType};
          }
        }
      }
    } catch {
      // Ignore OMDB fallback errors
    }
  }

  throw new Error('No TMDB or IMDb identifier is available and search failed');
};

const normalizeStoryData = ({
  collection,
  details,
  mediaType,
  trendingRank,
}: {
  collection?: any;
  details: any;
  mediaType: TmdbMediaType;
  trendingRank?: number;
}): TmdbStoryData => {
  const isTv = mediaType === 'tv';
  const creditData = isTv ? details.aggregate_credits : details.credits;
  const cast = (creditData?.cast ?? []).slice(0, 24).map(
    (person: any): TmdbStoryCastMember => ({
      id: person.id,
      name: person.name,
      character: isTv
        ? person.roles?.[0]?.character
        : person.character || undefined,
      profilePath: getImagePath(person.profile_path),
    }),
  );
  const crew = creditData?.crew ?? [];
  const directors = isTv
    ? (details.created_by ?? []).map((person: any) => person.name)
    : crew
        .filter((person: any) => person.job === 'Director')
        .map((person: any) => person.name);
  const keywordItems = isTv
    ? (details.keywords?.results ?? [])
    : (details.keywords?.keywords ?? []);
  const collectionItems: TmdbStoryCollectionItem[] = isTv
    ? []
    : (collection?.parts ?? []).map((movie: any) => ({
        id: movie.id,
        title: movie.title,
        subtitle: movie.release_date?.slice(0, 4),
        imagePath: getImagePath(movie.poster_path),
      }));
  const backdropPaths = Array.from(
    new Set(
      [
        details.backdrop_path,
        ...(details.images?.backdrops ?? []).map(
          (image: any) => image.file_path,
        ),
      ].filter(Boolean),
    ),
  ).slice(0, 10) as string[];
  const youtubeVideos = (details.videos?.results ?? []).filter(
    (video: any) => video.site === 'YouTube' && video.key,
  );
  const tmdbTrailers: StoryVideo[] = youtubeVideos
    .filter((v: any) => v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip')
    .map((v: any) => ({
      id: v.id || v.key,
      name: v.name,
      youtubeKey: v.key,
    }));
  const trailer =
    youtubeVideos.find(
      (video: any) => video.type === 'Trailer' && video.official,
    ) ??
    youtubeVideos.find((video: any) => video.type === 'Trailer') ??
    youtubeVideos.find((video: any) => video.type === 'Teaser') ??
    youtubeVideos[0];

  const tmdbReviews = details.reviews?.results ?? [];
  const review = tmdbReviews[0];
  const featuredReview = review
    ? {
        author: review.author || review.author_details?.username || undefined,
        summary: undefined,
        text: review.content || undefined,
        rating: review.author_details?.rating || undefined,
        date: review.created_at || undefined,
      }
    : undefined;

  return {
    id: details.id,
    mediaType,
    title: isTv ? (details.name || '') : (details.title || ''),
    tagline: details.tagline || undefined,
    overview: details.overview || undefined,
    backdropPath: getImagePath(details.backdrop_path),
    backdropPaths,
    posterPath: getImagePath(details.poster_path),
    trailerKey: trailer?.key,
    trailerName: trailer?.name,
    trailers: tmdbTrailers,
    releaseDate: isTv ? details.first_air_date : details.release_date,
    runtime: isTv ? details.episode_run_time?.[0] : details.runtime,
    genres: (details.genres ?? []).map((genre: any) => genre.name),
    rating: details.vote_average || undefined,
    voteCount: details.vote_count || undefined,
    popularity: details.popularity || undefined,
    trendingRank,
    certification: isTv
      ? getTvCertification(details)
      : getMovieCertification(details),
    status: details.status || undefined,
    originalLanguage: details.original_language?.toUpperCase(),
    cast,
    creators: Array.from(new Set(directors)).slice(0, 5) as string[],
    companies: (details.production_companies ?? [])
      .map((company: any) => company.name)
      .slice(0, 6),
    countries: (details.production_countries ?? [])
      .map((country: any) => country.name)
      .slice(0, 5),
    networks: (details.networks ?? [])
      .map((network: any) => network.name)
      .slice(0, 5),
    keywords: keywordItems.map((item: any) => item.name).slice(0, 10),
    collectionTitle:
      collection?.name || details.belongs_to_collection?.name || undefined,
    collectionItems,
    featuredReview,
    totalSeasons: details.number_of_seasons || (details.seasons ? details.seasons.filter((s: any) => s.season_number > 0).length : undefined),
    totalEpisodes: details.number_of_episodes,
  };
};

const fetchTmdbStory = async ({
  imdbId,
  signal,
  tmdbId,
  type,
  title,
  year,
}: Omit<UseTmdbStoryOptions, 'enabled'> & {
  signal?: AbortSignal;
}): Promise<TmdbStoryData> => {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new Error('No TMDB API key is configured');
  }

  const identity = await resolveTmdbIdentity({
    apiKey,
    imdbId,
    preferredType: getPreferredMediaType(type),
    signal,
    tmdbId,
    title,
    year,
  });
  const appendToResponse =
    identity.mediaType === 'tv'
      ? 'aggregate_credits,content_ratings,keywords,external_ids,images,videos,reviews'
      : 'credits,release_dates,keywords,external_ids,images,videos,reviews';
  const detailsResponse = await axios.get(
    `${TMDB_API_URL}/${identity.mediaType}/${identity.id}`,
    {
      params: {
        api_key: apiKey,
        append_to_response: appendToResponse,
        include_image_language: 'en,null',
        language: 'en-US',
      },
      signal,
      timeout: 12000,
    },
  );
  const details = detailsResponse.data;
  const [trendingResult, collectionResult] = await Promise.allSettled([
    axios.get(`${TMDB_API_URL}/trending/${identity.mediaType}/week`, {
      params: {api_key: apiKey, language: 'en-US'},
      signal,
      timeout: 10000,
    }),
    details.belongs_to_collection?.id
      ? axios.get(
          `${TMDB_API_URL}/collection/${details.belongs_to_collection.id}`,
          {
            params: {api_key: apiKey, language: 'en-US'},
            signal,
            timeout: 10000,
          },
        )
      : Promise.resolve(undefined),
  ]);
  const trending =
    trendingResult.status === 'fulfilled'
      ? (trendingResult.value.data?.results ?? [])
      : [];
  const trendingIndex = trending.findIndex(
    (item: any) => item.id === details.id,
  );
  const collection =
    collectionResult.status === 'fulfilled'
      ? collectionResult.value?.data
      : undefined;

  return normalizeStoryData({
    collection,
    details,
    mediaType: identity.mediaType,
    trendingRank: trendingIndex >= 0 ? trendingIndex + 1 : undefined,
  });
};

export const fetchStoryData = async (
  options: Omit<UseTmdbStoryOptions, 'enabled'> & { signal?: AbortSignal },
): Promise<TmdbStoryData> => {
  const userTmdbKey = settingsStorage.getTmdbApiKey();
  const hasCustomTmdbKey = Boolean(userTmdbKey);
  const proxyApiUrl = getProxyApiUrl();

  // If user explicitly configured custom TMDB key, use TMDB directly
  if (hasCustomTmdbKey) {
    return fetchTmdbStory(options);
  }

  // If proxy API URL is present in env, try proxy API first
  if (proxyApiUrl && options.imdbId) {
    const proxyResult = await fetchProxyStory(options.imdbId, options.signal);
    if (proxyResult) {
      return proxyResult;
    }
  }

  // Fallback to TMDB if proxy is not configured in env or if proxy failed / no imdbId
  // This will use userTmdbKey, envKey, or the hardcoded fallback keys from apiKeys.ts
  return fetchTmdbStory(options);
};

export const useTmdbStory = ({
  enabled,
  imdbId,
  tmdbId,
  type,
  title,
  year,
}: UseTmdbStoryOptions) => {
  const apiKeyRevision = settingsStorage.getTmdbApiKeyRevision();

  return useQuery({
    queryKey: [
      'tmdbStory',
      tmdbId || '',
      imdbId || '',
      type || '',
      title || '',
      year || '',
      apiKeyRevision,
    ],
    queryFn: ({signal}) =>
      fetchStoryData({imdbId, signal, tmdbId, type, title, year}),
    enabled: enabled && Boolean(tmdbId || imdbId || title),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    retry: 1,
  });
};

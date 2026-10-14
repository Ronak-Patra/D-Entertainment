# 🎬 D Entertainment

A modern, premium, feature-rich Android streaming and media player application for movies, series, anime, and Asian dramas. Powered by multi-provider extensions, native ExoPlayer engine, featuring YouTube/Netflix-style half-vertical playback, dual Picture-in-Picture (PiP) multitasking, smart category hubs, dynamic intro/outro skip, and advanced network circumvention.

---

## 📖 About The Project

**D Entertainment** is a comprehensive, modern Android media aggregator and player application built with React Native & Expo (powered by the native ExoPlayer engine). It seamlessly bridges diverse online streaming sources into a unified, high-performance entertainment experience.

Designed with a sleek dark/light dynamic design system, D Entertainment allows users to effortlessly stream high-bitrate movies, web series, anime, and Asian dramas, multitask with dual-mode Picture-in-Picture (PiP), download video streams for offline playback, bypass restrictive network/ISP blocks with built-in DNS-over-HTTPS (DoH) and WARP, and customize playback across mobile and Android TV interfaces.

---

## ✨ Comprehensive Feature Details

### 📺 1. Video Playback & Native ExoPlayer Engine
* **High-Fidelity Video Engine**: Powered by `react-native-video` (ExoPlayer) with native hardware acceleration, smooth 1080p/4K decoding, and background playback support.
* **Full-Screen & Gesture Controls**: Interactive player view featuring intuitive swipe gestures for brightness and volume adjustments, double-tap to seek, pinch-to-zoom, and a long-press 2x speed booster gesture.
* **Dynamic Intro/Outro Skip**: Skip buttons automatically detect verified intro/outro intervals per title. A long-press menu allows selecting custom skip intervals (30s, 60s, 85s, 90s) with per-title duration memory.
* **Audio Track & Subtitle Switcher**: Seamless switching between embedded multi-audio tracks and styled subtitle streams (including external SRT and VTT support).
* **Multi-Speed Playback**: Smooth variable playback rates ranging from 0.25x to 2.0x.

### 📱 2. Mobile-First Half-Vertical Player & Orientation Control
* **Half-Vertical (Portrait) Playback by Default**: On mobile devices, videos open in responsive Half-Vertical mode (16:9 video player on top, rich metadata and controls below), matching the UX of YouTube and Netflix mobile.
* **Notch & Status Bar Safe Area Insets**: Top safe-area insets prevent player controls and video boundaries from being obscured by punch-hole cameras or notches.
* **Same-Provider Recommendations Shelf**: Browse related titles directly beneath the active video fetched dynamically from the active provider without interrupting playback.
* **One-Tap Episode Shelf**: Horizontal episode carousel allows one-tap switching between episodes and seasons directly under the player.
* **Dedicated Orientation Switch & Screen Lock**: One-tap rotation buttons placed in both the top-right overlay and bottom control bar, backed by an independent orientation lock to prevent unwanted device autorotation.

### 🖼️ 3. Dual Picture-in-Picture (PiP) Multitasking Engine
* **System-Level Global PiP**: Seamlessly floats over the Android Home screen and other applications when swiping home or pressing the PiP button.
* **Dynamic 16:9 Geometry Alignment**: Dynamically computes `sourceRectHint` matching the top 16:9 video bounds (`Rect(0, 0, width, (width * 9) / 16)`), resolving Android 12+ OS-level aborts during aspect ratio shifts.
* **Dual Multi-Tasking Choice Modal**: Tapping the PiP icon presents a choice between:
  * **System PiP (Global)**: Floating window over the Home screen and third-party apps.
  * **In-App Mini Player**: Lightweight, draggable mini-player within D Entertainment.
* **Streamlined PiP Interface**: Floating PiP window displays strictly essential controls (**Play/Pause**, **Fullscreen**, and **Close**).
* **AppOps Permission Verifier & Settings Shortcut**: Detects OEM skins (MIUI/HyperOS, Samsung OneUI, ColorOS) where PiP is restricted for sideloaded APKs, providing a direct one-tap shortcut to Android Settings.
* **Eliminated Render Cascade**: Resolved the `"Maximum update depth exceeded"` infinite loop error when pausing in PiP mode.

### 🌐 4. Multi-Provider Streaming & Content Discovery
* **Multi-Provider Aggregation**: Aggregates movies, series, anime, and dramas across community-maintained provider plugins with zero hardcoded dependencies.
* **Fresh Content Priority (Hub #0)**: "Latest Releases" is pinned at the top of the feed with recency scoring, round-robin interleaved across all active providers to eliminate duplicate rows.
* **Smart Category Hub Filter Tabs**: One-tap filter chips for **All**, **Anime**, **K-Drama**, **Trending & New**, **Bollywood**, **South Indian**, **Hollywood**, and **OTT Series**, accompanied by sub-filters for **Movies** vs **Web Series**.
* **Zero-Flicker Advance Search**: Replaced layout jumping and disruptive "Updating Results" banners with a smooth, debounced query engine.
* **Search Tab Instant Reset**: Tapping the bottom Search tab instantly resets query parameters, dismisses the keyboard, and triggers haptic feedback.
* **Auto-Provider Initialization**: Automatically selects and initializes default active providers upon first install—no manual onboarding dialog required.

### 📡 5. Casting & External Player Integration
* **Google Cast & DLNA**: Cast videos to smart TVs, Chromecast, and DLNA devices with real-time stream remuxing.
* **External Video Player Launching**: Send streams directly to preferred external media players such as VLC, MX Player, or mpv with audio/subtitle passing.

### 🛡️ 6. Network Resilience, Privacy & Offline Downloads
* **Built-in Network Bypass Engine**: Native support for **DNS-over-HTTPS (DoH)**, **Cloudflare WARP**, and **ByeDPI** to bypass restrictive ISP blocks and censorship filters.
* **Automatic DNS Failover**: Sequential 3-provider fallback gracefully catches socket and host resolution errors without disrupting the user experience.
* **Custom TMDB API Key**: Configure personal TMDB keys directly in Settings for uninterrupted metadata scraping.
* **Fast Downloads & Offline Manager**: Multithreaded HLS downloader and torrent streaming support for offline viewing.

### 🎨 7. Modern Aesthetics & Theme System
* **Material 3 Dynamic Theming**: Dynamically extracts dominant color accents from media artwork to tint buttons, badges, and player progress sliders.
* **Adaptive App Launcher Icons & Bootsplash**: High-resolution adaptive launcher icons (`mdpi` to `xxxhdpi`) paired with a dark-themed bootsplash.
* **Dark / Light / Android TV Mode**: Default OLED dark mode, clean light mode, and a TV-optimized D-pad navigation layout.

---

## 🏠 Home Page Sections

| Section | Description |
|---|---|
| **Latest Releases** | Freshly released movies and episodes round-robin interleaved across active providers |
| **Trending & New** | Live trending titles and popular media calculated by recency and engagement |
| **Dedicated Anime Hub** | Anime series, movies, and ongoing seasons categorized dynamically |
| **Dedicated K-Drama Hub** | Korean and Asian drama series with complete episode listings |
| **Bollywood & Regional** | Indian cinema, regional releases (Tamil, Telugu, Malayalam, Punjabi), and OTT originals |
| **Hollywood & Global** | International box-office titles, blockbuster films, and Western series |
| **OTT Series Hub** | Curated series across premium streaming networks |
| **Continue Watching** | Instant resume timeline tracking playback progress across all titles |

---

## 📱 Android Architecture & APK Compatibility Guide

When downloading or distributing **D Entertainment**, choose the APK build matching your device's CPU architecture:

### 🚀 arm64-v8a (The Modern Standard)

> [!IMPORTANT]
> **Recommended for 99% of Android Users**

* **Architecture**: 64-bit ARM
* **Supported Devices**: Almost all Android smartphones released in the last 7+ years (Samsung Galaxy S/A series, Google Pixel, OnePlus, Xiaomi, Redmi, Poco, Realme, Vivo, Oppo, Motorola, Nothing Phone, etc.), modern Android tablets, and newer Android TV boxes.
* **Why Use It**: Delivers optimal 64-bit performance, lowest battery consumption, faster JavaScript execution, and full hardware acceleration for 4K/1080p video decoders. If you are installing D Entertainment on your daily smartphone, this is the file you need.

---

### 🏛️ armeabi-v7a (The Legacy Standard)

> [!NOTE]
> **For Very Old Devices, Cheap TV Boxes & Fire TV Sticks**

* **Architecture**: 32-bit ARM
* **Supported Devices**: Older legacy budget phones (pre-2016), budget Android TV boxes, older smart TVs, Fire TV Stick Lite / Fire TV Stick 3rd Gen, and older Android tablets.
* **Why Use It**: Retains backward compatibility with devices featuring 32-bit CPUs or 32-bit OS kernels, with a smaller file size (~29.8 MB vs ~51.0 MB).

---

## 📊 Quick Summary Table

| Architecture | CPU Type | Best For | Typical Devices | APK File Name | Size |
|---|---|---|---|---|---|
| **arm64-v8a** | 64-bit ARM | ⭐ **Main Android Phones & Modern TVs (Recommended)** | Samsung, Pixel, OnePlus, Xiaomi, Realme, Moto (2017+) | `d-entertainment-arm64-v8a-v1.0.0.apk` | **~51.0 MB** |
| **armeabi-v7a** | 32-bit ARM | 📦 **Legacy Phones, Budget Sticks & Cheap TV Boxes** | Pre-2016 Phones, Fire TV Stick Lite/3rd Gen, Budget Boxes | `d-entertainment-armeabi-v7a-v1.0.0.apk` | **~29.8 MB** |

---

## 🚀 Download & Installation

You can download the compiled Android APK directly from the project repository:

📦 **Latest Release**: [Download D-Entertainment Releases](https://github.com/Ronak-Patra/D-Entertainment/releases)

### Installation Steps:
1. Download the `d-entertainment-arm64-v8a-v1.0.0.apk` file (or `armeabi-v7a` for older devices) onto your Android device.
2. Open the downloaded file. If prompted, enable **"Allow from this source"** or **"Install Unknown Apps"** in your Android Security Settings.
3. Tap **Install** and launch **D Entertainment** to start watching!
4. *(Optional)* When tapping Picture-in-Picture for the first time, allow **"Picture-in-picture"** in your phone's Android Settings if prompted.

---

## 🛠️ Built With

* **Framework**: [React Native](https://reactnative.dev/) (New Architecture ready) & [Expo Modules](https://docs.expo.dev/)
* **Video Engine**: [react-native-video](https://github.com/react-native-video/react-native-video) (ExoPlayer)
* **State Management**: [Zustand](https://github.com/pmndrs/zustand) & [MMKV Storage](https://github.com/mrousavy/react-native-mmkv)
* **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
* **Navigation**: [React Navigation](https://reactnavigation.org/)
* **Network & DNS**: Custom OkHttp DoH, Cloudflare WARP, and ByeDPI engine

---

## 🙏 Acknowledgements

* **Original Foundation**: Built upon the open-source foundation of **[Vega App](https://github.com/vega-org/vega-app)** developed by the [Vega Organization](https://github.com/vega-org). Heartfelt gratitude and full credit go to the original creators, maintainers, and contributors for creating the exceptional architectural foundation, provider plugin system, casting remuxer, and media playback infrastructure.

---

## ⚖️ Disclaimer

> [!IMPORTANT]
> **D Entertainment does not host, store, or distribute any media content or video files.**
> This application functions strictly as a media player and aggregator frontend. All streams and metadata are provided by third-party extensions and community-maintained sources selected and configured directly by the user. The developers do not endorse and have no affiliation with any third-party content providers.

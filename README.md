# D Entertainment

<p align="center">
  <strong>Modern Android streaming and media player app for movies, series, anime, and Asian dramas.</strong>
</p>

<p align="center">
  <a href="https://github.com/Ronak-Patra/D-Entertainment"><img src="https://img.shields.io/badge/Platform-Android-green.svg?style=for-the-badge&logo=android" alt="Platform"></a>
  <a href="https://reactnative.dev/"><img src="https://custom-icon-badges.demolab.com/badge/-React_Native-287aad?style=for-the-badge&logo=react&logoColor=white" alt="React Native"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://custom-icon-badges.demolab.com/badge/Typescript-3078C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://docs.expo.dev/"><img src="https://custom-icon-badges.demolab.com/badge/Expo-black?style=for-the-badge&logo=expo&logoColor=white" alt="Expo"></a>
</p>

---

## 🌟 Key Features

- **Multi-Provider Media Streaming**: Aggregate and stream movies, web series, and TV shows from multiple community providers.
- **Dedicated Anime & K-Drama Hubs**: Smart categorization tabs covering **Anime**, **K-Drama**, **Trending & New Releases**, **Bollywood**, **South Indian**, **Hollywood**, and **OTT Series**.
- **YouTube/Netflix-Style Half-Vertical Player**:
  - Top 16:9 video player with smooth pinch-to-zoom and gestures.
  - Bottom scrollable recommendations shelf, episode selectors, and Material 3 quick action pills.
  - One-tap switch between Half-Vertical (Portrait) and Fullscreen (Landscape).
- **Dual Picture-in-Picture (PiP) Modes**:
  - **In-App Floating PiP**: Draggable, resizable floating mini-player with clean, minimal controls (Play/Pause, Fullscreen, and Close).
  - **Android System PiP**: Smooth OS-level Picture-in-Picture triggered on swipe-to-home or navigation button press.
- **Smart Orientation Control**:
  - Dedicated orientation switch and orientation lock toggle directly inside the player overlay.
- **Dynamic Intro/Outro Skip**:
  - Skip buttons automatically detect intro/outro segments per title with configurable custom skip durations.
- **Casting & Audio/Subtitle Selection**:
  - Google Cast and DLNA with real-time remuxing, embedded audio track switching, and subtitle selection.
- **Network Resilience & Privacy**:
  - Built-in DNS-over-HTTPS (DoH), Cloudflare WARP, and ByeDPI support for circumvention and smooth playback behind ISP blocks.
- **Downloads & Offline Playback**:
  - Fast multithreaded HLS downloader and torrent streaming support.

---

## 🛠️ Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) (New Architecture ready) & [Expo Modules](https://docs.expo.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) & [Kotlin](https://kotlinlang.org/)
- **Video Engine**: [react-native-video](https://github.com/react-native-video/react-native-video) (ExoPlayer)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) & [MMKV Storage](https://github.com/mrousavy/react-native-mmkv)
- **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **Navigation**: [React Navigation](https://reactnavigation.org/)

---

## 🚀 Getting Started & Building from Source

### Prerequisites
1. Set up your React Native development environment following the [Official React Native Environment Setup Guide](https://reactnative.dev/docs/set-up-your-environment) (JDK 17+, Android SDK, and Android Studio).
2. Install Node.js (v18 or higher).

### Installation & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Ronak-Patra/D-Entertainment.git
   cd D-Entertainment
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Generate Android native project (Prebuild)**:
   ```bash
   npx expo prebuild -p android --clean
   ```

4. **Run on an Android device or emulator**:
   ```bash
   npm run android
   ```

### Building Release APKs

To build optimized release APKs:
```bash
cd android
./gradlew assembleRelease
```
The output APKs will be located at:
- `android/app/build/outputs/apk/release/d-entertainment-arm64-v8a-v1.0.0.apk`
- `android/app/build/outputs/apk/release/d-entertainment-armeabi-v7a-v1.0.0.apk`

---

## 💖 Acknowledgements & Credits

**D Entertainment** is built upon and proudly forked from the open-source **[Vega App](https://github.com/vega-org/vega-app)** developed by the [Vega Organization](https://github.com/vega-org).

Heartfelt gratitude and full credit go to the original creators, maintainers, and contributors of the Vega App for creating the exceptional architectural foundation, provider plugin system, casting remuxer, and media playback infrastructure.

---

## ⚖️ Disclaimer

> [!IMPORTANT]
> **D Entertainment does not host, store, or distribute any media content or video files.**
> This application functions strictly as a media player and aggregator frontend. All streams and metadata are provided by third-party extensions and community-maintained sources selected and configured directly by the user. The developers do not endorse and have no affiliation with any third-party content providers.

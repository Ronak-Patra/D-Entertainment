import React, {useCallback, useEffect} from 'react';
import {StyleSheet, Dimensions, View, Pressable, BackHandler} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {useInAppPlayerStore} from '../lib/zustand/inAppPlayerStore';
import Player from '../screens/home/Player';
import Orientation from 'react-native-orientation-locker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {isTV} from '../lib/tv';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const PIP_WIDTH = 280;
const PIP_HEIGHT = 158; // 16:9 aspect ratio
const PIP_MARGIN = 20;

const GlobalPlayerWrapper = () => {
  const {isOpen, isPip, setPip, closePlayer, params, isPlaying, isGlobalPip} = useInAppPlayerStore();
  const insets = useSafeAreaInsets();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pipScale = useSharedValue(1);
  const baseScale = useSharedValue(1);

  useEffect(() => {
    if (isPip) {
      Orientation.lockToPortrait();
      pipScale.value = 1;
      baseScale.value = 1;
      // Snap to bottom right corner initially
      translateX.value = withSpring(SCREEN_WIDTH - PIP_WIDTH - PIP_MARGIN);
      translateY.value = withSpring(SCREEN_HEIGHT - PIP_HEIGHT - PIP_MARGIN - insets.bottom - 60); // Account for tab bar
    } else {
      pipScale.value = 1;
      baseScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    }
  }, [isPip, insets.bottom, pipScale, baseScale, translateX, translateY]);

  useEffect(() => {
    if (!isOpen) {
      if (!isTV) {
        Orientation.lockToPortrait();
      }
      return;
    }
    const backAction = () => {
      if (isPip) {
        closePlayer();
      } else {
        setPip(true);
      }
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isOpen, isPip, closePlayer, setPip]);

  const handleToggleSize = useCallback(() => {
    if (pipScale.value > 1.05) {
      pipScale.value = withSpring(1.0);
      baseScale.value = 1.0;
    } else {
      const maxScale = Math.min(1.35, (SCREEN_WIDTH - 2 * PIP_MARGIN) / PIP_WIDTH);
      pipScale.value = withSpring(maxScale);
      baseScale.value = maxScale;
    }
  }, [baseScale, pipScale]);

  const panGesture = Gesture.Pan()
    .enabled(isPip)
    .minDistance(8)
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd((event) => {
      // Swipe down to dismiss PiP
      if (event.translationY > 100 || (event.velocityY > 500 && event.translationY > 30)) {
        translateY.value = withTiming(SCREEN_HEIGHT + 100, {duration: 250}, (finished) => {
          if (finished) {
            runOnJS(closePlayer)();
          }
        });
        return;
      }

      const scale = pipScale.value;
      const visualLeftOffset = (PIP_WIDTH * (scale - 1)) / 2;
      const visualTopOffset = (PIP_HEIGHT * (scale - 1)) / 2;

      // Snap to edges
      const midX = SCREEN_WIDTH / 2;
      const currentCenterX = translateX.value + PIP_WIDTH / 2;
      const targetX = currentCenterX > midX 
        ? SCREEN_WIDTH - PIP_WIDTH - PIP_MARGIN - visualLeftOffset 
        : PIP_MARGIN + visualLeftOffset;
        
      const minY = insets.top + PIP_MARGIN + visualTopOffset;
      const maxY = SCREEN_HEIGHT - PIP_HEIGHT - PIP_MARGIN - insets.bottom - 60 - visualTopOffset;
      const targetY = Math.max(minY, Math.min(translateY.value, maxY));

      translateX.value = withSpring(targetX, {velocity: 100});
      translateY.value = withSpring(targetY, {velocity: 100});
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(isPip)
    .onUpdate((event) => {
      const minScale = 0.75;
      const maxScale = Math.min(1.4, (SCREEN_WIDTH - 2 * PIP_MARGIN) / PIP_WIDTH);
      const newScale = Math.min(Math.max(baseScale.value * event.scale, minScale), maxScale);
      pipScale.value = newScale;
    })
    .onEnd(() => {
      baseScale.value = pipScale.value;
      const scale = pipScale.value;
      const visualLeftOffset = (PIP_WIDTH * (scale - 1)) / 2;
      const visualTopOffset = (PIP_HEIGHT * (scale - 1)) / 2;
      const midX = SCREEN_WIDTH / 2;
      const currentCenterX = translateX.value + PIP_WIDTH / 2;
      const targetX = currentCenterX > midX 
        ? SCREEN_WIDTH - PIP_WIDTH - PIP_MARGIN - visualLeftOffset 
        : PIP_MARGIN + visualLeftOffset;
      const minY = insets.top + PIP_MARGIN + visualTopOffset;
      const maxY = SCREEN_HEIGHT - PIP_HEIGHT - PIP_MARGIN - insets.bottom - 60 - visualTopOffset;
      const targetY = Math.max(minY, Math.min(translateY.value, maxY));
      translateX.value = withSpring(targetX);
      translateY.value = withSpring(targetY);
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .enabled(isPip)
    .onEnd(() => {
      if (pipScale.value > 1.05) {
        pipScale.value = withSpring(1.0);
        baseScale.value = 1.0;
      } else {
        const maxScale = Math.min(1.35, (SCREEN_WIDTH - 2 * PIP_MARGIN) / PIP_WIDTH);
        pipScale.value = withSpring(maxScale);
        baseScale.value = maxScale;
      }
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    if (isGlobalPip || !isPip) {
      return {
        transform: [{translateX: 0}, {translateY: 0}, {scale: 1}],
        width: '100%',
        height: '100%',
        borderRadius: 0,
        zIndex: 9999,
        position: 'absolute',
        top: 0,
        left: 0,
      };
    }

    return {
      transform: [
        {translateX: translateX.value},
        {translateY: translateY.value},
        {scale: pipScale.value},
      ],
      width: PIP_WIDTH,
      height: PIP_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      zIndex: 9999,
      position: 'absolute',
      top: 0,
      left: 0,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.5,
      shadowRadius: 10,
    };
  });

  if (!isOpen) return null;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={animatedStyle}>
        {/* The actual player screen */}
        <View style={StyleSheet.absoluteFill} pointerEvents={isPip && !isGlobalPip ? 'none' : 'auto'}>
          <Player key={`${params?.infoUrl || ''}-${params?.link || ''}-${params?.linkIndex ?? 0}`} />
        </View>

        {/* PIP Overlay Controls: Play/Pause, Expand, Resize, Close */}
        {isPip && !isGlobalPip && !isTV && (
          <View style={styles.pipOverlay} pointerEvents="box-none">
            {/* Top right: Fullscreen & Close */}
            <View style={styles.topActionRow}>
              <Pressable 
                style={styles.iconButton} 
                onPress={() => setPip(false)}
                hitSlop={8}
              >
                <MaterialIcons name="fullscreen" size={20} color="#FFF" />
              </Pressable>
              <Pressable 
                style={styles.iconButton} 
                onPress={() => closePlayer()}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={20} color="#FFF" />
              </Pressable>
            </View>

            {/* Center: Play / Pause */}
            <View style={styles.centerActionRow} pointerEvents="box-none">
              <Pressable 
                style={styles.playPauseButton} 
                onPress={() => {
                  const state = useInAppPlayerStore.getState();
                  state.togglePlayback?.();
                }}
                hitSlop={12}
              >
                <MaterialIcons 
                  name={isPlaying ? "pause" : "play-arrow"} 
                  size={26} 
                  color="#FFF" 
                />
              </Pressable>
            </View>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  pipOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 6,
  },
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  centerActionRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 16,
    padding: 5,
  },
  playPauseButton: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 24,
    padding: 8,
  },
});

export default GlobalPlayerWrapper;

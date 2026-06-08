/**
 * CachedImage — Drop-in replacement for React Native's Image component.
 *
 * Uses expo-image under the hood, which provides:
 *  - Automatic disk caching (persists across app restarts)
 *  - Memory caching for fast re-renders
 *  - Smooth transitions and placeholder support
 *  - Works offline once an image has been cached
 *
 * USAGE:
 *  Replace: import { Image } from 'react-native';
 *  With:    import CachedImage from './CachedImage';
 *
 *  <CachedImage source={{ uri: url }} style={styles.image} resizeMode="cover" />
 *
 * The component accepts the same props as RN Image, mapping them to expo-image equivalents.
 */

import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import { StyleProp, ImageStyle, View, ViewStyle } from 'react-native';

// Map RN resizeMode to expo-image contentFit
const RESIZE_MODE_MAP: Record<string, 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  repeat: 'cover', // no direct equivalent, use cover
  center: 'none',
};

interface CachedImageProps {
  source: { uri: string } | number; // uri object or require() result
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  placeholder?: string; // blurhash or URL
  transition?: number; // ms
  onLoad?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * CachedImage — uses expo-image with aggressive disk caching.
 *
 * Once an image is loaded (either by display or prefetch),
 * it's stored on disk and available offline.
 */
export default function CachedImage({
  source,
  style,
  resizeMode,
  contentFit,
  placeholder,
  transition = 200,
  onLoad,
  onError,
  accessibilityLabel,
  testID,
}: CachedImageProps) {
  // Resolve the source to a string URL or require number
  let resolvedSource: string | number;
  if (typeof source === 'number') {
    resolvedSource = source;
  } else if (source && typeof source === 'object' && 'uri' in source) {
    resolvedSource = source.uri;
  } else {
    resolvedSource = '';
  }

  // Resolve contentFit from resizeMode if not explicitly set
  const resolvedContentFit = contentFit || (resizeMode ? RESIZE_MODE_MAP[resizeMode] : 'cover');

  if (!resolvedSource) {
    // Return empty view with same dimensions if no source
    return <View style={style as StyleProp<ViewStyle>} />;
  }

  return (
    <ExpoImage
      source={resolvedSource}
      style={style}
      contentFit={resolvedContentFit}
      cachePolicy="disk"
      transition={transition}
      placeholder={placeholder}
      onLoad={onLoad}
      onError={onError}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      recyclingKey={typeof resolvedSource === 'string' ? resolvedSource : undefined}
    />
  );
}

/**
 * CachedImageBackground — replacement for RN's ImageBackground.
 *
 * Renders an image behind children content, like ImageBackground
 * but with expo-image's caching.
 */
export function CachedImageBackground({
  source,
  style,
  imageStyle,
  resizeMode = 'cover',
  children,
}: {
  source: { uri: string } | number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  children?: React.ReactNode;
}) {
  let resolvedSource: string | number;
  if (typeof source === 'number') {
    resolvedSource = source;
  } else if (source && typeof source === 'object' && 'uri' in source) {
    resolvedSource = source.uri;
  } else {
    resolvedSource = '';
  }

  const resolvedContentFit = RESIZE_MODE_MAP[resizeMode] || 'cover';

  return (
    <View style={style}>
      <ExpoImage
        source={resolvedSource}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          imageStyle,
        ]}
        contentFit={resolvedContentFit}
        cachePolicy="disk"
        transition={0}
      />
      {children}
    </View>
  );
}

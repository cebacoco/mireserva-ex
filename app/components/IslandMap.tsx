import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Beach } from '../lib/types';
import CachedImage from './CachedImage';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_WIDTH = SCREEN_WIDTH - 40;
const MAP_HEIGHT = Math.min(MAP_WIDTH * 1.05, 480);

// Zoom to frame the channel area where all 6 beaches are clustered
const ZOOM = 2.0;
const FOCUS_X = 0.45; // horizontal center on channel area
const FOCUS_Y = 0.38; // vertical center on channel area

interface IslandMapProps {
  beaches: Beach[];
  onBeachSelect: (beach: Beach) => void;
}

// Beach positions — mapped from reference image dots to container coordinates
// Image coords → visible area (20%-70% horiz, 13%-63% vert) → container %
const beachPositions: Record<string, { top: number; left: number }> = {
  'Coco Doble':     { top: 26, left: 70 },   // black dot — south coast, right side of channel
  'Coco Privado':   { top: 32, left: 58 },   // blue dot — south coast, left of Doble
  'Coco Loco':      { top: 44, left: 40 },   // red dot — narrow inlet on south coast
  'Coco Blanco':    { top: 48, left: 52 },   // green dot — at the channel
  'Coco Escondido': { top: 66, left: 28 },   // yellow dot — between islands, west side
  'Coco Cristal':   { top: 68, left: 52 },   // purple dot — north shore of smaller island
};

const beachColors: Record<string, string> = {
  'Coco Loco':      '#EF4444',
  'Coco Blanco':    '#22C55E',
  'Coco Escondido': '#EAB308',
  'Coco Doble':     '#1E293B',
  'Coco Privado':   '#3B82F6',
  'Coco Cristal':   '#A855F7',
};

// Animated boat — sails in the water between beach spots
function AnimatedBoat() {
  const boatAnim = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(boatAnim, {
        toValue: 1,
        duration: 28000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Boat path visits each beach area in the water (channel between islands)
  // Positions as fractions of MAP_WIDTH/MAP_HEIGHT matching the container coordinates
  const translateX = boatAnim.interpolate({
    inputRange:  [0,    0.12,  0.25,  0.38,  0.50,  0.62,  0.75,  0.88,  1],
    outputRange: [
      MAP_WIDTH * 0.78,  // start: water right of Coco Doble
      MAP_WIDTH * 0.65,  // heading toward Coco Privado
      MAP_WIDTH * 0.45,  // near Coco Loco area (in water)
      MAP_WIDTH * 0.55,  // near Coco Blanco area (in water)
      MAP_WIDTH * 0.22,  // heading to Coco Escondido (in channel)
      MAP_WIDTH * 0.48,  // near Coco Cristal (in water south)
      MAP_WIDTH * 0.65,  // heading back east through water
      MAP_WIDTH * 0.75,  // rising up on right side
      MAP_WIDTH * 0.78,  // back to start
    ],
  });

  const translateY = boatAnim.interpolate({
    inputRange:  [0,    0.12,  0.25,  0.38,  0.50,  0.62,  0.75,  0.88,  1],
    outputRange: [
      MAP_HEIGHT * 0.22,  // near Coco Doble level
      MAP_HEIGHT * 0.28,  // near Coco Privado level
      MAP_HEIGHT * 0.40,  // near Coco Loco level
      MAP_HEIGHT * 0.46,  // near Coco Blanco level
      MAP_HEIGHT * 0.62,  // near Coco Escondido level
      MAP_HEIGHT * 0.72,  // south of Coco Cristal
      MAP_HEIGHT * 0.55,  // heading back through channel
      MAP_HEIGHT * 0.35,  // rising up
      MAP_HEIGHT * 0.22,  // back to start
    ],
  });

  const bobTranslate = bobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const rotate = boatAnim.interpolate({
    inputRange:  [0,      0.12,    0.25,    0.38,    0.50,    0.62,    0.75,    0.88,    1],
    outputRange: ['200deg','210deg','220deg','160deg','200deg','30deg','350deg','330deg','200deg'],
  });

  return (
    <Animated.View
      style={[
        styles.boat,
        {
          transform: [
            { translateX },
            { translateY },
            { translateY: bobTranslate },
            { rotate },
          ],
        },
      ]}
    >
      <View style={styles.boatShadow} />
      <MaterialCommunityIcons name="sail-boat" size={20} color="#0F172A" />
    </Animated.View>
  );
}

// Animated wave dots for water effect
function WaveLines() {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wave1, { toValue: 1, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wave1, { toValue: 0, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(wave2, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wave2, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const waveX1 = wave1.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
  const waveX2 = wave2.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });
  const waveOp1 = wave1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.5, 0.2] });
  const waveOp2 = wave2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.55, 0.25] });

  return (
    <>
      {[
        { top: '10%', left: '85%', anim: waveX1, op: waveOp1 },
        { top: '35%', left: '80%', anim: waveX2, op: waveOp2 },
        { top: '55%', left: '75%', anim: waveX1, op: waveOp1 },
        { top: '20%', left: '90%', anim: waveX2, op: waveOp2 },
        { top: '75%', left: '70%', anim: waveX1, op: waveOp1 },
        { top: '5%', left: '60%', anim: waveX2, op: waveOp2 },
        { top: '85%', left: '40%', anim: waveX1, op: waveOp1 },
      ].map((w, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveMark,
            { top: w.top as any, left: w.left as any, transform: [{ translateX: w.anim }], opacity: w.op },
          ]}
        >
          <View style={styles.waveDot} />
          <View style={[styles.waveDot, { marginLeft: 3, width: 8 }]} />
        </Animated.View>
      ))}
    </>
  );
}

// Beach marker with pulse animation
function BeachMarker({
  beach,
  isSelected,
  onPress,
}: {
  beach: Beach;
  isSelected: boolean;
  onPress: () => void;
}) {
  const pos = beachPositions[beach.name] || { top: 50, left: 50 };
  const color = beachColors[beach.name] || '#0D9488';
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSelected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isSelected]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <TouchableOpacity
      style={[
        styles.marker,
        { top: `${pos.top}%` as any, left: `${pos.left}%` as any },
        isSelected && styles.markerSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Pulse ring */}
      {isSelected && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: color,
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />
      )}

      {/* Marker dot */}
      <View
        style={[
          styles.markerDot,
          { backgroundColor: color },
          isSelected && styles.markerDotSelected,
        ]}
      >
        <Ionicons name="location" size={isSelected ? 13 : 10} color="#fff" />
      </View>

      {/* Label */}
      <View style={[styles.markerLabelBg, isSelected && styles.markerLabelBgSelected]}>
        <Text style={[styles.markerLabel, isSelected && styles.markerLabelSelected]} numberOfLines={1}>
          {beach.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function IslandMap({ beaches, onBeachSelect }: IslandMapProps) {
  const [filter, setFilter] = useState<'all' | 'Coco' | 'Cristal'>('all');

  const filteredBeaches = beaches.filter(b => filter === 'all' || b.island === filter);

  const handleBeachPress = (beach: Beach) => {
    onBeachSelect(beach);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Bahía de los Cocos</Text>
      <Text style={styles.sectionSubtitle}>Tap a beach to book your boat ride</Text>

      <View style={styles.filterRow}>
        {([
          { key: 'all', label: 'All Beaches' },
          { key: 'Coco', label: 'Isla Coco' },
          { key: 'Cristal', label: 'Isla Cristal' },
        ] as const).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key as any)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mapWrapper}>
        <View style={styles.mapContainer}>
          {/* Clean illustrated island map (no reference dots) */}
          <CachedImage
            source={{ uri: 'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1771007256665_f9737b0f.png' }}
            style={styles.mapImage}
            resizeMode="cover"
          />

          {/* Subtle overlay for better marker visibility */}
          <View style={styles.mapOverlay} />

          {/* Wave animations in water areas */}
          <WaveLines />

          {/* Animated boat sailing between beaches */}
          <AnimatedBoat />

          {/* Bay label — in water area top-right */}
          <View style={styles.bayLabel}>
            <Text style={styles.bayLabelText}>BAHÍA</Text>
            <Text style={styles.bayLabelTextSub}>de los Cocos</Text>
          </View>

          {/* Island labels */}
          <View style={styles.mainIslandLabel}>
            <Text style={styles.islandLabelMain}>ISLA COCO</Text>
          </View>
          <View style={styles.cristalLabel}>
            <Text style={styles.islandLabelCristal}>ISLA CRISTAL</Text>
          </View>

          {/* Compass rose */}
          <View style={styles.compass}>
            <Text style={styles.compassN}>N</Text>
            <View style={styles.compassArrow}>
              <Ionicons name="navigate" size={14} color="#1E3A5F" />
            </View>
          </View>

          {/* Scale bar */}
          <View style={styles.scaleBar}>
            <View style={styles.scaleBarLine} />
            <Text style={styles.scaleBarText}>~200m</Text>
          </View>

          {/* Beach markers */}
          {filteredBeaches.map((beach) => (
            <BeachMarker
              key={beach.id}
              beach={beach}
              isSelected={false}
              onPress={() => handleBeachPress(beach)}
            />
          ))}
        </View>
      </View>

      {/* Color legend */}
      <View style={styles.legend}>
        {Object.entries(beachColors).map(([name, color]) => (
          <TouchableOpacity
            key={name}
            style={styles.legendItem}
            onPress={() => {
              const beach = beaches.find(b => b.name === name);
              if (beach) handleBeachPress(beach);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>
              {name.replace('Coco ', '')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0D9488',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#fff',
  },

  // Map
  mapWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#7DD3E8',
  },
  mapContainer: {
    width: '100%',
    height: MAP_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#8ECAE6',
  },
  mapImage: {
    position: 'absolute',
    width: MAP_WIDTH * ZOOM,
    height: MAP_HEIGHT * ZOOM,
    left: -(FOCUS_X * MAP_WIDTH * ZOOM - MAP_WIDTH / 2),
    top: -(FOCUS_Y * MAP_HEIGHT * ZOOM - MAP_HEIGHT / 2),
  },

  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },

  // Wave marks
  waveMark: {
    position: 'absolute',
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveDot: {
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  // Boat
  boat: {
    position: 'absolute',
    zIndex: 8,
    marginLeft: -10,
    marginTop: -10,
  },
  boatShadow: {
    position: 'absolute',
    width: 16,
    height: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
    bottom: -3,
    left: 2,
  },

  // Labels — positioned for zoomed view
  bayLabel: {
    position: 'absolute',
    top: '4%',
    right: '6%',
    alignItems: 'center',
    zIndex: 4,
  },
  bayLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(30,58,95,0.45)',
    letterSpacing: 3,
  },
  bayLabelTextSub: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(30,58,95,0.35)',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  mainIslandLabel: {
    position: 'absolute',
    top: '8%',
    left: '22%',
    zIndex: 4,
  },
  islandLabelMain: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(30,60,30,0.55)',
    letterSpacing: 3,
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cristalLabel: {
    position: 'absolute',
    top: '82%',
    left: '15%',
    zIndex: 4,
  },
  islandLabelCristal: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(30,60,30,0.55)',
    letterSpacing: 2,
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Compass
  compass: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    width: 28,
    height: 36,
    justifyContent: 'center',
    paddingTop: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  compassN: {
    fontSize: 7,
    fontWeight: '900',
    color: '#1E3A5F',
    marginBottom: -2,
  },
  compassArrow: {
    transform: [{ rotate: '-45deg' }],
  },

  // Scale bar
  scaleBar: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    alignItems: 'center',
    zIndex: 15,
  },
  scaleBarLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1,
  },
  scaleBarText: {
    fontSize: 7,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Beach markers
  marker: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
    marginLeft: -18,
    marginTop: -18,
  },
  markerSelected: {
    zIndex: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    top: -4,
    left: 0,
  },
  markerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  markerDotSelected: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  markerLabelBg: {
    backgroundColor: 'rgba(15,23,42,0.8)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  markerLabelBgSelected: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  markerLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  markerLabelSelected: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
});

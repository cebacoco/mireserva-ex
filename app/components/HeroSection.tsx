import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getConfig } from '../lib/dataService';
import { useLang } from '../lib/i18n';
import { CachedImageBackground } from './CachedImage';

interface HeroSectionProps {
  onExplorePress: () => void;
}

export default function HeroSection({ onExplorePress }: HeroSectionProps) {
  const { t } = useLang();
  const config = getConfig();
  const hero = config?.hero;

  const tagline = hero?.tagline || t('hero_tagline');
  const title = t('hero_title');
  const subtitle = t('hero_subtitle');
  const backgroundImage = hero?.background_image || 'https://d64gsuwffb70l.cloudfront.net/698b1e0a79f9514b9ba08463_1770961130876_e7bda931.jpg';
  const stats = (hero?.stats && hero.stats.length > 0)
    ? hero.stats.map((s, i) => ({
        number: s.number,
        label: i === 0 ? t('stat_beaches') : i === 1 ? t('stat_activities') : t('stat_islands'),
      }))
    : [
        { number: '6', label: t('stat_beaches') },
        { number: '9', label: t('stat_activities') },
        { number: '2', label: t('stat_islands') },
      ];

  return (
    <CachedImageBackground
      source={{ uri: backgroundImage }}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.logoContainer}>
            <Ionicons name="boat" size={28} color="#fff" />
            <Text style={styles.logoText}>Cebaco Bay</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.tagline}>{tagline}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <TouchableOpacity style={styles.ctaButton} onPress={onExplorePress} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{t('hero_cta')}</Text>
            <Ionicons name="arrow-down" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <Text style={styles.statNumber}>{stat.number}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </CachedImageBackground>
  );

}

const styles = StyleSheet.create({
  container: { width: '100%', minHeight: 520 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  content: { flex: 1, justifyContent: 'center', paddingVertical: 20 },
  tagline: {
    color: '#5EEAD4', fontSize: 12, fontWeight: '700',
    letterSpacing: 3, marginBottom: 8,
  },
  title: {
    color: '#fff', fontSize: 38, fontWeight: '900',
    lineHeight: 44, marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14,
    lineHeight: 22, marginBottom: 24, maxWidth: 340,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0D9488',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statItem: { alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 28, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 2 },
});

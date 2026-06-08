import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Activity } from '../lib/types';
import { ACTIVITY_GALLERY } from '../lib/dataService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width > 600 ? (width - 60) / 2 : width - 40;
const IMAGE_HEIGHT = 180;

interface ActivityCardProps {
  activity: Activity;
  spotsRemaining?: number;
  onBook: (activity: Activity) => void;
}

const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
  Fishing: { bg: '#EFF6FF', text: '#2563EB', icon: 'fish' },
  'Water Sports': { bg: '#F0FDFA', text: '#0D9488', icon: 'water' },
  Wellness: { bg: '#FDF4FF', text: '#A855F7', icon: 'fitness' },
  Experience: { bg: '#FFF7ED', text: '#EA580C', icon: 'leaf' },
};

export default function ActivityCard({ activity, spotsRemaining, onBook }: ActivityCardProps) {
  const catStyle = categoryColors[activity.category] || categoryColors['Experience'];
  const gallery = ACTIVITY_GALLERY[activity.id];
  const hasGallery = gallery && gallery.length > 1;
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handleImageScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / CARD_WIDTH);
    if (index !== activeImageIndex && index >= 0 && index < (gallery?.length || 1)) {
      setActiveImageIndex(index);
    }
  };

  return (
    <View style={styles.card}>
      {/* Image area - gallery or single */}
      {hasGallery ? (
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleImageScroll}
            scrollEventThrottle={16}
            style={styles.imageScroll}
          >
            {gallery.map((url, idx) => (
              <Image key={idx} source={{ uri: url }} style={styles.galleryImage} />
            ))}
          </ScrollView>
          {/* Gallery dots */}
          <View style={styles.dotsContainer}>
            {gallery.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === activeImageIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
          {/* Photo count badge */}
          <View style={styles.photoCountBadge}>
            <Ionicons name="images" size={12} color="#fff" />
            <Text style={styles.photoCountText}>{activeImageIndex + 1}/{gallery.length}</Text>
          </View>
        </View>
      ) : (
        <Image source={{ uri: activity.image_url }} style={styles.image} />
      )}

      <View style={[styles.categoryBadge, { backgroundColor: catStyle.bg }]}>
        <Ionicons name={catStyle.icon as any} size={12} color={catStyle.text} />
        <Text style={[styles.categoryText, { color: catStyle.text }]}>
          {activity.category}
        </Text>
      </View>

      <View style={styles.priceBadge}>
        <Text style={styles.priceText}>${Number(activity.price)}</Text>
        <Text style={styles.perPersonText}>/person</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{activity.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {activity.description}
        </Text>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>{activity.duration}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>Max {activity.max_participants}</Text>
          </View>
        </View>

        {spotsRemaining !== undefined && (
          <View style={styles.spotsContainer}>
            <View style={styles.spotsBar}>
              <View
                style={[
                  styles.spotsFill,
                  {
                    width: `${Math.max(0, Math.min(100, (spotsRemaining / activity.max_participants) * 100))}%`,
                    backgroundColor: spotsRemaining > 3 ? '#10B981' : spotsRemaining > 0 ? '#F59E0B' : '#EF4444',
                  },
                ]}
              />
            </View>
            <Text style={[styles.spotsText, {
              color: spotsRemaining > 3 ? '#10B981' : spotsRemaining > 0 ? '#F59E0B' : '#EF4444'
            }]}>
              {spotsRemaining} spots left today
            </Text>
          </View>
        )}

        <View style={styles.equipmentRow}>
          {activity.equipment.slice(0, 3).map((item, idx) => (
            <View key={idx} style={styles.equipChip}>
              <Text style={styles.equipText}>{item}</Text>
            </View>
          ))}
          {activity.equipment.length > 3 && (
            <View style={styles.equipChip}>
              <Text style={styles.equipText}>+{activity.equipment.length - 3}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.bookButton, !activity.available && styles.bookButtonDisabled]}
          onPress={() => onBook(activity)}
          activeOpacity={0.8}
          disabled={!activity.available}
        >
          <Ionicons name="calendar" size={16} color="#fff" />
          <Text style={styles.bookText}>
            {activity.available ? 'Book Now' : 'Sold Out'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  imageContainer: {
    position: 'relative',
  },
  imageScroll: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  galleryImage: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    resizeMode: 'cover',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priceText: {
    color: '#5EEAD4',
    fontSize: 18,
    fontWeight: '800',
  },
  perPersonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '500',
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  spotsContainer: {
    marginBottom: 10,
  },
  spotsBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  spotsFill: {
    height: '100%',
    borderRadius: 2,
  },
  spotsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  equipmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  equipChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  equipText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  bookButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  bookText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

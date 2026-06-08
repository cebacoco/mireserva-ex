import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuItem } from '../lib/types';

interface MenuItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
}

const categoryEmoji: Record<string, string> = {
  Seafood: 'fish',
  Tacos: 'restaurant',
  Drinks: 'cafe',
  Desserts: 'ice-cream',
  Mains: 'flame',
};

export default function MenuItemCard({ item, onAddToCart }: MenuItemCardProps) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: item.image_url }} style={styles.image} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>

        </View>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.footer}>
          <View style={styles.tagsRow}>
            {item.dietary_tags.slice(0, 2).map((tag, idx) => (
              <View key={idx} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAddToCart(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  image: {
    width: 100,
    height: 100,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D9488',
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tagChip: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 9,
    color: '#16A34A',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  addButton: {
    backgroundColor: '#0D9488',
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

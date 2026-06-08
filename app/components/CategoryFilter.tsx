import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CategoryFilterProps {
  categories: { key: string; label: string; icon?: string }[];
  selected: string;
  onSelect: (key: string) => void;
}

export default function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((cat) => {
        const isActive = selected === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onSelect(cat.key)}
            activeOpacity={0.7}
          >
            {cat.icon && (
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={isActive ? '#fff' : '#64748B'}
              />
            )}
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#0D9488',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: '#fff',
  },
});

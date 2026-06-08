import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLang } from '../lib/i18n';

const { width } = Dimensions.get('window');

interface EnhanceTripOverlayProps {
  beachName: string;
  tripDate: string;
  onAddFood: () => void;
  onAddOvernight: () => void;
  onAddWaterActivities: () => void;
  onAddJungleWorkshops: () => void;
  onAddFishing: () => void;
  onGoToCheckout: () => void;
  onDismiss: () => void;
}

const ENHANCE_OPTIONS = [
  {
    key: 'food',
    titleKey: 'enhance_food',
    subtitleKey: 'enhance_food_sub',
    icon: 'restaurant',
    iconLib: 'ion' as const,
    color: '#EA580C',
    bgColor: '#FFF7ED',
  },
  {
    key: 'overnight',
    titleKey: 'enhance_overnight',
    subtitleKey: 'enhance_overnight_sub',
    icon: 'sleep',
    iconLib: 'mci' as const,
    color: '#7C3AED',
    bgColor: '#F5F3FF',
  },
  {
    key: 'water',
    titleKey: 'enhance_water',
    subtitleKey: 'enhance_water_sub',
    icon: 'water',
    iconLib: 'ion' as const,
    color: '#0891B2',
    bgColor: '#ECFEFF',
  },
  {
    key: 'island',
    titleKey: 'enhance_island',
    subtitleKey: 'enhance_island_sub',
    icon: 'leaf',
    iconLib: 'ion' as const,
    color: '#16A34A',
    bgColor: '#F0FDF4',
  },
  {
    key: 'fishing',
    titleKey: 'enhance_fishing',
    subtitleKey: 'enhance_fishing_sub',
    icon: 'fish',
    iconLib: 'ion' as const,
    color: '#2563EB',
    bgColor: '#EFF6FF',
  },
];

export default function EnhanceTripOverlay({
  beachName,
  tripDate,
  onAddFood,
  onAddOvernight,
  onAddWaterActivities,
  onAddJungleWorkshops,
  onAddFishing,
  onGoToCheckout,
  onDismiss,
}: EnhanceTripOverlayProps) {
  const { t } = useLang();

  const handlers: Record<string, () => void> = {
    food: onAddFood,
    overnight: onAddOvernight,
    water: onAddWaterActivities,
    island: onAddJungleWorkshops,
    fishing: onAddFishing,
  };

  return (
    <View style={styles.container}>
      {/* Success header */}
      <View style={styles.successHeader}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={28} color="#10B981" />
        </View>
        <View style={styles.successInfo}>
          <Text style={styles.successTitle}>{t('boat_trip_booked')}</Text>
          <Text style={styles.successSub}>{beachName} · {tripDate}</Text>
        </View>
      </View>

      {/* Enhance prompt */}
      <View style={styles.enhancePrompt}>
        <MaterialCommunityIcons name="star-four-points" size={16} color="#D97706" />
        <Text style={styles.enhanceText}>
          {t('make_trip_better')}
        </Text>
      </View>

      {/* Options grid */}
      <View style={styles.optionsGrid}>
        {ENHANCE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={styles.optionCard}
            onPress={handlers[opt.key]}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: opt.bgColor }]}>
              {opt.iconLib === 'ion' ? (
                <Ionicons name={opt.icon as any} size={20} color={opt.color} />
              ) : (
                <MaterialCommunityIcons name={opt.icon as any} size={20} color={opt.color} />
              )}
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>{t(opt.titleKey)}</Text>
              <Text style={styles.optionSub}>{t(opt.subtitleKey)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={onGoToCheckout} activeOpacity={0.8}>
          <Ionicons name="cart" size={18} color="#fff" />
          <Text style={styles.checkoutText}>{t('go_to_checkout')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.dismissText}>{t('continue_browsing')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#D1FAE5',
    overflow: 'hidden',
  },

  // Success header
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  successIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successInfo: {
    flex: 1,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  successSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
    fontWeight: '500',
  },

  // Enhance prompt
  enhancePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  enhanceText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Options
  optionsGrid: {
    padding: 12,
    gap: 6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Actions
  actions: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
});

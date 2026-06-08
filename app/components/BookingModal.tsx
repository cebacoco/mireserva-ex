import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Activity } from '../lib/types';
import { useCart } from '../lib/cartStore';

interface BookingModalProps {
  visible: boolean;
  activity: Activity | null;
  onClose: () => void;
  onSuccess: () => void;
}

const getNextDays = (count: number): { label: string; value: string }[] => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push({ label, value: d.toISOString().split('T')[0] });
  }
  return days;
};

export default function BookingModal({ visible, activity, onClose, onSuccess }: BookingModalProps) {
  const { addItem } = useCart();
  const [selectedDate, setSelectedDate] = useState(0);
  const [participants, setParticipants] = useState(1);

  const days = getNextDays(7);

  if (!activity) return null;

  const activityPrice = Number(activity.price) || 0;
  const totalPrice = activityPrice * participants;

  const handleAddToCart = () => {
    addItem({
      id: `activity-${activity.id}-${days[selectedDate].value}-${Date.now()}`,
      type: 'activity',
      name: `${activity.name} - ${days[selectedDate].label}`,
      price: activityPrice,
      quantity: participants,
      date: days[selectedDate].value,
      participants,
      image_url: activity.image_url,
    });

    setParticipants(1);
    setSelectedDate(0);
    onSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{activity.name}</Text>
              <Text style={styles.subtitle}>{activity.category} - {activity.duration}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll}>
              {days.map((day, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dateChip, selectedDate === idx && styles.dateChipActive]}
                  onPress={() => setSelectedDate(idx)}
                >
                  <Text style={[styles.dateText, selectedDate === idx && styles.dateTextActive]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Participants</Text>
            <View style={styles.participantRow}>
              <TouchableOpacity
                style={styles.participantBtn}
                onPress={() => setParticipants(Math.max(1, participants - 1))}
              >
                <Ionicons name="remove" size={20} color="#0D9488" />
              </TouchableOpacity>
              <View style={styles.participantCount}>
                <Text style={styles.participantNumber}>{participants}</Text>
                <Text style={styles.participantLabel}>
                  {participants === 1 ? 'person' : 'people'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.participantBtn}
                onPress={() => setParticipants(Math.min(activity.max_participants, participants + 1))}
              >
                <Ionicons name="add" size={20} color="#0D9488" />
              </TouchableOpacity>
            </View>
            <Text style={styles.maxText}>Max {activity.max_participants} participants</Text>

            {activity.equipment && activity.equipment.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Equipment Included</Text>
                <View style={styles.equipGrid}>
                  {activity.equipment.map((item, idx) => (
                    <View key={idx} style={styles.equipItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.equipItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.priceDisplay}>
              <Text style={styles.priceLabel}>Total</Text>
              <Text style={styles.priceAmount}>${totalPrice.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={handleAddToCart} activeOpacity={0.8}>
              <Ionicons name="cart" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    marginTop: 8,
  },
  datesScroll: {
    marginBottom: 20,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  dateChipActive: {
    backgroundColor: '#0D9488',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  dateTextActive: {
    color: '#fff',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 6,
  },
  participantBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantCount: {
    alignItems: 'center',
  },
  participantNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
  },
  participantLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  maxText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  equipGrid: {
    gap: 8,
    marginBottom: 20,
  },
  equipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  equipItemText: {
    fontSize: 13,
    color: '#475569',
    textTransform: 'capitalize',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  priceDisplay: {},
  priceLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

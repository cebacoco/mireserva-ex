import React from 'react';
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
import { Beach, AvailabilityData } from '../lib/types';

interface PrivacyDashboardProps {
  visible: boolean;
  onClose: () => void;
  beaches: Beach[];
  availability: AvailabilityData | null;
  lastUpdated: string;
}

function getOccupancyColor(percent: number): string {
  if (percent < 40) return '#10B981';
  if (percent < 70) return '#F59E0B';
  return '#EF4444';
}

function getOccupancyLabel(percent: number): string {
  if (percent < 40) return 'Peaceful';
  if (percent < 70) return 'Moderate';
  return 'Busy';
}

export default function PrivacyDashboard({
  visible,
  onClose,
  beaches,
  availability,
  lastUpdated,
}: PrivacyDashboardProps) {
  const totalGuests = beaches.reduce((sum, b) => sum + b.current_occupancy, 0);
  const totalCapacity = beaches.reduce((sum, b) => sum + b.capacity, 0);
  const overallOccupancy = totalCapacity > 0 ? Math.round((totalGuests / totalCapacity) * 100) : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Privacy Dashboard</Text>
              <Text style={styles.subtitle}>Real-time beach occupancy</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Overall stats */}
            <View style={styles.overallCard}>
              <View style={styles.overallCircle}>
                <Text style={styles.overallPercent}>{overallOccupancy}%</Text>
                <Text style={styles.overallLabel}>Overall</Text>
              </View>
              <View style={styles.overallStats}>
                <View style={styles.overallStat}>
                  <Text style={styles.overallStatNumber}>{totalGuests}</Text>
                  <Text style={styles.overallStatLabel}>Current Guests</Text>
                </View>
                <View style={styles.overallStat}>
                  <Text style={styles.overallStatNumber}>{totalCapacity}</Text>
                  <Text style={styles.overallStatLabel}>Total Capacity</Text>
                </View>
                <View style={styles.overallStat}>
                  <Text style={styles.overallStatNumber}>{beaches.length}</Text>
                  <Text style={styles.overallStatLabel}>Beaches</Text>
                </View>
              </View>
            </View>

            {/* Per-beach charts */}
            <Text style={styles.sectionTitle}>Beach Occupancy</Text>
            {beaches.map((beach) => {
              const percent = beach.capacity > 0 ? Math.round((beach.current_occupancy / beach.capacity) * 100) : 0;
              const color = getOccupancyColor(percent);
              return (
                <View key={beach.id} style={styles.beachRow}>
                  <View style={styles.beachNameRow}>
                    <Text style={styles.beachName}>{beach.name}</Text>
                    <View style={[styles.islandTag, { backgroundColor: beach.island === 'Cristal' ? '#EFF6FF' : '#F0FDFA' }]}>
                      <Text style={[styles.islandTagText, { color: beach.island === 'Cristal' ? '#2563EB' : '#0D9488' }]}>
                        {beach.island === 'Cristal' ? 'Isla Cristal' : 'Isla Coco'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.barContainer}>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.barPercent, { color }]}>{percent}%</Text>
                  </View>
                  <View style={styles.beachMeta}>
                    <Text style={styles.beachMetaText}>
                      {beach.current_occupancy}/{beach.capacity} guests
                    </Text>
                    <View style={[styles.statusDot, { backgroundColor: color }]} />
                    <Text style={[styles.statusText, { color }]}>
                      {getOccupancyLabel(percent)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Boat availability */}
            {availability?.boats && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Boat Status</Text>
                <View style={styles.boatGrid}>
                  {Object.entries(availability.boats).map(([key, value]) => {
                    const label = key.replace(/_/g, ' ').replace('spots remaining', '').replace('running', '');
                    const isBoolean = value === 'true' || value === 'false';
                    return (
                      <View key={key} style={styles.boatCard}>
                        <Ionicons
                          name={isBoolean ? (value === 'true' ? 'checkmark-circle' : 'close-circle') : 'boat'}
                          size={20}
                          color={isBoolean ? (value === 'true' ? '#10B981' : '#EF4444') : '#0D9488'}
                        />
                        <Text style={styles.boatLabel}>{label.trim()}</Text>
                        <Text style={styles.boatValue}>
                          {isBoolean ? (value === 'true' ? 'Running' : 'Down') : `${value} spots`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Reservation stats */}
            {availability?.reservations && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Today's Reservations</Text>
                <View style={styles.resCard}>
                  <View style={styles.resStat}>
                    <Text style={styles.resNumber}>{availability.reservations.total_today || '0'}</Text>
                    <Text style={styles.resLabel}>Today</Text>
                  </View>
                  <View style={styles.resDivider} />
                  <View style={styles.resStat}>
                    <Text style={styles.resNumber}>{availability.reservations.total_tomorrow || '0'}</Text>
                    <Text style={styles.resLabel}>Tomorrow</Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.updateInfo}>
              <Ionicons name="time-outline" size={14} color="#94A3B8" />
              <Text style={styles.updateText}>Last updated: {lastUpdated}</Text>
            </View>
          </ScrollView>
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
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
  overallCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  overallCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  overallPercent: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5EEAD4',
  },
  overallLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  overallStats: {
    flex: 1,
    gap: 8,
  },
  overallStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overallStatNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  overallStatLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  beachRow: {
    marginBottom: 16,
  },
  beachNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  beachName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  islandTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  islandTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barPercent: {
    fontSize: 13,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  beachMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  beachMetaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  boatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  boatCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    width: '47%',
    alignItems: 'center',
    gap: 4,
  },
  boatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  boatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  resCard: {
    flexDirection: 'row',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'center',
    gap: 30,
  },
  resStat: {
    alignItems: 'center',
  },
  resNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0D9488',
  },
  resLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  resDivider: {
    width: 1,
    backgroundColor: '#D1FAE5',
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 10,
  },
  updateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

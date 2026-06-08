import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useCart } from './lib/cartStore';
import { Beach, Activity, AvailabilityData } from './lib/types';
import { fetchBeaches, fetchActivities, fetchAvailability, FISHING_ACTIVITY_IDS, loadConfig, getConfig, getLastFetchError, getConfigDebugInfo, getRawINI, forceReload, smartRefresh } from './lib/dataService';

import { AppConfig } from './lib/configParser';
import { useLang } from './lib/i18n';
import { initSync, syncNow, stopSync } from './lib/syncService';



import { loadBookings, addBooking, StoredBooking } from './lib/bookingStorage';
import { prefetchAllImages, getCacheStatus } from './lib/imageCache';



import HeroSection from './components/HeroSection';
import BookingModal from './components/BookingModal';
import CartSidebar from './components/CartSidebar';
import IslandMap from './components/IslandMap';
import PrivacyDashboard from './components/PrivacyDashboard';
import BeachDetailModal from './components/BeachDetailModal';
import Toast from './components/Toast';
import SectionHeader from './components/SectionHeader';
import FooterSection from './components/FooterSection';

import ActivityIconGrid from './components/ActivityIconGrid';
import BeachBookingCard from './components/BeachBookingCard';
import ActivityTabsSection from './components/ActivityTabsSection';
import BookingHistoryModal, { BookingRecord } from './components/BookingHistoryModal';




// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// CONFIG SOURCE (hardcoded in configService.ts):
//   https://raw.githubusercontent.com/cebacoco/configs/main/cebacoco-config.ini
//
// CACHING: Platform-aware cache:
//   - WEB: IndexedDB (async, large quota, proper database)
//   - NATIVE: expo-file-system (documentDirectory)
//   - Remote newer → fetch + cache update
//   - Same timestamp → use cache (fast)
//   - Fetch failed + cache exists → use cache
//   - Fetch failed + no cache → error screen (NO FALLBACKS)
// ═══════════════════════════════════════════════════════════════

// ─── Main Screen ───
export default function MainScreen() {
  const { addItem, totalItems } = useCart();
  const scrollRef = useRef<ScrollView>(null);
  const { lang, setLang: setLanguage, t } = useLang();

  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [configRefreshKey, setConfigRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadErrorMsg, setLoadErrorMsg] = useState('');
  const [configVerification, setConfigVerification] = useState<string[]>([]);



  const [refreshing, setRefreshing] = useState(false);
  const [configChangedSections, setConfigChangedSections] = useState<string[]>([]);

  const [bookingActivity, setBookingActivity] = useState<Activity | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [beachDetailVisible, setBeachDetailVisible] = useState(false);
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [beachPreselectedForBooking, setBeachPreselectedForBooking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const [preselectedInshore, setPreselectedInshore] = useState(false);
  const [inshoreTrigger, setInshoreTrigger] = useState(0);
  const [preselectedChillGym, setPreselectedChillGym] = useState(false);
  const [chillGymTrigger, setChillGymTrigger] = useState(0);

  // Booking history state (local only)
  const [bookingHistory, setBookingHistory] = useState<BookingRecord[]>([]);
  const [bookingHistoryVisible, setBookingHistoryVisible] = useState(false);

  // Activity tabs state - default to 'water'
  const [activeActivityTab, setActiveActivityTab] = useState('water');

  const [scrollTarget, setScrollTarget] = useState<string | undefined>(undefined);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const [beachSectionY, setBeachSectionY] = useState(0);
  const [activitySectionY, setActivitySectionY] = useState(0);
  const [bookingCardY, setBookingCardY] = useState(0);

  // Preselected beach for booking (from map click)
  const [preselectedBeachId, setPreselectedBeachId] = useState<number | null>(null);


  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message); setToastType(type); setToastVisible(true);
  }, []);

  // Load booking history from IndexedDB (web) or memory (native) on mount
  useEffect(() => {
    loadBookings().then(stored => {
      if (stored.length > 0) {
        setBookingHistory(stored as BookingRecord[]);
      }
    });
  }, []);


  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
      setLoadErrorMsg('');
      setConfigVerification([]);

      // 1. Load config — fetches from GitHub, compares timestamps with cache
      //    If cache exists + timestamps match → uses cache (fast)
      //    If remote newer → fetches + updates cache
      //    If fetch fails + cache exists → uses cache (offline)
      //    If fetch fails + no cache → returns null → error screen
      const configResult = await loadConfig();
      
      // Store verification results
      if (configResult.verification && configResult.verification.length > 0) {
        setConfigVerification(configResult.verification);
      }

      // Track if loaded from cache
      setLoadedFromCache(configResult.fromCache);

      if (!configResult.config) {
        // Both GitHub fetch AND cache failed → show error
        console.error('[App] Config is NULL — no remote + no cache. App will NOT load.');
        console.error('[App] Error:', configResult.error);
        setLoadErrorMsg(configResult.error || 'Unknown error — config returned null');
        setLoadError(true);
        setLoading(false);
        return;
      }

      // Log cache vs fresh
      if (configResult.fromCache) {
        console.log('[App] Config loaded from LOCAL CACHE (timestamp matched or fetch failed)');
      } else {
        console.log('[App] Config loaded FRESH from GitHub (new or updated)');
      }

      setAppConfig(configResult.config);
      // Increment refresh key so child components re-read config data from useMemo
      setConfigRefreshKey(prev => prev + 1);
      setConfigChangedSections(configResult.changedSections);
      if (configResult.changedSections.length > 0 && !configResult.fromCache) {
        console.log('[App] Config updated sections:', configResult.changedSections.join(', '));
        showToast('Config updated!', 'info');
      }


      // 2. Fetch data (from config)
      const [beachData, activityData, availData] = await Promise.all([
        fetchBeaches(), fetchActivities(), fetchAvailability(),
      ]);
      setBeaches(beachData); setActivities(activityData);
      setAvailability(availData); setLastUpdated(new Date().toLocaleTimeString());
      if (availData?.beaches) {
        setBeaches(prev => prev.map(beach => {
          const key = beach.name.toLowerCase().replace(/\s+/g, '_').replace(/á/g, 'a').replace(/í/g, 'i') + '_occupancy';
          const occ = availData.beaches[key];
          return occ ? { ...beach, current_occupancy: parseInt(occ) } : beach;
        }));
      }

      // 3. Prefetch images
      if (configResult.config) {
        prefetchAllImages(configResult.config).then(result => {
          console.log(`[App] Image prefetch: ${result.cached} new, ${result.alreadyCached} cached, ${result.failed} failed (${result.total} total)`);
        }).catch(err => {
          console.warn('[App] Image prefetch error (non-fatal):', err);
        });
      }

    } catch (err) {
      console.error('[App] loadData error:', err);
      setLoadError(true);
      setLoadErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);



  // Initialize sync service on mount
  useEffect(() => {
    initSync();
    return () => stopSync();
  }, []);


  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const i = setInterval(() => loadData(), 5 * 60 * 1000); return () => clearInterval(i); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Smart refresh: clear in-memory cache only, preserve filesystem timestamps
    // This way fetchConfig() re-fetches from GitHub and compares timestamps properly
    // Only sections with NEWER timestamps get updated, others keep cached data
    smartRefresh();
    await loadData();
    setRefreshing(false);
    showToast(t('data_refreshed'), 'info');
  }, [loadData, showToast]);

  // Manual refresh from footer icon — smart refresh (timestamp-based selective reload)
  const handleFooterRefresh = useCallback(async () => {
    // Smart refresh: preserves filesystem cache timestamps for proper comparison
    // Only reloads sections where remote timestamp is NEWER than cached timestamp
    smartRefresh();
    await loadData();
    showToast(t('data_refreshed'), 'info');
  }, [loadData, showToast]);




  // Map beach click → scroll to Book the Boat
  const handleMapBeachSelect = useCallback((beach: Beach) => {
    setPreselectedBeachId(beach.id);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: bookingCardY, animated: true });
    }, 100);
  }, [bookingCardY]);

  const handleBeachPressFromBooking = (beach: Beach) => { setSelectedBeach(beach); setBeachPreselectedForBooking(false); setBeachDetailVisible(true); };

  const handleBookActivity = (activity: Activity) => { setBookingActivity(activity); setBookingModalVisible(true); };
  const handleBookingSuccess = () => { showToast(t('added_adventure'), 'success'); };

  // Inshore fishing → redirect to boat booking with inshore pre-checked
  const handleBookInshore = useCallback(() => {
    setPreselectedInshore(true);
    setInshoreTrigger(prev => prev + 1);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: bookingCardY, animated: true });
    }, 100);
  }, [bookingCardY]);

  // Chill & Gym → redirect to boat booking with chill&gym pre-checked
  const handleBookChillGym = useCallback(() => {
    setPreselectedChillGym(true);
    setChillGymTrigger(prev => prev + 1);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: bookingCardY, animated: true });
    }, 100);
  }, [bookingCardY]);


  // Handle completed booking from CartSidebar - save to IndexedDB (web) or memory (native)
  const handleBookingComplete = useCallback((booking: {
    confirmationNumber: string;
    customerName: string;
    customerEmail: string;
    customerWhatsapp: string;
    items: { name: string; price: number; quantity: number; date?: string | null }[];
    total: number;
    emailSent: boolean;
  }) => {
    const record: BookingRecord = {
      id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      confirmationNumber: booking.confirmationNumber,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerWhatsapp: booking.customerWhatsapp,
      items: booking.items,
      total: booking.total,
      date: new Date().toISOString(),
      emailSent: booking.emailSent,
    };
    // addBooking is async (IndexedDB on web) — fire and update state when done
    addBooking(record as StoredBooking).then(updated => {
      setBookingHistory(updated as BookingRecord[]);
    });
  }, []);



  const fishingActivities = useMemo(() => activities.filter(a => FISHING_ACTIVITY_IDS.includes(a.id)), [activities]);

  // Handle tab switch from icon grid - supports sub-targets
  const handleTabSwitch = useCallback((tab: string, subTarget?: string) => {
    setActiveActivityTab(tab);
    setScrollTarget(subTarget);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: activitySectionY + 120, animated: true });
    }, 100);
  }, [activitySectionY]);

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <Ionicons name="boat" size={48} color="#0D9488" />
        <Text style={s.loadingText}>Loading Cebaco Bay...</Text>
        <Text style={s.loadingSubtext}>Fetching config from GitHub...</Text>
        <Text style={s.loadingUrl}>raw.githubusercontent.com/cebacoco/configs/main/cebacoco-config.ini</Text>
        <View style={s.loadingDots}>
          <View style={[s.dot, { backgroundColor: '#0D9488' }]} />
          <View style={[s.dot, { backgroundColor: '#14B8A6' }]} />
          <View style={[s.dot, { backgroundColor: '#5EEAD4' }]} />
        </View>
      </View>
    );
  }


  // ═══════════════════════════════════════════════════════════════
  // ERROR STATE — GitHub fetch failed, NO fallback, app does NOT proceed
  // ═══════════════════════════════════════════════════════════════
  if (loadError || !appConfig) {
    const errDetail = loadErrorMsg || getLastFetchError() || 'No error details available';
    const debugInfo = getConfigDebugInfo();
    return (
      <View style={s.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
        <Text style={[s.loadingText, { color: '#EF4444' }]}>Failed to Load Config</Text>
        <Text style={s.errorSubtext}>Could not fetch config from GitHub.</Text>
        <Text style={s.errorSubtext}>App cannot proceed without remote config.</Text>
        
        {/* Debug info box */}
        <View style={s.debugBox}>
          <Text style={s.debugLabel}>SOURCE URL</Text>
          <Text style={s.debugValue} selectable>
            {debugInfo.url || 'raw.githubusercontent.com/cebacoco/configs/main/cebacoco-config.ini'}
          </Text>

          <Text style={s.debugLabel}>ERROR</Text>
          <Text style={[s.debugValue, { color: '#FCA5A5' }]} selectable>
            {errDetail}
          </Text>

          {debugInfo.rawLength > 0 && (
            <>
              <Text style={s.debugLabel}>RAW RESPONSE ({debugInfo.rawLength} bytes)</Text>
              <Text style={s.debugValue} selectable>
                {debugInfo.rawFirst200}
              </Text>
            </>
          )}

          {configVerification.length > 0 && (
            <>
              <Text style={s.debugLabel}>VERIFICATION CHECKS</Text>
              {configVerification.map((check, i) => (
                <Text key={i} style={[s.debugValue, { 
                  color: check.includes('✓') ? '#86EFAC' : '#FCA5A5',
                  marginBottom: 2,
                }]}>
                  {check}
                </Text>
              ))}
            </>
          )}
        </View>

        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => {
            forceReload(); // Clear all caches first
            setLoading(true);
            setLoadError(false);
            setLoadErrorMsg('');
            setConfigVerification([]);
            loadData();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>

        
        <Text style={s.errorHint}>
          Check that the GitHub repo is public and the file exists.{'\n'}
          No local config file — everything loads from GitHub.{'\n'}
          Open browser console for detailed logs.
        </Text>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN APP — only renders if config loaded successfully from GitHub
  // ═══════════════════════════════════════════════════════════════

  return (
    <View style={s.container}>
      {/* ─── Floating Language Selector ─── */}
      <TouchableOpacity
        style={s.floatingLangBtn}
        onPress={() => setLanguage(lang === 'es' ? 'en' : 'es')}
        activeOpacity={0.7}
      >
        <Text style={s.flagText}>{lang === 'es' ? 'ES' : 'EN'}</Text>
        <Ionicons name="globe-outline" size={12} color="#fff" style={{ marginLeft: 2 }} />
      </TouchableOpacity>

      {/* ─── Floating Booking History Icon ─── */}
      <TouchableOpacity
        style={s.floatingHistoryBtn}
        onPress={() => setBookingHistoryVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="receipt-outline" size={18} color="#fff" />
        {bookingHistory.length > 0 && (
          <View style={s.historyBadge}>
            <Text style={s.historyBadgeText}>{bookingHistory.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />}>

        <HeroSection onExplorePress={() => scrollRef.current?.scrollTo({ y: beachSectionY, animated: true })} />

        <View style={s.quickActions}>
          <TouchableOpacity style={s.quickAction} onPress={() => { setActiveActivityTab('overnight'); handleTabSwitch('overnight'); }}>
            <View style={[s.qaIcon, { backgroundColor: '#F5F3FF' }]}><MaterialCommunityIcons name="sleep" size={20} color="#7C3AED" /></View>
            <Text style={s.qaText}>{t('qa_overnight')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickAction} onPress={() => { setActiveActivityTab('food'); handleTabSwitch('food'); }}>
            <View style={[s.qaIcon, { backgroundColor: '#FFF7ED' }]}><Ionicons name="restaurant" size={20} color="#EA580C" /></View>
            <Text style={s.qaText}>{t('qa_food')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickAction} onPress={() => { setActiveActivityTab('water'); handleTabSwitch('water'); }}>
            <View style={[s.qaIcon, { backgroundColor: '#ECFEFF' }]}><Ionicons name="water" size={20} color="#0891B2" /></View>
            <Text style={s.qaText}>{t('qa_activities')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickAction} onPress={() => { setActiveActivityTab('fishing'); handleTabSwitch('fishing'); }}>
            <View style={[s.qaIcon, { backgroundColor: '#EFF6FF' }]}><MaterialCommunityIcons name="fish" size={20} color="#2563EB" /></View>
            <Text style={s.qaText}>{t('qa_fishing')}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── BEACH SECTION (Map only) ─── */}
        <View onLayout={(e) => setBeachSectionY(e.nativeEvent.layout.y)}>
          <IslandMap beaches={beaches} onBeachSelect={handleMapBeachSelect} />
        </View>

        {/* ─── ACTIVITIES SECTION (with tabs) ─── */}
        <View onLayout={(e) => setActivitySectionY(e.nativeEvent.layout.y)}>
          <SectionHeader title={t('section_activities_title')} subtitle={t('section_activities_subtitle')} icon="compass" />
          
          <ActivityIconGrid
            onTabSwitch={handleTabSwitch}
            activeTab={activeActivityTab}
          />

          <ActivityTabsSection
            activeTab={activeActivityTab}
            onTabChange={setActiveActivityTab}
            fishingActivities={fishingActivities}
            onBookActivity={handleBookActivity}
            showToast={showToast}
            scrollTarget={scrollTarget}
            onBookInshore={handleBookInshore}
            onOpenCart={() => setCartVisible(true)}
            onBookChillGym={handleBookChillGym}
            configRefreshKey={configRefreshKey}
          />

        </View>

        {/* ─── BOOK THE BOAT ─── */}
        <View onLayout={(e) => setBookingCardY(e.nativeEvent.layout.y)}>
          <BeachBookingCard
            beaches={beaches}
            onBeachPress={handleBeachPressFromBooking}
            onSuccess={() => showToast(t('boat_booked'), 'success')}
            onOpenCart={() => setCartVisible(true)}
            preselectedBeachId={preselectedBeachId}
            preselectedInshore={preselectedInshore}
            preselectedChillGym={preselectedChillGym}
            key={`booking-${inshoreTrigger}-${chillGymTrigger}`}
          />
        </View>

        <FooterSection onRefreshConfig={handleFooterRefresh} />


      </ScrollView>

      {totalItems > 0 && (
        <TouchableOpacity style={s.floatingCart} onPress={() => setCartVisible(true)} activeOpacity={0.85}>
          <View style={s.fcInner}>
            <Ionicons name="compass" size={22} color="#fff" />
            <View style={s.fcText}><Text style={s.fcTitle}>My Adventure</Text><Text style={s.fcCount}>{totalItems} items</Text></View>
            <View style={s.fcBadge}><Text style={s.fcBadgeText}>{totalItems}</Text></View>
          </View>
        </TouchableOpacity>
      )}

      <BookingModal visible={bookingModalVisible} activity={bookingActivity} onClose={() => setBookingModalVisible(false)} onSuccess={handleBookingSuccess} />
      <CartSidebar visible={cartVisible} onClose={() => setCartVisible(false)} onBookingComplete={handleBookingComplete} />
      <PrivacyDashboard visible={privacyVisible} onClose={() => setPrivacyVisible(false)} beaches={beaches} availability={availability} lastUpdated={lastUpdated} />
      <BeachDetailModal visible={beachDetailVisible} beach={selectedBeach} beaches={beaches} preselectedForBooking={beachPreselectedForBooking} onClose={() => { setBeachDetailVisible(false); setBeachPreselectedForBooking(false); }} />
      <BookingHistoryModal visible={bookingHistoryVisible} onClose={() => setBookingHistoryVisible(false)} bookings={bookingHistory} />
      <Toast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 16 },
  loadingSubtext: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  loadingUrl: { fontSize: 10, color: '#64748B', marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlign: 'center' },
  loadingDots: { flexDirection: 'row', gap: 8, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  errorSubtext: { fontSize: 14, color: '#64748B', marginTop: 6, textAlign: 'center' },
  debugBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    width: '100%',
    maxWidth: 400,
  },
  debugLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 10,
    letterSpacing: 1,
  },
  debugValue: {
    color: '#E2E8F0',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0D9488', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, marginTop: 24,
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorHint: { color: '#64748B', fontSize: 11, marginTop: 16, textAlign: 'center', lineHeight: 18 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingVertical: 20, backgroundColor: '#fff', marginHorizontal: 20, marginTop: -20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, marginBottom: 16 },
  quickAction: { alignItems: 'center', position: 'relative' },
  qaIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  qaText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  qaBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  qaBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  floatingHistoryBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 34,
    right: 20,
    zIndex: 200,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  historyBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#0D9488',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  historyBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  floatingCart: { position: 'absolute', bottom: Platform.OS === 'ios' ? 34 : 20, left: 20, right: 20, zIndex: 100 },
  fcInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 },
  fcText: { flex: 1, marginLeft: 12 },
  fcTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fcCount: { color: '#94A3B8', fontSize: 12, marginTop: 1 },
  fcBadge: { backgroundColor: '#0D9488', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fcBadgeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  floatingLangBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 34,
    right: 68,
    zIndex: 200,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  flagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

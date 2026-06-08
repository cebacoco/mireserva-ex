import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ActivityIndicator, LayoutAnimation, UIManager } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { getConfig, getConfigDebugInfo, smartRefresh, loadConfig } from '../lib/dataService';

import { useLang } from '../lib/i18n';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


function ExpandableInfo({ text, icon, showLess, seeMore }: { text: string; icon: string; showLess: string; seeMore: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.infoBanner}>
      <Ionicons name={icon as any} size={18} color="#0369A1" style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={styles.infoBannerText}
          numberOfLines={expanded ? undefined : 2}
        >
          {text}
        </Text>
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.seeMoreText}>
            {expanded ? showLess : seeMore}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface FooterSectionProps {
  onRefreshConfig?: () => void;
}

export default function FooterSection({ onRefreshConfig }: FooterSectionProps) {
  const config = getConfig();
  const footer = config?.footer;
  const { t } = useLang();
  const debugInfo = getConfigDebugInfo();
  const [refreshing, setRefreshing] = useState(false);
  const [tsExpanded, setTsExpanded] = useState(false);

  const brandName = t('footer_brand');
  const copyright = t('footer_copyright');
  const whatsappNumber = footer?.whatsapp_number || '';
  const whatsappUrl = footer?.whatsapp_url || '';
  const email = footer?.email || '';

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefreshConfig) {
        onRefreshConfig();
      } else {
        // Fallback: smart refresh (preserves timestamps for proper comparison)
        smartRefresh();
        await loadConfig();
      }
    } catch (e) {
      console.warn('[Footer] Manual refresh error:', e);
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };


  const toggleTimestamps = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTsExpanded(prev => !prev);
  }, []);

  // Build section timestamp display
  const sectionTimestamps = debugInfo.sectionTimestamps || {};
  const sectionKeys = Object.keys(sectionTimestamps);
  const firstKey = sectionKeys[0];
  const restKeys = sectionKeys.slice(1);

  return (
    <View style={styles.container}>
      <ExpandableInfo text={t('footer_beach_info')} icon="information-circle" showLess={t('show_less')} seeMore={t('see_more')} />
      <ExpandableInfo text={t('footer_app_info')} icon="shield-checkmark" showLess={t('show_less')} seeMore={t('see_more')} />

      <View style={styles.contactSection}>
        <View style={styles.brandRow}>
          <Ionicons name="boat" size={22} color="#5EEAD4" />
          <Text style={styles.brandText}>{brandName}</Text>
        </View>

        <View style={styles.contactRow}>
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL(whatsappUrl)}
          >
            <View style={styles.contactIconBg}>
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            </View>
            <View>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>{whatsappNumber}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL(`mailto:${email}`)}
          >
            <View style={styles.contactIconBg}>
              <Ionicons name="mail" size={18} color="#5EEAD4" />
            </View>
            <View>
              <Text style={styles.contactLabel}>{t('email')}</Text>
              <Text style={styles.contactValue}>{email}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ─── Config Debug Info Box ─── */}
      <View style={styles.debugBox}>
        <View style={styles.debugRow}>
          <Ionicons name="git-branch-outline" size={13} color="#0D9488" />
          <Text style={styles.debugText}>
            config_updated: <Text style={styles.debugHighlight}>{debugInfo.version || 'N/A'}</Text>
            {'  '}|{'  '}
            <Text style={styles.debugHighlight}>{debugInfo.rawLength > 0 ? `${debugInfo.rawLength}b` : '—'}</Text>
          </Text>

          {/* ── Manual Refresh Button ── */}
          <TouchableOpacity
            onPress={handleManualRefresh}
            activeOpacity={0.5}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.refreshBtn}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#5EEAD4" />
            ) : (
              <Ionicons name="refresh-circle" size={26} color="#5EEAD4" />
            )}
          </TouchableOpacity>
        </View>

        {/* Per-section timestamps — first line always visible, rest on tap */}
        {sectionKeys.length > 0 && (
          <TouchableOpacity
            onPress={toggleTimestamps}
            activeOpacity={0.7}
            style={styles.sectionTimestamps}
          >
            {/* Always show first section */}
            {firstKey && (
              <View style={styles.tsFirstRow}>
                <Text style={styles.sectionTsText}>
                  {firstKey}: <Text style={styles.sectionTsValue}>{sectionTimestamps[firstKey]}</Text>
                </Text>
                <Ionicons
                  name={tsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color="#475569"
                  style={{ marginLeft: 6 }}
                />
                {!tsExpanded && restKeys.length > 0 && (
                  <Text style={styles.tsCountBadge}>+{restKeys.length}</Text>
                )}
              </View>
            )}

            {/* Expanded: show remaining sections */}
            {tsExpanded && restKeys.map((section) => (
              <Text key={section} style={styles.sectionTsText}>
                {section}: <Text style={styles.sectionTsValue}>{sectionTimestamps[section]}</Text>
              </Text>
            ))}
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.copyright}>{copyright}</Text>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 28,
    marginTop: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoBannerText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  seeMoreText: {
    fontSize: 12,
    color: '#0EA5E9',
    fontWeight: '600',
    marginTop: 4,
  },
  contactSection: {
    marginTop: 10,
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  contactRow: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  contactValue: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginBottom: 14,
  },
  debugBox: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  debugText: {
    flex: 1,
    fontSize: 10,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugHighlight: {
    color: '#0D9488',
    fontWeight: '700',
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(94, 234, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  sectionTimestamps: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sectionTsText: {
    fontSize: 9,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 14,
  },
  sectionTsValue: {
    color: '#64748B',
  },
  tsFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tsCountBadge: {
    fontSize: 9,
    color: '#0D9488',
    fontWeight: '700',
    marginLeft: 6,
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },

  copyright: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
});

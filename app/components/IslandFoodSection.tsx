import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../lib/cartStore';
import { getConfig } from '../lib/dataService';
import { useLang } from '../lib/i18n';

const { width } = Dimensions.get('window');

// ─── Food Data (from config or fallback) ───
interface FoodItem {
  id: string;
  name: string;
  name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  image: string;
  category: 'juices' | 'nicecream' | 'specials' | 'snacks' | string;
  options?: { label: string; price: number }[];
  options_es?: { label: string; price: number }[];
  addOns?: { label: string; price: number }[];
  addOns_es?: { label: string; price: number }[];
}

function getFoodItemsFromConfig(): { items: FoodItem[] } {
  const config = getConfig();
  if (config && config.food && config.food.length > 0) {
    const items: FoodItem[] = config.food.map(f => ({
      id: f.id,
      name: f.name,
      name_es: f.name_es,
      description: f.description,
      description_es: f.description_es,
      price: f.price,
      image: f.image,
      category: f.category,
      options: f.options.length > 0 ? f.options.map(o => ({ label: o.label, price: o.price })) : undefined,
      options_es: f.options_es && f.options_es.length > 0 ? f.options_es.map(o => ({ label: o.label, price: o.price })) : undefined,
      addOns: f.addons.length > 0 ? f.addons.map(a => ({ label: a.label, price: a.price })) : undefined,
      addOns_es: f.addons_es && f.addons_es.length > 0 ? f.addons_es.map(a => ({ label: a.label, price: a.price })) : undefined,
    }));
    return { items };
  }
  // Fallback (should never reach here if config is loaded)
  return { items: [] };
}

// ─── Food Item Card ───
function FoodItemCard({ item, onAddToCart, t, lang }: { item: FoodItem; onAddToCart: (name: string, price: number, imageUrl: string) => void; t: (key: string, params?: Record<string, string | number>) => string; lang: string }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [selectedAddOns, setSelectedAddOns] = useState<boolean[]>(
    item.addOns ? item.addOns.map(() => false) : []
  );

  const isEs = lang === 'es';
  const displayName = (isEs && item.name_es) ? item.name_es : item.name;
  const displayDesc = (isEs && item.description_es) ? item.description_es : item.description;
  const displayOptions = (isEs && item.options_es && item.options_es.length > 0) ? item.options_es : item.options;
  const displayAddOns = (isEs && item.addOns_es && item.addOns_es.length > 0) ? item.addOns_es : item.addOns;

  const hasOptions = displayOptions && displayOptions.length > 0;
  const hasAddOns = displayAddOns && displayAddOns.length > 0;
  const needsExpand = hasOptions || hasAddOns;

  const getPrice = (): number => {
    let price = item.price;
    if (hasOptions && displayOptions) { price = displayOptions[selectedOption].price; }
    if (hasAddOns && displayAddOns) { displayAddOns.forEach((addon, i) => { if (selectedAddOns[i]) price += addon.price; }); }
    return price;
  };

  const getName = (): string => {
    let name = displayName;
    if (hasOptions && displayOptions) { name += ` (${displayOptions[selectedOption].label})`; }
    if (hasAddOns && displayAddOns) { const addons = displayAddOns.filter((_, i) => selectedAddOns[i]).map(a => a.label); if (addons.length > 0) name += ` + ${addons.join(', ')}`; }
    return name;
  };

  const toggleAddOn = (index: number) => { setSelectedAddOns(prev => { const next = [...prev]; next[index] = !next[index]; return next; }); };

  const handleQuickAdd = () => {
    if (needsExpand && !expanded) { setExpanded(true); return; }
    onAddToCart(getName(), getPrice(), item.image);
    if (expanded) setExpanded(false);
  };

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.mainRow}>
        <Image source={{ uri: item.image }} style={cardStyles.image} />
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={cardStyles.desc} numberOfLines={2}>{displayDesc}</Text>
          <View style={cardStyles.bottomRow}>
            {hasOptions ? (<Text style={cardStyles.priceRange}>{t('from_price', { price: Math.min(...displayOptions!.map(o => o.price)).toFixed(2) })}</Text>) : (<Text style={cardStyles.price}>${item.price.toFixed(2)}</Text>)}
            <TouchableOpacity style={cardStyles.addBtn} onPress={handleQuickAdd} activeOpacity={0.8}>
              {needsExpand && !expanded ? (<Ionicons name="options" size={16} color="#fff" />) : (<Ionicons name="add" size={18} color="#fff" />)}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {expanded && (
        <View style={cardStyles.expandedSection}>
          {hasOptions && (<View style={cardStyles.optionsSection}><Text style={cardStyles.optionLabel}>{t('choose_flavor')}</Text>{displayOptions!.map((option, idx) => (<TouchableOpacity key={idx} style={[cardStyles.optionRow, selectedOption === idx && cardStyles.optionRowActive]} onPress={() => setSelectedOption(idx)} activeOpacity={0.7}><Ionicons name={selectedOption === idx ? 'radio-button-on' : 'radio-button-off'} size={18} color={selectedOption === idx ? '#0D9488' : '#CBD5E1'} /><Text style={[cardStyles.optionText, selectedOption === idx && cardStyles.optionTextActive]}>{option.label}</Text><Text style={cardStyles.optionPrice}>${option.price.toFixed(2)}</Text></TouchableOpacity>))}</View>)}
          {hasAddOns && (<View style={cardStyles.addOnsSection}><Text style={cardStyles.optionLabel}>{t('add_extras')}</Text>{displayAddOns!.map((addon, idx) => (<TouchableOpacity key={idx} style={[cardStyles.optionRow, selectedAddOns[idx] && cardStyles.optionRowActive]} onPress={() => toggleAddOn(idx)} activeOpacity={0.7}><Ionicons name={selectedAddOns[idx] ? 'checkbox' : 'square-outline'} size={18} color={selectedAddOns[idx] ? '#0D9488' : '#CBD5E1'} /><Text style={[cardStyles.optionText, selectedAddOns[idx] && cardStyles.optionTextActive]}>{addon.label}</Text><Text style={cardStyles.optionPrice}>+${addon.price.toFixed(2)}</Text></TouchableOpacity>))}</View>)}
          <View style={cardStyles.totalRow}><Text style={cardStyles.totalLabel}>{t('total_label')}</Text><Text style={cardStyles.totalPrice}>${getPrice().toFixed(2)}</Text></View>
          <TouchableOpacity style={cardStyles.addToCartBtn} onPress={handleQuickAdd} activeOpacity={0.8}><Ionicons name="cart" size={16} color="#fff" /><Text style={cardStyles.addToCartText}>{t('add_to_cart_dash', { price: getPrice().toFixed(2) })}</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
  mainRow: { flexDirection: 'row' },
  image: { width: 100, height: 100 },
  info: { flex: 1, padding: 12, justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  desc: { fontSize: 11, color: '#64748B', lineHeight: 15, marginTop: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  price: { fontSize: 16, fontWeight: '800', color: '#0D9488' },
  priceRange: { fontSize: 13, fontWeight: '600', color: '#0D9488' },
  addBtn: { backgroundColor: '#0D9488', width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  expandedSection: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  optionsSection: { marginTop: 10 },
  addOnsSection: { marginTop: 10 },
  optionLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4, backgroundColor: '#F8FAFC' },
  optionRowActive: { backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4' },
  optionText: { fontSize: 13, fontWeight: '600', color: '#475569', flex: 1 },
  optionTextActive: { color: '#0D9488' },
  optionPrice: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  totalPrice: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  addToCartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9488', paddingVertical: 12, borderRadius: 12, gap: 8, marginTop: 10 },
  addToCartText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ─── Main Section ───
export default function IslandFoodSection({ showToast, configRefreshKey }: { showToast: (message: string, type: 'success' | 'error' | 'info') => void; configRefreshKey?: number }) {

  const { addItem } = useCart();
  const { t, lang } = useLang();
  const [filter, setFilter] = useState('all');

  const CATEGORIES = [
    { key: 'all', label: t('food_all'), icon: 'grid' as const },
    { key: 'juices', label: t('food_juices'), icon: 'water' as const },
    { key: 'nicecream', label: t('food_nicecream'), icon: 'ice-cream' as const },
    { key: 'specials', label: t('food_specials'), icon: 'star' as const },
    { key: 'snacks', label: t('food_snacks'), icon: 'cafe' as const },
  ];

  // Read from config (memoized so it doesn't re-parse every render)
  const { items: foodItems } = useMemo(() => getFoodItemsFromConfig(), []);

  const filteredItems = filter === 'all' ? foodItems : foodItems.filter(f => f.category === filter);

  const handleAddToCart = (name: string, price: number, imageUrl: string) => {
    addItem({
      id: `food-${name}-${Date.now()}`,
      type: 'food',
      name,
      price,
      quantity: 1,
      image_url: imageUrl,
    });
    showToast(t('added_to_cart', { name }), 'success');
  };

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.filterChip, filter === cat.key && styles.filterChipActive]}
            onPress={() => setFilter(cat.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={cat.icon} size={14} color={filter === cat.key ? '#fff' : '#64748B'} />
            <Text style={[styles.filterText, filter === cat.key && styles.filterTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Food items */}
      <View style={styles.itemList}>
        {filteredItems.map((item) => (
          <FoodItemCard key={item.id} item={item} onAddToCart={handleAddToCart} t={t} lang={lang} />
        ))}
      </View>

      {/* Fresh note */}
      <View style={styles.freshNote}>
        <Ionicons name="nutrition" size={16} color="#16A34A" />
        <Text style={styles.freshNoteText}>{t('food_fresh_note')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 8 },
  filterScroll: { marginBottom: 16 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9',
  },
  filterChipActive: { backgroundColor: '#0D9488' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterTextActive: { color: '#fff' },
  itemList: { paddingHorizontal: 20 },
  freshNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12,
  },
  freshNoteText: { fontSize: 12, color: '#16A34A', fontWeight: '500', flex: 1, lineHeight: 16 },
});

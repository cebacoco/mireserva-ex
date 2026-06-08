/**
 * i18n.ts — ZERO LOCAL FALLBACKS
 *
 * ALL strings come from GitHub config:
 *   https://raw.githubusercontent.com/cebacoco/configs/main/cebacoco-config.ini
 *
 * The t() function returns:
 *   1. Config override for current language (from applyConfigToI18n)
 *   2. Config override for English (fallback lang)
 *   3. The raw key itself (so you can see what's missing)
 *
 * NO hardcoded strings. NO local fallbacks. Period.
 */

import { useState, useEffect } from 'react';
import type { AppConfig } from './configParser';

export type Lang = 'es' | 'en';

let _currentLang: Lang = 'es';
let _listeners: Array<() => void> = [];

// ─── Config-driven strings (populated ONLY by applyConfigToI18n from GitHub config) ───
let _configStrings_en: Record<string, string> = {};
let _configStrings_es: Record<string, string> = {};

export function getLang(): Lang { return _currentLang; }
export function setLang(lang: Lang): void { _currentLang = lang; _listeners.forEach(fn => fn()); }
export function subscribeLang(fn: () => void): () => void { _listeners.push(fn); return () => { _listeners = _listeners.filter(l => l !== fn); }; }

export function useLang(): { lang: Lang; setLang: (l: Lang) => void; t: (key: string, params?: Record<string, string | number>) => string } {
  const [, setTick] = useState(0);
  useEffect(() => { const unsub = subscribeLang(() => setTick(prev => prev + 1)); return unsub; }, []);
  return { lang: _currentLang, setLang: (l: Lang) => setLang(l), t: (key: string, params?: Record<string, string | number>) => t(key, params) };
}

/**
 * Translate a key. Priority:
 *   1. Config string for current language
 *   2. Config string for English (fallback)
 *   3. The key itself (shows what's missing from config)
 *
 * NO LOCAL FALLBACKS. If the key isn't in the GitHub config, you see the raw key.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const primary = _currentLang === 'es' ? _configStrings_es : _configStrings_en;
  const fallback = _configStrings_en;

  let str = primary[key] || fallback[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}


// ═══════════════════════════════════════════════════════════════
// CONFIG → i18n STRING MAPPING
// ═══════════════════════════════════════════════════════════════
//
// Called when config loads from GitHub. Extracts ALL translatable
// fields from config sections AND the [strings_en]/[strings_es]
// sections into the string dictionaries.
//
// NO FALLBACKS. If a string isn't in the config, t() returns the key.
// ═══════════════════════════════════════════════════════════════

export function applyConfigToI18n(config: AppConfig): void {
  const en: Record<string, string> = {};
  const es: Record<string, string> = {};

  // Helper: set both if value exists
  const set = (key: string, enVal?: string, esVal?: string) => {
    if (enVal) en[key] = enVal;
    if (esVal) es[key] = esVal;
  };

  // ─── [strings_en] and [strings_es] sections — bulk UI strings ───
  if (config.strings_en) {
    for (const [key, val] of Object.entries(config.strings_en)) {
      en[key] = val;
    }
  }
  if (config.strings_es) {
    for (const [key, val] of Object.entries(config.strings_es)) {
      es[key] = val;
    }
  }

  // ─── Hero ───
  if (config.hero) {
    const h = config.hero;
    set('hero_tagline', h.tagline, h.tagline_es);
    set('hero_title', h.title, h.title_es);
    set('hero_subtitle', h.subtitle, h.subtitle_es);
    set('hero_cta', h.cta_text, h.cta_text_es);
    set('hero_logo', h.logo_text, h.logo_text_es);

    // Stats
    if (h.stats && h.stats.length >= 3) {
      set('stat_beaches', h.stats[0]?.label);
      set('stat_activities', h.stats[1]?.label);
      set('stat_islands', h.stats[2]?.label);
    }
    if (h.stats_es && h.stats_es.length >= 3) {
      if (h.stats_es[0]?.label) es['stat_beaches'] = h.stats_es[0].label;
      if (h.stats_es[1]?.label) es['stat_activities'] = h.stats_es[1].label;
      if (h.stats_es[2]?.label) es['stat_islands'] = h.stats_es[2].label;
    }
  }

  // ─── Boat Booking ───
  if (config.boatBooking) {
    const b = config.boatBooking;
    set('book_the_boat', b.title, b.title_es);
    set('price_per_person', b.subtitle, b.subtitle_es);
    set('service_fee_note', b.service_fee_note, b.service_fee_note_es);
    set('inshore_fishing_detail', b.inshore_fishing_addon_desc, b.inshore_fishing_addon_desc_es);
    set('return_boat_note', b.overnight_return_note, b.overnight_return_note_es);

    if (b.overnight_includes && b.overnight_includes.length > 0) {
      en['overnight_includes_list'] = b.overnight_includes.join(', ');
    }
    if (b.overnight_includes_es && b.overnight_includes_es.length > 0) {
      es['overnight_includes_list'] = b.overnight_includes_es.join(', ');
    }
  }

  // ─── Fishing ───
  if (config.fishing) {
    set('fishing_intro', config.fishing.intro_text, config.fishing.intro_text_es);

    for (const item of config.fishing.items) {
      const id = item.id;
      set(`${id}_override_desc`, item.description, item.description_es);
      set(`${id}_subtitle`, item.subtitle, item.subtitle_es);
      set(id, item.display_name, item.display_name_es);

      if (item.equipment && item.equipment.length > 0) {
        en[`${id}_equipment`] = item.equipment.join(', ');
      }
      if (item.equipment_es && item.equipment_es.length > 0) {
        es[`${id}_equipment`] = item.equipment_es.join(', ');
      }
      if (item.included && item.included.length > 0) {
        en[`${id}_included`] = item.included.join(', ');
      }
      if (item.included_es && item.included_es.length > 0) {
        es[`${id}_included`] = item.included_es.join(', ');
      }
    }
  }

  // ─── Water Activities ───
  set('water_intro', config.waterIntroText, config.waterIntroTextEs);

  for (const item of config.water) {
    const id = item.id;
    set(`water_${id}_name`, item.name, item.name_es);
    set(`water_${id}_desc`, item.description, item.description_es);
    set(`water_${id}_price`, item.price_label, item.price_label_es);
    if (item.details && item.details.length > 0) {
      en[`water_${id}_details`] = item.details.join(', ');
    }
    if (item.details_es && item.details_es.length > 0) {
      es[`water_${id}_details`] = item.details_es.join(', ');
    }
  }

  // ─── Island Activities ───
  set('island_intro', config.islandIntroText, config.islandIntroTextEs);

  for (const item of config.island) {
    const id = item.id;
    set(`island_${id}_name`, item.name, item.name_es);
    set(`island_${id}_desc`, item.description, item.description_es);
    set(`island_${id}_price`, item.price_label, item.price_label_es);
    if (item.details && item.details.length > 0) {
      en[`island_${id}_details`] = item.details.join(', ');
    }
    if (item.details_es && item.details_es.length > 0) {
      es[`island_${id}_details`] = item.details_es.join(', ');
    }
  }

  // ─── Overnight ───
  if (config.overnight) {
    const o = config.overnight;
    set('overnight_pitch', o.pitch_text, o.pitch_text_es);
    set('what_to_expect', o.honest_title, o.honest_title_es);
    set('what_to_expect_text', o.honest_text, o.honest_text_es);
    set('overnight_name', o.name, o.name_es);
    set('overnight_description', o.description, o.description_es);
    set('overnight_price_label', o.price_label, o.price_label_es);

    if (o.sleep_options && o.sleep_options.length >= 1) {
      set('ranchito', o.sleep_options[0]?.name);
      set('ranchito_desc', o.sleep_options[0]?.description);
    }
    if (o.sleep_options && o.sleep_options.length >= 2) {
      set('bungalow', o.sleep_options[1]?.name);
      set('bungalow_desc', o.sleep_options[1]?.description);
    }
    if (o.sleep_options && o.sleep_options.length >= 3) {
      set('tree_tent', o.sleep_options[2]?.name);
      set('tree_tent_desc', o.sleep_options[2]?.description);
    }
    if (o.sleep_options_es && o.sleep_options_es.length >= 1) {
      es['ranchito'] = o.sleep_options_es[0].name;
      es['ranchito_desc'] = o.sleep_options_es[0].description;
    }
    if (o.sleep_options_es && o.sleep_options_es.length >= 2) {
      es['bungalow'] = o.sleep_options_es[1].name;
      es['bungalow_desc'] = o.sleep_options_es[1].description;
    }
    if (o.sleep_options_es && o.sleep_options_es.length >= 3) {
      es['tree_tent'] = o.sleep_options_es[2].name;
      es['tree_tent_desc'] = o.sleep_options_es[2].description;
    }

    const galleryKeyMap = [
      'gl_main_rancho', 'gl_bungalow_inside', 'gl_bungalow_outside',
      'gl_shower_entrance', 'gl_shower_inside', 'gl_kitchen_hut',
      'gl_kitchen_inside', 'gl_wash_area', 'gl_dining_area', 'gl_covered_seating',
    ];
    for (let i = 0; i < o.gallery.length && i < galleryKeyMap.length; i++) {
      if (o.gallery[i].label) {
        en[galleryKeyMap[i]] = o.gallery[i].label;
      }
    }

    if (o.details && o.details.length > 0) {
      en['overnight_details_list'] = o.details.join('\n');
    }
    if (o.details_es && o.details_es.length > 0) {
      es['overnight_details_list'] = o.details_es.join('\n');
    }
  }

  // ─── Food ───
  set('food_fresh_note', config.foodFreshNote, config.foodFreshNoteEs);

  for (const item of config.food) {
    const id = item.id;
    set(`food_${id}_name`, item.name, item.name_es);
    set(`food_${id}_desc`, item.description, item.description_es);
  }

  // ─── Footer ───
  if (config.footer) {
    const f = config.footer;
    set('footer_brand', f.brand_name, f.brand_name_es);
    set('footer_beach_info', f.info_beach, f.info_beach_es);
    set('footer_app_info', f.info_app, f.info_app_es);
    set('footer_copyright', f.copyright, f.copyright_es);
  }

  // ─── Meta ───
  if (config.meta) {
    set('app_name', config.meta.app_name, config.meta.app_name_es);
  }

  // Apply — these are the ONLY source of strings
  _configStrings_en = en;
  _configStrings_es = es;

  // Notify listeners so components re-render with new strings
  _listeners.forEach(fn => fn());

  console.log(
    `[i18n] Applied config strings: ${Object.keys(en).length} EN, ${Object.keys(es).length} ES keys (ZERO local fallbacks)`
  );
}

/**
 * Clear config strings (e.g. when cache is cleared).
 */
export function clearConfigOverrides(): void {
  _configStrings_en = {};
  _configStrings_es = {};
}

/**
 * Get the current config strings (for debugging).
 */
export function getConfigOverrides(): { en: Record<string, string>; es: Record<string, string> } {
  return { en: { ..._configStrings_en }, es: { ..._configStrings_es } };
}

/**
 * beachTags.ts — Beach tag definitions with i18n keys and visual styling
 */

export interface BeachTagDef {
  key: string;       // i18n key (e.g. 'tag_lagoon')
  icon: string;      // Ionicons icon name
  color: string;     // text color
  bgColor: string;   // background color
}

// Tag definitions with visual styling
const TAG_DEFS: Record<string, BeachTagDef> = {
  tag_lagoon:          { key: 'tag_lagoon',          icon: 'water',           color: '#0369A1', bgColor: '#E0F2FE' },
  tag_gym:             { key: 'tag_gym',             icon: 'barbell',         color: '#7C3AED', bgColor: '#F3E8FF' },
  tag_corals:          { key: 'tag_corals',          icon: 'color-palette',   color: '#EA580C', bgColor: '#FFF7ED' },
  tag_fun:             { key: 'tag_fun',             icon: 'happy',           color: '#D97706', bgColor: '#FFFBEB' },
  tag_manta_rays:      { key: 'tag_manta_rays',      icon: 'fish',            color: '#0D9488', bgColor: '#F0FDFA' },
  tag_white_sand:      { key: 'tag_white_sand',      icon: 'sunny',           color: '#B45309', bgColor: '#FEF3C7' },
  tag_smooth_shore:    { key: 'tag_smooth_shore',    icon: 'trail-sign',      color: '#0891B2', bgColor: '#ECFEFF' },
  tag_private:         { key: 'tag_private',         icon: 'lock-closed',     color: '#059669', bgColor: '#D1FAE5' },
  tag_black:           { key: 'tag_black',           icon: 'moon',            color: '#374151', bgColor: '#F3F4F6' },
  tag_empty:           { key: 'tag_empty',           icon: 'footsteps',       color: '#059669', bgColor: '#ECFDF5' },
  tag_remote:          { key: 'tag_remote',          icon: 'compass',         color: '#6D28D9', bgColor: '#EDE9FE' },
  tag_crystal_water:   { key: 'tag_crystal_water',   icon: 'diamond',         color: '#0EA5E9', bgColor: '#E0F2FE' },
  tag_semi_empty:      { key: 'tag_semi_empty',      icon: 'people',          color: '#16A34A', bgColor: '#DCFCE7' },
  tag_public_hot_spot: { key: 'tag_public_hot_spot', icon: 'flame',           color: '#DC2626', bgColor: '#FEE2E2' },
  tag_busy:            { key: 'tag_busy',            icon: 'people-circle',   color: '#DC2626', bgColor: '#FEF2F2' },
};

// Beach name → tag keys mapping
const BEACH_TAGS: Record<string, string[]> = {
  'Coco Loco':      ['tag_lagoon', 'tag_gym', 'tag_corals', 'tag_fun', 'tag_manta_rays'],
  'Coco Blanco':    ['tag_white_sand', 'tag_smooth_shore', 'tag_corals', 'tag_fun', 'tag_manta_rays'],
  'Coco Escondido': ['tag_private', 'tag_black', 'tag_empty'],
  'Coco Doble':     ['tag_lagoon', 'tag_private', 'tag_empty', 'tag_remote'],
  'Coco Privado':   ['tag_white_sand', 'tag_private', 'tag_crystal_water', 'tag_corals', 'tag_semi_empty'],
  'Coco Cristal':   ['tag_crystal_water', 'tag_public_hot_spot', 'tag_white_sand', 'tag_busy'],
};

/**
 * Get tag definitions for a beach by name.
 * Returns array of BeachTagDef objects with i18n keys and styling.
 */
export function getBeachTags(beachName: string): BeachTagDef[] {
  const tagKeys = BEACH_TAGS[beachName] || [];
  return tagKeys.map(k => TAG_DEFS[k]).filter(Boolean);
}

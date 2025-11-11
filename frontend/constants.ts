import { SUBRESOURCE_INTEGRITY_MANIFEST } from 'next/dist/shared/lib/constants';
import type { ChatMessage } from './components/ChatSidebar';

export const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [
  {
    type: 'bot',
    text:
      '👋 Hi! I can help you query your agricultural hex data. Try asking:\n' +
      '• "Show me hexes with low phosphorus"\n' +
      '• "What\'s the average yield target?"\n' +
      '• "Find hexes that need more than 100 units of nitrogen"\n' +
      '• "Show hexes with high yield and low potassium"'
  }
];



// Color constants for nutrients
export const COLORS = {
  // Yield target colors (red -> yellow -> green gradient)
  YIELD_LOW: '#a50426',      // Red - low yield
  YIELD_MID: '#fefdbd',      // Yellow - medium yield
  YIELD_HIGH: '#016937',     // Green - high yield
  
  // Nitrogen (N) colors (light green -> dark green gradient)
  N_LIGHT: '#f5fbf4',        // Light green - low N
  N_DARK: '#054419',         // Dark green - high N
  
  // Phosphorus (P) colors (light purple -> dark purple gradient)
  P_LIGHT: '#fbfbfd',        // Light purple - low P
  P_DARK: '#3b0379',         // Dark purple - high P
  
  // Potassium (K) colors (light blue -> dark blue gradient)
  K_LIGHT: '#f6faff',        // Light blue - low K
  K_DARK: '#08316e',         // Dark blue - high K
  
  // Default/fallback colors
  DEFAULT_LIGHT: '#f1f8e9',
  DEFAULT_MID_1: '#c8e6c9',
  DEFAULT_MID_2: '#81c784',
  DEFAULT_MID_3: '#4caf50',
  DEFAULT_DARK: '#2e7d32',
  
  // Line/stroke colors
  LINE_COLOR: '#0f0f0f',
  
  // White/transparent
  WHITE: '#ffffff'
} as const;

const ACCENT_RGB = '34, 197, 94';

export const THEME = {
  ACCENT: {
    RGB: ACCENT_RGB,
    TEXT_DARK: '#052e16',
    TEXT_ACCENT: `rgba(${ACCENT_RGB}, 0.85)`,
    TEXT_MUTED: 'rgba(209, 250, 229, 0.75)',
    TEXT_SUBTLE: 'rgba(209, 250, 229, 0.65)',

    // Button gradient 
    PRIMARY_GRADIENT: 'linear-gradient(135deg,rgb(229, 219, 167),rgb(240, 213, 157))'
  },
  TEXT: {
    DARK: '#000000',
    LIGHT: '#ffffff',
  },
  BACKGROUND: {
    HERO: 'radial-gradient(circle at top,rgb(133, 202, 163) 0%,rgb(104, 157, 123) 45%,rgb(58, 87, 69) 100%)',
    
    // Landing page input 
    SURFACE_PRIMARY: 'rgb(255, 255, 255)',
    // SURFACE_PRIMARY: 'rgba(251, 255, 252, 0.82)',

    // Table background & title container
    SURFACE_ELEVATED: 'rgba(158, 211, 180, 0.82)',
    
    // Fertilizer Philosophy 
    PANEL: 'rgba(16, 57, 36, 0.82)',
    PANEL_DEEP: 'rgba(16, 57, 36, 0.82)',
    

    // Table 
    PANEL_LIGHT: '#ffffff',


    INPUT: 'rgba(17, 58, 36, 0.85)',
    BUTTON_PILL: `rgba(${ACCENT_RGB}, 0.18)`,
    BUTTON_PILL_HOVER: `rgba(${ACCENT_RGB}, 0.28)`,
    CARD_TINT: `rgba(${ACCENT_RGB}, 0.12)`,
    CARD_TINT_HOVER: `rgba(${ACCENT_RGB}, 0.22)`,
    ROW_HOVER: `rgba(${ACCENT_RGB}, 0.1)`,
    ROW_ACTIVE: `rgba(${ACCENT_RGB}, 0.18)`,
    STATUS_POSITIVE: 'rgba(16, 185, 129, 0.15)',
    STATUS_POSITIVE_BORDER: 'rgba(16, 185, 129, 0.35)',
    MODAL: 'rgba(8, 28, 17, 0.96)',
    OVERLAY_DIM: 'rgba(0, 0, 0, 0.5)',
    TABLE_HEADER: 'rgba(89, 173, 121, 0.92)',
    PASS_HEADER: `rgba(${ACCENT_RGB}, 0.26)`
  },
  BORDER: {
    MEDIUM: `1px solid rgba(${ACCENT_RGB}, 0.32)`,
    PILL: `1px solid rgba(${ACCENT_RGB}, 0.35)`,
    TABLE_ROW: `1px solid rgba(${ACCENT_RGB}, 0.2)`,
    INNER_CARD: `1px solid rgba(${ACCENT_RGB}, 0.28)`,
    MODAL: `1px solid rgba(${ACCENT_RGB}, 0.32)`
  },  
  SHADOW: {
    LIFT: `0 10px 20px rgba(${ACCENT_RGB}, 0.35)`,
    LIFT_HOVER: `0 18px 34px rgba(${ACCENT_RGB}, 0.45)`,
    PANEL: '0 10px 40px rgba(10, 45, 25, 0.25)',
    MODAL: '0 24px 60px rgba(7, 26, 15, 0.55)'
  }
} as const;

// Field name constants
export const FIELD_NAMES = {
  NORTH_OF_ROAD: 'North of Road',
  SOUTH_OF_ROAD: 'South of Road',
  RAILROAD_PIVOT: 'Railroad Pivot'
} as const;

// Mapbox URL constants for each field
export const MAPBOX_URLS = {
  NORTH_OF_ROAD: 'mapbox://zeumer.bofg9ncj',
  SOUTH_OF_ROAD: 'mapbox://zeumer.8d46889j',
  RAILROAD_PIVOT: 'mapbox://zeumer.2tepd0uh'
} as const;

// Map center coordinates for each field [longitude, latitude]
export const FIELD_CENTERS = {
  NORTH_OF_ROAD: [-86.684316, 32.431793] as [number, number],
  SOUTH_OF_ROAD: [-86.686834, 32.423013] as [number, number],
  RAILROAD_PIVOT: [-86.376, 32.416] as [number, number]
} as const;

// Layer name suffixes
export const LAYER_SUFFIXES = {
  HIGHRES: 'highres',
  MEDIUMRES: 'mediumres',
  BOUNDARIESSHP: 'boundariesshp'
} as const;

// Map layer styling constants
export const MAP_STYLE = {
  FILL_OPACITY: 0.8,        // Fill layer opacity (0.0 to 1.0)
  LINE_WIDTH: 0.0001        // Line/stroke width for boundaries
} as const;

// Legend configuration type
export type LegendConfig = {
  colors: readonly string[];
  stops: readonly number[];
  min: number;
  max: number;
};

// Legend configuration constants
export const LEGEND_CONFIG = {
  YIELD: {
    colors: [COLORS.YIELD_LOW, COLORS.YIELD_MID, COLORS.YIELD_HIGH],
    stops: [0, 125, 250],
    min: 0,
    max: 250
  },
  N_SOIL: {
    colors: [COLORS.N_LIGHT, COLORS.N_DARK],
    stops: [0, 250],
    min: 0,
    max: 288
  },
  N_APPLY: {
    colors: [COLORS.N_LIGHT, COLORS.N_DARK],
    stops: [0, 250],
    min: 0,
    max: 288
  },
  P_SOIL: {
    colors: [COLORS.P_LIGHT, COLORS.P_DARK],
    stops: [0, 600],
    min: 0,
    max: 600
  },
  P_APPLY: {
    colors: [COLORS.P_LIGHT, COLORS.P_DARK],
    stops: [0, 175],
    min: 0,
    max: 175
  },
  K_SOIL: {
    colors: [COLORS.K_LIGHT, COLORS.K_DARK],
    stops: [0, 400],
    min: 0,
    max: 400
  },
  K_APPLY: {
    colors: [COLORS.K_LIGHT, COLORS.K_DARK],
    stops: [0, 150],
    min: 0,
    max: 150
  },
  DEFAULT: {
    colors: [COLORS.DEFAULT_LIGHT, COLORS.DEFAULT_DARK],
    stops: [0, 100],
    min: 0,
    max: 100
  }
} as const;

// Legend configuration lookup map
export const LEGEND_LOOKUP: Record<string, LegendConfig> = {
  'yield_target': LEGEND_CONFIG.YIELD,
  'N_in_soil': LEGEND_CONFIG.N_SOIL,
  'N_to_apply': LEGEND_CONFIG.N_APPLY,
  'P_in_soil': LEGEND_CONFIG.P_SOIL,
  'P_to_apply': LEGEND_CONFIG.P_APPLY,
  'K_in_soil': LEGEND_CONFIG.K_SOIL,
  'K_to_apply': LEGEND_CONFIG.K_APPLY
};


/**
 * Utility for mapping disease names to visual properties
 */

// Define color mappings for each disease
// These colors are chosen to be distinguishable and work well on a dark background
export const DISEASE_COLORS = {
  'Ankylosing Spondylitis': [230, 126, 34, 200], // orange
  'Hidradenitis Suppurativa': [155, 89, 182, 200], // purple
  'Multiple Sclerosis': [52, 152, 219, 200], // blue
  'Asthma': [46, 204, 113, 200], // green
  'Breast Cancer': [231, 76, 60, 200], // red
  'Diabetes': [241, 196, 15, 200], // yellow
  'Heart Disease': [231, 76, 60, 200], // red
  'Hypertension': [52, 73, 94, 200], // dark blue
  'Migraine': [155, 89, 182, 200], // purple
  'Other': [149, 165, 166, 200], // gray
};

// Define opacity for different states
export const POINT_OPACITY = {
  DEFAULT: 0.8,
  HOVER: 1.0,
  DIMMED: 0.4,
};

// Define sizes for different zoom levels and point types
export const POINT_SIZES = {
  INDIVIDUAL: {
    BASE: 5000,
    MIN_PIXELS: 22,
    MAX_PIXELS: 40,
  },
  CLUSTER: {
    BASE: 8000,
    MIN_PIXELS: 30,
    MAX_PIXELS: 80,
  },
};

// Helper function to get color for a disease
export function getDiseaseColor(disease) {
  return DISEASE_COLORS[disease] || DISEASE_COLORS['Other'];
}

// Animation settings for points
export const ANIMATION = {
  PULSE_DURATION: 2000, // ms
  PULSE_AMPLITUDE: 0.3, // how much to pulse (0-1)
};

// Generate mapping for disease id to icon path
export const DISEASE_ICONS = Object.keys(DISEASE_COLORS).reduce((acc, disease) => {
  // We're using the same icon for all diseases for now
  // Will customize for each disease if needed later
  acc[disease] = `/icons/speech-bubble.svg`;
  return acc;
}, {});

// Helper function to get icon for a disease
export function getDiseaseIcon(disease) {
  return DISEASE_ICONS[disease] || DISEASE_ICONS['Other'];
} 
export const TIME_SIGNATURES = [
  { value: '4/4', label: '4/4', beatsPerMeasure: 16 },
  { value: '3/4', label: '3/4', beatsPerMeasure: 12 },
  { value: '2/4', label: '2/4', beatsPerMeasure: 8 },
  { value: '6/8', label: '6/8', beatsPerMeasure: 12 },
  { value: '2/2', label: '2/2', beatsPerMeasure: 8 },
];

export const NOTE_COLORS = {
  0: '#D4AF37',
  1: '#5F9EA0',
  2: '#9370DB',
  3: '#CD853F',
};

export const getVelocityColor = (velocity) => {
  const v = Math.max(0, Math.min(1, velocity));
  if (v < 0.4) { const t = v / 0.4; return `rgb(${Math.round(0)}, ${Math.round(100 + t * 155)}, ${Math.round(255 - t * 55)})`; }
  else if (v < 0.7) { const t = (v - 0.4) / 0.3; return `rgb(${Math.round(t * 255)}, 255, ${Math.round(200 - t * 200)})`; }
  else { const t = (v - 0.7) / 0.3; return `rgb(255, ${Math.round(255 - t * 255)}, 0)`; }
};

export const BASE_CELL_WIDTH = 48;
export const BASE_CELL_HEIGHT = 28;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.1;
export const MIN_DURATION = 0.125;
export const DEFAULT_DURATION = 1;

const NOTE_NAMES_CHROMATIC = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];

export const ALL_PITCHES = (() => {
  const p = ['C8'];
  for (let octave = 7; octave >= 1; octave--) {
    NOTE_NAMES_CHROMATIC.forEach(note => p.push(`${note}${octave}`));
  }
  p.push('B0', 'A#0', 'A0');
  return p;
})();
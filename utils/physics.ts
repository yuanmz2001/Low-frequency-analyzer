import { Speaker, Complex } from '../types';

export const SPEED_OF_SOUND_20C = 343; // m/s

export function calculateSpeedOfSound(temperature: number): number {
  return 331.3 + 0.606 * temperature;
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

export function linearToDb(linear: number): number {
  return 20 * Math.log10(linear);
}

// Map a normalized value (0-1) to a heatmap color (Black -> Blue -> Cyan -> Green -> Yellow -> Red -> White)
export function getHeatmapColor(value: number): [number, number, number] {
  // Clamp value
  const v = Math.max(0, Math.min(1, value));
  
  // Color stops
  // 0.0: Black
  // 0.2: Blue
  // 0.4: Cyan
  // 0.6: Green
  // 0.8: Yellow
  // 1.0: Red -> White tip
  
  let r = 0, g = 0, b = 0;

  if (v < 0.2) {
    // Black to Blue
    b = (v / 0.2) * 255;
  } else if (v < 0.4) {
    // Blue to Cyan
    b = 255;
    g = ((v - 0.2) / 0.2) * 255;
  } else if (v < 0.6) {
    // Cyan to Green
    b = 255 - ((v - 0.4) / 0.2) * 255;
    g = 255;
  } else if (v < 0.8) {
    // Green to Yellow
    g = 255;
    r = ((v - 0.6) / 0.2) * 255;
  } else if (v < 0.95) {
    // Yellow to Red
    r = 255;
    g = 255 - ((v - 0.8) / 0.15) * 255;
  } else {
    // Red to White (clipping/hot)
    r = 255;
    g = ((v - 0.95) / 0.05) * 255;
    b = ((v - 0.95) / 0.05) * 255;
  }

  return [Math.round(r), Math.round(g), Math.round(b)];
}

// Map phase radians (-PI to PI) to a cyclic HSV color
export function getPhaseColor(radians: number): [number, number, number] {
  // Map -PI..PI to 0..1
  let t = (radians + Math.PI) / (2 * Math.PI);
  // Clamp/Wrap to ensure 0-1 range
  t = t - Math.floor(t);

  // HSV to RGB conversion with Saturation=1, Value=1
  const i = Math.floor(t * 6);
  const f = t * 6 - i;
  const p = 0;
  const q = 1 - f;
  const u = f; // 't' in standard algo, renamed

  let r=0, g=0, b=0;
  switch (i % 6) {
      case 0: r = 1; g = u; b = 0; break;
      case 1: r = q; g = 1; b = 0; break;
      case 2: r = 0; g = 1; b = u; break;
      case 3: r = 0; g = q; b = 1; break;
      case 4: r = u; g = 0; b = 1; break;
      case 5: r = 1; g = 0; b = q; break;
  }
  
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function computeSoundField(
  width: number,
  height: number,
  resolution: number, // pixels per meter factor (actually calculation grid size relative to canvas)
  speakers: Speaker[],
  frequency: number,
  speedOfSound: number
): Float32Array {
  // We compute on a grid.
  // width/height are in canvas pixels.
  // To keep it performant, we might downscale the calculation grid compared to the display canvas.
  
  const buffer = new Float32Array(width * height);
  const k = (2 * Math.PI * frequency) / speedOfSound;
  
  // Pre-calculate speaker properties to avoid repeating inside the loop
  const activeSpeakers = speakers.filter(s => !s.mute && (!speakers.some(sp => sp.solo) || s.solo));

  if (activeSpeakers.length === 0) return buffer.fill(-Infinity);

  const sources = activeSpeakers.map(s => {
    // Convert delay to phase shift (radians)
    // Delay (ms) -> Seconds: d/1000
    // Phase = -omega * t = -2*pi*f * (d/1000)
    // Add polarity inversion (pi radians) if needed
    let phaseOffset = -(2 * Math.PI * frequency * (s.delay / 1000));
    if (s.polarity) phaseOffset += Math.PI;

    const amp = dbToLinear(s.gain);

    return {
      x: s.x, // These are in meters
      y: s.y, // These are in meters
      amp,
      phaseOffset
    };
  });

  // Meters per pixel (assuming canvas width maps to venueWidth)
  // But wait, the component handles the transform. 
  // Let's assume the function receives coordinates in "pixels" that need to be mapped to meters?
  // No, easier if we pass the meter-per-pixel ratio.
  // Actually, let's just loop through pixels and convert to meters inside.
  
  return buffer;
}
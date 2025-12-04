export interface Position {
  x: number; // meters
  y: number; // meters
}

export interface Group {
  id: string;
  name: string;
  color: string;
  mute: boolean;
  solo: boolean;
}

export interface Speaker {
  id: string;
  groupId?: string; // Optional reference to a group
  x: number; // meters from center
  y: number; // meters from center
  z: number; // height (reserved for 3D future use, default 0)
  gain: number; // dB
  delay: number; // milliseconds
  polarity: boolean; // true = inverted
  mute: boolean;
  solo: boolean;
  name: string;
}

export interface SimulationSettings {
  frequency: number; // Hz
  temperature: number; // Celsius
  venueWidth: number; // meters
  venueDepth: number; // meters
  resolution: number; // pixels per meter (calculation density)
  dynamicRange: number; // dB (heatmap range)
}

export interface Complex {
  re: number;
  im: number;
}
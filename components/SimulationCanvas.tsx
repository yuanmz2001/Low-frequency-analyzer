import React, { useRef, useEffect, useState } from 'react';
import { Speaker, SimulationSettings, Group } from '../types';
import { calculateSpeedOfSound, dbToLinear, getHeatmapColor, getPhaseColor } from '../utils/physics';

interface Props {
  speakers: Speaker[];
  groups: Group[];
  settings: SimulationSettings;
  viewMode: 'SPL' | 'Phase';
  selectedSpeakerIds: string[];
  onUpdateSpeakerPosition: (id: string, x: number, y: number) => void;
  onSelectSpeakers: (ids: string[]) => void;
}

const SimulationCanvas: React.FC<Props> = ({
  speakers,
  groups,
  settings,
  viewMode,
  selectedSpeakerIds,
  onUpdateSpeakerPosition,
  onSelectSpeakers,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  // Store initial positions of all selected speakers when drag starts
  const [initialPositions, setInitialPositions] = useState<Record<string, {x: number, y: number}>>({});

  // Physics constants derived from settings
  const c = calculateSpeedOfSound(settings.temperature);
  const k = (2 * Math.PI * settings.frequency) / c;
  
  // Transform helpers
  const metersToPixels = (meters: number, canvasSize: number, venueSize: number) => {
    return (meters / venueSize) * canvasSize + (canvasSize / 2);
  };

  const pixelsToMeters = (pixels: number, canvasSize: number, venueSize: number) => {
    return ((pixels - (canvasSize / 2)) / canvasSize) * venueSize;
  };

  // Helper to determine if a speaker is effectively muted
  const isSpeakerActive = (s: Speaker) => {
    const group = groups.find(g => g.id === s.groupId);
    // Speaker is active if NOT muted AND (No group OR Group not muted)
    // Also handle SOLO logic: 
    // If ANY speaker or ANY group is soloed, only those soloed are active.
    return !s.mute && (!group || !group.mute);
  };

  // Draw Heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Resolve Solo Logic
    const anySpeakerSolo = speakers.some(s => s.solo);
    const anyGroupSolo = groups.some(g => g.solo);
    const isSoloActive = anySpeakerSolo || anyGroupSolo;

    const activeSpeakers = speakers
      .filter(s => {
         const group = groups.find(g => g.id === s.groupId);
         const effectivelyMuted = s.mute || (group?.mute ?? false);
         
         if (effectivelyMuted) return false;

         if (isSoloActive) {
            // If solo mode is active, only include if this speaker OR its group is soloed
            return s.solo || (group?.solo ?? false);
         }
         return true;
      })
      .map(s => ({
        ...s,
        linGain: dbToLinear(s.gain),
        phaseShift: -(2 * Math.PI * settings.frequency * (s.delay / 1000)) + (s.polarity ? Math.PI : 0)
      }));

    if (activeSpeakers.length === 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    let maxPressure = 0;
    
    // Arrays to store result for second pass (normalization) if needed
    // Float32Array initialized to 0
    const reMap = new Float32Array(width * height);
    const imMap = new Float32Array(width * height);
    const magMap = new Float32Array(width * height);

    for (let py = 0; py < height; py++) {
      const yMeters = pixelsToMeters(py, height, settings.venueDepth);
      for (let px = 0; px < width; px++) {
        const xMeters = pixelsToMeters(px, width, settings.venueWidth);

        let reTotal = 0;
        let imTotal = 0;

        for (const s of activeSpeakers) {
          const dx = xMeters - s.x;
          const dy = yMeters - s.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          const dist = Math.max(r, 0.1); 
          const mag = s.linGain / dist;
          const phase = -k * r + s.phaseShift;

          reTotal += mag * Math.cos(phase);
          imTotal += mag * Math.sin(phase);
        }
        
        const idx = py * width + px;
        const pressure = Math.sqrt(reTotal * reTotal + imTotal * imTotal);
        
        reMap[idx] = reTotal;
        imMap[idx] = imTotal;
        magMap[idx] = pressure;

        if (pressure > maxPressure) maxPressure = pressure;
      }
    }

    const minPressure = maxPressure * dbToLinear(-settings.dynamicRange);

    for (let i = 0; i < magMap.length; i++) {
      const p = magMap[i];
      let r=0, g=0, b=0;

      if (viewMode === 'SPL') {
        let intensity = 0;
        if (p > 0) {
          const dbRelative = 20 * Math.log10(p / maxPressure);
          intensity = (dbRelative + settings.dynamicRange) / settings.dynamicRange;
        }
        [r, g, b] = getHeatmapColor(intensity);
      } else {
        // Phase Mode
        // Only show phase if magnitude is significant enough
        if (p > minPressure) {
            const phase = Math.atan2(imMap[i], reMap[i]); // -PI to PI
            [r, g, b] = getPhaseColor(phase);
        } else {
            // Too quiet, phase is chaotic/irrelevant
            r=15; g=23; b=42; // Background color #0f172a
        }
      }
      
      const idx = i * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

  }, [speakers, groups, settings, k, viewMode]);

  // Draw Overlay
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridSpacingMeters = Math.max(1, Math.round(settings.venueWidth / 10));
    
    for (let x = -settings.venueWidth/2; x <= settings.venueWidth/2; x += gridSpacingMeters) {
        const px = metersToPixels(x, width, settings.venueWidth);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
        if (Math.abs(x) < settings.venueWidth/2) {
             ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
             ctx.font = '10px sans-serif';
             ctx.fillText(`${x}m`, px + 2, height - 5);
        }
    }
    
    for (let y = -settings.venueDepth/2; y <= settings.venueDepth/2; y += gridSpacingMeters) {
        const py = metersToPixels(y, height, settings.venueDepth);
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
         if (Math.abs(y) < settings.venueDepth/2) {
             ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
             ctx.font = '10px sans-serif';
             ctx.fillText(`${y}m`, 5, py - 2);
        }
    }

    // Phase Wavefronts for Selected Speakers
    if (viewMode === 'Phase' && selectedSpeakerIds.length > 0) {
      selectedSpeakerIds.forEach(id => {
        const s = speakers.find(sp => sp.id === id);
        if (!s) return;
        
        // Calculate properties
        const phaseShift = -(2 * Math.PI * settings.frequency * (s.delay / 1000)) + (s.polarity ? Math.PI : 0);
        const lambda = c / settings.frequency; // wavelength in meters
        
        // base_r represents the theoretical distance where phase would be 0 (mod 2PI)
        const base_r = (phaseShift / (2 * Math.PI)) * lambda;
        
        // Find first positive wavefront ring
        const start_m = Math.ceil(-base_r / lambda);
        
        const maxDistMeters = Math.sqrt(settings.venueWidth**2 + settings.venueDepth**2);
        const sx = metersToPixels(s.x, width, settings.venueWidth);
        const sy = metersToPixels(s.y, height, settings.venueDepth);
        
        // Scale factor (pixels per meter)
        const scale = width / settings.venueWidth;

        ctx.lineWidth = 1;
        
        // Draw Peaks (0 deg) - Solid White
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([]);
        for (let m = start_m; ; m++) {
            const r = base_r + m * lambda;
            if (r > maxDistMeters) break;
            
            const radiusPx = r * scale;
            ctx.beginPath();
            ctx.arc(sx, sy, radiusPx, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Draw Troughs (180 deg) - Dashed White
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([4, 4]);
        const base_r_trough = base_r - (lambda / 2);
        const start_m_trough = Math.ceil(-base_r_trough / lambda);

        for (let m = start_m_trough; ; m++) {
              const r = base_r_trough + m * lambda;
              if (r > maxDistMeters) break;
              if (r < 0) continue;

              const radiusPx = r * scale;
              ctx.beginPath();
              ctx.arc(sx, sy, radiusPx, 0, 2 * Math.PI);
              ctx.stroke();
        }
      });
      ctx.setLineDash([]); // Reset dash
    }

    // Speakers
    speakers.forEach(s => {
      const x = metersToPixels(s.x, width, settings.venueWidth);
      const y = metersToPixels(s.y, height, settings.venueDepth);
      
      const isSelected = selectedSpeakerIds.includes(s.id);
      const group = groups.find(g => g.id === s.groupId);
      const color = group ? group.color : '#3b82f6'; // Default brand blue
      
      const isMuted = s.mute || (group?.mute ?? false);

      // Selection Ring
      if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, 2 * Math.PI);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      
      if (isMuted) {
          ctx.fillStyle = '#ef4444'; // Red if muted
      } else {
          ctx.fillStyle = color;
      }
      
      ctx.fill();
      
      // Border
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSelected ? '#fff' : (group ? '#fff' : '#ccc');
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      
      // Show group name if in group
      const label = s.name; // group ? `${group.name}: ${s.name}` : s.name;
      ctx.fillText(label, x, y - 15);
    });

  }, [speakers, groups, settings, selectedSpeakerIds, viewMode, c]);

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Hit test
    let clickedId: string | null = null;
    for (let i = speakers.length - 1; i >= 0; i--) {
      const s = speakers[i];
      const width = overlayRef.current!.width;
      const height = overlayRef.current!.height;
      const sx = metersToPixels(s.x, width, settings.venueWidth);
      const sy = metersToPixels(s.y, height, settings.venueDepth);
      
      const dist = Math.sqrt((mouseX - sx) ** 2 + (mouseY - sy) ** 2);
      if (dist < 15) {
        clickedId = s.id;
        break;
      }
    }

    if (clickedId) {
        // Speaker Clicked
        const isShift = e.shiftKey;
        let newSelection = [...selectedSpeakerIds];

        if (isShift) {
            // Toggle
            if (newSelection.includes(clickedId)) {
                newSelection = newSelection.filter(id => id !== clickedId);
            } else {
                newSelection.push(clickedId);
            }
        } else {
            // If clicking on an already selected item (and no shift), keep selection for dragging
            // Unless it wasn't selected, then select only it
            if (!newSelection.includes(clickedId)) {
                newSelection = [clickedId];
            }
        }
        
        onSelectSpeakers(newSelection);
        
        // Setup Drag
        setIsDragging(true);
        setDragStart({ x: mouseX, y: mouseY });
        
        // Snapshot positions
        const positions: Record<string, {x: number, y: number}> = {};
        speakers.forEach(s => {
            if (newSelection.includes(s.id)) {
                positions[s.id] = { x: s.x, y: s.y };
            }
        });
        setInitialPositions(positions);
    } else {
        // Background Clicked -> Clear selection
        onSelectSpeakers([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || selectedSpeakerIds.length === 0) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const width = overlayRef.current!.width;
    const height = overlayRef.current!.height;

    // Calculate delta in meters
    const deltaPixelsX = mouseX - dragStart.x;
    const deltaPixelsY = mouseY - dragStart.y;
    
    const deltaMetersX = (deltaPixelsX / width) * settings.venueWidth;
    const deltaMetersY = (deltaPixelsY / height) * settings.venueDepth;

    // Update all selected speakers relative to their initial positions
    selectedSpeakerIds.forEach(id => {
        const initial = initialPositions[id];
        if (initial) {
             const newX = initial.x + deltaMetersX;
             const newY = initial.y + deltaMetersY;
             onUpdateSpeakerPosition(id, newX, newY);
        }
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    setInitialPositions({});
  };

  const [dimensions, setDimensions] = useState({ w: 600, h: 600 });
  useEffect(() => {
    if(!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        setDimensions({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner cursor-crosshair">
      <canvas 
        ref={canvasRef}
        width={dimensions.w}
        height={dimensions.h}
        className="absolute top-0 left-0 w-full h-full"
      />
      <canvas 
        ref={overlayRef}
        width={dimensions.w}
        height={dimensions.h}
        className="absolute top-0 left-0 w-full h-full focus:outline-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        tabIndex={0}
      />
      <div className="absolute top-4 left-4 pointer-events-none bg-black/60 backdrop-blur text-xs text-white p-2 rounded">
        <div>Resolution: {Math.round(dimensions.w)}px</div>
        <div>Scale: {(settings.venueWidth / dimensions.w * 100).toFixed(1)} cm/px</div>
      </div>
    </div>
  );
};

export default SimulationCanvas;
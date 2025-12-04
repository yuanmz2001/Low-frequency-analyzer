import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import SimulationCanvas from './components/SimulationCanvas';
import Controls from './components/Controls';
import { Speaker, SimulationSettings, Group } from './types';
import { calculateSpeedOfSound } from './utils/physics';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Default colors for new groups
const GROUP_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#facc15', '#a855f7', '#f97316', '#ec4899'];

const App: React.FC = () => {
  // --- State ---
  const [settings, setSettings] = useState<SimulationSettings>({
    frequency: 60, // Standard sub frequency
    temperature: 20,
    venueWidth: 20,
    venueDepth: 20,
    resolution: 1, 
    dynamicRange: 36 // dB
  });
  
  const [viewMode, setViewMode] = useState<'SPL' | 'Phase'>('SPL');

  const [speakers, setSpeakers] = useState<Speaker[]>([
    { id: '1', name: 'Sub 1', x: -0.5, y: 0, z: 0, gain: 0, delay: 0, polarity: false, mute: false, solo: false },
    { id: '2', name: 'Sub 2', x: 0.5, y: 0, z: 0, gain: 0, delay: 0, polarity: false, mute: false, solo: false },
  ]);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>(['1']);

  // --- Handlers ---

  // Unified updater for one or more speakers
  const handleUpdateSpeakers = (ids: string[], updates: Partial<Speaker>) => {
    setSpeakers(prev => prev.map(s => ids.includes(s.id) ? { ...s, ...updates } : s));
  };

  const handleUpdateSpeakerPosition = (id: string, x: number, y: number) => {
      setSpeakers(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
  };

  const handleUpdateGroup = (id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const handleCreateGroup = (speakerIds: string[]) => {
    const newGroup: Group = {
      id: generateId(),
      name: `Group ${String.fromCharCode(65 + groups.length)}`, // Group A, Group B...
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      mute: false,
      solo: false
    };
    setGroups([...groups, newGroup]);
    
    // Assign selected speakers to this new group
    if (speakerIds.length > 0) {
      handleUpdateSpeakers(speakerIds, { groupId: newGroup.id });
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    // Remove group
    setGroups(prev => prev.filter(g => g.id !== groupId));
    // Unassign speakers
    setSpeakers(prev => prev.map(s => s.groupId === groupId ? { ...s, groupId: undefined } : s));
  };

  const handleAddSpeaker = () => {
    const newSpeaker: Speaker = {
      id: generateId(),
      name: `Sub ${speakers.length + 1}`,
      x: 0,
      y: 0,
      z: 0,
      gain: 0,
      delay: 0,
      polarity: false,
      mute: false,
      solo: false
    };
    setSpeakers([...speakers, newSpeaker]);
    setSelectedSpeakerIds([newSpeaker.id]);
  };

  const handleRemoveSpeakers = (ids: string[]) => {
    setSpeakers(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedSpeakerIds([]);
  };

  const handleCloneSpeaker = (id: string) => {
    const original = speakers.find(s => s.id === id);
    if (!original) return;
    const newSpeaker = {
        ...original,
        id: generateId(),
        name: `${original.name} (Copy)`,
        x: original.x + 0.5, // slightly offset
        y: original.y + 0.5
    };
    setSpeakers([...speakers, newSpeaker]);
    setSelectedSpeakerIds([newSpeaker.id]);
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedSpeakerIds(ids);
  };

  const handleApplyPreset = (type: 'broadside' | 'endfire' | 'gradient' | 'inverted_stack') => {
    const c = calculateSpeedOfSound(settings.temperature);
    const lambda = c / settings.frequency;
    
    let newSpeakers: Speaker[] = [];

    switch (type) {
        case 'broadside':
            [-1.5, -0.5, 0.5, 1.5].forEach((offset, i) => {
                newSpeakers.push({
                    id: generateId(), name: `Sub ${i+1}`, x: offset, y: 0, z: 0, gain: 0, delay: 0, polarity: false, mute: false, solo: false
                });
            });
            break;
        case 'endfire':
            const spacing = lambda / 4;
            const delayMs = (spacing / c) * 1000;
            [0, 1, 2, 3].forEach((i) => {
                const yPos = i * spacing - (1.5 * spacing);
                newSpeakers.push({
                    id: generateId(), name: `EF ${i+1}`, x: 0, y: yPos, z: 0, gain: 0, 
                    delay: i * delayMs, 
                    polarity: false, mute: false, solo: false
                });
            });
            break;
        case 'gradient':
            const dist = lambda / 4;
            const timeMs = (dist / c) * 1000;
            newSpeakers.push({
                id: generateId(), name: 'Front', x: 0, y: 0, z: 0, gain: 0, delay: 0, polarity: false, mute: false, solo: false
            });
            newSpeakers.push({
                id: generateId(), name: 'Rear', x: 0, y: -dist, z: 0, gain: 0, 
                delay: timeMs, polarity: true, mute: false, solo: false
            });
            break;
        case 'inverted_stack':
             newSpeakers.push({ id: generateId(), name: 'Sub 1', x: -0.6, y: 0, z: 0, gain: 0, delay: 0, polarity: false, mute: false, solo: false });
             newSpeakers.push({ id: generateId(), name: 'Sub 2 (Cardioid)', x: 0, y: 0.1, z: 0, gain: 0, delay: 0, polarity: true, mute: false, solo: false }); 
             newSpeakers.push({ id: generateId(), name: 'Sub 3', x: 0.6, y: 0, z: 0, gain: 0, delay: 0, polarity: false, mute: false, solo: false });
             break;
    }
    setSpeakers(newSpeakers);
    if(newSpeakers.length > 0) setSelectedSpeakerIds([newSpeakers[0].id]);
  };

  return (
    <div className="flex h-screen w-full bg-gray-950 text-white overflow-hidden font-sans">
      
      {/* Simulation Area */}
      <div className="flex-grow relative flex flex-col">
         <div className="flex-grow p-4 relative">
             <SimulationCanvas 
                speakers={speakers}
                groups={groups}
                settings={settings}
                viewMode={viewMode}
                selectedSpeakerIds={selectedSpeakerIds}
                onUpdateSpeakerPosition={handleUpdateSpeakerPosition}
                onSelectSpeakers={handleSelectionChange}
             />
         </div>
         
         <div className="h-8 bg-gray-900 border-t border-slate-800 flex items-center px-4 text-xs text-slate-500 justify-between">
            <span>Shift+Click to select multiple. Drag to move.</span>
            
            {viewMode === 'SPL' ? (
              <span className="flex items-center gap-2">
                   <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"/> -30dB
                   <span className="w-3 h-3 rounded-full bg-green-500 inline-block"/> -12dB
                   <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"/> -3dB
                   <span className="w-3 h-3 rounded-full bg-red-500 inline-block"/> 0dB
              </span>
            ) : (
              <span className="flex items-center gap-2">
                   <span className="w-3 h-3 bg-red-500 inline-block"/> 
                   <span className="w-3 h-3 bg-yellow-500 inline-block"/> 
                   <span className="w-3 h-3 bg-green-500 inline-block"/> 
                   <span className="w-3 h-3 bg-cyan-500 inline-block"/> 
                   <span className="w-3 h-3 bg-blue-500 inline-block"/> 
                   <span className="w-3 h-3 bg-fuchsia-500 inline-block"/> 
                   <span className="ml-1">Phase (-180° to +180°)</span>
              </span>
            )}
         </div>
      </div>

      {/* Sidebar */}
      <Controls 
        speakers={speakers}
        groups={groups}
        settings={settings}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedIds={selectedSpeakerIds}
        onSettingsChange={setSettings}
        onUpdateSpeakers={handleUpdateSpeakers}
        onAddSpeaker={handleAddSpeaker}
        onRemoveSpeakers={handleRemoveSpeakers}
        onCloneSpeaker={handleCloneSpeaker}
        onApplyPreset={handleApplyPreset}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onSelectSpeakers={handleSelectionChange}
      />
      
    </div>
  );
};

export default App;
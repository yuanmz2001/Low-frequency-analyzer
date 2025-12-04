import React from 'react';
import { Speaker, SimulationSettings, Group } from '../types';
import { Trash2, Copy, Volume2, VolumeX, Eye, EyeOff, Plus, ArrowLeftRight, Grid, Users, Layers, Activity, Waves } from 'lucide-react';

interface Props {
  speakers: Speaker[];
  groups: Group[];
  settings: SimulationSettings;
  viewMode: 'SPL' | 'Phase';
  onViewModeChange: (mode: 'SPL' | 'Phase') => void;
  selectedIds: string[];
  onSettingsChange: (s: SimulationSettings) => void;
  onUpdateSpeakers: (ids: string[], updates: Partial<Speaker>) => void;
  onAddSpeaker: () => void;
  onRemoveSpeakers: (ids: string[]) => void;
  onCloneSpeaker: (id: string) => void;
  onApplyPreset: (type: 'broadside' | 'endfire' | 'gradient' | 'inverted_stack') => void;
  onCreateGroup: (selectedIds: string[]) => void;
  onUpdateGroup: (id: string, updates: Partial<Group>) => void;
  onDeleteGroup: (id: string) => void;
  onSelectSpeakers: (ids: string[]) => void;
}

const Controls: React.FC<Props> = ({
  speakers,
  groups,
  settings,
  viewMode,
  onViewModeChange,
  selectedIds,
  onSettingsChange,
  onUpdateSpeakers,
  onAddSpeaker,
  onRemoveSpeakers,
  onCloneSpeaker,
  onApplyPreset,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSelectSpeakers
}) => {
  
  // Helpers for multi-selection values
  const selectedSpeakers = speakers.filter(s => selectedIds.includes(s.id));
  const firstSelected = selectedSpeakers[0];

  // If multiple values differ, we could show mixed state. For simplicity, we show the first one's value.
  const displayGain = firstSelected?.gain || 0;
  const displayDelay = firstSelected?.delay || 0;
  const displayPolarity = firstSelected?.polarity || false;
  const displayMute = selectedSpeakers.every(s => s.mute); // All must be muted to show muted
  const displaySolo = selectedSpeakers.some(s => s.solo); // If any solo, show solo

  // Determine group state of selection
  const uniqueGroupIds = Array.from(new Set(selectedSpeakers.map(s => s.groupId).filter(Boolean)));
  const commonGroupId = uniqueGroupIds.length === 1 ? uniqueGroupIds[0] : null;

  return (
    <div className="flex flex-col h-full bg-gray-850 text-slate-300 border-l border-slate-700 w-80 shadow-xl overflow-y-auto">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-gray-950">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
           <Volume2 className="text-brand-500"/> LowFreq Sim
        </h2>
      </div>

      {/* Global Settings */}
      <div className="p-4 border-b border-slate-700 space-y-4">
         <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Venue & Physics</h3>
         </div>
         <div className="space-y-3">
             <div className="grid grid-cols-2 gap-3">
                <div className='flex flex-col gap-1'>
                    <div className="flex justify-between items-center">
                        <label className='text-[10px] uppercase text-slate-500'>Freq</label>
                        <span className='text-[10px] font-mono text-brand-500'>{settings.frequency}Hz</span>
                    </div>
                    <input 
                      type="range" min="20" max="200" step="1"
                      value={settings.frequency}
                      onChange={(e) => onSettingsChange({...settings, frequency: Number(e.target.value)})}
                      className="w-full accent-brand-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer my-1"
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <label className='text-[10px] uppercase text-slate-500'>Temp (°C)</label>
                    <input 
                      type="number" min="-10" max="50" 
                      value={settings.temperature}
                      onChange={(e) => onSettingsChange({...settings, temperature: Number(e.target.value)})}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm font-mono"
                    />
                </div>
             </div>
             
             {/* View Mode Toggle */}
             <div className="bg-slate-800 p-1 rounded-lg flex gap-1">
                 <button 
                    onClick={() => onViewModeChange('SPL')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${viewMode === 'SPL' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                    <Waves size={12} /> Magnitude
                 </button>
                 <button 
                    onClick={() => onViewModeChange('Phase')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${viewMode === 'Phase' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                    <Activity size={12} /> Phase
                 </button>
             </div>
         </div>
      </div>

      {/* Group Manager */}
      <div className="p-4 border-b border-slate-700 bg-gray-900/30">
          <div className="flex items-center justify-between mb-3">
             <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                 <Users size={12}/> Groups
             </h3>
             <button onClick={() => onCreateGroup([])} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700">
                 + New Group
             </button>
          </div>
          
          <div className="space-y-2">
             {groups.length === 0 && <p className="text-xs text-slate-600 italic">No groups created</p>}
             {groups.map(g => (
                 <div key={g.id} className="flex items-center gap-2 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                     <input 
                        className="bg-transparent border-none text-xs font-medium text-white w-full focus:outline-none focus:bg-slate-800 px-1 rounded"
                        value={g.name}
                        onChange={(e) => onUpdateGroup(g.id, { name: e.target.value })}
                     />
                     <div className="flex items-center gap-1">
                        <button 
                            onClick={() => onUpdateGroup(g.id, { mute: !g.mute })}
                            className={`p-1 rounded ${g.mute ? 'bg-red-500/20 text-red-500' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Mute Group"
                        >
                            {g.mute ? <VolumeX size={12}/> : <Volume2 size={12}/>}
                        </button>
                        <button 
                            onClick={() => onUpdateGroup(g.id, { solo: !g.solo })}
                            className={`p-1 rounded ${g.solo ? 'bg-blue-500/20 text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Solo Group"
                        >
                            {g.solo ? <Eye size={12}/> : <EyeOff size={12}/>}
                        </button>
                         <button 
                            onClick={() => {
                                // Select all speakers in group
                                const ids = speakers.filter(s => s.groupId === g.id).map(s => s.id);
                                onSelectSpeakers(ids);
                            }}
                            className="p-1 text-slate-500 hover:text-white"
                            title="Select Group Members"
                        >
                            <Grid size={12}/>
                        </button>
                         <button 
                            onClick={() => onDeleteGroup(g.id)}
                            className="p-1 text-slate-600 hover:text-red-400"
                            title="Delete Group"
                        >
                            <Trash2 size={12}/>
                        </button>
                     </div>
                 </div>
             ))}
          </div>
      </div>

      {/* Selected Properties */}
      <div className="p-4 border-b border-slate-700 flex-grow">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 flex justify-between items-center">
            {selectedSpeakers.length > 1 ? `${selectedSpeakers.length} Selected` : 'Speaker Properties'}
            {selectedSpeakers.length > 0 && <span className="text-brand-500 text-xs bg-brand-500/10 px-2 py-0.5 rounded">Active</span>}
        </h3>

        {selectedSpeakers.length > 0 ? (
          <div className="space-y-5 animate-fadeIn">
            
            {/* Name & Group Assignment */}
            <div className="grid grid-cols-1 gap-2">
                {selectedSpeakers.length === 1 && (
                     <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Name</label>
                        <input 
                            type="text" 
                            value={firstSelected.name}
                            onChange={(e) => onUpdateSpeakers([firstSelected.id], { name: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm font-semibold"
                        />
                    </div>
                )}
                
                {/* Group Dropdown */}
                <div>
                     <label className="text-[10px] text-slate-400 block mb-1">Group Assignment</label>
                     <div className="flex gap-2">
                         <select 
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs"
                            value={commonGroupId || ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                    onUpdateSpeakers(selectedIds, { groupId: undefined });
                                } else {
                                    onUpdateSpeakers(selectedIds, { groupId: val });
                                }
                            }}
                         >
                            <option value="">No Group</option>
                            {uniqueGroupIds.length > 1 && <option value="mixed" disabled>-- Mixed --</option>}
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                         </select>
                         {commonGroupId === null && selectedSpeakers.length > 0 && (
                             <button 
                                onClick={() => onCreateGroup(selectedIds)}
                                className="whitespace-nowrap px-2 py-1 bg-brand-600 text-xs rounded hover:bg-brand-500 transition-colors"
                             >
                                Create Group
                             </button>
                         )}
                     </div>
                </div>
            </div>

            {/* Position Controls (Only for single selection ideally, or relative for multi - disable for multi for now to simple) */}
            {selectedSpeakers.length === 1 && (
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] text-slate-400 block mb-1">X (m)</label>
                    <input 
                    type="number" step="0.01"
                    value={firstSelected.x}
                    onChange={(e) => onUpdateSpeakers([firstSelected.id], { x: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Y (m)</label>
                    <input 
                    type="number" step="0.01"
                    value={firstSelected.y}
                    onChange={(e) => onUpdateSpeakers([firstSelected.id], { y: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
                    />
                </div>
                </div>
            )}

            {/* Common Acoustic Params */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400">Gain (dB)</label>
                <span className="text-xs font-mono">{displayGain.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="-60" max="10" step="0.1" 
                value={displayGain}
                onChange={(e) => onUpdateSpeakers(selectedIds, { gain: Number(e.target.value) })}
                className="w-full accent-green-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400">Delay (ms)</label>
                <span className="text-xs font-mono">{displayDelay.toFixed(2)} ms</span>
              </div>
              <input 
                type="range" min="0" max="50" step="0.01" 
                value={displayDelay}
                onChange={(e) => onUpdateSpeakers(selectedIds, { delay: Number(e.target.value) })}
                className="w-full accent-orange-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => onUpdateSpeakers(selectedIds, { polarity: !displayPolarity })}
                  className={`flex-1 py-1.5 rounded text-xs font-medium border flex items-center justify-center gap-1 transition-colors ${displayPolarity ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}
                >
                  <ArrowLeftRight size={14} /> {displayPolarity ? 'Inverted' : 'Polarity'}
                </button>
                 <button 
                  onClick={() => onUpdateSpeakers(selectedIds, { mute: !displayMute })}
                  className={`flex-1 py-1.5 rounded text-xs font-medium border flex items-center justify-center gap-1 transition-colors ${displayMute ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}
                >
                  {displayMute ? <VolumeX size={14}/> : <Volume2 size={14}/>} {displayMute ? 'Muted' : 'Mute'}
                </button>
                 <button 
                  onClick={() => onUpdateSpeakers(selectedIds, { solo: !displaySolo })}
                  className={`flex-1 py-1.5 rounded text-xs font-medium border flex items-center justify-center gap-1 transition-colors ${displaySolo ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}
                >
                  {displaySolo ? <Eye size={14}/> : <EyeOff size={14}/>} Solo
                </button>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700">
               {selectedIds.length === 1 && (
                    <button 
                        onClick={() => onCloneSpeaker(firstSelected.id)}
                        className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Duplicate"
                    >
                    <Copy size={16} />
                    </button>
               )}
               <button 
                  onClick={() => onRemoveSpeakers(selectedIds)}
                  className="p-2 rounded bg-slate-800 hover:bg-red-900/50 text-red-400 hover:text-red-300 transition-colors ml-auto"
                  title="Remove Selected"
                >
                  <Trash2 size={16} />
                </button>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
             <Grid size={48} strokeWidth={1} className="mb-2 opacity-20"/>
             <p>Select speakers to edit</p>
             <p className="text-xs opacity-50">Hold Shift to select multiple</p>
          </div>
        )}
      </div>

       {/* Quick Actions */}
      <div className="p-4 bg-gray-900">
        <button 
            onClick={onAddSpeaker}
            className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white rounded font-medium flex items-center justify-center gap-2 mb-4 transition-colors shadow-lg shadow-brand-900/20"
        >
            <Plus size={18} /> Add Subwoofer
        </button>
        
        <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2">Quick Arrays</h4>
        <div className="grid grid-cols-2 gap-2">
           <button onClick={() => onApplyPreset('broadside')} className="text-xs bg-slate-800 hover:bg-slate-700 py-2 rounded text-slate-300 border border-slate-700">Line</button>
           <button onClick={() => onApplyPreset('endfire')} className="text-xs bg-slate-800 hover:bg-slate-700 py-2 rounded text-slate-300 border border-slate-700">End-Fire</button>
           <button onClick={() => onApplyPreset('gradient')} className="text-xs bg-slate-800 hover:bg-slate-700 py-2 rounded text-slate-300 border border-slate-700">Cardioid</button>
           <button onClick={() => onApplyPreset('inverted_stack')} className="text-xs bg-slate-800 hover:bg-slate-700 py-2 rounded text-slate-300 border border-slate-700">Stack</button>
        </div>
      </div>
    </div>
  );
};

export default Controls;
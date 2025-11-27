import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wand2, 
  Download, 
  RefreshCw, 
  Music2, 
  Settings, 
  Layers,
  Save,
  FolderOpen,
  Sparkles
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AIChatbot from '@/components/counterpoint/AIChatbot';
import { motion, AnimatePresence } from 'framer-motion';

import NoteGrid from '@/components/counterpoint/NoteGrid';
import VoiceEditor from '@/components/counterpoint/VoiceEditor';
import PlaybackControls from '@/components/counterpoint/PlaybackControls';
import PianoKeyboard from '@/components/counterpoint/PianoKeyboard';
import CantusFirmusEditor from '@/components/counterpoint/CantusFirmusEditor';
import GenerationSettings from '@/components/counterpoint/GenerationSettings';
import { generateCounterpoint, validateCounterpoint } from '@/components/counterpoint/counterpointEngine';
import { initAudio, playNote, stopAllNotes, playMetronomeClick } from '@/components/counterpoint/audioEngine';

const DEFAULT_VOICES = [
  { name: 'Cantus Firmus', enabled: true, lowRange: 'C4', highRange: 'C5', volume: 80 },
  { name: 'Soprano', enabled: true, lowRange: 'C4', highRange: 'G5', volume: 75 },
  { name: 'Alto', enabled: false, lowRange: 'F3', highRange: 'D5', volume: 70 },
  { name: 'Bass', enabled: false, lowRange: 'E2', highRange: 'C4', volume: 80 },
];

const DEFAULT_SETTINGS = {
  species: '1st',
  key: 'C',
  mode: 'major',
  measures: 8,
  numVoices: 2,
  strictRules: true,
  showViolations: true,
  timeSignature: '4/4',
};

export default function CounterpointGenerator() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState(DEFAULT_VOICES);
  const [cantusFirmus, setCantusFirmus] = useState([]);
  const [generatedVoices, setGeneratedVoices] = useState([]);
  const [violations, setViolations] = useState([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [tempo, setTempo] = useState(80);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  
  const [activeTab, setActiveTab] = useState('compose');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [activeVoice, setActiveVoice] = useState(0);
      const [pianoInstrument, setPianoInstrument] = useState('organ');
          const [selectedNotes, setSelectedNotes] = useState([]);
          const scrollToBeatRef = useRef(null);
          const [pressedPianoNotes, setPressedPianoNotes] = useState(new Set());
  
  const playbackRef = useRef(null);
      const audioInitialized = useRef(false);
      const queryClient = useQueryClient();

      // Global spacebar handler for play/pause
      useEffect(() => {
        const handleKeyDown = (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          if (e.key === ' ') {
            e.preventDefault();
            handlePlayPause();
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [isPlaying]);

  // Fetch saved projects
  const { data: savedProjects = [] } = useQuery({
    queryKey: ['counterpoint-projects'],
    queryFn: () => base44.entities.CounterpointProject.list('-created_date'),
  });

  // Save project mutation
  const saveProjectMutation = useMutation({
    mutationFn: async (data) => {
      if (currentProjectId) {
        await base44.entities.CounterpointProject.update(currentProjectId, data);
        return { id: currentProjectId };
      }
      const result = await base44.entities.CounterpointProject.create(data);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['counterpoint-projects'] });
      if (result?.id) {
        setCurrentProjectId(result.id);
      }
      setSaveDialogOpen(false);
    },
    onError: (error) => {
      console.error('Save failed:', error);
    }
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (id) => base44.entities.CounterpointProject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['counterpoint-projects'] });
    }
  });

  const handleSaveProject = () => {
    if (!projectName.trim()) return;
    saveProjectMutation.mutate({
      name: projectName,
      settings,
      cantusFirmus,
      generatedVoices,
      voices
    });
  };

  const handleLoadProject = (project) => {
    setSettings(project.settings || DEFAULT_SETTINGS);
    setCantusFirmus(project.cantusFirmus || []);
    setGeneratedVoices(project.generatedVoices || []);
    setVoices(project.voices || DEFAULT_VOICES);
    setProjectName(project.name);
    setCurrentProjectId(project.id);
    setLoadDialogOpen(false);
  };

  const handleNewProject = () => {
    setSettings(DEFAULT_SETTINGS);
    setCantusFirmus([]);
    setGeneratedVoices([]);
    setVoices(DEFAULT_VOICES);
    setProjectName('');
    setCurrentProjectId(null);
  };

  // Initialize audio on first interaction
  const ensureAudio = useCallback(() => {
    if (!audioInitialized.current) {
      initAudio();
      audioInitialized.current = true;
    }
  }, []);

  // Get all voices for display
  const allVoices = [
    { name: 'Cantus Firmus', notes: cantusFirmus, enabled: true },
    ...generatedVoices
  ];

  // Get active notes at current beat
  const activeNotes = allVoices.flatMap(voice => 
    voice.notes?.filter(n => Math.floor(n.beat) === currentBeat) || []
  );

  // Handle voice config update
  const updateVoice = (index, updatedVoice) => {
    const newVoices = [...voices];
    newVoices[index] = updatedVoice;
    setVoices(newVoices);
    
    // Update numVoices based on enabled voices
    const enabledCount = newVoices.filter(v => v.enabled).length;
    if (enabledCount !== settings.numVoices) {
      setSettings(prev => ({ ...prev, numVoices: enabledCount }));
    }
  };

  // Generate counterpoint
  const handleGenerate = async () => {
    if (cantusFirmus.length === 0) return;
    
    ensureAudio();
    setIsGenerating(true);
    
    // Simulate processing time for effect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const result = generateCounterpoint(cantusFirmus, settings, voices);
    setGeneratedVoices(result.voices);
    
    // Validate and get violations
    const newViolations = validateCounterpoint(result.voices, cantusFirmus);
    setViolations(newViolations);
    
    setIsGenerating(false);
  };

  // Get beats per measure based on time signature
  const getBeatsPerMeasure = (timeSig) => {
    const map = { '4/4': 16, '3/4': 12, '2/4': 8, '6/8': 12, '2/2': 8 };
    return map[timeSig] || 16;
  };

  // Playback logic - based on time signature
  useEffect(() => {
    if (isPlaying) {
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      const msPerBeat = (60 / tempo) * 1000 / 4; // 16th notes = quarter note / 4
      const totalBeats = settings.measures * beatsPerMeasure;
      
      // If selected notes exist, determine loop bounds from selection
      let selectionStart = 0;
      let selectionEnd = totalBeats;
      if (selectedNotes.length > 0) {
        selectionStart = Math.min(...selectedNotes.map(n => n.beat));
        selectionEnd = Math.max(...selectedNotes.map(n => n.beat + (n.duration || 1)));
      }
      
      const effectiveLoopEnd = selectedNotes.length > 0 ? selectionEnd : (loopEnd ?? totalBeats);
      const effectiveLoopStart = selectedNotes.length > 0 ? selectionStart : loopStart;
      
      playbackRef.current = setInterval(() => {
        setCurrentBeat(prev => {
          const next = prev + 1;
          if (next >= effectiveLoopEnd) {
            if (isLooping || selectedNotes.length > 0) {
              return effectiveLoopStart;
            }
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, msPerBeat);
      
      return () => clearInterval(playbackRef.current);
    } else {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    }
  }, [isPlaying, tempo, settings.measures, settings.timeSignature, isLooping, loopStart, loopEnd, selectedNotes]);

  // Play notes at current beat
      useEffect(() => {
        if (isPlaying) {
          // If there are selected notes, only play those
          if (selectedNotes.length > 0) {
            const notesAtBeat = selectedNotes.filter(n => n.beat === currentBeat);
            notesAtBeat.forEach(note => {
              const volume = (voices[0]?.volume || 80) / 100;
              const actualDuration = (note.duration || 1) * (60 / tempo) * 0.9;
              const instrument = voices[0]?.instrument || 'organ';
              playNote(note.pitch, actualDuration, volume * 0.7, 0, instrument);
            });
          } else {
            // Play cantus firmus notes directly from cantusFirmus state
            const cfNotesAtBeat = cantusFirmus.filter(n => n.beat === currentBeat);
            cfNotesAtBeat.forEach(note => {
              const volume = (voices[0]?.volume || 80) / 100;
              const actualDuration = (note.duration || 1) * (60 / tempo) * 0.9;
              const instrument = voices[0]?.instrument || 'organ';
              playNote(note.pitch, actualDuration, volume * 0.7, 0, instrument);
            });

            // Play generated voices
            generatedVoices.forEach((voice, idx) => {
              const voiceIndex = idx + 1;
              if (!voices[voiceIndex]?.enabled) return;

              const notesAtBeat = voice.notes?.filter(n => n.beat === currentBeat) || [];
              notesAtBeat.forEach(note => {
                const volume = (voices[voiceIndex]?.volume || 80) / 100;
                const actualDuration = (note.duration || 1) * (60 / tempo) * 0.9;
                const instrument = voices[voiceIndex]?.instrument || 'organ';
                playNote(note.pitch, actualDuration, volume * 0.7, voiceIndex, instrument);
              });
            });
          }

          // Metronome click
          if (metronomeEnabled) {
            const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
            const subdivisionSize = beatsPerMeasure / 4;
            if (currentBeat % subdivisionSize === 0) {
              const isDownbeat = currentBeat % beatsPerMeasure === 0;
              playMetronomeClick(isDownbeat);
            }
          }
        }
      }, [currentBeat, isPlaying, cantusFirmus, generatedVoices, tempo, voices, selectedNotes, metronomeEnabled, settings.timeSignature]);

  const handlePlayPause = () => {
    ensureAudio();
    if (isPlaying) {
      stopAllNotes();
    } else {
      // If there are selected notes, start from the earliest selected note
      if (selectedNotes.length > 0) {
        const minBeat = Math.min(...selectedNotes.map(n => n.beat));
        setCurrentBeat(minBeat);
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentBeat(0);
  };

  const handleStop = () => {
    setIsPlaying(false);
    stopAllNotes();
    setCurrentBeat(0);
  };

  const handleSeek = (beat) => {
    setCurrentBeat(beat);
  };

  // Export as data
  const handleExport = () => {
    const data = {
      settings,
      cantusFirmus,
      generatedVoices,
      voices: voices.filter(v => v.enabled)
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `counterpoint-${settings.key}-${settings.species}-species.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl xl:max-w-[95vw] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center">
                  <Music2 className="w-5 h-5 text-slate-900" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-light text-cream tracking-tight">
                  Counterpoint <span className="font-semibold">Generator</span>
                </h1>
              </div>
              <p className="text-cream/50 text-sm">
                Create polyphonic compositions following classical counterpoint rules
              </p>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {/* Load Project */}
              <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-slate-700 text-cream/70 hover:text-cream hover:bg-slate-800"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Load
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Load Project</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {savedProjects.length === 0 ? (
                      <p className="text-white/60 text-sm text-center py-4">No saved projects yet</p>
                    ) : (
                      savedProjects.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 cursor-pointer"
                          onClick={() => handleLoadProject(project)}
                        >
                          <div>
                            <p className="text-white font-medium">{project.name}</p>
                            <p className="text-white/50 text-xs">
                              {project.settings?.key} {project.settings?.mode} • {project.cantusFirmus?.length || 0} notes
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProjectMutation.mutate(project.id);
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            ×
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleNewProject}
                    className="w-full border-slate-700 text-white"
                  >
                    New Project
                  </Button>
                </DialogContent>
              </Dialog>

              {/* Save Project */}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-slate-700 text-cream/70 hover:text-cream hover:bg-slate-800"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Save Project</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveProject(); }} className="space-y-4">
                    <div>
                      <Label className="text-white/80">Project Name</Label>
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="My Counterpoint"
                        className="bg-slate-800 border-slate-700 text-white mt-1"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!projectName.trim() || saveProjectMutation.isPending}
                      className="w-full bg-gold text-slate-900 hover:bg-gold/90"
                    >
                      {saveProjectMutation.isPending ? 'Saving...' : (currentProjectId ? 'Update Project' : 'Save Project')}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* AI Composer */}
              <Button
                variant="outline"
                onClick={async () => {
                  const isAuth = await base44.auth.isAuthenticated();
                  if (!isAuth) {
                    base44.auth.redirectToLogin(window.location.href);
                    return;
                  }
                  setChatbotOpen(true);
                }}
                className="border-slate-700 text-cream/70 hover:text-cream hover:bg-slate-800"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Composer
              </Button>

              <Button
                variant="outline"
                onClick={handleExport}
                disabled={generatedVoices.length === 0}
                className="border-slate-700 text-cream/70 hover:text-cream hover:bg-slate-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={cantusFirmus.length === 0 || isGenerating}
                style={{ 
                  background: 'linear-gradient(to right, #fbbf24, #d97706)', 
                  color: '#0f172a',
                  border: '2px solid #f59e0b',
                  fontWeight: 600
                }}
                className="hover:opacity-90 shadow-lg"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Generate
              </Button>
            </div>
          </div>
        </motion.header>

        {/* Main Content - Full width now, AI panel is overlay */}
        <div className="grid grid-cols-1 gap-6">

          {/* Main Area - Score & Playback - Full width */}
          <motion.main 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <NoteGrid
                              playbackControls={
                                <PlaybackControls
                                  isPlaying={isPlaying}
                                  onPlayPause={handlePlayPause}
                                  tempo={tempo}
                                  onTempoChange={setTempo}
                                  currentBeat={currentBeat}
                                  totalBeats={settings.measures * getBeatsPerMeasure(settings.timeSignature)}
                                  onSeek={handleSeek}
                                  onReset={handleReset}
                                  onStop={handleStop}
                                  loopStart={loopStart}
                                  loopEnd={loopEnd}
                                  onLoopChange={(start, end) => { setLoopStart(start); setLoopEnd(end); }}
                                  isLooping={isLooping}
                                  onLoopToggle={() => setIsLooping(!isLooping)}
                                  timeSignature={settings.timeSignature}
                                  onTimeSignatureChange={(ts) => setSettings(prev => ({ ...prev, timeSignature: ts }))}
                                  metronomeEnabled={metronomeEnabled}
                                  onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)}
                                  onScrollToBeat={(beat) => scrollToBeatRef.current?.(beat)}
                                />
                              }
                              voices={allVoices.map((v, i) => ({ ...v, instrument: voices[i]?.instrument || 'organ' }))}
                              currentBeat={currentBeat}
                              isPlaying={isPlaying}
                              measures={settings.measures}
                              cantusFirmus={cantusFirmus}
                              onNotesUpdate={setCantusFirmus}
                              onSeek={handleSeek}
                              activeVoice={activeVoice}
                              onActiveVoiceChange={setActiveVoice}
                              onSelectionChange={setSelectedNotes}
                              tempo={tempo}
                              timeSignature={settings.timeSignature}
                              scrollToBeatRef={scrollToBeatRef}
                              pressedPianoNotes={pressedPianoNotes}
                              pianoInstrument={pianoInstrument}
                              onVoiceInstrumentChange={(voiceIndex, instrument) => {
                                const newVoices = [...voices];
                                if (newVoices[voiceIndex]) {
                                  newVoices[voiceIndex] = { ...newVoices[voiceIndex], instrument };
                                  setVoices(newVoices);
                                }
                              }}
                              onExportMidi={() => {
                                const midiData = {
                                  tempo,
                                  timeSignature: [4, 4],
                                  tracks: allVoices.map((voice, idx) => ({
                                    name: voice.name,
                                    notes: voice.notes?.map(n => ({
                                      pitch: n.pitch,
                                      startTime: n.beat * (60 / tempo),
                                      duration: 60 / tempo,
                                      velocity: 80
                                    })) || []
                                  }))
                                };
                                const blob = new Blob([JSON.stringify(midiData, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `counterpoint-${settings.key}-${Date.now()}.mid.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                            />
            
            <PianoKeyboard
                                activeNotes={activeNotes}
                                instrument={voices[activeVoice]?.instrument || 'organ'}
                                onInstrumentChange={(inst) => {
                                  const newVoices = [...voices];
                                  if (newVoices[activeVoice]) {
                                    newVoices[activeVoice] = { ...newVoices[activeVoice], instrument: inst };
                                    setVoices(newVoices);
                                  }
                                  setPianoInstrument(inst);
                                }}
                                onPressedNotesChange={setPressedPianoNotes}
                              />
          </motion.main>
          </div>
          </div>

      {/* AI Chatbot - Left side panel like base44 */}
      <AnimatePresence>
        {chatbotOpen && (
          <AIChatbot
            isOpen={chatbotOpen}
            onClose={() => setChatbotOpen(false)}
            settings={settings}
            onSettingsChange={setSettings}
            voices={voices}
            onVoicesChange={setVoices}
            currentNotes={cantusFirmus}
            onApplyMelody={(notes) => setCantusFirmus(notes)}
            onApplyHarmony={(notes, voiceType) => {
              // Map voice type to voice index
              const voiceMap = { soprano: 1, alto: 2, tenor: 2, bass: 3 };
              const voiceIndex = voiceMap[voiceType] || 1;

              // Create or update the generated voice
              const newVoice = {
                name: voiceType.charAt(0).toUpperCase() + voiceType.slice(1),
                notes: notes,
                enabled: true
              };

              setGeneratedVoices(prev => {
                const updated = [...prev];
                // Find existing voice of same type or add new
                const existingIdx = updated.findIndex(v => v.name.toLowerCase() === voiceType);
                if (existingIdx >= 0) {
                  updated[existingIdx] = newVoice;
                } else {
                  updated.push(newVoice);
                }
                return updated;
              });

              // Enable the corresponding voice in settings
              const newVoices = [...voices];
              if (newVoices[voiceIndex]) {
                newVoices[voiceIndex].enabled = true;
              }
              setVoices(newVoices);
            }}
            tempo={tempo}
          />
        )}
      </AnimatePresence>

      {/* Custom styles */}
      <style>{`
        :root {
          --gold: #E8B885;
          --cream: #FFFFFF;
        }
        
        .text-cream {
          color: var(--cream);
        }
        
        .text-gold {
          color: var(--gold);
        }
        
        .bg-gold {
          background-color: var(--gold);
        }
        
        .border-gold {
          border-color: var(--gold);
        }
        
        .ring-gold {
          --tw-ring-color: var(--gold);
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        .scrollbar-thumb-slate-700::-webkit-scrollbar-thumb {
          background-color: rgb(51 65 85);
          border-radius: 3px;
        }
        
        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background: transparent;
        }
        
        /* Global text visibility fixes */
        label, .text-cream\/60, .text-cream\/50, .text-cream\/40, .text-cream\/70 {
          color: rgba(255, 255, 255, 0.85) !important;
        }
        
        /* Select triggers and inputs */
        [data-radix-select-trigger], select, input, textarea {
          color: white !important;
          background-color: rgba(30, 41, 59, 0.8) !important;
          border-color: rgba(100, 116, 139, 0.5) !important;
        }
        
        /* Select content dropdowns */
        [data-radix-select-content] {
          background-color: rgb(30, 41, 59) !important;
          border-color: rgb(71, 85, 105) !important;
        }
        
        [data-radix-select-item] {
          color: white !important;
        }
        
        [data-radix-select-item]:hover, [data-radix-select-item][data-highlighted] {
          background-color: rgba(100, 116, 139, 0.3) !important;
        }
        
        /* Slider track visibility */
        [role="slider"] {
          background-color: var(--gold) !important;
          border: none !important;
        }
        
        [data-orientation="horizontal"] > span:first-child {
          background-color: rgba(100, 116, 139, 0.5) !important;
        }
        
        /* Switch styling */
        [role="switch"] {
          background-color: rgba(100, 116, 139, 0.5) !important;
        }
        
        [role="switch"][data-state="checked"] {
          background-color: var(--gold) !important;
        }
        
        /* Tab triggers */
        [role="tablist"] {
          background-color: rgba(30, 41, 59, 0.6) !important;
        }
        
        [role="tab"] {
          color: rgba(255, 255, 255, 0.7) !important;
        }
        
        [role="tab"][data-state="active"] {
          color: rgb(15, 23, 42) !important;
          background-color: var(--gold) !important;
        }
        
        /* Badges */
        .badge, [class*="Badge"] {
          font-weight: 500 !important;
        }
        
        /* Card backgrounds */
        .bg-slate-800\/40 {
          background-color: rgba(30, 41, 59, 0.6) !important;
        }
        
        .bg-slate-900\/50 {
          background-color: rgba(15, 23, 42, 0.7) !important;
        }
        
        /* Border visibility */
        .border-slate-700\/50 {
          border-color: rgba(71, 85, 105, 0.6) !important;
        }
        
        .border-slate-700 {
          border-color: rgb(71, 85, 105) !important;
        }
      `}</style>
    </div>
  );
}
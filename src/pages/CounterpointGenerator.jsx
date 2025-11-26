import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wand2, 
  Download, 
  RefreshCw, 
  Music2, 
  Settings, 
  BookOpen,
  Layers,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import NoteGrid from '@/components/counterpoint/NoteGrid';
import VoiceEditor from '@/components/counterpoint/VoiceEditor';
import PlaybackControls from '@/components/counterpoint/PlaybackControls';
import CounterpointRules from '@/components/counterpoint/CounterpointRules';
import PianoKeyboard from '@/components/counterpoint/PianoKeyboard';
import CantusFirmusEditor from '@/components/counterpoint/CantusFirmusEditor';
import GenerationSettings from '@/components/counterpoint/GenerationSettings';
import { generateCounterpoint, validateCounterpoint } from '@/components/counterpoint/counterpointEngine';
import { initAudio, playNote, stopAllNotes } from '@/components/counterpoint/audioEngine';

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
  
  const [activeTab, setActiveTab] = useState('compose');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const playbackRef = useRef(null);
  const audioInitialized = useRef(false);

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

  // Playback logic
  useEffect(() => {
    if (isPlaying) {
      const msPerBeat = (60 / tempo) * 1000;
      const totalBeats = settings.measures;
      
      playbackRef.current = setInterval(() => {
        setCurrentBeat(prev => {
          const next = prev + 1;
          if (next >= totalBeats) {
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
  }, [isPlaying, tempo, settings.measures]);

  // Play notes at current beat
  useEffect(() => {
    if (isPlaying) {
      const noteDuration = (60 / tempo) * 0.9;
      
      allVoices.forEach((voice, voiceIndex) => {
        if (!voice.enabled && voiceIndex > 0) return;
        
        const notesAtBeat = voice.notes?.filter(n => Math.floor(n.beat) === currentBeat) || [];
        notesAtBeat.forEach(note => {
          const volume = (voices[voiceIndex]?.volume || 80) / 100;
          playNote(note.pitch, noteDuration, volume * 0.7, voiceIndex);
        });
      });
    }
  }, [currentBeat, isPlaying]);

  const handlePlayPause = () => {
    ensureAudio();
    if (isPlaying) {
      stopAllNotes();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentBeat(0);
    stopAllNotes();
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            
            <div className="flex gap-3">
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
                className="bg-gradient-to-r from-gold to-amber-600 text-slate-900 hover:from-gold/90 hover:to-amber-600/90"
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Settings */}
          <motion.aside 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 space-y-4"
          >
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full bg-slate-800/50 border border-slate-700/50">
                <TabsTrigger value="compose" className="flex-1 data-[state=active]:bg-gold data-[state=active]:text-slate-900">
                  <Music2 className="w-4 h-4 mr-1" />
                  Compose
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex-1 data-[state=active]:bg-gold data-[state=active]:text-slate-900">
                  <Settings className="w-4 h-4 mr-1" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compose" className="mt-4 space-y-4">
                <CantusFirmusEditor
                  notes={cantusFirmus}
                  onUpdate={setCantusFirmus}
                  mode={settings.mode}
                  keySignature={settings.key}
                  measures={settings.measures}
                />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Layers className="w-4 h-4 text-cream/60" />
                    <h3 className="text-cream/80 text-sm font-medium">Voices</h3>
                  </div>
                  {voices.map((voice, index) => (
                    <VoiceEditor
                      key={index}
                      voice={voice}
                      voiceIndex={index}
                      onUpdate={(updated) => updateVoice(index, updated)}
                      isCantus={index === 0}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <GenerationSettings
                  settings={settings}
                  onUpdate={setSettings}
                />
              </TabsContent>
            </Tabs>
          </motion.aside>

          {/* Main Area - Score & Playback */}
          <motion.main 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-6 space-y-4"
          >
            <NoteGrid
              voices={allVoices}
              currentBeat={currentBeat}
              isPlaying={isPlaying}
              measures={settings.measures}
            />
            
            <PlaybackControls
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              tempo={tempo}
              onTempoChange={setTempo}
              currentBeat={currentBeat}
              totalBeats={settings.measures}
              onSeek={handleSeek}
              onReset={handleReset}
            />
            
            <PianoKeyboard
              activeNotes={activeNotes}
              octaves={[3, 4, 5]}
            />
          </motion.main>

          {/* Right Sidebar - Rules */}
          <motion.aside 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3"
          >
            <CounterpointRules
              species={settings.species}
              violations={settings.showViolations ? violations : []}
            />
          </motion.aside>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        :root {
          --gold: #D4A574;
          --cream: #F5F0E8;
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
      `}</style>
    </div>
  );
}
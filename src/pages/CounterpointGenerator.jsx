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
  Sparkles,
  X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AIChatbot from '@/components/counterpoint/AIChatbot';
import MusicTheoryPanel from '@/components/counterpoint/MusicTheoryPanel';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Midi } from '@tonejs/midi';

import NoteGrid from '@/components/counterpoint/NoteGrid';
import VoiceEditor from '@/components/counterpoint/VoiceEditor';
import PlaybackControls from '@/components/counterpoint/PlaybackControls';
import PianoKeyboard from '@/components/counterpoint/PianoKeyboard';
import CantusFirmusEditor from '@/components/counterpoint/CantusFirmusEditor';
import GenerationSettings from '@/components/counterpoint/GenerationSettings';
import { generateCounterpoint, validateCounterpoint } from '@/components/counterpoint/counterpointEngine';
import { initAudio, playNote, stopAllNotes, playMetronomeClick, setMasterVolume as setAudioMasterVolume } from '@/components/counterpoint/audioEngine';

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
  const [playheadPosition, setPlayheadPosition] = useState(0); // Smooth floating point position
  const [tempo, setTempo] = useState(80);
  const [isLooping, setIsLooping] = useState(true);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInBeats, setCountInBeats] = useState(4);
  const [masterVolume, setMasterVolume] = useState(80);
  const recordedNotesRef = useRef([]);
  
  const [activeTab, setActiveTab] = useState('compose');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [songDialogOpen, setSongDialogOpen] = useState(false);
  const [saveSongDialogOpen, setSaveSongDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [songName, setSongName] = useState('');
  const [songDescription, setSongDescription] = useState('');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  const dragControls = useDragControls();
  
  // Auto-expand measures functionality
  useEffect(() => {
    window.expandMeasures = () => {
      setSettings(prev => ({ ...prev, measures: prev.measures + 4 }));
    };
    return () => { delete window.expandMeasures; };
  }, []);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [theoryPanelOpen, setTheoryPanelOpen] = useState(false);
  const [activeVoice, setActiveVoice] = useState(0);
          const [selectedNotes, setSelectedNotes] = useState([]);
          const scrollToBeatRef = useRef(null);
          const [pressedPianoNotes, setPressedPianoNotes] = useState(new Set());
        const [showPiano, setShowPiano] = useState(true);
  const [showPianoPanel, setShowPianoPanel] = useState(true);
  const [pianoPopout, setPianoPopout] = useState(false);
  const [pianoPopoutSize, setPianoPopoutSize] = useState({ width: 800, height: 300 });
  const [previewingSongId, setPreviewingSongId] = useState(null);
  
  const playbackRef = useRef(null);
      const animationRef = useRef(null);
      const lastTimeRef = useRef(null);
      const audioInitialized = useRef(false);
      const queryClient = useQueryClient();
  const previewTimeoutRef = useRef(null);

      // Global spacebar handler for play/pause
      useEffect(() => {
        const handleKeyDown = (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          if (e.key === ' ') {
            e.preventDefault();
            setIsPlaying(prev => {
              if (prev) {
                stopAllNotes();
              }
              return !prev;
            });
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, []);

  // Get current user
  useEffect(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => setCurrentUser(null));
  }, []);

  // Fetch saved projects
  const { data: savedProjects = [] } = useQuery({
    queryKey: ['counterpoint-projects'],
    queryFn: () => base44.entities.CounterpointProject.list('-created_date'),
  });

  // Fetch songs
  const { data: songs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: () => base44.entities.Song.list('-created_date'),
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

  // Save song mutation (admin only)
  const saveSongMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Song.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setSaveSongDialogOpen(false);
      setSongName('');
      setSongDescription('');
    }
  });

  // Clone song mutation
  const cloneSongMutation = useMutation({
    mutationFn: async (song) => {
      await base44.entities.Song.create({
        name: `${song.name} (Copy)`,
        description: song.description,
        settings: song.settings,
        cantusFirmus: song.cantusFirmus,
        generatedVoices: song.generatedVoices,
        voices: song.voices
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    }
  });

  const handleSaveProject = () => {
    if (!projectName.trim()) return;
    saveProjectMutation.mutate({
      name: projectName,
      settings: { ...settings, tempo },
      cantusFirmus,
      generatedVoices,
      voices
    });
  };

  const handleSaveSong = () => {
    if (!songName.trim()) return;
    saveSongMutation.mutate({
      name: songName,
      description: songDescription,
      settings: { ...settings, tempo },
      cantusFirmus,
      generatedVoices,
      voices
    });
  };

  const handleLoadProject = (project) => {
    // Load voices and ensure each has an instrument
    const loadedVoices = project.voices || DEFAULT_VOICES;
    const voicesWithInstruments = loadedVoices.map((v, idx) => ({
      ...v,
      instrument: v.instrument || DEFAULT_VOICES[idx]?.instrument || 'organ'
    }));
    setVoices(voicesWithInstruments);
    
    // Fix tempo if needed
    const loadedTempo = project.settings?.tempo || 80;
    const correctedTempo = loadedTempo > 200 ? Math.round(loadedTempo / 4) : loadedTempo;
    
    // Update settings with corrected tempo
    setSettings({ ...(project.settings || DEFAULT_SETTINGS), tempo: correctedTempo });
    setTempo(correctedTempo);
    
    setCantusFirmus(project.cantusFirmus || []);
    setGeneratedVoices(project.generatedVoices || []);
    setProjectName(project.name);
    setCurrentProjectId(project.id);
    setLoadDialogOpen(false);
  };

  // Stop preview when modal closes
  useEffect(() => {
    if (!songDialogOpen && previewTimeoutRef.current) {
      previewTimeoutRef.current.forEach(id => clearTimeout(id));
      previewTimeoutRef.current = null;
      setPreviewingSongId(null);
      // Delay stopAllNotes slightly to ensure timeouts are cleared first
      setTimeout(() => stopAllNotes(), 50);
    }
  }, [songDialogOpen]);

  const handleLoadSong = (song) => {
    // Stop any preview
    if (previewTimeoutRef.current) {
      previewTimeoutRef.current.forEach(id => clearTimeout(id));
      previewTimeoutRef.current = null;
    }
    stopAllNotes();
    setPreviewingSongId(null);
    
    // Load voices and ensure each has an instrument
    const loadedVoices = song.voices || DEFAULT_VOICES;
    const voicesWithInstruments = loadedVoices.map((v, idx) => ({
      ...v,
      instrument: v.instrument || DEFAULT_VOICES[idx]?.instrument || 'organ'
    }));
    setVoices(voicesWithInstruments);
    
    // Load notes as-is (preview plays correctly, so no conversion needed)
    const loadedTempo = song.settings?.tempo || 80;
    const loadedCantusFirmus = song.cantusFirmus || [];
    const loadedGeneratedVoices = song.generatedVoices || [];
    
    // Calculate required measures based on actual beat range
    const maxBeat = Math.max(
      ...loadedCantusFirmus.map(n => n.beat + (n.duration || 1)),
      ...loadedGeneratedVoices.flatMap(v => (v.notes || []).map(n => n.beat + (n.duration || 1))),
      0
    );
    const beatsPerMeasure = getBeatsPerMeasure(song.settings?.timeSignature || '4/4');
    const requiredMeasures = Math.ceil(maxBeat / beatsPerMeasure) || (song.settings?.measures || 8);
    
    setSettings({ 
      ...(song.settings || DEFAULT_SETTINGS), 
      tempo: loadedTempo,
      measures: requiredMeasures 
    });
    setTempo(loadedTempo);
    
    setCantusFirmus(loadedCantusFirmus);
    setGeneratedVoices(loadedGeneratedVoices);
    setProjectName(song.name);
    setCurrentProjectId(null);
    setSongDialogOpen(false);
  };

  const handlePreviewSong = (song, e) => {
    e.stopPropagation();
    ensureAudio();

    // Clear any existing preview
    if (previewTimeoutRef.current) {
      previewTimeoutRef.current.forEach(id => clearTimeout(id));
      previewTimeoutRef.current = null;
      stopAllNotes();
    }

    if (previewingSongId === song.id) {
      // Stop preview
      setPreviewingSongId(null);
      stopAllNotes();
      return;
    }

    // Start new preview
    setPreviewingSongId(song.id);
    const loadedTempo = song.settings?.tempo || 80;
    // Fix tempo if it was saved as 16th-note BPM instead of quarter-note BPM
    const previewTempo = loadedTempo > 200 ? Math.round(loadedTempo / 4) : loadedTempo;
    const previewNotes = song.cantusFirmus || [];
    const previewVoices = song.generatedVoices || [];
    const songVoices = song.voices || [];
    const allPreviewVoices = [{ notes: previewNotes }, ...previewVoices];

    // Play all voices with proper timing
    const timeouts = [];
    allPreviewVoices.forEach((voice, voiceIndex) => {
      const voiceInstrument = songVoices[voiceIndex]?.instrument || 'organ';
      voice.notes?.forEach(note => {
        const sixteenthNoteDuration = (60 / previewTempo) / 4; // Duration of one 16th note (our beat unit)
        const startTime = note.beat * sixteenthNoteDuration * 1000; // Convert beat to milliseconds
        const noteDuration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
        
        const timeout = setTimeout(() => {
          if (previewTimeoutRef.current) { // Only play if preview is still active
            playNote(note.pitch, noteDuration, 0.7, voiceIndex, voiceInstrument);
          }
        }, startTime);
        
        timeouts.push(timeout);
      });
    });
    
    // Auto-stop after song duration
    const maxBeat = Math.max(
      ...allPreviewVoices.flatMap(v => v.notes?.map(n => n.beat + (n.duration || 1)) || [0])
    );
    const totalDuration = maxBeat * ((60 / previewTempo) / 4) * 1000 + 500;
    
    const stopTimeout = setTimeout(() => {
      stopAllNotes();
      setPreviewingSongId(null);
      previewTimeoutRef.current = null;
    }, totalDuration);
    
    timeouts.push(stopTimeout);
    previewTimeoutRef.current = timeouts;
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

  // Playback logic - smooth animation with requestAnimationFrame
  useEffect(() => {
    if (isPlaying) {
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      const beatsPerSecond = (tempo / 60) * 4; // 16th notes per second
      const totalBeats = settings.measures * beatsPerMeasure;

      const effectiveLoopEnd = loopEnd ?? totalBeats;
      const effectiveLoopStart = loopStart ?? 0;

      // Safety: ensure loop range is at least 1 beat to prevent stuck loops
      if (effectiveLoopEnd <= effectiveLoopStart) {
        setIsPlaying(false);
        return;
      }
      
      lastTimeRef.current = performance.now();
      
      const animate = (timestamp) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const deltaTime = (timestamp - lastTimeRef.current) / 1000; // Convert to seconds
        lastTimeRef.current = timestamp;

        setPlayheadPosition(prev => {
          const next = prev + deltaTime * beatsPerSecond;
          if (next >= effectiveLoopEnd) {
            if (isLooping) {
              return effectiveLoopStart;
            }
            setIsPlaying(false);
            return 0;
          }
          return next;
        });

        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = null;
    }
  }, [isPlaying, tempo, settings.measures, settings.timeSignature, isLooping, loopStart, loopEnd]);

  // Update discrete beat for note triggering - only when it actually changes
  useEffect(() => {
    const discreteBeat = Math.floor(playheadPosition);
    if (discreteBeat !== currentBeat && discreteBeat >= 0) {
      setCurrentBeat(discreteBeat);
    }
  }, [playheadPosition, currentBeat]);

  // Pre-index notes by beat for fast playback lookup
  const notesAtBeatMap = React.useMemo(() => {
    const map = new Map();
    cantusFirmus.forEach(note => {
      if (note.beat >= 0 && !map.has(note.beat)) map.set(note.beat, []);
      if (note.beat >= 0) map.get(note.beat).push({ note, voiceIndex: 0 });
    });
    generatedVoices.forEach((voice, idx) => {
      voice.notes?.forEach(note => {
        if (note.beat >= 0 && !map.has(note.beat)) map.set(note.beat, []);
        if (note.beat >= 0) map.get(note.beat).push({ note, voiceIndex: idx + 1 });
      });
    });
    return map;
  }, [cantusFirmus, generatedVoices]);

  // Track last played beat to prevent duplicate plays
  const lastPlayedBeatRef = useRef(-1);

  // Play notes at current beat - with duplicate prevention
  useEffect(() => {
    if (!isPlaying || currentBeat < 0) return;

    // Prevent playing the same beat multiple times in rapid succession
    if (lastPlayedBeatRef.current === currentBeat) return;
    lastPlayedBeatRef.current = currentBeat;

    // Use pre-indexed map for O(1) lookup
    const notesAtBeat = notesAtBeatMap.get(currentBeat) || [];
    notesAtBeat.forEach(({ note, voiceIndex }) => {
      if (voiceIndex > 0 && !voices[voiceIndex]?.enabled) return;
      const volume = (voices[voiceIndex]?.volume || 80) / 100;
      const velocity = note.velocity ?? 0.8;
      const sixteenthNoteDuration = (60 / tempo) / 4; // Duration of one 16th note
      const actualDuration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
      const instrument = voices[voiceIndex]?.instrument || 'organ';
      
      // Build pitch bend envelope if bend data exists
      let pitchBend = 0;
      if (note.bendStart !== undefined || note.bendEnd !== undefined) {
        pitchBend = {
          start: note.bendStart ?? 0,
          end: note.bendEnd ?? 0,
          startTime: note.bendStartTime ?? 0,
          endTime: note.bendEndTime ?? 1
        };
      }
      
      // Use velocity directly with a slight boost for expression
      playNote(note.pitch, actualDuration, volume * Math.min(1, velocity * 1.2), voiceIndex, instrument, pitchBend);
    });

    // Metronome click
    if (metronomeEnabled) {
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      const subdivisionSize = beatsPerMeasure / 4;
      if (currentBeat % subdivisionSize === 0) {
        const isDownbeat = currentBeat % beatsPerMeasure === 0;
        playMetronomeClick(isDownbeat);
      }
    }
  }, [currentBeat, isPlaying, notesAtBeatMap, tempo, voices, metronomeEnabled, settings.timeSignature]);

  const handlePlayPause = () => {
    ensureAudio();
    if (isPlaying) {
      stopAllNotes();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentBeat(0);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setIsRecording(false);
    setIsCountingIn(false);
    stopAllNotes();
    setCurrentBeat(0);
    setPlayheadPosition(0);
    lastPlayedBeatRef.current = -1;
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      // Stop recording
      console.log('Stopping recording. Total notes recorded:', recordedNotesRef.current.length);
      setIsRecording(false);
      setIsPlaying(false);
      setIsCountingIn(false);
      stopAllNotes();
      recordedNotesRef.current = [];
    } else {
      // Start count-in
      ensureAudio();
      setIsCountingIn(true);
      setCountInBeats(4);
      setCurrentBeat(-4);
      setPlayheadPosition(-4);
      recordedNotesRef.current = [];
      
      // Count down
      let count = 4;
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      const sixteenthNoteDuration = (60 / tempo) / 4;
      const countInterval = setInterval(() => {
        playMetronomeClick(count === 4);
        count--;
        setCountInBeats(count);
        
        if (count === 0) {
          clearInterval(countInterval);
          setIsCountingIn(false);
          setIsRecording(true);
          setIsPlaying(true);
          setCurrentBeat(0);
          setPlayheadPosition(0);
        }
      }, sixteenthNoteDuration * (beatsPerMeasure / 4) * 1000);
    }
  };

  // Handle note press during recording
  const handleNotePress = useCallback((pitch) => {
    if (isRecording && currentBeat >= 0) {
      // Check if this note at this beat already exists
      const alreadyRecorded = recordedNotesRef.current.some(
        n => n.pitch === pitch && Math.abs(n.beat - currentBeat) < 0.5
      );
      if (!alreadyRecorded) {
        const newNote = {
          pitch,
          beat: currentBeat,
          duration: 1,
          velocity: 0.8
        };
        recordedNotesRef.current.push(newNote);
        console.log('Recorded note:', newNote, 'Total recorded:', recordedNotesRef.current.length);
        
        // Update cantusFirmus immediately for real-time visual feedback
        setCantusFirmus(prev => [...prev, newNote].sort((a, b) => a.beat - b.beat));
      }
    }
  }, [isRecording, currentBeat]);

  const handleSeek = (beat) => {
    setCurrentBeat(beat);
    setPlayheadPosition(beat);
  };

  const handleApplyProgression = (notes) => {
    saveToHistory(notes);
    setCantusFirmus(notes);
  };

  const handleApplyScale = (notes) => {
    saveToHistory(notes);
    setCantusFirmus(notes);
  };

  const saveToHistory = (notes) => {
    // Simple history tracking for undo/redo
    // This can be expanded later
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

  // Import MIDI
  const handleImportMidi = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        
        // Extract tempo from MIDI (convert to BPM based on quarter notes)
        const midiTempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
        const midiBPM = Math.round(midiTempo);
        
        // Get all notes from all tracks, sorted by time
        const allNotes = [];
        midi.tracks.forEach(track => {
          track.notes.forEach(note => {
            allNotes.push({
              pitch: note.name,
              time: note.time,
              duration: note.duration,
              velocity: note.velocity
            });
          });
        });
        
        // Sort by time
        allNotes.sort((a, b) => a.time - b.time);
        
        // Convert MIDI times (in seconds) to our 16th-note beat grid
        // At X BPM, there are X quarter notes per minute = X/60 quarter notes per second
        // Since our beat is a 16th note, multiply by 4
        const sixteenthNotesPerSecond = (midiBPM / 60) * 4;
        
        const importedNotes = allNotes.map(n => ({
          pitch: n.pitch,
          beat: Math.round(n.time * sixteenthNotesPerSecond),
          duration: Math.max(0.25, Math.round((n.duration * sixteenthNotesPerSecond) * 4) / 4),
          velocity: n.velocity
        }));
        
        // Calculate required measures based on the longest note
        const maxBeat = Math.max(...importedNotes.map(n => n.beat + (n.duration || 1)), 0);
        const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
        const requiredMeasures = Math.ceil(maxBeat / beatsPerMeasure) || 1;

        // Update tempo and measures to match MIDI file
        setTempo(midiBPM);
        setSettings(prev => ({ ...prev, measures: requiredMeasures }));
        setCantusFirmus(importedNotes);
        } catch (error) {
        console.error('Failed to import MIDI:', error);
        alert('Failed to import MIDI file: ' + error.message);
        }
        };
        input.click();
        };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#1E1E1E] via-[#232323] to-[#1A1A1A]">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-[98vw] 2xl:max-w-[99vw] mx-auto px-1 2xl:px-0 pt-1 pb-2 overflow-x-hidden">
        {/* Header */}
                  <motion.header 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-1"
                  >
                                {/* Load Project Dialog */}
              <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogTrigger asChild>
                  <div style={{ display: 'none' }} />
                </DialogTrigger>
                <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A]">
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
                          className="flex items-center justify-between p-3 bg-[#3A3A3A] rounded-lg hover:bg-[#424242] cursor-pointer"
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

              {/* Browse Songs Dialog */}
              <Dialog open={songDialogOpen} onOpenChange={setSongDialogOpen}>
                <DialogTrigger asChild>
                  <div style={{ display: 'none' }} />
                </DialogTrigger>
                <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-white">Browse Songs</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {songs.length === 0 ? (
                      <p className="text-white/60 text-sm text-center py-4">No songs available</p>
                    ) : (
                      songs.map((song) => (
                        <div
                          key={song.id}
                          className="flex items-center justify-between p-4 bg-[#3A3A3A] rounded-lg hover:bg-[#424242] cursor-pointer border border-[#4A4A4A]"
                          onClick={() => handleLoadSong(song)}
                        >
                          <div className="flex-1">
                            <p className="text-white font-medium text-lg">{song.name}</p>
                            <p className="text-white/70 text-sm mt-1">{song.description}</p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                                {song.settings?.key} {song.settings?.mode}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                {song.settings?.timeSignature}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                                {song.cantusFirmus?.length || 0} notes
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handlePreviewSong(song, e)}
                              className={`${previewingSongId === song.id ? 'text-red-400 hover:text-red-300' : 'text-white/60 hover:text-white'}`}
                            >
                              {previewingSongId === song.id ? '⏹' : '▶'}
                            </Button>
                            {currentUser?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cloneSongMutation.mutate(song);
                                }}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                Clone
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-400 hover:text-amber-300"
                            >
                              Load →
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Save Project Dialog */}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <div style={{ display: 'none' }} />
                </DialogTrigger>
                <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A]">
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
                        className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!projectName.trim() || saveProjectMutation.isPending}
                      className="w-full bg-[#D4AF37] text-[#1E1E1E] hover:bg-[#E5C158]"
                    >
                      {saveProjectMutation.isPending ? 'Saving...' : (currentProjectId ? 'Update Project' : 'Save Project')}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Save Song Dialog (Admin Only) */}
              <Dialog open={saveSongDialogOpen} onOpenChange={setSaveSongDialogOpen}>
                <DialogTrigger asChild>
                  <div style={{ display: 'none' }} />
                </DialogTrigger>
                <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A]">
                  <DialogHeader>
                    <DialogTitle className="text-white">Save as Song</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSong(); }} className="space-y-4">
                    <div>
                      <Label className="text-white/80">Song Name</Label>
                      <Input
                        value={songName}
                        onChange={(e) => setSongName(e.target.value)}
                        placeholder="My Beautiful Song"
                        className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label className="text-white/80">Description</Label>
                      <Input
                        value={songDescription}
                        onChange={(e) => setSongDescription(e.target.value)}
                        placeholder="A brief description..."
                        className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!songName.trim() || saveSongMutation.isPending}
                      className="w-full bg-[#D4AF37] text-[#1E1E1E] hover:bg-[#E5C158]"
                    >
                      {saveSongMutation.isPending ? 'Saving...' : 'Save Song'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
        </motion.header>

        {/* Main Content - Full width now, AI panel is overlay */}
        <div className="grid grid-cols-1 gap-6">

          {/* Main Area - Score & Playback - Full width */}
          <motion.main 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <NoteGrid
                              settings={settings}
                              playheadPosition={playheadPosition}
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
                                  onNewProject={handleNewProject}
                                  onSaveProject={() => setSaveDialogOpen(true)}
                                  onSaveSong={currentUser?.role === 'admin' ? () => setSaveSongDialogOpen(true) : null}
                                  onLoadProject={() => setLoadDialogOpen(true)}
                                  onBrowseSongs={() => setSongDialogOpen(true)}
                                  onExport={handleExport}
                                  onAIComposer={async () => {
                                    const isAuth = await base44.auth.isAuthenticated();
                                    if (!isAuth) {
                                      base44.auth.redirectToLogin(window.location.href);
                                      return;
                                    }
                                    setChatbotOpen(true);
                                  }}
                                  onGenerate={handleGenerate}
                                  canGenerate={cantusFirmus.length > 0}
                                  isGenerating={isGenerating}
                                  onExportMidi={() => {
                                    const midiData = {
                                      tempo,
                                      timeSignature: [4, 4],
                                      tracks: allVoices.map((voice, idx) => ({
                                        name: voice.name,
                                        notes: voice.notes?.map(n => ({
                                          pitch: n.pitch,
                                          startTime: n.beat * (60 / tempo),
                                          duration: (n.duration || 1) * (60 / tempo),
                                          velocity: Math.round((n.velocity ?? 0.8) * 100)
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
                                  onImportMidi={handleImportMidi}
                                  onTheoryTools={() => setTheoryPanelOpen(true)}
                                  isRecording={isRecording}
                                  onRecordToggle={handleRecordToggle}
                                  isCountingIn={isCountingIn}
                                  countInBeats={countInBeats}
                                  masterVolume={masterVolume}
                                  onMasterVolumeChange={(vol) => {
                                    setMasterVolume(vol);
                                    setAudioMasterVolume(vol / 100 * 0.4);
                                  }}
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
                              pianoInstrument={voices[0]?.instrument || 'organ'}
                              loopStart={loopStart}
                              loopEnd={loopEnd}
                              isLooping={isLooping}
                              onLoopChange={(start, end) => { setLoopStart(start); setLoopEnd(end); }}
                              onVoiceInstrumentChange={(voiceIndex, instrument) => {
                                const newVoices = [...voices];
                                // Always update voice 0 (cantus firmus) since that's what's being edited
                                if (newVoices[0]) {
                                  newVoices[0] = { ...newVoices[0], instrument };
                                  setVoices(newVoices);
                                }
                              }}
                              onTogglePianoPanel={() => setShowPianoPanel(!showPianoPanel)}
                              showPianoPanel={showPianoPanel && !pianoPopout}
                              onPopOut={() => setPianoPopout(true)}
                              onNewProject={handleNewProject}
                              onSaveProject={() => setSaveDialogOpen(true)}
                              onSaveSong={currentUser?.role === 'admin' ? () => setSaveSongDialogOpen(true) : null}
                              onLoadProject={() => setLoadDialogOpen(true)}
                              onBrowseSongs={() => setSongDialogOpen(true)}
                              onExport={handleExport}
                              onAIComposer={async () => {
                                const isAuth = await base44.auth.isAuthenticated();
                                if (!isAuth) {
                                  base44.auth.redirectToLogin(window.location.href);
                                  return;
                                }
                                setChatbotOpen(true);
                              }}
                              onGenerate={handleGenerate}
                              canGenerate={cantusFirmus.length > 0}
                              isGenerating={isGenerating}
                              onExportMidi={() => {
                                const midiData = {
                                  tempo,
                                  timeSignature: [4, 4],
                                  tracks: allVoices.map((voice, idx) => ({
                                    name: voice.name,
                                    notes: voice.notes?.map(n => ({
                                      pitch: n.pitch,
                                      startTime: n.beat * (60 / tempo),
                                      duration: (n.duration || 1) * (60 / tempo),
                                      velocity: Math.round((n.velocity ?? 0.8) * 100)
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
                              onImportMidi={handleImportMidi}
                              onTheoryTools={() => setTheoryPanelOpen(true)}
                            />
            
            {/* Piano toggle for mobile */}
                              <div className="sm:hidden flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-600">
                                <span className="text-white/70 text-sm">Piano Keyboard</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowPiano(!showPiano)}
                                  className="text-amber-400 h-7 px-2"
                                >
                                  {showPiano ? 'Hide' : 'Show'}
                                </Button>
                              </div>

                              {showPianoPanel && !pianoPopout && (
                                <div className={`${showPiano ? 'block' : 'hidden'} sm:block`}>
                                  <PianoKeyboard
                                    activeNotes={activeNotes}
                                    instrument={voices[0]?.instrument || 'organ'}
                                    onInstrumentChange={(inst) => {
                                      const newVoices = [...voices];
                                      if (newVoices[0]) {
                                        newVoices[0] = { ...newVoices[0], instrument: inst };
                                        setVoices(newVoices);
                                      }
                                    }}
                                    onPressedNotesChange={setPressedPianoNotes}
                                    onPopOut={() => setPianoPopout(true)}
                                    onNotePress={handleNotePress}
                                  />
                                </div>
                              )}
          </motion.main>
          </div>
          </div>

      {/* Music Theory Panel */}
      <MusicTheoryPanel
        isOpen={theoryPanelOpen}
        onClose={() => setTheoryPanelOpen(false)}
        cantusFirmus={cantusFirmus}
        generatedVoices={generatedVoices}
        onApplyProgression={handleApplyProgression}
        onApplyScale={handleApplyScale}
      />

      {/* Piano Popout - Draggable & Resizable Window */}
      <AnimatePresence>
        {pianoPopout && (
          <motion.div
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ top: 0, left: 0, right: window.innerWidth - pianoPopoutSize.width - 20, bottom: window.innerHeight - pianoPopoutSize.height - 20 }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[100] bg-[#2D2D2D] border-2 border-[#3A3A3A] rounded-xl shadow-2xl"
            style={{ 
              top: '10%', 
              left: '10%', 
              width: `${pianoPopoutSize.width}px`,
              height: `${pianoPopoutSize.height}px`,
              maxWidth: '90vw',
              maxHeight: '80vh'
            }}
          >
            <div 
              className="cursor-move bg-[#1A1A1A] px-4 py-2 border-b border-[#3A3A3A] rounded-t-xl flex items-center justify-between"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span className="text-white text-sm font-medium">Piano Keyboard</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPianoPopout(false)}
                className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-[#3A3A3A]"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 overflow-auto" style={{ height: 'calc(100% - 40px)' }}>
              <PianoKeyboard
                activeNotes={activeNotes}
                instrument={voices[0]?.instrument || 'organ'}
                onInstrumentChange={(inst) => {
                  const newVoices = [...voices];
                  if (newVoices[0]) {
                    newVoices[0] = { ...newVoices[0], instrument: inst };
                    setVoices(newVoices);
                  }
                }}
                onPressedNotesChange={setPressedPianoNotes}
                onNotePress={handleNotePress}
              />
            </div>
            
            {/* Resize handle - bottom right corner */}
            <div
              className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = pianoPopoutSize.width;
                const startHeight = pianoPopoutSize.height;
                
                const handleMove = (moveEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  setPianoPopoutSize({
                    width: Math.max(400, Math.min(window.innerWidth * 0.9, startWidth + deltaX)),
                    height: Math.max(200, Math.min(window.innerHeight * 0.8, startHeight + deltaY))
                  });
                };
                
                const handleUp = () => {
                  document.removeEventListener('pointermove', handleMove);
                  document.removeEventListener('pointerup', handleUp);
                };
                
                document.addEventListener('pointermove', handleMove);
                document.addEventListener('pointerup', handleUp);
              }}
            >
              <svg 
                className="absolute bottom-1 right-1 text-white/30"
                width="12" 
                height="12" 
                viewBox="0 0 12 12"
              >
                <path d="M12 0 L12 12 L0 12" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 0 L12 4" stroke="currentColor" strokeWidth="1"/>
                <path d="M4 8 L12 8 L12 12 L4 12" fill="currentColor" opacity="0.3"/>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
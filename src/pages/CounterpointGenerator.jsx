import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Download, RefreshCw, Music2, Settings, Layers, Save, FolderOpen, Sparkles, X, Edit2, Trash2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AIChatbot from '@/components/counterpoint/AIChatbot';
import ProjectDialogs from '@/components/counterpoint/ProjectDialogs';
import PianoSection from '@/components/counterpoint/PianoSection';
import PianoPopout from '@/components/counterpoint/PianoPopout';
import { motion, AnimatePresence } from 'framer-motion';
import { Midi } from '@tonejs/midi';
import toast from 'react-hot-toast';

import NoteGrid from '@/components/counterpoint/NoteGrid';
import VoiceEditor from '@/components/counterpoint/VoiceEditor';
import PlaybackControls from '@/components/counterpoint/PlaybackControls';
import PianoKeyboard from '@/components/counterpoint/PianoKeyboard';
import CantusFirmusEditor from '@/components/counterpoint/CantusFirmusEditor';
import GenerationSettings from '@/components/counterpoint/GenerationSettings';
import UnsavedChangesDialog from '@/components/counterpoint/UnsavedChangesDialog';
import { generateCounterpoint, validateCounterpoint } from '@/components/counterpoint/counterpointEngine';
import { initAudio, playNote, stopAllNotes, playMetronomeClick, setMasterVolume as setAudioMasterVolume, playNoteWithCustomInstrument, cleanupAudio } from '@/components/counterpoint/audioEngine';
import { PRESET_LIBRARY_CONFIGS } from '@/components/counterpoint/presetLibrary';

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
  measures: 5,
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
  
  // Debug: Log every state change
  useEffect(() => {
    console.log('[DEBUG] isPlaying changed to:', isPlaying);
    console.trace();
  }, [isPlaying]);
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
  const activeRecordingNotesRef = useRef(new Map()); // Track note-on events during recording
  const [effects, setEffects] = useState({ reverb: 0.3, delay: 0, chorus: 0 });
  const [envelope, setEnvelope] = useState({ attack: 0.02, sustain: 0.7, release: 0.3 });
  
  const [activeTab, setActiveTab] = useState('compose');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveAsMode, setSaveAsMode] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [songDialogOpen, setSongDialogOpen] = useState(false);
  const [saveSongDialogOpen, setSaveSongDialogOpen] = useState(false);
  const [editSongDialogOpen, setEditSongDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [songName, setSongName] = useState('');
  const [songDescription, setSongDescription] = useState('');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  
  // Auto-expand and auto-shrink measures functionality
  useEffect(() => {
    window.__loadRecentProject = handleLoadProject;
    window.expandMeasures = () => { setSettings(prev => ({ ...prev, measures: prev.measures + 5 })); };
    window.autoAdjustMeasures = (notes) => {
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      
      // Calculate max beat from all notes
      const maxBeat = Math.max(
        ...notes.map(n => n.beat + (n.duration || 1)),
        ...generatedVoices.flatMap(v => (v.notes || []).map(n => n.beat + (n.duration || 1))),
        0
      );
      
      // Calculate required measures with 5 measure buffer
      const requiredMeasures = Math.ceil(maxBeat / beatsPerMeasure) || 1;
      const targetMeasures = Math.max(5, requiredMeasures + 5);
      
      setSettings(prev => {
        // Only update if different to avoid infinite loops
        if (prev.measures !== targetMeasures) {
          return { ...prev, measures: targetMeasures };
        }
        return prev;
      });
    };
    return () => { delete window.expandMeasures; delete window.autoAdjustMeasures; delete window.__loadRecentProject; };
  }, [generatedVoices, settings.timeSignature]);
  
  const queryClient = useQueryClient();
  const previewTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [chatbotActive, setChatbotActive] = useState(false);
  const [chatbotMinimized, setChatbotMinimized] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm your AI composer trained on Bach's Inventions. I can create new melodies or edit existing ones!\n\nExamples:\n• \"Create a 64-note flowing melody\"\n• \"Extend the current melody by 32 notes\"\n• \"Edit measures 5-8 to be more virtuosic\"\n• \"Add a contrasting section after the current melody\""
    }
  ]);
  const [activeVoice, setActiveVoice] = useState(0);
          const [selectedNotes, setSelectedNotes] = useState([]);
          const scrollToBeatRef = useRef(null);
          const [pressedPianoNotes, setPressedPianoNotes] = useState(new Set());
        const [showPiano, setShowPiano] = useState(true);
  const [showPianoPanel, setShowPianoPanel] = useState(true);
  const [pianoPopout, setPianoPopout] = useState(false);
  const [pianoPopoutSize, setPianoPopoutSize] = useState({ width: 800, height: 300 });
  const [previewingSongId, setPreviewingSongId] = useState(null);
  const [previewingProjectId, setPreviewingProjectId] = useState(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [librarySortBy, setLibrarySortBy] = useState('updated');
  const [libraryActiveTab, setLibraryActiveTab] = useState('songs');
  const [openWaveEditor, setOpenWaveEditor] = useState(false);
  const [customInstruments, setCustomInstruments] = useState([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  const playbackRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);
  const audioInitialized = useRef(false);

  // Fetch saved projects (combine database + local)
  const { data: dbProjects = [] } = useQuery({
    queryKey: ['counterpoint-projects'],
    queryFn: () => base44.entities.CounterpointProject.list('-created_date'),
  });
  
  const [localProjects, setLocalProjects] = useState([]);
  
  useEffect(() => {
    setLocalProjects(loadLocalProjects());
  }, []);
  
  const savedProjects = [...localProjects, ...dbProjects].sort((a, b) => 
    new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
  );

  // Fetch songs
  const { data: songs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: () => base44.entities.Song.list('-created_date'),
  });

  // Fetch custom instruments from database
  const { data: dbInstruments = [] } = useQuery({
    queryKey: ['custom-instruments'],
    queryFn: () => base44.entities.CustomInstrument.list('-created_date'),
  });

  // Load local instruments
  const [localInstruments, setLocalInstruments] = useState([]);
  
  useEffect(() => {
    setLocalInstruments(loadLocalInstruments());
  }, []);

  // Merge local, preset, and database instruments (Death Metal Guitar is now in presets)
  const presetInstruments = PRESET_LIBRARY_CONFIGS.filter(p => p.name === 'Death Metal Guitar').map((p, i) => ({ ...p, id: `preset_death_metal`, isPreset: true }));
  const savedInstruments = [...localInstruments, ...presetInstruments, ...dbInstruments];

  // Sync merged instruments to state
  useEffect(() => {
    setCustomInstruments(savedInstruments);
  }, [savedInstruments.length]);

  // Clean up legacy local Death Metal Guitar (now in preset library)
  const deathMetalCleanupRef = useRef(false);
  useEffect(() => {
    if (deathMetalCleanupRef.current) return;
    deathMetalCleanupRef.current = true;
    
    // Remove Death Metal Guitar from local storage (now in preset library)
    const localInsts = loadLocalInstruments();
    const cleaned = localInsts.filter(i => i.name !== 'Death Metal Guitar');
    if (cleaned.length !== localInsts.length) {
      localStorage.setItem('counterpoint-local-instruments', JSON.stringify(cleaned));
      setLocalInstruments(cleaned);
    }
  }, []);

  // Local storage helper functions
  const saveProjectLocally = (name, data) => {
    const projects = JSON.parse(localStorage.getItem('counterpoint-local-projects') || '[]');
    const timestamp = Date.now();
    const projectData = {
      id: `local_${timestamp}`,
      name,
      ...data,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      isLocal: true
    };
    
    // Check if updating existing local project
    const existingIndex = projects.findIndex(p => p.id === currentProjectId);
    if (existingIndex >= 0 && currentProjectId?.startsWith('local_')) {
      projects[existingIndex] = { ...projectData, id: currentProjectId, created_date: projects[existingIndex].created_date };
    } else {
      projects.push(projectData);
    }
    
    localStorage.setItem('counterpoint-local-projects', JSON.stringify(projects));
    return projectData;
  };

  const loadLocalProjects = () => {
    return JSON.parse(localStorage.getItem('counterpoint-local-projects') || '[]');
  };

  // Local storage helper functions for instruments
  const saveInstrumentLocally = (instrument) => {
    const instruments = JSON.parse(localStorage.getItem('counterpoint-local-instruments') || '[]');
    const timestamp = Date.now();
    const instrumentData = {
      id: `local_${timestamp}`,
      ...instrument,
      isLocal: true,
      created_date: new Date().toISOString()
    };
    
    instruments.push(instrumentData);
    localStorage.setItem('counterpoint-local-instruments', JSON.stringify(instruments));
    setLocalInstruments(instruments);
    return instrumentData;
  };

  const updateInstrumentLocally = (id, instrument) => {
    const instruments = loadLocalInstruments();
    const index = instruments.findIndex(i => i.id === id);
    if (index >= 0) {
      instruments[index] = { ...instruments[index], ...instrument };
      localStorage.setItem('counterpoint-local-instruments', JSON.stringify(instruments));
      setLocalInstruments(instruments);
    }
  };

  const deleteInstrumentLocally = (id) => {
    const instruments = loadLocalInstruments();
    const filtered = instruments.filter(i => i.id !== id);
    localStorage.setItem('counterpoint-local-instruments', JSON.stringify(filtered));
    setLocalInstruments(filtered);
  };

  const loadLocalInstruments = () => {
    return JSON.parse(localStorage.getItem('counterpoint-local-instruments') || '[]');
  };

  // Save project mutation (database only)
  const saveProjectMutation = useMutation({
    mutationFn: async (data) => {
      // If saveAsMode, always create new even if currentProjectId exists
      if (saveAsMode || !currentProjectId || currentProjectId.startsWith('local_')) {
        const result = await base44.entities.CounterpointProject.create(data);
        return result;
      }
      await base44.entities.CounterpointProject.update(currentProjectId, data);
      return { id: currentProjectId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['counterpoint-projects'] });
      if (result?.id) {
        setCurrentProjectId(result.id);
      }
      setHasUnsavedChanges(false);
      setSaveDialogOpen(false);
      setSaveAsMode(false);
      toast.success(saveAsMode ? 'Project saved to database' : (currentProjectId ? 'Project updated in database' : 'Project saved to database'));
    },
    onError: (error) => {
      console.error('Save failed:', error);
      setSaveAsMode(false);
      toast.error('Failed to save project to database');
    }
  });

  // Save project handler - defined early so keyboard shortcuts can use it
  const handleSaveProject = useCallback((skipDialog = false, saveToDatabase = false) => {
    const projectData = {
      name: projectName,
      settings: { ...settings, tempo },
      cantusFirmus,
      generatedVoices,
      voices,
      effects,
      envelope,
      customInstruments
    };

    // If we have an existing project and not in save-as mode, save directly
    if (skipDialog && currentProjectId && projectName.trim()) {
      if (currentProjectId.startsWith('local_') && !saveToDatabase) {
        // Update local project
        const saved = saveProjectLocally(projectName, projectData);
        setCurrentProjectId(saved.id);
        setHasUnsavedChanges(false);
        toast.success('Project saved locally');
      } else {
        // Save to database
        saveProjectMutation.mutate(projectData);
      }
      return;
    }

    // Otherwise, validate and save from dialog
    if (!projectName.trim()) return;
    
    if (saveToDatabase) {
      saveProjectMutation.mutate(projectData);
    } else {
      const saved = saveProjectLocally(projectName, projectData);
      setCurrentProjectId(saved.id);
      setHasUnsavedChanges(false);
      setSaveDialogOpen(false);
      setSaveAsMode(false);
      toast.success('Project saved locally');
    }
  }, [currentProjectId, projectName, settings, tempo, cantusFirmus, generatedVoices, voices, effects, envelope, saveProjectMutation, saveAsMode, customInstruments]);



  // Get current user
  useEffect(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => setCurrentUser(null));
  }, []);

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (id) => {
      if (id.startsWith('local_')) {
        // Delete from local storage
        const projects = loadLocalProjects();
        const filtered = projects.filter(p => p.id !== id);
        localStorage.setItem('counterpoint-local-projects', JSON.stringify(filtered));
        setLocalProjects(filtered);
        return Promise.resolve();
      }
      return base44.entities.CounterpointProject.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['counterpoint-projects'] });
    }
  });

  // Save song mutation (admin only)
  const saveSongMutation = useMutation({
    mutationFn: async (data) => {
      if (currentUser?.role !== 'admin') {
        throw new Error('Admin access required');
      }
      await base44.entities.Song.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setSaveSongDialogOpen(false);
      setSongName('');
      setSongDescription('');
      toast.success('Song saved to library');
    },
    onError: () => {
      toast.error('Failed to save song');
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

  // Update song mutation (admin only)
  const updateSongMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (currentUser?.role !== 'admin') {
        throw new Error('Admin access required');
      }
      await base44.entities.Song.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setEditSongDialogOpen(false);
      setEditingSong(null);
      setSongName('');
      setSongDescription('');
      toast.success('Song updated');
    },
    onError: () => {
      toast.error('Failed to update song');
    }
  });

  // Delete song mutation (admin only)
  const deleteSongMutation = useMutation({
    mutationFn: (id) => {
      if (currentUser?.role !== 'admin') {
        throw new Error('Admin access required');
      }
      return base44.entities.Song.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      toast.success('Song deleted');
    },
    onError: () => {
      toast.error('Failed to delete song');
    }
  });

  // Save custom instrument mutation (now saves locally)
  const saveInstrumentMutation = useMutation({
    mutationFn: async ({ instrument, index }) => {
      // Check if updating existing instrument
      if (index >= 0 && savedInstruments[index]?.id) {
        const existingInstrument = savedInstruments[index];
        if (existingInstrument.id.startsWith('local_')) {
          // Update local instrument
          updateInstrumentLocally(existingInstrument.id, instrument);
          return { index, local: true };
        } else {
          // Update database instrument (admin only)
          await base44.entities.CustomInstrument.update(existingInstrument.id, instrument);
          return { index };
        }
      } else {
        // Create new local instrument
        saveInstrumentLocally(instrument);
        return { index: -1, local: true };
      }
    },
    onSuccess: (result) => {
      if (!result.local) {
        queryClient.invalidateQueries({ queryKey: ['custom-instruments'] });
      }
      toast.success('Instrument saved locally');
    },
    onError: () => {
      toast.error('Failed to save instrument');
    }
  });

  // Delete custom instrument mutation
  const deleteInstrumentMutation = useMutation({
    mutationFn: (index) => {
      const instrument = savedInstruments[index];
      if (instrument?.id) {
        if (instrument.id.startsWith('local_')) {
          // Delete from local storage
          deleteInstrumentLocally(instrument.id);
          return Promise.resolve();
        } else {
          // Delete from database
          return base44.entities.CustomInstrument.delete(instrument.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-instruments'] });
      toast.success('Instrument deleted');
    },
    onError: () => {
      toast.error('Failed to delete instrument');
    }
  });



  const handleSaveSong = () => {
    if (!songName.trim()) return;
    saveSongMutation.mutate({
      name: songName,
      description: songDescription,
      settings: { ...settings, tempo },
      cantusFirmus,
      generatedVoices,
      voices,
      effects,
      envelope,
      customInstruments
    });
  };

  const handleUpdateSong = () => {
    if (!songName.trim() || !editingSong) return;
    updateSongMutation.mutate({
      id: editingSong.id,
      data: {
        name: songName,
        description: songDescription
      }
    });
  };

  const handleLoadProject = (project) => {
    if (hasUnsavedChanges) {
      setPendingAction({ type: 'loadProject', data: project });
      setUnsavedChangesDialog(true);
      return;
    }
    
    isLoadingProjectRef.current = true;
    setIsLoadingProject(true);
    
    // Clean up all audio (timeouts, nodes, etc.)
    cleanupAudio();
    
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

    // Load effects and envelope
    const loadedEffects = project.effects || { reverb: 0.3, delay: 0, chorus: 0 };
    const loadedEnvelope = project.envelope || { attack: 0.02, sustain: 0.7, release: 0.3 };
    setEffects(loadedEffects);
    setEnvelope(loadedEnvelope);
    
    // Apply to audio engine
    import('@/components/counterpoint/audioEngine').then(({ setEffectLevel, setEnvelope: setGlobalEnvelope }) => {
      setEffectLevel('reverb', loadedEffects.reverb);
      setEffectLevel('delay', loadedEffects.delay);
      setEffectLevel('chorus', loadedEffects.chorus);
      setGlobalEnvelope(loadedEnvelope);
    });

    // Merge custom instruments from project with existing saved instruments
    // Keep all instruments from database, only add project-specific ones if unique
    const projectInstruments = project.customInstruments || [];
    const mergedInstruments = [...savedInstruments];
    projectInstruments.forEach(projInst => {
      const exists = mergedInstruments.some(saved => saved.name === projInst.name);
      if (!exists) {
        mergedInstruments.push(projInst);
      }
    });
    setCustomInstruments(mergedInstruments);

    setHasUnsavedChanges(false); setLoadDialogOpen(false);
    setTimeout(() => { isLoadingProjectRef.current = false; setIsLoadingProject(false); }, 400);
  };

  // Stop preview when modal closes
  useEffect(() => {
    if (!songDialogOpen && previewTimeoutRef.current) {
      previewTimeoutRef.current.forEach(id => clearTimeout(id));
      previewTimeoutRef.current = null;
      setPreviewingSongId(null);
      setPreviewingProjectId(null);
      // Delay stopAllNotes slightly to ensure timeouts are cleared first
      setTimeout(() => stopAllNotes(), 50);
    }
  }, [songDialogOpen]);

  const handleLoadSong = (song) => {
    if (hasUnsavedChanges) {
      setPendingAction({ type: 'loadSong', data: song });
      setUnsavedChangesDialog(true);
      return;
    }
    
    isLoadingProjectRef.current = true;
    setIsLoadingProject(true);
    
    // Clean up all audio (timeouts, nodes, etc.)
    cleanupAudio();
    
    // Stop any preview
    if (previewTimeoutRef.current) {
      previewTimeoutRef.current.forEach(id => clearTimeout(id));
      previewTimeoutRef.current = null;
    }
    setPreviewingSongId(null);
    
    // Reinitialize audio with fresh context
    initAudio().catch(() => {});
    
    // Load voices and ensure each has an instrument
    const loadedVoices = song.voices || DEFAULT_VOICES;
    const voicesWithInstruments = loadedVoices.map((v, idx) => ({
      ...v,
      instrument: v.instrument || DEFAULT_VOICES[idx]?.instrument || 'organ'
    }));
    setVoices(voicesWithInstruments);
    
    // Load notes - preserve fractional beats (don't round)
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
    
    // Load effects and envelope
    const loadedEffects = song.effects || { reverb: 0.3, delay: 0, chorus: 0 };
    const loadedEnvelope = song.envelope || { attack: 0.02, sustain: 0.7, release: 0.3 };
    setEffects(loadedEffects);
    setEnvelope(loadedEnvelope);
    
    // Apply to audio engine
    import('@/components/counterpoint/audioEngine').then(({ setEffectLevel, setEnvelope: setGlobalEnvelope }) => {
      setEffectLevel('reverb', loadedEffects.reverb);
      setEffectLevel('delay', loadedEffects.delay);
      setEffectLevel('chorus', loadedEffects.chorus);
      setGlobalEnvelope(loadedEnvelope);
    });

    // Merge custom instruments from song with existing saved instruments
    // Keep all instruments from database, only add song-specific ones if unique
    const songInstruments = song.customInstruments || [];
    const mergedInstruments = [...savedInstruments];
    songInstruments.forEach(songInst => {
      const exists = mergedInstruments.some(saved => saved.name === songInst.name);
      if (!exists) {
        mergedInstruments.push(songInst);
      }
    });
    setCustomInstruments(mergedInstruments);

    setHasUnsavedChanges(false); setSongDialogOpen(false);
    setTimeout(() => { isLoadingProjectRef.current = false; setIsLoadingProject(false); }, 400);
    };

  const handlePreviewSong = (song, e) => {
    e.stopPropagation();
    ensureAudio();

    // Stop current project playback
    if (isPlaying) {
      setIsPlaying(false);
      stopAllNotes();
    }

    // Clear any existing preview
    if (previewTimeoutRef.current) {
      previewTimeoutRef.current.forEach(id => clearTimeout(id));
      previewTimeoutRef.current = null;
      stopAllNotes();
    }

    if (previewingSongId === song.id) {
      // Stop preview
      setPreviewingSongId(null);
      setPreviewingProjectId(null);
      stopAllNotes();
      return;
    }

    // Start new preview
    setPreviewingSongId(song.id);
    setPreviewingProjectId(null);
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
      const voiceInstrument = voices[voiceIndex]?.instrument || 'organ';
      const volume = (voices[voiceIndex]?.volume || 80) / 100;

      // Get custom config if it's a custom instrument
      const getCustomConfig = (instrument) => {
        if (instrument.startsWith('custom_')) {
          const index = parseInt(instrument.split('_')[1]);
          return customInstruments[index];
        }
        if (instrument === 'preset_death_metal') {
          return PRESET_LIBRARY_CONFIGS.find(p => p.name === 'Death Metal Guitar');
        }
        if (instrument.startsWith('preset_')) {
          const index = parseInt(instrument.split('_')[1]);
          const PRESET_LIBRARY = [
            { name: 'Warm Pad', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.5 }, { waveform: 'sawtooth', detune: 7, gain: 0.5 }], envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 }, filter: { type: 'lowpass', frequency: 1200, Q: 0.5 } },
            { name: 'Bright Lead', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.7 }, { waveform: 'square', detune: 12, gain: 0.3 }], envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 }, filter: { type: 'lowpass', frequency: 4000, Q: 2 } },
            { name: 'Sub Bass', oscillators: [{ waveform: 'sine', detune: 0, gain: 1.0 }], envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 }, filter: { type: 'lowpass', frequency: 500, Q: 1 } },
            { name: 'Pluck', oscillators: [{ waveform: 'triangle', detune: 0, gain: 0.8 }, { waveform: 'square', detune: 0, gain: 0.2 }], envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 }, filter: { type: 'lowpass', frequency: 3000, Q: 1.5 } },
            { name: 'Bell', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.6 }, { waveform: 'sine', detune: 700, gain: 0.3 }, { waveform: 'sine', detune: 1200, gain: 0.1 }], envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 }, filter: { type: 'highpass', frequency: 500, Q: 0.5 } },
            { name: 'Choir', oscillators: [{ waveform: 'sawtooth', detune: -5, gain: 0.4 }, { waveform: 'sawtooth', detune: 5, gain: 0.4 }, { waveform: 'sine', detune: 0, gain: 0.2 }], envelope: { attack: 0.2, decay: 0.1, sustain: 0.7, release: 0.4 }, filter: { type: 'bandpass', frequency: 1500, Q: 2 } },
            { name: 'Reese Bass', oscillators: [{ waveform: 'sawtooth', detune: -10, gain: 0.5 }, { waveform: 'sawtooth', detune: 10, gain: 0.5 }], envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.15 }, filter: { type: 'lowpass', frequency: 800, Q: 3 } },
            { name: 'Flutey', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.9 }, { waveform: 'triangle', detune: 0, gain: 0.1 }], envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.25 }, filter: { type: 'lowpass', frequency: 3500, Q: 0.3 } }
          ];
          return PRESET_LIBRARY[index];
        }
        return null;
      };

      const customConfig = getCustomConfig(voiceInstrument);

      voice.notes?.forEach(note => {
        const sixteenthNoteDuration = (60 / previewTempo) / 4; // Duration of one 16th note (our beat unit)
        const startTime = note.beat * sixteenthNoteDuration * 1000; // Convert beat to milliseconds
        const noteDuration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
        
        const timeout = setTimeout(() => {
          if (previewTimeoutRef.current) { // Only play if preview is still active
            if (customConfig) {
              import('@/components/counterpoint/audioEngine').then(({ playNoteWithCustomInstrument }) => {
                playNoteWithCustomInstrument(note.pitch, noteDuration, volume * 0.7, customConfig);
              });
            } else {
              playNote(note.pitch, noteDuration, volume * 0.7, voiceIndex, voiceInstrument);
            }
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

  const handlePreviewProject = (project, e) => {
    e.stopPropagation();
    ensureAudio();

    // Stop current project playback
    if (isPlaying) {
      setIsPlaying(false);
      stopAllNotes();
    }

    // Clear any existing preview
    if (previewTimeoutRef.current) {
      previewTimeoutRef.current.forEach(id => clearTimeout(id));
      previewTimeoutRef.current = null;
      stopAllNotes();
    }

    if (previewingProjectId === project.id) {
      // Stop preview
      setPreviewingProjectId(null);
      setPreviewingSongId(null);
      stopAllNotes();
      return;
    }

    // Start new preview
    setPreviewingProjectId(project.id);
    setPreviewingSongId(null);
    const previewTempo = project.settings?.tempo || 80;
    const previewNotes = project.cantusFirmus || [];
    const previewVoices = project.generatedVoices || [];
    const projectVoices = project.voices || [];
    const allPreviewVoices = [{ notes: previewNotes }, ...previewVoices];

    // Play all voices with proper timing
    const timeouts = [];
    allPreviewVoices.forEach((voice, voiceIndex) => {
      const voiceInstrument = projectVoices[voiceIndex]?.instrument || 'organ';
      const volume = (projectVoices[voiceIndex]?.volume || 80) / 100;

      // Get custom config if it's a custom instrument
      const getCustomConfig = (instrument) => {
        if (instrument.startsWith('custom_')) {
          const index = parseInt(instrument.split('_')[1]);
          return customInstruments[index];
        }
        if (instrument === 'preset_death_metal') {
          return PRESET_LIBRARY_CONFIGS.find(p => p.name === 'Death Metal Guitar');
        }
        if (instrument.startsWith('preset_')) {
          const index = parseInt(instrument.split('_')[1]);
          const PRESET_LIBRARY = [
            { name: 'Warm Pad', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.5 }, { waveform: 'sawtooth', detune: 7, gain: 0.5 }], envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 }, filter: { type: 'lowpass', frequency: 1200, Q: 0.5 } },
            { name: 'Bright Lead', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.7 }, { waveform: 'square', detune: 12, gain: 0.3 }], envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 }, filter: { type: 'lowpass', frequency: 4000, Q: 2 } },
            { name: 'Sub Bass', oscillators: [{ waveform: 'sine', detune: 0, gain: 1.0 }], envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 }, filter: { type: 'lowpass', frequency: 500, Q: 1 } },
            { name: 'Pluck', oscillators: [{ waveform: 'triangle', detune: 0, gain: 0.8 }, { waveform: 'square', detune: 0, gain: 0.2 }], envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 }, filter: { type: 'lowpass', frequency: 3000, Q: 1.5 } },
            { name: 'Bell', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.6 }, { waveform: 'sine', detune: 700, gain: 0.3 }, { waveform: 'sine', detune: 1200, gain: 0.1 }], envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 }, filter: { type: 'highpass', frequency: 500, Q: 0.5 } },
            { name: 'Choir', oscillators: [{ waveform: 'sawtooth', detune: -5, gain: 0.4 }, { waveform: 'sawtooth', detune: 5, gain: 0.4 }, { waveform: 'sine', detune: 0, gain: 0.2 }], envelope: { attack: 0.2, decay: 0.1, sustain: 0.7, release: 0.4 }, filter: { type: 'bandpass', frequency: 1500, Q: 2 } },
            { name: 'Reese Bass', oscillators: [{ waveform: 'sawtooth', detune: -10, gain: 0.5 }, { waveform: 'sawtooth', detune: 10, gain: 0.5 }], envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.15 }, filter: { type: 'lowpass', frequency: 800, Q: 3 } },
            { name: 'Flutey', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.9 }, { waveform: 'triangle', detune: 0, gain: 0.1 }], envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.25 }, filter: { type: 'lowpass', frequency: 3500, Q: 0.3 } }
          ];
          return PRESET_LIBRARY[index];
        }
        return null;
      };

      const customConfig = getCustomConfig(voiceInstrument);

      voice.notes?.forEach(note => {
        const sixteenthNoteDuration = (60 / previewTempo) / 4;
        const startTime = note.beat * sixteenthNoteDuration * 1000;
        const noteDuration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
        
        const timeout = setTimeout(() => {
          if (previewTimeoutRef.current) {
            if (customConfig) {
              import('@/components/counterpoint/audioEngine').then(({ playNoteWithCustomInstrument }) => {
                playNoteWithCustomInstrument(note.pitch, noteDuration, volume * 0.7, customConfig);
              });
            } else {
              playNote(note.pitch, noteDuration, volume * 0.7, voiceIndex, voiceInstrument);
            }
          }
        }, startTime);
        
        timeouts.push(timeout);
      });
    });
    
    // Auto-stop after duration
    const maxBeat = Math.max(
      ...allPreviewVoices.flatMap(v => v.notes?.map(n => n.beat + (n.duration || 1)) || [0])
    );
    const totalDuration = maxBeat * ((60 / previewTempo) / 4) * 1000 + 500;
    
    const stopTimeout = setTimeout(() => {
      stopAllNotes();
      setPreviewingProjectId(null);
      previewTimeoutRef.current = null;
    }, totalDuration);
    
    timeouts.push(stopTimeout);
    previewTimeoutRef.current = timeouts;
  };

  const handleNewProject = () => {
    if (hasUnsavedChanges) { setPendingAction({ type: 'newProject' }); setUnsavedChangesDialog(true); return; }
    isLoadingProjectRef.current = true;
    setIsLoadingProject(true);
    setSettings(DEFAULT_SETTINGS); setCantusFirmus([]); setGeneratedVoices([]); setVoices(DEFAULT_VOICES);
    setProjectName(''); setCurrentProjectId(null); setTempo(80);
    setEffects({ reverb: 0.3, delay: 0, chorus: 0 }); setEnvelope({ attack: 0.02, sustain: 0.7, release: 0.3 });
    setHasUnsavedChanges(false);
    setTimeout(() => { isLoadingProjectRef.current = false; setIsLoadingProject(false); }, 400);
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

  // Playback logic - use setInterval instead of requestAnimationFrame to work across tab changes
  useEffect(() => {
    console.log('[Playback] State changed:', { isPlaying, tempo, measures: settings.measures });
    if (isPlaying) {
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      const beatsPerSecond = (tempo / 60) * 4; // 16th notes per second
      const totalBeats = settings.measures * beatsPerMeasure;

      const effectiveLoopEnd = loopEnd ?? totalBeats;
      const effectiveLoopStart = loopStart ?? 0;

      // Safety: ensure loop range is at least 1 beat to prevent stuck loops
      if (effectiveLoopEnd <= effectiveLoopStart) {
        console.log('[Playback] Stopping - invalid loop range');
        console.log('[Playback] setIsPlaying(false) - invalid loop range');
        setIsPlaying(false);
        return;
      }
      
      console.log('[Playback] Starting playback with setInterval');
      lastTimeRef.current = Date.now();
      
      // Use setInterval instead of requestAnimationFrame - works even when tab is hidden
      const intervalId = setInterval(() => {
        const now = Date.now();
        const deltaTime = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        setPlayheadPosition(prev => {
          const next = prev + deltaTime * beatsPerSecond;
          if (next >= effectiveLoopEnd) {
            if (isLooping) {
              return effectiveLoopStart;
            }
            console.log('[Playback] Reached end, stopping');
            console.log('[Playback] setIsPlaying(false) - reached end of playback');
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 16); // ~60fps
      
      animationRef.current = intervalId;
      
      return () => {
        console.log('[Playback] Cleanup - clearing interval');
        if (animationRef.current) {
          clearInterval(animationRef.current);
        }
      };
    } else {
      console.log('[Playback] Not playing - cleanup');
      if (animationRef.current) {
        clearInterval(animationRef.current);
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

  // Track last playhead position for fractional beat note triggering
  const lastPlayheadRef = useRef(0);
  const playedNotesRef = useRef(new Set());

  // Collect all notes for fractional beat playback
  const allNotes = React.useMemo(() => {
    const notes = [];
    cantusFirmus.forEach(note => {
      if (note.beat >= 0) notes.push({ note, voiceIndex: 0 });
    });
    generatedVoices.forEach((voice, idx) => {
      voice.notes?.forEach(note => {
        if (note.beat >= 0) notes.push({ note, voiceIndex: idx + 1 });
      });
    });
    return notes.sort((a, b) => a.note.beat - b.note.beat);
  }, [cantusFirmus, generatedVoices]);

  // Play notes based on fractional playhead position (supports trills/ornaments)
  useEffect(() => {
    if (!isPlaying) return;

    const currentPos = playheadPosition;
    const lastPos = lastPlayheadRef.current;
    
    // Handle loop wraparound
    if (currentPos < lastPos) {
      playedNotesRef.current.clear();
    }

    // Get custom config for an instrument string
    const getCustomConfig = (instrument) => {
      if (instrument.startsWith('custom_')) {
        const index = parseInt(instrument.split('_')[1]);
        return customInstruments[index];
      }
      if (instrument === 'preset_death_metal') {
        return PRESET_LIBRARY_CONFIGS.find(p => p.name === 'Death Metal Guitar');
      }
      if (instrument.startsWith('preset_')) {
        const index = parseInt(instrument.split('_')[1]);
        const PRESET_LIBRARY = [
          { name: 'Warm Pad', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.5 }, { waveform: 'sawtooth', detune: 7, gain: 0.5 }], envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 }, filter: { type: 'lowpass', frequency: 1200, Q: 0.5 } },
          { name: 'Bright Lead', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.7 }, { waveform: 'square', detune: 12, gain: 0.3 }], envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 }, filter: { type: 'lowpass', frequency: 4000, Q: 2 } },
          { name: 'Sub Bass', oscillators: [{ waveform: 'sine', detune: 0, gain: 1.0 }], envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 }, filter: { type: 'lowpass', frequency: 500, Q: 1 } },
          { name: 'Pluck', oscillators: [{ waveform: 'triangle', detune: 0, gain: 0.8 }, { waveform: 'square', detune: 0, gain: 0.2 }], envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 }, filter: { type: 'lowpass', frequency: 3000, Q: 1.5 } },
          { name: 'Bell', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.6 }, { waveform: 'sine', detune: 700, gain: 0.3 }, { waveform: 'sine', detune: 1200, gain: 0.1 }], envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 }, filter: { type: 'highpass', frequency: 500, Q: 0.5 } },
          { name: 'Choir', oscillators: [{ waveform: 'sawtooth', detune: -5, gain: 0.4 }, { waveform: 'sawtooth', detune: 5, gain: 0.4 }, { waveform: 'sine', detune: 0, gain: 0.2 }], envelope: { attack: 0.2, decay: 0.1, sustain: 0.7, release: 0.4 }, filter: { type: 'bandpass', frequency: 1500, Q: 2 } },
          { name: 'Reese Bass', oscillators: [{ waveform: 'sawtooth', detune: -10, gain: 0.5 }, { waveform: 'sawtooth', detune: 10, gain: 0.5 }], envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.15 }, filter: { type: 'lowpass', frequency: 800, Q: 3 } },
          { name: 'Flutey', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.9 }, { waveform: 'triangle', detune: 0, gain: 0.1 }], envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.25 }, filter: { type: 'lowpass', frequency: 3500, Q: 0.3 } }
        ];
        return PRESET_LIBRARY[index];
      }
      return null;
    };

    // Arpeggio pattern definitions (mirrors NoteControls)
    const ARPEGGIO_PATTERNS = {
      up_maj:      { intervals: [0, 4, 7] },
      up_min:      { intervals: [0, 3, 7] },
      up_dom7:     { intervals: [0, 4, 7, 10] },
      up_maj7:     { intervals: [0, 4, 7, 11] },
      up_oct:      { intervals: [0, 7, 12] },
      down_maj:    { intervals: [7, 4, 0] },
      down_min:    { intervals: [7, 3, 0] },
      updown_maj:  { intervals: [0, 7, 4, 0] },
      updown_oct:  { intervals: [0, 12, 7, 0] },
      strum_maj:   { intervals: [0, 4, 7],  strum: true },
      strum_min:   { intervals: [0, 3, 7],  strum: true },
    };

    const ALL_NOTES_CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const shiftPitch = (pitch, semitones) => {
      const match = pitch.match(/^([A-G]#?)(\d+)$/);
      if (!match) return null;
      const [, note, oct] = match;
      const idx = ALL_NOTES_CHROMATIC.indexOf(note);
      const total = idx + parseInt(oct) * 12 + semitones;
      const newNote = ALL_NOTES_CHROMATIC[((total % 12) + 12) % 12];
      const newOct = Math.floor(total / 12);
      if (newOct < 0 || newOct > 8) return null;
      return `${newNote}${newOct}`;
    };

    // Find and play all notes between last and current position
    allNotes.forEach(({ note, voiceIndex }) => {
      const noteKey = `${voiceIndex}-${note.pitch}-${note.beat}`;
      
      // Check if note should trigger (beat is in the range we just passed)
      if (note.beat >= lastPos && note.beat < currentPos && !playedNotesRef.current.has(noteKey)) {
        playedNotesRef.current.add(noteKey);
        
        if (voiceIndex > 0 && !voices[voiceIndex]?.enabled) return;
        
        const volume = (voices[voiceIndex]?.volume || 80) / 100;
        const velocity = note.velocity ?? 0.8;
        const sixteenthNoteDuration = (60 / tempo) / 4;
        const actualDuration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
        const instrument = voices[voiceIndex]?.instrument || 'organ';
        const articulation = note.articulation || 'normal';
        
        // Check if using custom instrument
        const customConfig = getCustomConfig(instrument);

        // Handle arpeggio
        const arpeggioKey = note.arpeggio;
        const arpeggioPattern = arpeggioKey ? ARPEGGIO_PATTERNS[arpeggioKey] : null;
        if (arpeggioPattern) {
          const { intervals, strum } = arpeggioPattern;
          const stepDur = strum ? 0.04 : Math.min(actualDuration / intervals.length, 0.35);
          intervals.forEach((semis, i) => {
            const shiftedPitch = shiftPitch(note.pitch, semis);
            if (!shiftedPitch) return;
            const delayMs = strum ? i * 40 : i * stepDur * 1000;
            const noteDur = strum ? actualDuration : stepDur * 0.85;
            setTimeout(() => {
              if (customConfig) {
                import('@/components/counterpoint/audioEngine').then(({ playNoteWithCustomInstrument }) => {
                  playNoteWithCustomInstrument(shiftedPitch, noteDur, Math.min(1, velocity * 1.2), customConfig, 'normal', tempo, 0);
                });
              } else {
                playNote(shiftedPitch, noteDur, volume * Math.min(1, velocity * 1.2), voiceIndex, instrument, 0);
              }
            }, delayMs);
          });
          return; // skip normal note playback
        }
        
        let pitchBend = 0;
        if (note.bendStart !== undefined || note.bendEnd !== undefined) {
          pitchBend = {
            start: note.bendStart ?? 0,
            end: note.bendEnd ?? 0,
            startTime: note.bendStartTime ?? 0,
            endTime: note.bendEndTime ?? 1
          };
        }
        
        if (customConfig) {
          // Use custom instrument playback with articulation
          // Use raw velocity for power chord detection, then scale final volume
          import('@/components/counterpoint/audioEngine').then(({ playNoteWithCustomInstrument }) => {
            playNoteWithCustomInstrument(note.pitch, actualDuration, Math.min(1, velocity * 1.2), customConfig, articulation, tempo, pitchBend);
          });
        } else {
          // Check if articulation is applied
          if (articulation !== 'normal') {
            import('@/components/counterpoint/audioEngine').then(({ playNoteWithArticulation }) => {
              playNoteWithArticulation(note.pitch, actualDuration, volume * Math.min(1, velocity * 1.2), voiceIndex, instrument, articulation, tempo, pitchBend);
            });
          } else {
            // Use built-in instrument
            playNote(note.pitch, actualDuration, volume * Math.min(1, velocity * 1.2), voiceIndex, instrument, pitchBend);
          }
        }
      }
    });

    lastPlayheadRef.current = currentPos;

    // Metronome click with time signature aware accents
    const discreteBeat = Math.floor(currentPos);
    if (discreteBeat !== Math.floor(lastPos) && metronomeEnabled) {
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      
      // Determine click subdivision based on time signature
      let subdivisionSize;
      switch (settings.timeSignature) {
        case '6/8':
          subdivisionSize = 2; // Click on eighth notes (every 2 sixteenth notes)
          break;
        default:
          subdivisionSize = 4; // Click on quarter notes (every 4 sixteenth notes)
      }
      
      if (discreteBeat % subdivisionSize === 0) {
        // Time signature aware accent patterns
        let isAccent = false;
        const beatInMeasure = discreteBeat % beatsPerMeasure;
        
        switch (settings.timeSignature) {
          case '4/4':
            isAccent = beatInMeasure === 0; // Accent on beat 1
            break;
          case '3/4':
            isAccent = beatInMeasure === 0; // Accent on beat 1
            break;
          case '2/4':
            isAccent = beatInMeasure === 0; // Accent on beat 1
            break;
          case '6/8':
            // Accent only on beat 1
            isAccent = beatInMeasure === 0;
            break;
          case '2/2':
            isAccent = beatInMeasure === 0; // Accent on beat 1
            break;
          default:
            isAccent = beatInMeasure === 0;
        }
        
        playMetronomeClick(isAccent);
      }
    }
  }, [playheadPosition, isPlaying, allNotes, tempo, voices, metronomeEnabled, settings.timeSignature, customInstruments]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      stopAllNotes();
      setIsPlaying(false);
    } else {
      // Synchronously init and resume audio context (required for user gesture)
      initAudio().then((ctx) => {
        if (ctx && ctx.state === 'suspended') ctx.resume();
        setAudioMasterVolume(0.25);
      }).catch(() => {});
      
      // Clear played notes
      playedNotesRef.current.clear();
      // Jump to loop start or stay at current position
      if (loopStart !== null) {
        setCurrentBeat(loopStart);
        setPlayheadPosition(loopStart);
        lastPlayheadRef.current = loopStart;
      } else {
        lastPlayheadRef.current = playheadPosition;
      }
      setIsPlaying(true);
    }
  }, [isPlaying, loopStart, playheadPosition]);

  // Global keyboard handlers for play/pause and save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Spacebar for play/pause
      if (e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }

      // Cmd/Ctrl + S for save project
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        setSaveAsMode(false);
        // If existing project, save directly without dialog
        if (currentProjectId && projectName.trim()) {
          handleSaveProject(true);
        } else {
          setSaveDialogOpen(true);
        }
      }

      // Cmd/Ctrl + Shift + S for save as
       if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
         e.preventDefault();
         setSaveAsMode(true);
         setSaveDialogOpen(true);
       }

       // Arrow keys for playhead movement
       if (e.key === 'ArrowRight') {
         e.preventDefault();
         const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
         const totalBeats = settings.measures * beatsPerMeasure;
         const increment = e.shiftKey ? 4 : 1;
         const newBeat = Math.min(totalBeats - 1, currentBeat + increment);
         handleSeek(newBeat);
         scrollToBeatRef.current?.(newBeat);
       } else if (e.key === 'ArrowLeft') {
         e.preventDefault();
         const increment = e.shiftKey ? 4 : 1;
         const newBeat = Math.max(0, currentBeat - increment);
         handleSeek(newBeat);
         scrollToBeatRef.current?.(newBeat);
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser, currentProjectId, projectName, handleSaveProject, currentBeat, settings, handlePlayPause]);

  const handleReset = () => {
    setCurrentBeat(0);
  };

  const handleStop = () => {
    console.log('[Playback] handleStop called');
    console.trace();
    console.log('[Playback] setIsPlaying(false) - called from handleStop');
    setIsPlaying(false);
    setIsRecording(false);
    setIsCountingIn(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    stopAllNotes();
    setCurrentBeat(0);
    setPlayheadPosition(0);
    lastPlayheadRef.current = 0;
    playedNotesRef.current.clear();
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      // Stop recording - finalize any held notes
      activeRecordingNotesRef.current.forEach((noteStart, pitch) => {
        const duration = Math.max(0.25, Math.round((playheadPosition - noteStart.startBeat) * 1000) / 1000);
        const newNote = {
          pitch,
          beat: noteStart.startBeat,
          duration: duration,
          velocity: noteStart.velocity
        };
        recordedNotesRef.current.push(newNote);
        setCantusFirmus(prev => [...prev, newNote].sort((a, b) => a.beat - b.beat));
      });
      
      console.log('Stopping recording. Total notes recorded:', recordedNotesRef.current.length);
      setIsRecording(false);
      setIsPlaying(false);
      setIsCountingIn(false);
      stopAllNotes();
      recordedNotesRef.current = [];
      activeRecordingNotesRef.current.clear();
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
      countdownIntervalRef.current = setInterval(() => {
        playMetronomeClick(count === 4);
        count--;
        setCountInBeats(count);
        
        if (count === 0) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          setIsCountingIn(false);
          setIsRecording(true);
          setIsPlaying(true);
          setCurrentBeat(0);
          setPlayheadPosition(0);
        }
      }, sixteenthNoteDuration * (beatsPerMeasure / 4) * 1000);
    }
  };

  const isLoadingProjectRef = useRef(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  useEffect(() => { if (!isLoadingProject && (cantusFirmus.length > 0 || generatedVoices.length > 0)) setHasUnsavedChanges(true); }, [cantusFirmus, generatedVoices, settings, isLoadingProject]);

  // Handle note press during recording
  const handleNotePress = useCallback((pitch) => {
    if (isRecording && playheadPosition >= 0) {
      // Always record at exact position, never quantize during recording
      const recordBeat = playheadPosition;
      
      // Track note-on event
      if (!activeRecordingNotesRef.current.has(pitch)) {
        activeRecordingNotesRef.current.set(pitch, {
          startBeat: Math.round(recordBeat * 1000) / 1000,
          velocity: 0.8
        });
      }
    }
  }, [isRecording, playheadPosition]);

  // Handle note release during recording
  const handleNoteRelease = useCallback((pitch) => {
    if (isRecording && activeRecordingNotesRef.current.has(pitch)) {
      const noteStart = activeRecordingNotesRef.current.get(pitch);
      // Always use exact position for recording, never quantize
      const currentPos = playheadPosition;
      const duration = Math.max(0.25, Math.round((currentPos - noteStart.startBeat) * 1000) / 1000);
      
      const newNote = {
        pitch,
        beat: noteStart.startBeat,
        duration: duration,
        velocity: noteStart.velocity
      };
      
      recordedNotesRef.current.push(newNote);
      console.log('Recorded note:', newNote, 'Duration:', duration);
      
      // Update cantusFirmus immediately for real-time visual feedback
      setCantusFirmus(prev => [...prev, newNote].sort((a, b) => a.beat - b.beat));
      
      // Remove from active tracking
      activeRecordingNotesRef.current.delete(pitch);
    }
  }, [isRecording, playheadPosition]);

  const handleSeek = (beat) => {
    setCurrentBeat(beat);
    setPlayheadPosition(beat);
  };



  // Export as data
  const handleExport = () => {
    toast.loading('Exporting project...', { id: 'export' });
    
    try {
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
      
      toast.success('Project exported successfully', { id: 'export' });
    } catch (error) {
      toast.error('Failed to export project', { id: 'export' });
    }
  };

  // Import MIDI
  const handleImportMidi = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      toast.loading('Importing MIDI file...', { id: 'import-midi' });
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        
        // Extract tempo from MIDI (convert to BPM based on quarter notes)
        const midiTempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
        const midiBPM = Math.round(midiTempo);
        
        // Enharmonic flat-to-sharp map for normalization
        const flatToSharp = {
          'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
          'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
        };
        const normalizePitch = (name) => {
          // name is like "C4", "Db3", "A#5", "C-1" etc.
          const match = name.match(/^([A-G]b?)(-?\d+)$/);
          if (!match) return name;
          let [, note, octave] = match;
          const oct = parseInt(octave);
          // Map flat to sharp
          if (flatToSharp[note]) note = flatToSharp[note];
          // Clamp to supported range (C0–B8)
          if (oct < 0 || oct > 8) return null;
          return `${note}${oct}`;
        };

        // Get all notes from all tracks, sorted by time
        const allNotes = [];
        midi.tracks.forEach(track => {
          track.notes.forEach(note => {
            const normalizedPitch = normalizePitch(note.name);
            if (!normalizedPitch) return; // skip out-of-range notes
            allNotes.push({
              pitch: normalizedPitch,
              time: note.time,
              duration: note.duration,
              velocity: note.velocity
            });
          });
        });
        
        // Sort by time
        allNotes.sort((a, b) => a.time - b.time);
        
        // Convert MIDI times (in seconds) to our 16th-note beat grid
        const sixteenthNotesPerSecond = (midiBPM / 60) * 4;

        // Round to 3 decimal places (millisecond precision) - preserves trills while matching playback system
        const importedNotes = allNotes.map(n => ({
          pitch: n.pitch,
          beat: Math.round(n.time * sixteenthNotesPerSecond * 1000) / 1000,
          duration: Math.max(0.0625, Math.round((n.duration * sixteenthNotesPerSecond) * 1000) / 1000),
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
        toast.success('MIDI file imported successfully', { id: 'import-midi' });
        } catch (error) {
        console.error('Failed to import MIDI:', error);
        toast.error('Failed to import MIDI file: ' + error.message, { id: 'import-midi' });
        }
        };
        input.click();
        };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-[#1E1E1E] via-[#232323] to-[#1A1A1A]">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full overflow-x-hidden">
        {/* Header */}
                  <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-1">
          <ProjectDialogs
            loadDialogOpen={loadDialogOpen} setLoadDialogOpen={setLoadDialogOpen}
            savedProjects={savedProjects} handleLoadProject={handleLoadProject} deleteProjectMutation={deleteProjectMutation} handleNewProject={handleNewProject}
            songDialogOpen={songDialogOpen} setSongDialogOpen={setSongDialogOpen}
            librarySearchQuery={librarySearchQuery} setLibrarySearchQuery={setLibrarySearchQuery}
            librarySortBy={librarySortBy} setLibrarySortBy={setLibrarySortBy}
            libraryActiveTab={libraryActiveTab} setLibraryActiveTab={setLibraryActiveTab}
            songs={songs} previewingSongId={previewingSongId} handlePreviewSong={handlePreviewSong}
            previewingProjectId={previewingProjectId} handlePreviewProject={handlePreviewProject}
            currentUser={currentUser}
            editingSong={editingSong} setEditingSong={setEditingSong} songName={songName} setSongName={setSongName} songDescription={songDescription} setSongDescription={setSongDescription}
            setEditSongDialogOpen={setEditSongDialogOpen} editSongDialogOpen={editSongDialogOpen}
            deleteSongMutation={deleteSongMutation} updateSongMutation={updateSongMutation} handleUpdateSong={handleUpdateSong}
            saveDialogOpen={saveDialogOpen} setSaveDialogOpen={setSaveDialogOpen} saveAsMode={saveAsMode} setSaveAsMode={setSaveAsMode}
            projectName={projectName} setProjectName={setProjectName} saveProjectMutation={saveProjectMutation} handleSaveProject={handleSaveProject} currentProjectId={currentProjectId}
            saveSongDialogOpen={saveSongDialogOpen} setSaveSongDialogOpen={setSaveSongDialogOpen} handleSaveSong={handleSaveSong} saveSongMutation={saveSongMutation}
            unsavedChangesDialog={unsavedChangesDialog} setUnsavedChangesDialog={setUnsavedChangesDialog} pendingAction={pendingAction} setPendingAction={setPendingAction}
            hasUnsavedChanges={hasUnsavedChanges} setHasUnsavedChanges={setHasUnsavedChanges} isLoadingProjectRef={isLoadingProjectRef}
            handleLoadSong={handleLoadSong}
          />
        </motion.header>

        {/* Main Content - Full width now, AI panel is overlay */}
        <div className="flex flex-col flex-1 min-h-0 gap-2">

          {/* Main Area - Score & Playback - Full width */}
          <motion.main 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="flex-1 min-h-0 overflow-hidden h-full">
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
                                   onSaveProject={() => { setSaveAsMode(false); if (currentProjectId && projectName.trim()) { handleSaveProject(true); } else { setSaveDialogOpen(true); } }}
                                   onSaveProjectAs={() => { setSaveAsMode(true); setSaveDialogOpen(true); }}
                                   onSaveSong={currentUser?.role === 'admin' ? () => setSaveSongDialogOpen(true) : null}
                                   onLoadProject={() => { window.__loadRecentProject = handleLoadProject; setLibraryActiveTab('projects'); setSongDialogOpen(true); }}
                                   onBrowseSongs={() => setSongDialogOpen(true)}
                                   onExport={handleExport}
                                   onAIComposer={async () => { const isAuth = await base44.auth.isAuthenticated(); if (!isAuth) { base44.auth.redirectToLogin(window.location.href); return; } setChatbotActive(prev => { const ns = !prev; if (ns) { setChatbotOpen(true); setChatbotMinimized(false); } else { setChatbotOpen(false); setChatbotMinimized(false); } return ns; }); }}
                                   onGenerate={handleGenerate}
                                   canGenerate={cantusFirmus.length > 0}
                                   isGenerating={isGenerating}
                                   onExportMidi={() => { toast.loading('Exporting MIDI...', { id: 'export-midi' }); try { const md = { tempo, timeSignature: [4,4], tracks: allVoices.map(v => ({ name: v.name, notes: v.notes?.map(n => ({ pitch: n.pitch, startTime: n.beat*(60/tempo), duration: (n.duration||1)*(60/tempo), velocity: Math.round((n.velocity??0.8)*100) })) || [] })) }; const blob = new Blob([JSON.stringify(md,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`counterpoint-${settings.key}-${Date.now()}.mid.json`; a.click(); URL.revokeObjectURL(url); toast.success('MIDI exported',{id:'export-midi'}); } catch(e) { toast.error('Failed to export MIDI',{id:'export-midi'}); } }}
                                   onImportMidi={handleImportMidi}
                                   isRecording={isRecording}
                                   onRecordToggle={handleRecordToggle}
                                   isCountingIn={isCountingIn}
                                   countInBeats={countInBeats}
                                   masterVolume={masterVolume}
                                   onMasterVolumeChange={(vol) => { setMasterVolume(vol); setAudioMasterVolume(vol / 100 * 0.4); }}
                                   currentUser={currentUser}
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
                               loopStart={loopStart} loopEnd={loopEnd} isLooping={isLooping}
                               onLoopChange={(start, end) => { setLoopStart(start); setLoopEnd(end); }}
                               onVoiceInstrumentChange={(voiceIndex, instrument) => { const newVoices = [...voices]; if (newVoices[0]) { newVoices[0] = { ...newVoices[0], instrument }; setVoices(newVoices); } }}
                               onTogglePianoPanel={() => setShowPianoPanel(!showPianoPanel)}
                               showPianoPanel={showPianoPanel && !pianoPopout}
                               onPopOut={() => setPianoPopout(true)}
                               onNewProject={handleNewProject}
                               onSaveProject={() => { setSaveAsMode(false); if (currentProjectId && projectName.trim()) { handleSaveProject(true); } else { setSaveDialogOpen(true); } }}
                               onSaveProjectAs={() => { setSaveAsMode(true); setSaveDialogOpen(true); }}
                               onSaveSong={currentUser?.role === 'admin' ? () => setSaveSongDialogOpen(true) : null}
                               onLoadProject={() => { window.__loadRecentProject = handleLoadProject; setLibraryActiveTab('projects'); setSongDialogOpen(true); }}
                               onBrowseSongs={() => setSongDialogOpen(true)}
                               onExport={handleExport}
                               onAIComposer={async () => { const isAuth = await base44.auth.isAuthenticated(); if (!isAuth) { base44.auth.redirectToLogin(window.location.href); return; } setChatbotActive(prev => { const ns = !prev; if (ns) { setChatbotOpen(true); setChatbotMinimized(false); } else { setChatbotOpen(false); setChatbotMinimized(false); } return ns; }); }}
                               onGenerate={handleGenerate}
                               canGenerate={cantusFirmus.length > 0}
                               isGenerating={isGenerating}
                               onExportMidi={() => { toast.loading('Exporting MIDI...', { id: 'export-midi' }); try { const md = { tempo, timeSignature: [4,4], tracks: allVoices.map(v => ({ name: v.name, notes: v.notes?.map(n => ({ pitch: n.pitch, startTime: n.beat*(60/tempo), duration: (n.duration||1)*(60/tempo), velocity: Math.round((n.velocity??0.8)*100) })) || [] })) }; const blob = new Blob([JSON.stringify(md,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`counterpoint-${settings.key}-${Date.now()}.mid.json`; a.click(); URL.revokeObjectURL(url); toast.success('MIDI exported',{id:'export-midi'}); } catch(e) { toast.error('Failed to export MIDI',{id:'export-midi'}); } }}
                               onImportMidi={handleImportMidi}
                               onOpenWaveEditor={() => { setShowPianoPanel(true); setOpenWaveEditor(true); setTimeout(() => setOpenWaveEditor(false), 100); }}
                               customInstruments={customInstruments}
                               snapToGrid={snapToGrid} onSnapToGridChange={setSnapToGrid}
                               chatbotActive={chatbotActive}
                               projectName={projectName}
                               currentUser={currentUser}
                               />
            </div>

            <div className="flex-shrink-0 relative z-10">
            <PianoSection
              showPiano={showPiano} setShowPiano={setShowPiano}
              showPianoPanel={showPianoPanel} pianoPopout={pianoPopout} setPianoPopout={setPianoPopout}
              activeNotes={activeNotes} voices={voices} setVoices={setVoices}
              pressedPianoNotes={pressedPianoNotes} setPressedPianoNotes={setPressedPianoNotes}
              handleNotePress={handleNotePress} handleNoteRelease={handleNoteRelease}
              effects={effects} setEffects={setEffects}
              envelope={envelope} setEnvelope={setEnvelope}
              openWaveEditor={openWaveEditor} customInstruments={customInstruments}
              saveInstrumentMutation={saveInstrumentMutation} deleteInstrumentMutation={deleteInstrumentMutation}
            />
            </div>
          </motion.main>
          </div>
          </div>

      <PianoPopout
        pianoPopout={pianoPopout} setPianoPopout={setPianoPopout}
        pianoPopoutSize={pianoPopoutSize} setPianoPopoutSize={setPianoPopoutSize}
        activeNotes={activeNotes} voices={voices} setVoices={setVoices}
        setPressedPianoNotes={setPressedPianoNotes}
        handleNotePress={handleNotePress} handleNoteRelease={handleNoteRelease}
        effects={effects} setEffects={setEffects}
        envelope={envelope} setEnvelope={setEnvelope}
        openWaveEditor={openWaveEditor} customInstruments={customInstruments}
        saveInstrumentMutation={saveInstrumentMutation} deleteInstrumentMutation={deleteInstrumentMutation}
      />

      {/* AI Chatbot - Left side panel like base44 */}
      <AnimatePresence>
        {chatbotOpen && (
          <AIChatbot
            isOpen={chatbotOpen}
            onClose={() => {
              setChatbotOpen(false);
              setChatbotMinimized(true);
            }}
            settings={settings}
            onSettingsChange={setSettings}
            voices={voices}
            onVoicesChange={setVoices}
            currentNotes={cantusFirmus}
            messages={chatbotMessages}
            onMessagesChange={setChatbotMessages}
            onApplyMelody={(notes) => setCantusFirmus(notes)}
            instrument={voices[0]?.instrument || 'organ'}
            customInstruments={customInstruments}
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

      {/* AI Chatbot Bubble - Shows when minimized */}
      <AnimatePresence>
        {chatbotActive && chatbotMinimized && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => {
              setChatbotOpen(true);
              setChatbotMinimized(false);
            }}
            className="fixed bottom-6 left-6 z-[100] w-14 h-14 rounded-full bg-[#D4AF37] hover:bg-[#E5C158] shadow-2xl flex items-center justify-center transition-transform hover:scale-110"
            title="Open AI Composer"
          >
            <Sparkles className="w-6 h-6 text-[#1E1E1E]" />
          </motion.button>
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
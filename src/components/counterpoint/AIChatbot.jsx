import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Send, Loader2, Sparkles, Music, Play, Square, Layers, Palette, Settings, Music2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { initAudio, playNote, stopAllNotes } from './audioEngine';

const KEY_OPTIONS = ['C', 'G', 'D', 'F', 'A', 'E', 'Bb'];
const MODE_OPTIONS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Natural Minor' },
  { value: 'harmonic_minor', label: 'Harmonic Minor' },
  { value: 'melodic_minor', label: 'Melodic Minor' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'phrygian', label: 'Phrygian' },
  { value: 'mixolydian', label: 'Mixolydian' },
];

const SPECIES_OPTIONS = [
  { value: '1st', label: '1st Species' },
  { value: '2nd', label: '2nd Species' },
  { value: '3rd', label: '3rd Species' },
  { value: '4th', label: '4th Species' },
  { value: '5th', label: '5th (Florid)' },
];

const COMPOSER_STYLES = {
  none: { name: 'No Style', description: '' },
  bach: { 
    name: 'J.S. Bach', 
    description: 'Baroque polyphony with intricate counterpoint, sequences, motivic development, ornaments (trills, mordents), and structured harmonic progressions. Uses imitation, inversion, and fugal techniques.',
    techniques: 'sequences, suspensions, pedal points, voice leading, circle of fifths progressions, ornamental figures, rhythmic motifs that repeat and develop'
  },
  mozart: { 
    name: 'Mozart', 
    description: 'Classical elegance with balanced phrases (usually 4+4 or 8 bars), Alberti bass patterns, graceful melodic turns, clear harmonic structure, and galant style ornaments.',
    techniques: 'antecedent-consequent phrases, graceful appoggiaturas, scalar runs, arpeggiated accompaniments, surprising modulations, operatic melodic lines'
  },
  beethoven: { 
    name: 'Beethoven', 
    description: 'Dramatic contrasts, powerful rhythmic motifs, sforzando accents, development through variation, and heroic themes. Bold harmonic shifts and dynamic extremes.',
    techniques: 'short powerful motifs developed extensively, dramatic pauses, sudden dynamic changes, rhythmic drive, tritone relationships, subito piano'
  },
  chopin: { 
    name: 'Chopin', 
    description: 'Romantic piano poetry with rubato, expressive chromaticism, nocturne-like melodies, wide-ranging arpeggios, and intimate emotional expression.',
    techniques: 'chromatic passing tones, expressive rubato, wide arpeggiated left hand, ornamental filigree, bel canto melodic lines, rich pedaling effects'
  },
  debussy: { 
    name: 'Debussy', 
    description: 'Impressionistic colors with whole-tone scales, parallel chords, modal harmony, pentatonic elements, and atmospheric textures. Avoids traditional resolutions.',
    techniques: 'whole-tone passages, parallel fifths and fourths, pentatonic melodies, planing chords, suspended harmonies, coloristic effects'
  },
  jazz: { 
    name: 'Jazz/Blues', 
    description: 'Swing rhythms, blue notes (b3, b5, b7), syncopation, call-and-response, walking bass, and bebop-style chromatic lines.',
    techniques: 'swing 8ths, blue notes, ii-V-I progressions, tritone substitutions, chromatic approach notes, syncopated rhythms, improvisation-like passages'
  }
};

export default function AIChatbot({ 
  isOpen, 
  onClose, 
  settings,
  onSettingsChange,
  voices,
  onVoicesChange,
  onApplyMelody,
  onApplyHarmony,
  currentNotes,
  tempo = 80
}) {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm your AI counterpoint composer. I can create melodies and harmonies in various styles!\n\n• \"Create a Bach-style fugue subject\"\n• \"Add a walking bass line\"\n• \"Generate a 32-note passage\"\n\nSelect a composer style below!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [activeTab, setActiveTab] = useState('chat');
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const messagesEndRef = useRef(null);

  // Fetch Bach Inventions for AI training
  const { data: songs = [] } = useQuery({
    queryKey: ['songs-training'],
    queryFn: () => base44.entities.Song.list('-created_date'),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseNotesFromResponse = (response) => {
    // Try to extract notes array from the response
    if (response.notes && Array.isArray(response.notes)) {
      return response.notes;
    }
    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Detect if user wants harmony/accompaniment
    const wantsHarmony = /harmony|harmonize|bass|tenor|accompan|counterpoint|voice|part/i.test(userMessage);
    const hasExistingMelody = currentNotes.length > 0;
    
    // Build style context
    const style = COMPOSER_STYLES[selectedStyle];
    const styleContext = selectedStyle !== 'none' ? `
    COMPOSER STYLE: ${style.name}
    Style characteristics: ${style.description}
    Techniques to use: ${style.techniques}
    IMPORTANT: Emulate this composer's authentic style throughout the composition!
    ` : '';

    // Build training examples from Bach Inventions
    const trainingExamples = songs.slice(0, 5).map(song => `
    Example: ${song.name} (${song.settings?.key || 'C'} ${song.settings?.mode || 'major'})
    Melodic characteristics: ${song.cantusFirmus?.length || 0} notes, durations vary from ${Math.min(...(song.cantusFirmus?.map(n => n.duration) || [1]))} to ${Math.max(...(song.cantusFirmus?.map(n => n.duration) || [1]))}
    Sample notes: ${JSON.stringify(song.cantusFirmus?.slice(0, 20) || [])}
    `).join('\n');

    const trainingContext = songs.length > 0 ? `
    TRAINING DATA - Study these Bach Invention examples for authentic counterpoint:
    ${trainingExamples}

    Apply these patterns: varied note durations, melodic sequences, motivic development, proper voice leading.
    ` : '';

    // Detect if user wants a specific number of notes
          const noteCountMatch = userMessage.match(/(\d+)\s*notes?/i);
          const requestedNoteCount = noteCountMatch ? parseInt(noteCountMatch[1]) : null;
          const minNotes = requestedNoteCount || Math.max(32, settings.measures * 8);

          // Detect if user wants chords
          const wantsChords = /chord|polyphon|multi|simultan|together|stack/i.test(userMessage);

    try {
      let response;
      
      if (wantsHarmony && hasExistingMelody) {
        // Generate harmonizing voice
        response = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an expert counterpoint composer and music theorist. Generate a harmonizing voice to accompany the existing melody.

        Current settings:
        - Key: ${settings.key} ${settings.mode}
        - Species: ${settings.species || '1st'} species counterpoint
        - Tempo: ${tempo} BPM
        - Measures: ${settings.measures}
        ${styleContext}
        ${trainingContext}

Existing cantus firmus/melody:
${JSON.stringify(currentNotes, null, 2)}

User request: "${userMessage}"

Generate a SOPHISTICATED harmonizing voice following advanced counterpoint techniques:

HARMONIC RULES:
1. Use notes in ${settings.key} ${settings.mode} scale (with chromatic passing tones for color)
2. Create consonant intervals (3rds, 5ths, 6ths, octaves) on strong beats
3. Use suspensions (4-3, 7-6, 9-8) for tension and release
4. Avoid parallel 5ths and octaves
5. Employ contrary and oblique motion
6. For bass: E2-C4, tenor: C3-G4, alto: F3-D5
7. Start/end on perfect consonances
8. Use sequences, imitation, and motivic development

RHYTHM & COMPLEXITY:
- Create AT LEAST ${Math.max(12, currentNotes.length)} notes for the harmony
- Use varied durations: 0.25 (16th), 0.5 (8th), 1 (quarter), 2 (half), 4 (whole)
- Include passing tones, neighbor tones, and appoggiaturas
- Create rhythmic counterpoint - when melody moves, harmony can hold; when melody holds, harmony can move
- Add ornamental figures (turns, mordents represented as fast notes)

Determine the best voice type (bass, tenor, alto) and create a musically sophisticated part.`,
          response_json_schema: {
            type: "object",
            properties: {
              description: { type: "string" },
              voiceType: { type: "string", enum: ["bass", "tenor", "alto", "soprano"] },
              notes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pitch: { type: "string" },
                    beat: { type: "number" },
                    duration: { type: "number" }
                  }
                }
              }
            }
          }
        });
      } else if (wantsHarmony && !hasExistingMelody) {
        // Generate both melody and harmony
        response = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an expert counterpoint composer and music theorist. Create a complete two-voice contrapuntal composition.

        Current settings:
        - Key: ${settings.key} ${settings.mode}
        - Measures: ${settings.measures}
        - Species: ${settings.species || '1st'} species counterpoint
        - Tempo: ${tempo} BPM
        ${styleContext}
        ${trainingContext}

User request: "${userMessage}"

Generate TWO sophisticated voices using advanced music theory:

VOICE 1 - MELODY (Soprano, C4-G5):
- Create AT LEAST ${minNotes} notes - this should be a COMPLETE, DEVELOPED melody
- Use motivic development: introduce a motif, then vary it (inversion, augmentation, sequence)
- Include scalar passages, arpeggios, and ornamental figures
- Build to a climax around 2/3 through, then resolve
- Use chromatic passing tones for color where appropriate

VOICE 2 - HARMONY (Bass, E2-C4):
- Create complementary rhythmic counterpoint
- When melody is active, bass can sustain; when melody sustains, bass can move
- Use pedal points for harmonic stability
- Include walking bass sections and leaps of 4ths/5ths

ADVANCED TECHNIQUES:
- Suspensions (prepare-suspend-resolve)
- Sequences (melodic patterns that repeat at different pitch levels)
- Imitation (one voice echoes another)
- Contrary motion between voices
- Cadential formulas (authentic, half, deceptive)

RHYTHM - CRITICAL:
- Use ALL durations: 0.25, 0.5, 1, 2, 4
- Create rhythmic variety and interplay
- Include syncopation and hemiola
- Total span: ${settings.measures * 4} beats

This should sound like a REAL composition, not a simple exercise!`,
          response_json_schema: {
            type: "object",
            properties: {
              description: { type: "string" },
              melody: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pitch: { type: "string" },
                    beat: { type: "number" },
                    duration: { type: "number" }
                  }
                }
              },
              harmony: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pitch: { type: "string" },
                    beat: { type: "number" },
                    duration: { type: "number" }
                  }
                }
              },
              harmonyVoiceType: { type: "string", enum: ["bass", "tenor", "alto"] }
            }
          }
        });
      } else {
                // Generate melody (with optional chords)
                response = await base44.integrations.Core.InvokeLLM({
                  prompt: `You are an expert composer. Create a musically compelling composition.

                Current settings:
                - Key: ${settings.key} ${settings.mode}
                - Measures: ${settings.measures} (total beats: ${settings.measures * 4})
                - Tempo: ${tempo} BPM
                ${styleContext}
                ${trainingContext}

      User request: "${userMessage}"

      CRITICAL REQUIREMENTS:
      1. Generate EXACTLY ${minNotes} notes or MORE - this is mandatory!
      2. ${wantsChords ? 'Include CHORDS - multiple notes at the same beat position create harmony' : 'Create a melodic line'}
      3. Use the full beat range from 0 to ${settings.measures * 4}

      ${wantsChords ? `
      CHORD CREATION:
      - To create chords, place multiple notes at the SAME beat value
      - Example chord at beat 0: [{pitch: "C4", beat: 0}, {pitch: "E4", beat: 0}, {pitch: "G4", beat: 0}]
      - Common chord voicings: triads (3 notes), 7ths (4 notes), open voicings
      - Mix chords with single melodic notes for texture
      - Use chord progressions: I-IV-V-I, ii-V-I, I-vi-IV-V, etc.
      ` : ''}

      NOTE GENERATION STRATEGY:
      - Distribute notes evenly across ALL ${settings.measures * 4} beats
      - Use 16th notes (duration 0.25) for runs - generates 4 notes per beat!
      - Use 8th notes (duration 0.5) for moderate motion - 2 notes per beat
      - For ${minNotes} notes over ${settings.measures * 4} beats, average ${(minNotes / (settings.measures * 4)).toFixed(1)} notes per beat
      - Include scalar runs: 8-16 consecutive notes stepping up/down
      - Include arpeggios: chord tones played in sequence

      PITCH RANGE: C3 to C6 (use full range for expressiveness)

      DURATION VALUES:
      - 0.25 = 16th note (fast runs, ornaments)
      - 0.5 = 8th note (moderate motion)
      - 1 = quarter note
      - 2 = half note
      - 4 = whole note

      YOU MUST generate at least ${minNotes} notes. Count them!`,
                  response_json_schema: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      noteCount: { type: "number", description: "Total number of notes generated" },
                      notes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            pitch: { type: "string" },
                            beat: { type: "number" },
                            duration: { type: "number" }
                          }
                        }
                      }
                    }
                  }
                });
              }

      // Parse response based on type
      const notes = response.notes || response.melody;
      const harmony = response.harmony;
      const voiceType = response.voiceType || response.harmonyVoiceType;
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.description || "Here's what I created for you!",
        notes: notes,
        harmony: harmony,
        voiceType: voiceType
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I had trouble generating that melody. Please try again with a different description."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const [previewPlaying, setPreviewPlaying] = useState(null);
  const previewTimeoutRef = useRef(null);

  const handleApplyNotes = (notes) => {
    if (notes && notes.length > 0) {
      const formattedNotes = notes.map((n, i) => ({
        pitch: n.pitch,
        beat: n.beat !== undefined ? n.beat : i,
        duration: n.duration || 1
      }));
      onApplyMelody(formattedNotes);
    }
  };

  const handleApplyHarmony = (harmony, voiceType) => {
    if (harmony && harmony.length > 0 && onApplyHarmony) {
      const formattedNotes = harmony.map((n, i) => ({
        pitch: n.pitch,
        beat: n.beat !== undefined ? n.beat : i,
        duration: n.duration || 1
      }));
      onApplyHarmony(formattedNotes, voiceType || 'bass');
    }
  };

  const handleApplyBoth = (melody, harmony, voiceType) => {
    handleApplyNotes(melody);
    if (harmony) {
      handleApplyHarmony(harmony, voiceType);
    }
  };

  const handlePreview = (notes, messageIndex, harmony = null) => {
    if (previewPlaying === messageIndex) {
      // Stop preview
      stopAllNotes();
      if (previewTimeoutRef.current) {
        previewTimeoutRef.current.forEach(t => clearTimeout(t));
      }
      setPreviewPlaying(null);
      return;
    }

    initAudio();
    stopAllNotes();
    setPreviewPlaying(messageIndex);

    // Use 16th note timing - our beat unit is 16th notes
    const sixteenthNoteDuration = (60 / tempo) / 4; // Duration of one 16th note in seconds
    const msPerBeat = sixteenthNoteDuration * 1000;
    const timeouts = [];

    // Group notes by beat to separate melody from chords
    const notesByBeat = new Map();
    notes.forEach((note) => {
      const beat = note.beat !== undefined ? note.beat : 0;
      if (!notesByBeat.has(beat)) {
        notesByBeat.set(beat, []);
      }
      notesByBeat.get(beat).push(note);
    });

    // Play notes - single notes in sequence, skip simultaneous notes (chords)
    notesByBeat.forEach((notesAtBeat, beat) => {
      if (notesAtBeat.length === 1) {
        // Single note - play it
        const note = notesAtBeat[0];
        const startTime = beat * msPerBeat;
        const timeout = setTimeout(() => {
          const duration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
          playNote(note.pitch, duration, 0.7, 0, 'organ');
        }, startTime);
        timeouts.push(timeout);
      }
      // Skip chords (multiple notes at same beat) for melody preview
    });

    // Play harmony if exists - use actual beat positions
    if (harmony && harmony.length > 0) {
      harmony.forEach((note) => {
        const beat = note.beat !== undefined ? note.beat : 0;
        const startTime = beat * msPerBeat;
        const timeout = setTimeout(() => {
          const duration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
          playNote(note.pitch, duration, 0.6, 1, 'organ');
        }, startTime);
        timeouts.push(timeout);
      });
    }

    // Stop preview after all notes played - calculate based on actual durations
    const melodyEnd = notes.reduce((max, n) => Math.max(max, (n.beat || 0) + (n.duration || 1)), 0);
    const harmonyEnd = harmony ? harmony.reduce((max, n) => Math.max(max, (n.beat || 0) + (n.duration || 1)), 0) : 0;
    const totalDuration = Math.max(melodyEnd, harmonyEnd) * msPerBeat;
    
    const endTimeout = setTimeout(() => {
      setPreviewPlaying(null);
    }, totalDuration + 500);
    timeouts.push(endTimeout);

    previewTimeoutRef.current = timeouts;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        previewTimeoutRef.current.forEach(t => clearTimeout(t));
      }
      stopAllNotes();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      className="fixed left-4 top-20 bottom-4 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50"
    >
      {/* Tabs */}
      <div className="p-2 border-b border-slate-700">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-slate-800/50">
            <TabsTrigger value="chat" className="flex-1 text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Settings className="w-3 h-3 mr-1" />
              Settings
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Generation Settings */}
          <div className="space-y-3">
            <h4 className="text-white/80 text-xs font-medium uppercase tracking-wider">Generation</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-white/70 text-xs mb-1 block">Key</Label>
                <Select value={settings.key} onValueChange={(v) => onSettingsChange?.({...settings, key: v})}>
                  <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {KEY_OPTIONS.map(k => (
                      <SelectItem key={k} value={k} className="text-white text-xs">{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/70 text-xs mb-1 block">Mode</Label>
                <Select value={settings.mode} onValueChange={(v) => onSettingsChange?.({...settings, mode: v})}>
                  <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {MODE_OPTIONS.map(m => (
                      <SelectItem key={m.value} value={m.value} className="text-white text-xs">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-white/70 text-xs mb-1 block">Species</Label>
              <Select value={settings.species} onValueChange={(v) => onSettingsChange?.({...settings, species: v})}>
                <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {SPECIES_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-white text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-white/70 text-xs">Measures</Label>
                <span className="text-white text-xs">{settings.measures}</span>
              </div>
              <Slider
                value={[settings.measures]}
                onValueChange={([v]) => onSettingsChange?.({...settings, measures: v})}
                min={4}
                max={64}
                step={4}
                className="[&_[role=slider]]:bg-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-white/70 text-xs">Tempo</Label>
                <span className="text-white text-xs">{tempo} BPM</span>
              </div>
              <Slider
                value={[tempo]}
                onValueChange={([v]) => onSettingsChange?.({...settings, tempo: v})}
                min={40}
                max={200}
                step={5}
                className="[&_[role=slider]]:bg-amber-400"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-xs">Strict Rules</Label>
              <Switch
                checked={settings.strictRules}
                onCheckedChange={(v) => onSettingsChange?.({...settings, strictRules: v})}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          </div>

          {/* Voices */}
          <div className="space-y-2">
            <h4 className="text-white/80 text-xs font-medium uppercase tracking-wider">Voices</h4>
            {voices?.map((voice, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#E8B885', '#7B9E89', '#9B8AA6', '#A68B7B'][i] }} />
                  <span className="text-white text-xs">{voice.name}</span>
                </div>
                <Switch
                  checked={voice.enabled}
                  onCheckedChange={(v) => {
                    const newVoices = [...voices];
                    newVoices[i] = {...voice, enabled: v};
                    onVoicesChange?.(newVoices);
                  }}
                  className="data-[state=checked]:bg-amber-500 scale-75"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'user' 
                ? 'bg-amber-500 text-slate-900' 
                : 'bg-slate-800 text-white'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {(msg.notes?.length > 0 || msg.harmony?.length > 0) && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
                  {/* Melody section */}
                  {msg.notes?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Music className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-white/70">Melody • {msg.notes.length} notes</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.notes.slice(0, 8).map((n, j) => (
                          <span key={j} className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                            {n.pitch}
                          </span>
                        ))}
                        {msg.notes.length > 8 && (
                          <span className="text-xs text-white/50">+{msg.notes.length - 8}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Harmony section */}
                  {msg.harmony?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Layers className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-white/70 capitalize">{msg.voiceType || 'Harmony'} • {msg.harmony.length} notes</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.harmony.slice(0, 8).map((n, j) => (
                          <span key={j} className="text-xs bg-green-900/50 px-1.5 py-0.5 rounded text-green-300">
                            {n.pitch}
                          </span>
                        ))}
                        {msg.harmony.length > 8 && (
                          <span className="text-xs text-white/50">+{msg.harmony.length - 8}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handlePreview(msg.notes, i, msg.harmony)}
                      variant="outline"
                      className="border-slate-600 text-white text-xs h-7 hover:bg-slate-700"
                    >
                      {previewPlaying === i ? (
                        <><Square className="w-3 h-3 mr-1" />Stop</>
                      ) : (
                        <><Play className="w-3 h-3 mr-1" />Preview</>
                      )}
                    </Button>
                    
                    {msg.notes?.length > 0 && !msg.harmony && (
                      <Button
                        size="sm"
                        onClick={() => handleApplyNotes(msg.notes)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs h-7"
                      >
                        Apply Melody
                      </Button>
                    )}
                    
                    {msg.harmony?.length > 0 && !msg.notes && (
                      <Button
                        size="sm"
                        onClick={() => handleApplyHarmony(msg.harmony, msg.voiceType)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                      >
                        Apply {msg.voiceType || 'Harmony'}
                      </Button>
                    )}
                    
                    {msg.notes?.length > 0 && msg.harmony?.length > 0 && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApplyNotes(msg.notes)}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs h-7"
                        >
                          Melody Only
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApplyBoth(msg.notes, msg.harmony, msg.voiceType)}
                          className="bg-gradient-to-r from-amber-500 to-green-600 hover:opacity-90 text-slate-900 text-xs h-7"
                        >
                          Apply Both
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl px-4 py-3">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

          {/* Style selector and Input */}
          <div className="p-3 border-t border-slate-700 space-y-2">
            <div className="flex items-center gap-2">
              <Palette className="w-3 h-3 text-white/60" />
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="flex-1 bg-slate-800 border-slate-700 text-white h-7 text-xs">
                  <SelectValue placeholder="Style..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {Object.entries(COMPOSER_STYLES).map(([key, style]) => (
                    <SelectItem key={key} value={key} className="text-white text-xs">
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Describe what to create..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-white/40 h-8 text-xs"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-8 w-8 p-0"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Close button */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onClose} 
        className="absolute top-2 right-2 text-white/60 hover:text-white h-6 w-6"
      >
        <X className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}
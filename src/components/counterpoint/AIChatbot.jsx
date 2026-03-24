import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Play, Square, Music, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { initAudio, playNote, stopAllNotes, playNoteWithCustomInstrument } from './audioEngine';
import toast from 'react-hot-toast';

const QUICK_PROMPTS = [
  "Compose a 64-note Bach-style invention in the current key",
  "Create a virtuosic 32-note descending run with ornaments",
  "Write a lyrical 48-note singing melody with long phrases",
  "Generate a death metal riff with palm mutes and power chords",
  "Create a jazz-inflected melody with chromatic passing tones",
  "Write a fugue subject followed by its answer",
  "Compose a dramatic romantic melody with wide leaps",
  "Generate a fast baroque sequence with triplets",
];

export default function AIChatbot({ 
  isOpen, 
  onClose, 
  settings,
  tempo = 80,
  onApplyMelody,
  onApplyHarmony,
  currentNotes,
  messages,
  onMessagesChange,
  instrument = 'organ',
  customInstruments = [],
  voices = []
}) {
  const setMessages = onMessagesChange;
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [previewPlaying, setPreviewPlaying] = useState(null);
  const previewTimeoutRef = useRef(null);

  const { data: songs = [] } = useQuery({
    queryKey: ['songs-training'],
    queryFn: () => base44.entities.Song.list('-created_date'),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Music theory helpers ──────────────────────────────
  const parsePitchToMidi = (pitch) => {
    const noteMap = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const m = pitch?.match(/^([A-G]#?)(\d+)$/);
    if (!m) return 60;
    return (parseInt(m[2]) + 1) * 12 + (noteMap[m[1]] ?? 0);
  };

  const getScaleNotes = (key, mode) => {
    const chromatic = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const majorIntervals = [0,2,4,5,7,9,11];
    const minorIntervals = [0,2,3,5,7,8,10];
    const intervals = mode === 'minor' ? minorIntervals : majorIntervals;
    const root = chromatic.indexOf(key);
    return intervals.map(i => chromatic[(root + i) % 12]);
  };

  const analyzeNotes = (notes) => {
    if (!notes?.length) return null;
    const intervals = [];
    for (let i = 1; i < notes.length; i++) {
      intervals.push(parsePitchToMidi(notes[i].pitch) - parsePitchToMidi(notes[i-1].pitch));
    }
    const durations = notes.map(n => n.duration || 1);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxBeat = Math.max(...notes.map(n => n.beat + (n.duration || 1)));
    const steps = intervals.filter(i => Math.abs(i) <= 2).length;
    const leaps = intervals.filter(i => Math.abs(i) > 2).length;
    const ascending = intervals.filter(i => i > 0).length;
    const descending = intervals.filter(i => i < 0).length;
    return {
      noteCount: notes.length,
      maxBeat,
      avgDuration: avgDuration.toFixed(2),
      density: (notes.length / (maxBeat / 4)).toFixed(2),
      stepPercent: ((steps / Math.max(1, intervals.length)) * 100).toFixed(0),
      leapPercent: ((leaps / Math.max(1, intervals.length)) * 100).toFixed(0),
      tendency: ascending > descending ? 'ascending' : 'descending',
      pitchRange: `${notes[0]?.pitch} – ${notes[notes.length - 1]?.pitch}`,
      rhythmicCharacter: avgDuration < 0.5 ? 'rapid/virtuosic' : avgDuration < 1 ? 'flowing/eighth-note' : avgDuration < 2 ? 'moderate' : 'sustained/chorale',
      articulationsUsed: [...new Set(notes.map(n => n.articulation).filter(Boolean))].join(', ') || 'none',
      velocityRange: `${Math.min(...notes.map(n => n.velocity || 0.8)).toFixed(2)} – ${Math.max(...notes.map(n => n.velocity || 0.8)).toFixed(2)}`,
      bendsUsed: notes.filter(n => n.bendStart !== undefined || n.bendEnd !== undefined).length,
    };
  };

  const buildTrainingContext = () => {
    const examples = songs.slice(0, 8).map(song => {
      const notes = song.cantusFirmus || [];
      const a = analyzeNotes(notes);
      if (!a) return '';
      return `【${song.name}】 Key: ${song.settings?.key} ${song.settings?.mode} | Tempo: ${song.settings?.tempo}
Notes: ${a.noteCount} | Density: ${a.density}/quarter | Range: ${a.pitchRange} | Steps: ${a.stepPercent}% Leaps: ${a.leapPercent}%
Sample (first 20): ${JSON.stringify(notes.slice(0, 20))}`;
    }).filter(Boolean).join('\n\n');
    return examples;
  };

  const getStyleHints = (msg) => {
    const m = msg.toLowerCase();
    if (m.includes('death metal') || m.includes('brutal') || m.includes('metal')) {
      return `STYLE=DeathMetal: Low register C2-C4. Palm mutes velocity 0.2-0.35 duration 0.25. Power chords velocity 0.95-1.0. 
Tritones + minor seconds for dissonance. Breakdowns: syncopated quarters on low strings. 
Tremolo picking: articulation:"tremolo-ultra", duration 0.25, velocity 0.85. 
chromatic PASSING TONES only – root notes from scale. Example riff: C2(0.25,vm0.3) C2(0.25,vm0.3) C2(0.25,vm0.3) F#2(0.25,vm0.35) G2(0.5,vc0.95) G2(0.5,vc0.95)`;
    }
    if (m.includes('guitar') || m.includes('shred') || m.includes('solo')) {
      return `STYLE=ElectricGuitar: String bends bendStart:0,bendEnd:2 (whole step) or bendEnd:1 (half step). 
Vibrato: bendStart:-0.3,bendEnd:0.3,startTime:0.3,endTime:1. Dive bombs: bendEnd:-12. 
Sweep arpeggios: fast ascending/descending arpeggio on I/IV/V chords velocity 0.7-0.85. 
Hammer-ons/pull-offs: slurred rapid 0.25 notes velocity 0.55-0.65. 
Whammy dive: long note with bendEnd:-12. Pinch harmonics: velocity 0.95, short duration.`;
    }
    if (m.includes('jazz')) {
      return `STYLE=Jazz: Chromatic approach notes (half step below target), anticipations (beat early), 
blue notes (b3, b5, b7 of scale). Swing feel: alternating 0.67/0.33 eighth notes. 
Bebop runs: chromatic passing tones between scale degrees. 
Altered dominants: b9, #9, b13 on V chords.`;
    }
    if (m.includes('romantic') || m.includes('chopin') || m.includes('liszt')) {
      return `STYLE=Romantic: Wide leaps (6ths, octaves, 10ths). Rubato feel (varied note lengths). 
Long cantabile lines with expressive dynamics 0.3→0.95 crescendo. 
Chromatic voice leading. Virtuosic cadenzas. Ornaments: turns, trills, grace notes.`;
    }
    if (m.includes('baroque') || m.includes('bach') || m.includes('fugue') || m.includes('counterpoint')) {
      return `STYLE=Baroque: Continuous motivic development. Sequences (motif transposed by 2nd/3rd repeatedly). 
Ornaments: mordents (main-lower-main rapid), trills, appoggiaturas. 
Motor rhythm: consistent 8th or 16th note pulse. Terraced dynamics (no crescendo). 
Imitation and invertible counterpoint. Clear cadential formulas on I and V.`;
    }
    if (m.includes('lyrical') || m.includes('singing') || m.includes('vocal')) {
      return `STYLE=Lyrical: Long breath-like phrases 8-16 notes. Stepwise predominantly. 
Duration variety: quarters (1), halves (2), occasional 8ths (0.5). 
Dynamic arch: soft start → bloom → soft end. Legato articulation on most notes.`;
    }
    if (m.includes('virtuosic') || m.includes('fast') || m.includes('brilliant')) {
      return `STYLE=Virtuosic: Dense 16th note (0.25) passages. Wide range (3+ octaves). 
Sequences of scalar runs alternating ascending/descending. 
Dynamics 0.6-0.95. Articulation mix: legato runs with staccato accents.`;
    }
    return '';
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '🎵 Composing with advanced theory...', isGenerating: true }]);

    const noteCountMatch = userMessage.match(/(\d+)\s*notes?/i);
    const requestedNoteCount = noteCountMatch ? parseInt(noteCountMatch[1]) : 64;
    const existingAnalysis = analyzeNotes(currentNotes);
    const scaleNotes = getScaleNotes(settings.key, settings.mode);
    const isCounterpointRequest = /counterpoint|harmony|voice|soprano|alto|tenor|bass|second\s+voice|accompaniment/i.test(userMessage);
    const isExtendRequest = /extend|continue|add\s+more|append/i.test(userMessage);
    const isEditRequest = /edit|modify|change|replace\s+measure/i.test(userMessage);
    const startBeat = (isExtendRequest && existingAnalysis) ? existingAnalysis.maxBeat : 0;
    const styleHints = getStyleHints(userMessage);
    const trainingData = buildTrainingContext();

    // Build scale pitch lists for all octaves
    const scalePitchesAllOctaves = [];
    for (let oct = 2; oct <= 7; oct++) {
      scaleNotes.forEach(n => scalePitchesAllOctaves.push(`${n}${oct}`));
    }

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are an elite master composer with encyclopedic knowledge of Baroque counterpoint, Classical form, Romantic expression, Jazz harmony, and modern guitar techniques. You generate compositions of extraordinary musical depth and technical sophistication.

════════════════════════════════════════════
TRAINING CORPUS – REAL COMPOSITIONS IN THIS APP:
════════════════════════════════════════════
${trainingData || 'No songs in library yet – compose from first principles.'}

════════════════════════════════════════════
FULL FEATURE SET – USE EVERYTHING AVAILABLE:
════════════════════════════════════════════

1. PITCH: Any standard pitch string like "C4", "F#3", "Bb5" (use # not b for sharps)
   Scale of ${settings.key} ${settings.mode}: ${scaleNotes.join(', ')}
   All available octaves: ${scalePitchesAllOctaves.slice(0, 24).join(', ')} ...

2. BEAT: Fractional beat positioning (e.g., 0, 0.25, 0.5, 1, 1.333 for triplets)
   Total available beats: 0 to ${settings.measures * 16}
   ${isExtendRequest ? `⚡ EXTEND MODE: Start notes at beat ${startBeat}` : ''}

3. DURATION (16th-note units):
   • 0.125 = 32nd note (ultra-fast)
   • 0.25 = 16th note (fast, use heavily for runs)
   • 0.333 = 16th triplet
   • 0.5 = 8th note
   • 0.667 = 8th triplet
   • 1 = quarter note
   • 1.5 = dotted quarter
   • 2 = half note
   • 3 = dotted half
   • 4 = whole note

4. VELOCITY: 0.0–1.0 (VARY this! Don't use same value everywhere)
   • 0.2–0.35: very soft, palm-muted, whisper
   • 0.4–0.55: soft, piano
   • 0.6–0.75: medium, mezzo-forte
   • 0.8–0.9: loud, forte
   • 0.95–1.0: fff, accent, power chord

5. ARTICULATION (string, optional):
   • "staccato" – short, detached, bouncy
   • "legato" – smooth, connected, no gap
   • "accent" – emphasized attack + short
   • "trill" – rapid alternation (use with duration >= 1)
   • "tremolo-ultra" – extremely rapid same-pitch repetition
   • "grace" – grace note (very short, ornamental)

6. PITCH BEND (object, optional – for guitar/expressive playing):
   Properties: bendStart (semitones), bendEnd (semitones), startTime (0-1), endTime (0-1)
   • Half-step bend: {bendStart:0, bendEnd:1, startTime:0.1, endTime:0.9}
   • Whole-step bend: {bendStart:0, bendEnd:2, startTime:0.1, endTime:0.9}
   • Vibrato: {bendStart:-0.3, bendEnd:0.3, startTime:0.4, endTime:1.0}
   • Dive bomb: {bendStart:0, bendEnd:-12, startTime:0.1, endTime:0.95}
   • Pre-bend + release: {bendStart:2, bendEnd:0, startTime:0, endTime:0.8}
   ⚠️ Use fields: bendStart, bendEnd, bendStartTime, bendEndTime (NOT pitchBend object)

════════════════════════════════════════════
CURRENT COMPOSITION CONTEXT:
════════════════════════════════════════════

Musical parameters:
• Key: ${settings.key} ${settings.mode} | Tempo: ${tempo} BPM | Time sig: ${settings.timeSignature || '4/4'}
• Measures: ${settings.measures} | Beat range: 0–${settings.measures * 16}
• Scale notes: ${scaleNotes.join(', ')}
• Instrument: ${instrument}

${existingAnalysis ? `Existing melody analysis:
• ${existingAnalysis.noteCount} notes | Range: ${existingAnalysis.pitchRange} | Density: ${existingAnalysis.density} notes/quarter
• Steps: ${existingAnalysis.stepPercent}% | Leaps: ${existingAnalysis.leapPercent}% | Tendency: ${existingAnalysis.tendency}
• Rhythm: ${existingAnalysis.rhythmicCharacter} | AvgDur: ${existingAnalysis.avgDuration}
• Articulations used: ${existingAnalysis.articulationsUsed}
• Velocity range: ${existingAnalysis.velocityRange} | Pitch bends: ${existingAnalysis.bendsUsed}
• Last 10 notes: ${JSON.stringify(currentNotes?.slice(-10))}
${isExtendRequest ? `→ EXTEND: Start at beat ${existingAnalysis.maxBeat}, develop from last note ${currentNotes?.[currentNotes.length-1]?.pitch}` : ''}
${isEditRequest ? '→ EDIT MODE: Replace only specified range, output just those notes' : ''}` : '✨ Fresh composition – no existing notes'}

════════════════════════════════════════════
STYLE DIRECTIVE:
════════════════════════════════════════════
${styleHints || 'No specific style directive – use best musical judgment for the request.'}

════════════════════════════════════════════
USER REQUEST: "${userMessage}"
════════════════════════════════════════════

COMPOSITIONAL REQUIREMENTS:
1. Generate EXACTLY ${requestedNoteCount}+ notes (more is better – do not stop early)
2. Every note MUST have pitch, beat, duration, velocity
3. No two notes should have the same beat position unless intended (chords/ornaments)
4. Beats must be ASCENDING – sort all notes by beat
5. Duration + beat of last note must not exceed ${settings.measures * 16}
6. USE ARTICULATIONS on at least 30% of notes
7. USE VELOCITY VARIATION – create dynamic curves, not flat dynamics
8. Use PITCH BENDS for expressive passages when stylistically appropriate
9. Create clear MUSICAL FORM: introduction → development → climax → resolution
10. Apply advanced techniques: sequences, imitation, invertible counterpoint, motivic development

ADVANCED TECHNIQUES TO EMPLOY:
• Sequences: repeat a 3-6 note motif transposed by 2nd/3rd (3-4 times)
• Scalar runs: 8-16 stepwise notes ascending or descending  
• Arpeggiation: outline I, IV, V, vi chords in the key
• Rhythmic augmentation/diminution: stretch or compress motif rhythmically
• Dynamic shaping: velocity arc 0.5→0.9→0.5 matching phrase rise/fall
• Ornaments: grace notes (dur 0.125), mordents (3 fast notes), trills (long dur)
• Syncopation: notes starting on offbeats (0.5, 1.5, 2.5)

SCALE TO USE (root notes for ${settings.key} ${settings.mode}):
ALL melodic content should use: ${scaleNotes.join(', ')} (across octaves C2-C7)
Chromatic notes are PASSING TONES only – always resolve to scale tones.

Generate a musically sophisticated, technically impressive composition.

${isCounterpointRequest ? `COUNTERPOINT NOTE: The user wants a counterpoint voice. Generate notes that harmonize with the existing melody (if any). Use consonant intervals (3rds, 6ths, octaves, 5ths) against the main melody. Avoid parallel 5ths and octaves. The counterpoint line should have its own melodic identity while complementing the existing melody.` : ''}`,
        response_json_schema: {
          type: "object",
          properties: {
            compositionAnalysis: {
              type: "object",
              properties: {
                form: { type: "string" },
                keyAreas: { type: "array", items: { type: "string" } },
                motivicContent: { type: "string" },
                climaxLocation: { type: "string" },
                stylisticFeatures: { type: "array", items: { type: "string" } },
                techniquesSummary: { type: "string" }
              }
            },
            description: { type: "string" },
            noteCount: { type: "number" },
            editMode: { type: "string", description: "replace, extend, or partial" },
            notes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pitch: { type: "string", description: "e.g. C4, F#3, Bb5" },
                  beat: { type: "number" },
                  duration: { type: "number" },
                  velocity: { type: "number", description: "0.0–1.0" },
                  articulation: { type: "string", description: "staccato|legato|accent|trill|tremolo-ultra|grace" },
                  bendStart: { type: "number", description: "Semitones at start of bend" },
                  bendEnd: { type: "number", description: "Semitones at end of bend" },
                  bendStartTime: { type: "number", description: "0–1 normalized position" },
                  bendEndTime: { type: "number", description: "0–1 normalized position" }
                },
                required: ["pitch", "beat", "duration", "velocity"]
              }
            }
          },
          required: ["compositionAnalysis", "description", "noteCount", "notes", "editMode"]
        }
      });

      // Handle nested response structure from LLM
      const actualResponse = response?.response || response;
      const rawNotes = actualResponse?.notes || [];
      
      console.log('[AIChatbot] Extracted notes count:', rawNotes.length);
      
      // Post-process: sort by beat, clamp durations, remove overlapping
      const processedNotes = rawNotes
        .filter(n => n.pitch && typeof n.beat === 'number' && typeof n.duration === 'number')
        .sort((a, b) => a.beat - b.beat)
        .map(n => {
          const note = {
            pitch: n.pitch,
            beat: Math.round(n.beat * 1000) / 1000,
            duration: Math.max(0.125, Math.round(n.duration * 1000) / 1000),
            velocity: Math.max(0.1, Math.min(1.0, n.velocity ?? 0.7)),
          };
          if (n.articulation) note.articulation = n.articulation;
          if (n.bendStart !== undefined) note.bendStart = n.bendStart;
          if (n.bendEnd !== undefined) note.bendEnd = n.bendEnd;
          if (n.bendStartTime !== undefined) note.bendStartTime = n.bendStartTime;
          if (n.bendEndTime !== undefined) note.bendEndTime = n.bendEndTime;
          return note;
        });

      const aiEditMode = actualResponse.editMode || 'replace';

      setMessages(prev => {
        const filtered = prev.filter(m => !m.isGenerating);
        const ca = actualResponse?.compositionAnalysis;
        let analysisText = `${actualResponse?.description || 'Composition generated.'}\n\n`;
        if (ca) {
          analysisText += `📊 **Analysis**: Form: ${ca.form || '?'} | Climax: ${ca.climaxLocation || '?'}\n`;
          if (ca.motivicContent) analysisText += `🎵 ${ca.motivicContent}\n`;
          if (ca.techniquesSummary) analysisText += `🔬 ${ca.techniquesSummary}\n`;
          if (ca.stylisticFeatures?.length) analysisText += `✨ Techniques: ${ca.stylisticFeatures.join(', ')}`;
        }
        return [...filtered, {
          role: 'assistant',
          content: analysisText,
          notes: processedNotes,
          editMode: aiEditMode,
          analysis: ca
        }];
      });
    } catch (error) {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isGenerating);
        return [...filtered, {
          role: 'assistant',
          content: `Sorry, composition failed: ${error.message}. Please try again.`
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyNotes = (notes, editMode = 'replace') => {
    if (!notes?.length || !onApplyMelody) return;
    
    if (editMode === 'extend' || (currentNotes?.length > 0 && Math.min(...notes.map(n => n.beat)) >= (analyzeNotes(currentNotes)?.maxBeat || 0) - 2)) {
      const combined = [...(currentNotes || []), ...notes].sort((a, b) => a.beat - b.beat);
      onApplyMelody(combined);
      toast.success(`Extended with ${notes.length} new notes`);
    } else if (editMode === 'partial' && currentNotes?.length > 0) {
      const minBeat = Math.min(...notes.map(n => n.beat));
      const maxBeat = Math.max(...notes.map(n => n.beat + (n.duration || 1)));
      const kept = currentNotes.filter(n => n.beat < minBeat || n.beat >= maxBeat);
      const combined = [...kept, ...notes].sort((a, b) => a.beat - b.beat);
      onApplyMelody(combined);
      toast.success(`Updated ${notes.length} notes in range`);
    } else {
      onApplyMelody(notes);
      toast.success(`Applied ${notes.length} AI-generated notes`);
    }
  };

  const handlePreview = (notes, messageIndex) => {
    if (previewPlaying === messageIndex) {
      stopAllNotes();
      previewTimeoutRef.current?.forEach(t => clearTimeout(t));
      setPreviewPlaying(null);
      return;
    }
    initAudio();
    stopAllNotes();
    setPreviewPlaying(messageIndex);

    const sixteenthNoteDuration = (60 / tempo) / 4;
    const msPerBeat = sixteenthNoteDuration * 1000;
    const timeouts = [];

    const getCustomConfig = () => {
      if (instrument.startsWith('custom_')) return customInstruments[parseInt(instrument.split('_')[1])];
      if (instrument.startsWith('preset_')) {
        const PRESETS = [
          { name: 'Warm Pad', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.5 }, { waveform: 'sawtooth', detune: 7, gain: 0.5 }], envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 }, filter: { type: 'lowpass', frequency: 1200, Q: 0.5 } },
          { name: 'Bright Lead', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.7 }, { waveform: 'square', detune: 12, gain: 0.3 }], envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 }, filter: { type: 'lowpass', frequency: 4000, Q: 2 } },
          { name: 'Bell', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.6 }, { waveform: 'sine', detune: 700, gain: 0.3 }], envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 }, filter: { type: 'highpass', frequency: 500, Q: 0.5 } }
        ];
        return PRESETS[parseInt(instrument.split('_')[1])];
      }
      return null;
    };

    const customConfig = getCustomConfig();
    notes.forEach(note => {
      const t = setTimeout(() => {
        const duration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
        const pitchBend = (note.bendStart !== undefined || note.bendEnd !== undefined) ? {
          start: note.bendStart ?? 0, end: note.bendEnd ?? 0,
          startTime: note.bendStartTime ?? 0, endTime: note.bendEndTime ?? 1
        } : 0;
        if (customConfig) playNoteWithCustomInstrument(note.pitch, duration, note.velocity ?? 0.7, customConfig);
        else playNote(note.pitch, duration, note.velocity ?? 0.7, 0, instrument, pitchBend);
      }, (note.beat || 0) * msPerBeat);
      timeouts.push(t);
    });

    const maxBeat = Math.max(...notes.map(n => (n.beat || 0) + (n.duration || 1)));
    timeouts.push(setTimeout(() => setPreviewPlaying(null), maxBeat * msPerBeat + 500));
    previewTimeoutRef.current = timeouts;
  };

  useEffect(() => {
    return () => {
      previewTimeoutRef.current?.forEach(t => clearTimeout(t));
      stopAllNotes();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, x: -320 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -320 }}
        className="fixed left-4 top-16 bottom-4 w-84 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50"
        style={{ width: 340 }}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-white font-semibold text-sm">AI Composer</h3>
              <p className="text-white/40 text-[10px]">Claude Sonnet · All features enabled</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60 hover:text-white h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-3 pt-2 pb-1 flex flex-col gap-1 flex-shrink-0 border-b border-slate-800">
            <p className="text-white/40 text-[10px] uppercase tracking-wider px-1 pb-0.5">Quick Prompts</p>
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(prompt); }}
                  className="text-left text-xs text-white/60 hover:text-amber-400 hover:bg-slate-800 rounded px-2 py-1 transition-colors flex items-center gap-1.5"
                >
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-2xl px-3 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-white'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed select-text cursor-text">{msg.content}</p>
                {msg.notes?.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-700/50 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <Music className="w-3 h-3" />
                        {msg.notes.length} notes
                      </span>
                      {msg.notes.filter(n => n.articulation).length > 0 && (
                        <span className="text-xs text-blue-400">
                          {msg.notes.filter(n => n.articulation).length} articulated
                        </span>
                      )}
                      {msg.notes.filter(n => n.bendEnd !== undefined).length > 0 && (
                        <span className="text-xs text-purple-400">
                          {msg.notes.filter(n => n.bendEnd !== undefined).length} bends
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePreview(msg.notes, i)}
                        className={`text-xs h-7 flex-1 ${previewPlaying === i ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                      >
                        {previewPlaying === i ? <><Square className="w-3 h-3 mr-1" />Stop</> : <><Play className="w-3 h-3 mr-1" />Preview</>}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApplyNotes(msg.notes, msg.editMode)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs h-7 flex-1 font-semibold"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-white/60 text-xs">Claude Sonnet composing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-700 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
              placeholder="Describe your composition..."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-white/30 h-9 text-sm"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-9 w-9 p-0 flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-white/25 text-[10px] text-center mt-1.5">Uses claude_sonnet_4_6 · more credits per request</p>
        </div>
      </motion.div>
    </>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Play, Square, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { initAudio, playNote, stopAllNotes, playNoteWithCustomInstrument } from './audioEngine';
import toast from 'react-hot-toast';

export default function AIChatbot({ 
  isOpen, 
  onClose, 
  settings,
  tempo = 80,
  onApplyMelody,
  currentNotes,
  messages,
  onMessagesChange,
  instrument = 'organ',
  customInstruments = []
}) {
  const setMessages = onMessagesChange;
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [previewPlaying, setPreviewPlaying] = useState(null);
  const previewTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Fetch Bach Inventions for training
  const { data: songs = [] } = useQuery({
    queryKey: ['songs-training'],
    queryFn: () => base44.entities.Song.list('-created_date'),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    
    // Add generating message
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: '🎵 Composing your melody... analyzing Bach patterns and generating notes...',
      isGenerating: true
    }]);

    // Detect requested note count
    const noteCountMatch = userMessage.match(/(\d+)\s*notes?/i);
    const requestedNoteCount = noteCountMatch ? parseInt(noteCountMatch[1]) : 64;

    // Helper functions for analysis
    const parsePitchToMidi = (pitch) => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const match = pitch.match(/^([A-G]#?)(\d+)$/);
      if (!match) return 60;
      const [, note, octave] = match;
      return (parseInt(octave) + 1) * 12 + notes.indexOf(note);
    };
    
    const getIntervalDistribution = (intervals) => {
      const dist = {};
      intervals.forEach(int => {
        const abs = Math.abs(int);
        dist[abs] = (dist[abs] || 0) + 1;
      });
      return Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([int, count]) => `±${int}(${count})`).join(', ');
    };
    
    const findSequences = (notes) => {
      const sequences = [];
      for (let len = 3; len <= 8; len++) {
        for (let i = 0; i <= notes.length - len * 2; i++) {
          const pattern = notes.slice(i, i + len);
          let reps = 1;
          for (let j = i + len; j <= notes.length - len; j += len) {
            const next = notes.slice(j, j + len);
            const transposition = parsePitchToMidi(next[0].pitch) - parsePitchToMidi(pattern[0].pitch);
            const isSequence = pattern.every((n, k) => {
              const expectedMidi = parsePitchToMidi(n.pitch) + transposition;
              const actualMidi = parsePitchToMidi(next[k]?.pitch || '');
              return Math.abs(expectedMidi - actualMidi) <= 1;
            });
            if (isSequence) reps++;
            else break;
          }
          if (reps >= 2) sequences.push({ length: len, repetitions: reps, startIndex: i });
        }
      }
      return sequences.slice(0, 3);
    };
    
    const getScaleDegrees = (key, mode) => {
      const major = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
      const minor = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
      return mode === 'minor' ? minor.join(', ') : major.join(', ');
    };
    
    const getPitchRange = (notes) => {
      if (!notes.length) return 'N/A';
      const pitches = notes.map(n => n.pitch);
      return `${pitches[0]} to ${pitches[pitches.length - 1]}`;
    };
    
    const getThird = (key, mode) => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const rootIdx = notes.indexOf(key);
      const interval = mode === 'minor' ? 3 : 4;
      return notes[(rootIdx + interval) % 12];
    };
    
    const getFifth = (key) => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const rootIdx = notes.indexOf(key);
      return notes[(rootIdx + 7) % 12];
    };
    
    const analyzeMelodicTendency = (notes) => {
      if (notes.length < 2) return 'insufficient data';
      let ascending = 0, descending = 0;
      for (let i = 1; i < notes.length; i++) {
        const prev = parsePitchToMidi(notes[i-1].pitch);
        const curr = parsePitchToMidi(notes[i].pitch);
        if (curr > prev) ascending++;
        if (curr < prev) descending++;
      }
      return ascending > descending ? 'ascending' : descending > ascending ? 'descending' : 'balanced';
    };
    
    const analyzeRhythmicCharacter = (notes) => {
      const durations = notes.map(n => n.duration || 1);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const fastNotes = durations.filter(d => d <= 0.5).length;
      const slowNotes = durations.filter(d => d >= 2).length;
      
      if (avgDuration < 0.6) return 'rapid/virtuosic';
      if (avgDuration > 1.5) return 'sustained/chorale';
      if (fastNotes > slowNotes * 2) return 'ornamental';
      return 'moderate/balanced';
    };
    
    const getUserIntent = (message) => {
      const msg = message.toLowerCase();
      if (msg.includes('virtuosic') || msg.includes('fast') || msg.includes('brilliant')) {
        return `🎭 STYLE DETECTED: Virtuosic → Use dense 16th note runs, wide leaps, dynamic contrasts`;
      }
      if (msg.includes('lyrical') || msg.includes('singing') || msg.includes('expressive')) {
        return `🎭 STYLE DETECTED: Lyrical → Flowing stepwise motion, longer note values, cantabile`;
      }
      if (msg.includes('energetic') || msg.includes('lively') || msg.includes('dance')) {
        return `🎭 STYLE DETECTED: Energetic → Strong rhythmic drive, syncopation, motor rhythm`;
      }
      if (msg.includes('contemplative') || msg.includes('slow') || msg.includes('meditative')) {
        return `🎭 STYLE DETECTED: Contemplative → Sparse texture, long notes, minimal ornamentation`;
      }
      if (msg.includes('baroque')) {
        return `🎭 STYLE DETECTED: Baroque → Sequences, continuous motion, ornaments, terraced dynamics`;
      }
      if (msg.includes('classical')) {
        return `🎭 STYLE DETECTED: Classical → Balanced phrases, clear cadences, alberti figures`;
      }
      if (msg.includes('romantic')) {
        return `🎭 STYLE DETECTED: Romantic → Wide range, expressive leaps, rubato implications`;
      }
      return ``;
    };

    // Build sophisticated training context from Bach Inventions with deep analysis
    const trainingExamples = songs.slice(0, 12).map(song => {
      const notes = song.cantusFirmus || [];
      const durations = notes.map(n => n.duration || 1);
      const pitches = notes.map(n => n.pitch);
      
      // Analyze intervals
      const intervals = [];
      for (let i = 1; i < notes.length; i++) {
        const prev = pitches[i - 1];
        const curr = pitches[i];
        const prevMidi = parsePitchToMidi(prev);
        const currMidi = parsePitchToMidi(curr);
        intervals.push(currMidi - prevMidi);
      }
      
      // Analyze melodic shape
      const leaps = intervals.filter(int => Math.abs(int) > 2).length;
      const steps = intervals.filter(int => Math.abs(int) <= 2).length;
      const direction = intervals.filter(int => int > 0).length > intervals.filter(int => int < 0).length ? 'ascending tendency' : 'descending tendency';
      
      // Find sequences (repeating patterns at different pitch levels)
      const sequences = findSequences(notes);
      
      return `
━━━ ${song.name} ━━━
Key: ${song.settings?.key || 'C'} ${song.settings?.mode || 'major'} | Tempo: ${song.settings?.tempo || 80} BPM
Total: ${notes.length} notes | Range: ${pitches[0]} to ${pitches[pitches.length - 1]}

RHYTHM ANALYSIS:
• Duration types: ${new Set(durations).size} different values (${Array.from(new Set(durations)).sort((a, b) => a - b).join(', ')})
• Rhythmic density: ${(notes.length / Math.max(...notes.map(n => n.beat + (n.duration || 1))) * 4).toFixed(2)} notes/quarter
• Pattern: ${durations.slice(0, 24).join(',')}

MELODIC ANALYSIS:
• Steps vs Leaps: ${steps} steps (${((steps / intervals.length) * 100).toFixed(0)}%), ${leaps} leaps (${((leaps / intervals.length) * 100).toFixed(0)}%)
• Direction: ${direction}
• Interval distribution: ${getIntervalDistribution(intervals)}
• Sequences found: ${sequences.length > 0 ? sequences.map(s => `${s.length} notes × ${s.repetitions}`).join(', ') : 'none detected'}

FULL SCORE (first 30 notes):
${JSON.stringify(notes.slice(0, 30), null, 2)}`;
    }).join('\n\n');
    
    function parsePitchToMidi(pitch) {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const match = pitch.match(/^([A-G]#?)(\d+)$/);
      if (!match) return 60;
      const [, note, octave] = match;
      return (parseInt(octave) + 1) * 12 + notes.indexOf(note);
    }
    
    function getIntervalDistribution(intervals) {
      const dist = {};
      intervals.forEach(int => {
        const abs = Math.abs(int);
        dist[abs] = (dist[abs] || 0) + 1;
      });
      return Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([int, count]) => `±${int}(${count})`).join(', ');
    }
    
    function findSequences(notes) {
      const sequences = [];
      for (let len = 3; len <= 8; len++) {
        for (let i = 0; i <= notes.length - len * 2; i++) {
          const pattern = notes.slice(i, i + len);
          let reps = 1;
          for (let j = i + len; j <= notes.length - len; j += len) {
            const next = notes.slice(j, j + len);
            const transposition = parsePitchToMidi(next[0].pitch) - parsePitchToMidi(pattern[0].pitch);
            const isSequence = pattern.every((n, k) => {
              const expectedMidi = parsePitchToMidi(n.pitch) + transposition;
              const actualMidi = parsePitchToMidi(next[k]?.pitch || '');
              return Math.abs(expectedMidi - actualMidi) <= 1;
            });
            if (isSequence) reps++;
            else break;
          }
          if (reps >= 2) sequences.push({ length: len, repetitions: reps, startIndex: i });
        }
      }
      return sequences.slice(0, 3);
    }

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a MASTER composer with deep knowledge of Baroque counterpoint, classical form, and advanced music theory. You have analyzed thousands of works by Bach, Palestrina, Fux, Mozart, and Beethoven. Your compositions are sophisticated, musical, and theoretically sound.

═══════════════════════════════════════════════════════
TRAINING CORPUS - BACH'S TWO-PART INVENTIONS (ANALYZED):
═══════════════════════════════════════════════════════

${trainingExamples}

═══════════════════════════════════════════════════════
ADVANCED COMPOSITIONAL PRINCIPLES:
═══════════════════════════════════════════════════════

🎼 RHYTHM & METER (CRITICAL):
1. **Rhythmic Hierarchy**: Establish strong vs weak beats. Longer notes on downbeats, shorter on offbeats
2. **Motivic Rhythm**: Create a distinctive rhythmic motif (e.g., [0.25, 0.25, 0.5, 1]) and develop it
3. **Hemiola & Syncopation**: Use cross-rhythms (3 against 2) for sophistication
4. **Duration Variety**: Mix 16ths (0.25), 8ths (0.5), quarters (1), halves (2), whole notes (4)
5. **Density Curve**: Start sparse → build to climax with dense runs → resolve with space
6. **Triplet Integration**: Use triplet subdivisions (duration 2.67, 5.33) for variety

🎵 MELODIC CONSTRUCTION (MASTERCLASS):
1. **Motif Development**: 
   - Create a 3-5 note motif with distinctive rhythm + pitch contour
   - Develop through: sequence, inversion, retrograde, augmentation, diminution
2. **Sequences**: 
   - Repeat motifs at different pitch levels (up/down 2nd, 3rd, 4th)
   - Use 2-4 repetitions before breaking the pattern
3. **Scalar Passages**:
   - 8-16 note runs using scale tones (diatonic scales in the given key)
   - Alternate direction every 1-2 octaves
4. **Arpeggiation**:
   - Outline I, IV, V, vi chords using arpeggios
   - Mix broken chords with passing tones
5. **Climax Architecture**:
   - Build tension to highest note around 60-70% through
   - Use wider intervals, faster rhythms approaching climax
   - Resolve with descending motion and longer durations
6. **Interval Usage**:
   - 70% steps (M2, m2), 20% small leaps (m3, M3), 10% larger leaps (4th, 5th, 6th)
   - Follow leaps with stepwise motion in opposite direction
7. **Neighbor Tones & Passing Tones**:
   - Use upper/lower neighbors for ornamentation
   - Fill in leaps with passing tones

🎯 HARMONIC AWARENESS:
1. **Implied Harmony**: Even single lines imply chords - outline tonic, dominant, subdominant
2. **Cadences**: Create clear phrase endings (V-I, IV-I patterns in final measures)
3. **Non-Chord Tones**: Use suspensions, appoggiaturas, escape tones
4. **Voice Leading**: Smooth connection between phrases

🏗️ FORM & STRUCTURE:
1. **Phrase Length**: 4 or 8 measure phrases (16 or 32 beats)
2. **Antecedent-Consequent**: Question phrase → answer phrase
3. **ABA Form**: Statement → contrasting middle → return
4. **Spinning Out**: Continuous development without clear phrase breaks (Fortspinnung)

⚡ EXPRESSION & CHARACTER:
1. **Dynamic Shaping**: Use velocity variations (0.4-1.0) to create crescendo/diminuendo
2. **Articulation Variety**: Mix legato passages with staccato accents
3. **Mood Consistency**: Maintain character (energetic, lyrical, dramatic, playful)
4. **Stylistic Idioms**: 
   - Baroque: sequences, consistent motor rhythm, ornaments
   - Classical: balanced phrases, clear cadences, alberti bass patterns
   - Romantic: wide range, expressive leaps, rubato feel

═══════════════════════════════════════════════════════
CURRENT COMPOSITION CONTEXT:
═══════════════════════════════════════════════════════

📊 MUSICAL PARAMETERS:
• Key: ${settings.key} ${settings.mode}
• Tempo: ${tempo} BPM (${tempo < 80 ? 'slow/contemplative' : tempo < 120 ? 'moderate' : tempo < 160 ? 'energetic' : 'virtuosic'})
• Time signature: ${settings.timeSignature || '4/4'}
• Total measures: ${settings.measures}
• Available beat range: 0 to ${settings.measures * 16}
• Scale degrees: ${getScaleDegrees(settings.key, settings.mode)}

${currentNotes && currentNotes.length > 0 ? `
📝 EXISTING MELODY IN SCORE:
• Total notes: ${currentNotes.length}
• Current range: ${getPitchRange(currentNotes)}
• Density: ${(currentNotes.length / Math.max(...currentNotes.map(n => n.beat + (n.duration || 1))) * 4).toFixed(2)} notes/quarter
• Existing score excerpt:
${JSON.stringify(currentNotes.slice(0, 30), null, 2)}
${currentNotes.length > 30 ? `\n... (${currentNotes.length - 30} more notes)` : ''}

⚠️ EDIT MODE: The user may want to extend/modify this melody rather than replace it!` : '✨ FRESH COMPOSITION - No existing melody'}

🎯 USER REQUEST: "${userMessage}"

${getUserIntent(userMessage)}`}

function getScaleDegrees(key, mode) {
  const major = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const minor = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
  return mode === 'minor' ? minor.join(', ') : major.join(', ');
}

function getPitchRange(notes) {
  if (!notes.length) return 'N/A';
  const pitches = notes.map(n => n.pitch);
  return `${pitches[0]} to ${pitches[pitches.length - 1]}`;
}

function getUserIntent(message) {
  const msg = message.toLowerCase();
  if (msg.includes('virtuosic') || msg.includes('fast') || msg.includes('brilliant')) {
    return `🎭 STYLE DETECTED: Virtuosic → Use dense 16th note runs, wide leaps, dynamic contrasts`;
  }
  if (msg.includes('lyrical') || msg.includes('singing') || msg.includes('expressive')) {
    return `🎭 STYLE DETECTED: Lyrical → Flowing stepwise motion, longer note values, cantabile`;
  }
  if (msg.includes('energetic') || msg.includes('lively') || msg.includes('dance')) {
    return `🎭 STYLE DETECTED: Energetic → Strong rhythmic drive, syncopation, motor rhythm`;
  }
  if (msg.includes('contemplative') || msg.includes('slow') || msg.includes('meditative')) {
    return `🎭 STYLE DETECTED: Contemplative → Sparse texture, long notes, minimal ornamentation`;
  }
  if (msg.includes('baroque')) {
    return `🎭 STYLE DETECTED: Baroque → Sequences, continuous motion, ornaments, terraced dynamics`;
  }
  if (msg.includes('classical')) {
    return `🎭 STYLE DETECTED: Classical → Balanced phrases, clear cadences, alberti figures`;
  }
  if (msg.includes('romantic')) {
    return `🎭 STYLE DETECTED: Romantic → Wide range, expressive leaps, rubato implications`;
  }
  return ``;
}

═══════════════════════════════════════════════════════
TASK INSTRUCTIONS:
═══════════════════════════════════════════════════════

📋 EDIT MODE DETECTION:
${currentNotes.length > 0 ? `
• EXTENDING: If user says "extend", "continue", or "add more" → START at beat ${Math.max(...currentNotes.map(n => n.beat + (n.duration || 1)))}
• EDITING MEASURES: If user specifies "edit measures 5-8" → ONLY generate for that range
• PARTIAL EDIT: Output ONLY new/changed notes, system merges with existing
• REPLACE: If user says "new", "fresh", or "replace" → Start from beat 0, ignore existing` : `
• FRESH START: No existing melody, create from scratch starting at beat 0`}

═══════════════════════════════════════════════════════
GENERATION PARAMETERS:
═══════════════════════════════════════════════════════

📊 TARGET METRICS:
• Note count: ${userMessage.toLowerCase().includes('edit') && userMessage.match(/measure[s]?\s+(\d+)/i) ? 'Match requested measure range only' : `MINIMUM ${requestedNoteCount} notes (more is better!)`}
• Rhythmic density: ${(requestedNoteCount / (settings.measures * 4)).toFixed(1)} notes per quarter note average
• Beat range: 0 to ${settings.measures * 16}
• Pitch range: C3 to C6 (3+ octave range for expressivity)

⚡ RHYTHM GENERATION STRATEGY:

**CRITICAL**: To generate ${requestedNoteCount}+ notes in ${settings.measures} measures:
• Heavy use of 16th notes (duration 0.25) = 4 notes per beat
• Moderate 8th notes (duration 0.5) = 2 notes per beat  
• Strategic longer notes (1, 2, 4) for structural points

**Example 16-beat phrase generating 32+ notes**:
[0.25,0.25,0.25,0.25, 0.5,0.5, 0.25,0.25,0.25,0.25, 1, 0.25,0.25,0.25,0.25, 0.25,0.25,0.25,0.25, 0.5,0.5, 0.25,0.25,0.25,0.25, 2]
= 28 notes in 16 beats (1.75 notes/beat)

**Rhythmic Vocabulary**:
• Fast runs: [0.25, 0.25, 0.25, 0.25] = 16th note stream
• Ornamental turns: [0.25, 0.25, 0.5] = neighbor-tone figure
• Syncopation: [0.5, 1, 0.5] = anticipation pattern
• Hemiola: [2.67, 2.67, 2.67] = triplet grouping across barlines
• Driving rhythm: [0.5, 0.5, 0.5, 0.5] = steady 8th notes

🎼 MELODIC GENERATION ALGORITHM:

**PHASE 1 - EXPOSITION (measures 1-${Math.ceil(settings.measures * 0.3)})**:
1. Introduce PRIMARY MOTIF (4-5 notes with distinctive rhythm)
2. Immediately sequence it (repeat +2nd, +3rd, or -2nd)
3. Add connective scalar passage (6-10 notes ascending/descending)
4. Close first phrase with cadential gesture (slower rhythm → tonic)

**PHASE 2 - DEVELOPMENT (measures ${Math.ceil(settings.measures * 0.3) + 1}-${Math.ceil(settings.measures * 0.7)})**:
1. Transform motif: invert intervals, retrograde, change rhythm
2. Increase rhythmic density with 16th note runs
3. Explore different pitch areas (move through I, IV, V harmonic centers)
4. Build sequences: 3-4 repetitions of a pattern rising or falling by step
5. Introduce CLIMAX (highest note, loudest dynamic, densest rhythm)

**PHASE 3 - RECAPITULATION (measures ${Math.ceil(settings.measures * 0.7) + 1}-${settings.measures})**:
1. Return to opening motif (possibly varied)
2. Wind down rhythmic activity (fewer 16ths, more quarters/halves)
3. Cadential formula: descending scale or arpeggio to tonic
4. Final note on tonic (${settings.key}) with longer duration (2-4 beats)

🎨 INTERVAL & CONTOUR GUIDELINES:
• **Steps (M2, m2)**: 65-75% of intervals - foundation of melody
• **Small leaps (m3, M3)**: 15-20% - adds interest
• **Medium leaps (P4, P5)**: 8-12% - structural boundaries
• **Large leaps (m6, M6, 8ve)**: 2-5% - dramatic moments (compensate opposite direction!)
• **Melodic shape**: Arch form (rise to climax, fall to resolution) or wave form (undulating)
• **Compensatory motion**: After leap >P4, move stepwise in opposite direction

🔬 ADVANCED TECHNIQUES:

1. **Sequence Types**:
   - Ascending by step: Motif at C, D, E, F...
   - Descending by third: Motif at G, E, C, A...
   - Chromatic sequence: Include chromatic passing tones
   - Rosalia: Sequential repetition (name from famous pattern)

2. **Ornamentation**:
   - Turns: [main, upper, main, lower, main] with durations [0.25, 0.25, 0.25, 0.25]
   - Mordents: [main, lower, main] rapid
   - Appoggiaturas: Dissonant note → resolution on beat

3. **Rhythmic Motifs**:
   - Scotch snap: [0.25, 0.75] (short-long)
   - Lombardic rhythm: [0.75, 0.25] (long-short)  
   - Dotted rhythms: [0.75, 0.25] or [1.5, 0.5]

4. **Harmonic Outlining**:
   - Tonic arpeggio: ${settings.key}, ${getThird(settings.key, settings.mode)}, ${getFifth(settings.key)}
   - Dominant arpeggio: ${getFifth(settings.key)}, leading tone, dominant
   - Diminished 7th: Dramatic tension builders

${currentNotes && currentNotes.length > 0 ? `
🔍 EXISTING MELODY ANALYSIS:
• Note count: ${currentNotes.length}
• Range: ${getPitchRange(currentNotes)}
• Last note: ${currentNotes[currentNotes.length - 1]?.pitch} at beat ${currentNotes[currentNotes.length - 1]?.beat}
• Melodic direction tendency: ${analyzeMelodicTendency(currentNotes)}
• Rhythmic character: ${analyzeRhythmicCharacter(currentNotes)}

💡 CONTINUATION STRATEGY:
- Maintain stylistic consistency with existing material
- Develop existing motifs if present
- Ensure smooth voice leading from last note
- Balance existing melodic contour` : ''}

🎯 USER REQUEST INTERPRETATION: "${userMessage}"

${getUserIntent(userMessage)}`}

function getThird(key, mode) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIdx = notes.indexOf(key);
  const interval = mode === 'minor' ? 3 : 4; // minor 3rd or major 3rd
  return notes[(rootIdx + interval) % 12];
}

function getFifth(key) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIdx = notes.indexOf(key);
  return notes[(rootIdx + 7) % 12]; // Perfect 5th
}

function analyzeMelodicTendency(notes) {
  if (notes.length < 2) return 'insufficient data';
  let ascending = 0, descending = 0;
  for (let i = 1; i < notes.length; i++) {
    const prev = parsePitchToMidi(notes[i-1].pitch);
    const curr = parsePitchToMidi(notes[i].pitch);
    if (curr > prev) ascending++;
    if (curr < prev) descending++;
  }
  return ascending > descending ? 'ascending' : descending > ascending ? 'descending' : 'balanced';
}

function analyzeRhythmicCharacter(notes) {
  const durations = notes.map(n => n.duration || 1);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const fastNotes = durations.filter(d => d <= 0.5).length;
  const slowNotes = durations.filter(d => d >= 2).length;
  
  if (avgDuration < 0.6) return 'rapid/virtuosic';
  if (avgDuration > 1.5) return 'sustained/chorale';
  if (fastNotes > slowNotes * 2) return 'ornamental';
  return 'moderate/balanced';
}

function parsePitchToMidi(pitch) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60;
  const [, note, octave] = match;
  return (parseInt(octave) + 1) * 12 + notes.indexOf(note);
}
        response_json_schema: {
          type: "object",
          properties: {
            compositionAnalysis: {
              type: "object",
              properties: {
                form: { type: "string", description: "Overall form (e.g., ABA, through-composed, binary)" },
                keyAreas: { type: "array", items: { type: "string" }, description: "Harmonic progression through piece" },
                motivicContent: { type: "string", description: "Description of main motifs and their development" },
                climaxLocation: { type: "string", description: "Where and how climax occurs" },
                stylisticFeatures: { type: "array", items: { type: "string" }, description: "Notable compositional techniques used" }
              }
            },
            description: { type: "string", description: "User-friendly description of the composition" },
            noteCount: { type: "number" },
            rhythmicAnalysis: { type: "string", description: "Analysis of rhythmic structure and patterns" },
            melodicAnalysis: { type: "string", description: "Analysis of melodic contour and intervals" },
            theoreticalJustification: { type: "string", description: "Why these compositional choices were made" },
            notes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pitch: { type: "string" },
                  beat: { type: "number" },
                  duration: { type: "number" },
                  velocity: { type: "number", description: "Dynamic level 0.4-1.0 for expressive shaping" }
                },
                required: ["pitch", "beat", "duration"]
              }
            }
          },
          required: ["compositionAnalysis", "description", "noteCount", "notes"]
        }
      });

      const notes = response.notes || [];

      // Detect edit mode based on user request
      const isPartialEdit = userMessage.toLowerCase().includes('edit') || 
                            userMessage.toLowerCase().includes('modify') ||
                            userMessage.match(/measure[s]?\s+\d+/i);

      // Remove generating message and add result with detailed analysis
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isGenerating);
        
        // Build rich response with analysis
        let analysisText = response.description + '\n\n';
        
        if (response.compositionAnalysis) {
          analysisText += `📊 **Musical Analysis**:\n`;
          analysisText += `• Form: ${response.compositionAnalysis.form || 'N/A'}\n`;
          analysisText += `• Key areas: ${response.compositionAnalysis.keyAreas?.join(' → ') || 'N/A'}\n`;
          analysisText += `• Motifs: ${response.compositionAnalysis.motivicContent || 'N/A'}\n`;
          analysisText += `• Climax: ${response.compositionAnalysis.climaxLocation || 'N/A'}\n`;
          if (response.compositionAnalysis.stylisticFeatures?.length > 0) {
            analysisText += `• Techniques: ${response.compositionAnalysis.stylisticFeatures.join(', ')}\n`;
          }
          analysisText += `\n`;
        }
        
        if (response.rhythmicAnalysis) {
          analysisText += `🎵 ${response.rhythmicAnalysis}\n`;
        }
        
        if (response.melodicAnalysis) {
          analysisText += `🎼 ${response.melodicAnalysis}\n`;
        }
        
        if (response.theoreticalJustification) {
          analysisText += `\n💭 ${response.theoreticalJustification}`;
        }
        
        return [...filtered, { 
          role: 'assistant', 
          content: analysisText,
          notes: notes,
          editMode: isPartialEdit ? 'partial' : 'replace',
          analysis: response.compositionAnalysis
        }];
      });
    } catch (error) {
      // Check if it was an abort
      if (error.name === 'AbortError') {
        setMessages(prev => {
          const filtered = prev.filter(m => !m.isGenerating);
          return [...filtered, { 
            role: 'assistant', 
            content: "Generation stopped."
          }];
        });
      } else {
        setMessages(prev => {
          const filtered = prev.filter(m => !m.isGenerating);
          return [...filtered, { 
            role: 'assistant', 
            content: "Sorry, I had trouble generating that melody. Please try again."
          }];
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleApplyNotes = (notes, editMode = 'replace') => {
    if (!notes || notes.length === 0 || !onApplyMelody) return;
    
    // Detect if this is an edit/extension based on the AI's response
    const minNewBeat = Math.min(...notes.map(n => n.beat));
    const maxNewBeat = Math.max(...notes.map(n => n.beat + (n.duration || 1)));
    
    // If AI generated notes that start after existing notes, it's an extension
    const isExtension = currentNotes.length > 0 && minNewBeat >= Math.max(...currentNotes.map(n => n.beat + (n.duration || 1))) - 2;
    
    // If AI only covered a small portion of the score, it's likely an edit
    const totalBeats = settings.measures * 16;
    const coverageRatio = (maxNewBeat - minNewBeat) / totalBeats;
    const isPartialEdit = coverageRatio < 0.8 && currentNotes.length > 0;
    
    if (isExtension) {
      // Append new notes to existing
      const combined = [...currentNotes, ...notes].sort((a, b) => a.beat - b.beat);
      onApplyMelody(combined);
      toast.success(`Extended melody with ${notes.length} new notes`);
    } else if (isPartialEdit) {
      // Replace notes only in the edited range, keep the rest
      const notesOutsideRange = currentNotes.filter(n => n.beat < minNewBeat || n.beat >= maxNewBeat);
      const combined = [...notesOutsideRange, ...notes].sort((a, b) => a.beat - b.beat);
      onApplyMelody(combined);
      toast.success(`Updated ${notes.length} notes in selected range`);
    } else {
      // Full replacement
      onApplyMelody(notes);
      toast.success(`Applied ${notes.length} AI-generated notes to score`);
    }
  };

  const handlePreview = (notes, messageIndex) => {
    if (previewPlaying === messageIndex) {
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

    const sixteenthNoteDuration = (60 / tempo) / 4;
    const msPerBeat = sixteenthNoteDuration * 1000;
    const timeouts = [];

    // Get custom config if using custom instrument
    const getCustomConfig = () => {
      if (instrument.startsWith('custom_')) {
        const index = parseInt(instrument.split('_')[1]);
        return customInstruments[index];
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

    const customConfig = getCustomConfig();

    notes.forEach((note) => {
      const startTime = (note.beat || 0) * msPerBeat;
      const timeout = setTimeout(() => {
        const duration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
        if (customConfig) {
          playNoteWithCustomInstrument(note.pitch, duration, 0.7, customConfig);
        } else {
          playNote(note.pitch, duration, 0.7, 0, instrument);
        }
      }, startTime);
      timeouts.push(timeout);
    });

    const maxBeat = Math.max(...notes.map(n => (n.beat || 0) + (n.duration || 1)));
    const totalDuration = maxBeat * msPerBeat;
    
    const endTimeout = setTimeout(() => {
      setPreviewPlaying(null);
    }, totalDuration + 500);
    timeouts.push(endTimeout);

    previewTimeoutRef.current = timeouts;
  };

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
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, x: -300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -300 }}
        className="fixed left-4 top-20 bottom-4 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50"
      >
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-medium">AI Composer</h3>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="text-white/60 hover:text-white h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

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
              {msg.notes?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Music className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-white/70">{msg.notes.length} notes generated</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handlePreview(msg.notes, i)}
                      className={`text-xs h-8 font-medium ${
                        previewPlaying === i 
                          ? 'bg-red-500 hover:bg-red-600 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white border-0'
                      }`}
                    >
                      {previewPlaying === i ? (
                        <><Square className="w-3.5 h-3.5 mr-1.5" />Stop Preview</>
                      ) : (
                        <><Play className="w-3.5 h-3.5 mr-1.5" />Preview</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApplyNotes(msg.notes, msg.editMode)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs h-8 font-medium"
                    >
                      Apply to Score
                    </Button>
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

      {/* Input */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Describe your melody..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-white/40 h-9 text-sm"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              onClick={handleStop}
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white h-9 w-9 p-0"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-9 w-9 p-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
    </>
  );
}
// Counterpoint Generation Engine

const NOTE_VALUES = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4,
  'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11
};

const CONSONANT_INTERVALS = [0, 3, 4, 5, 7, 8, 9, 12]; // Unison, 3rds, 4th, 5th, 6ths, octave
const PERFECT_CONSONANCES = [0, 5, 7, 12]; // Unison, P4, P5, Octave
const IMPERFECT_CONSONANCES = [3, 4, 8, 9]; // 3rds and 6ths

export function parsePitch(pitchStr) {
  const match = pitchStr.match(/^([A-G][#b]?)(\d)$/);
  if (!match) return null;
  const [, note, octave] = match;
  return {
    note,
    octave: parseInt(octave),
    midi: NOTE_VALUES[note] + (parseInt(octave) + 1) * 12
  };
}

export function midiToPitch(midi) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
}

export function getInterval(pitch1, pitch2) {
  const p1 = parsePitch(pitch1);
  const p2 = parsePitch(pitch2);
  if (!p1 || !p2) return null;
  return Math.abs(p2.midi - p1.midi);
}

export function isConsonant(interval) {
  return CONSONANT_INTERVALS.includes(interval % 12);
}

export function isPerfectConsonance(interval) {
  return PERFECT_CONSONANCES.includes(interval % 12);
}

export function getMotionType(voice1Prev, voice1Curr, voice2Prev, voice2Curr) {
  const v1Move = parsePitch(voice1Curr).midi - parsePitch(voice1Prev).midi;
  const v2Move = parsePitch(voice2Curr).midi - parsePitch(voice2Prev).midi;
  
  if (v1Move === 0 && v2Move === 0) return 'stationary';
  if (v1Move === 0 || v2Move === 0) return 'oblique';
  if ((v1Move > 0 && v2Move > 0) || (v1Move < 0 && v2Move < 0)) return 'similar';
  return 'contrary';
}

export function checkParallelFifths(voice1Prev, voice1Curr, voice2Prev, voice2Curr) {
  const prevInterval = getInterval(voice1Prev, voice2Prev) % 12;
  const currInterval = getInterval(voice1Curr, voice2Curr) % 12;
  
  // Check for parallel perfect fifths
  if (prevInterval === 7 && currInterval === 7) {
    const motion = getMotionType(voice1Prev, voice1Curr, voice2Prev, voice2Curr);
    if (motion === 'similar') return true;
  }
  return false;
}

export function checkParallelOctaves(voice1Prev, voice1Curr, voice2Prev, voice2Curr) {
  const prevInterval = getInterval(voice1Prev, voice2Prev) % 12;
  const currInterval = getInterval(voice1Curr, voice2Curr) % 12;
  
  // Check for parallel octaves or unisons
  if ((prevInterval === 0 || prevInterval === 12) && (currInterval === 0 || currInterval === 12)) {
    const motion = getMotionType(voice1Prev, voice1Curr, voice2Prev, voice2Curr);
    if (motion === 'similar') return true;
  }
  return false;
}

export function getScaleNotes(key, mode = 'major') {
  const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
  const modeOffsets = {
    major: 0,
    dorian: 1,
    phrygian: 2,
    lydian: 3,
    mixolydian: 4,
    minor: 5,
    locrian: 6
  };
  
  const keyMidi = NOTE_VALUES[key];
  const offset = modeOffsets[mode] || 0;
  
  const notes = [];
  for (let octave = 2; octave <= 6; octave++) {
    for (let i = 0; i < 7; i++) {
      const noteIdx = (majorIntervals[(i + offset) % 7] + keyMidi) % 12;
      notes.push(midiToPitch(noteIdx + (octave + 1) * 12));
    }
  }
  
  return notes;
}

export function generateCounterpoint(cantusFirmus, settings, voiceConfig) {
  const { species, key, mode, strictRules } = settings;
  const scaleNotes = getScaleNotes(key, mode);
  
  const generatedVoices = [];
  const violations = [];
  
  // Generate each voice
  for (let voiceIdx = 0; voiceIdx < settings.numVoices - 1; voiceIdx++) {
    const voice = voiceConfig[voiceIdx + 1]; // Skip cantus firmus
    if (!voice.enabled) {
      generatedVoices.push({ name: voice.name, notes: [] });
      continue;
    }
    
    const voiceNotes = generateVoice(
      cantusFirmus,
      scaleNotes,
      voice,
      species,
      strictRules,
      violations,
      generatedVoices
    );
    
    generatedVoices.push({ name: voice.name, notes: voiceNotes });
  }
  
  return { voices: generatedVoices, violations };
}

function generateVoice(cantusFirmus, scaleNotes, voiceConfig, species, strictRules, violations, previousVoices) {
  const notes = [];
  const { lowRange, highRange } = voiceConfig;
  
  const lowMidi = parsePitch(lowRange).midi;
  const highMidi = parsePitch(highRange).midi;
  
  // Filter scale notes to voice range
  const availableNotes = scaleNotes.filter(note => {
    const midi = parsePitch(note).midi;
    return midi >= lowMidi && midi <= highMidi;
  });
  
  if (availableNotes.length === 0) return notes;
  
  // Determine notes per beat based on species
  const notesPerBeat = {
    '1st': 1,
    '2nd': 2,
    '3rd': 4,
    '4th': 1, // Syncopated
    '5th': 2  // Mixed - simplified
  }[species] || 1;
  
  cantusFirmus.forEach((cfNote, beatIdx) => {
    const cfPitch = cfNote.pitch;
    
    for (let subBeat = 0; subBeat < notesPerBeat; subBeat++) {
      const beat = beatIdx + (subBeat / notesPerBeat);
      const isStrongBeat = subBeat === 0;
      
      // Get previous note
      const prevNote = notes.length > 0 ? notes[notes.length - 1].pitch : null;
      
      // Score each available note
      let bestNote = null;
      let bestScore = -Infinity;
      
      for (const candidate of availableNotes) {
        let score = 0;
        
        // Interval with cantus firmus
        const interval = getInterval(cfPitch, candidate);
        
        // On strong beats, require consonance
        if (isStrongBeat) {
          if (isConsonant(interval)) {
            score += 10;
            if (!isPerfectConsonance(interval)) {
              score += 5; // Prefer imperfect consonances
            }
          } else {
            if (strictRules) continue; // Skip dissonant options
            score -= 20;
          }
        } else {
          // Weak beats allow passing tones
          if (isConsonant(interval)) {
            score += 5;
          }
        }
        
        // Melodic motion - prefer stepwise
        if (prevNote) {
          const melodicInterval = getInterval(prevNote, candidate);
          if (melodicInterval <= 2) {
            score += 8; // Stepwise
          } else if (melodicInterval <= 4) {
            score += 4; // Third
          } else if (melodicInterval <= 7) {
            score += 1; // Fourth or fifth
          } else {
            score -= 5; // Large leap
          }
          
          // Check for parallel fifths/octaves
          if (beatIdx > 0) {
            const prevCfPitch = cantusFirmus[beatIdx - 1].pitch;
            if (checkParallelFifths(prevCfPitch, cfPitch, prevNote, candidate)) {
              if (strictRules) continue;
              score -= 50;
            }
            if (checkParallelOctaves(prevCfPitch, cfPitch, prevNote, candidate)) {
              if (strictRules) continue;
              score -= 50;
            }
          }
          
          // Prefer contrary motion
          const cfPrevMidi = beatIdx > 0 ? parsePitch(cantusFirmus[beatIdx - 1].pitch).midi : null;
          if (cfPrevMidi !== null) {
            const cfMotion = parsePitch(cfPitch).midi - cfPrevMidi;
            const voiceMotion = parsePitch(candidate).midi - parsePitch(prevNote).midi;
            if ((cfMotion > 0 && voiceMotion < 0) || (cfMotion < 0 && voiceMotion > 0)) {
              score += 6; // Contrary motion bonus
            }
          }
        }
        
        // Add some randomness for variety
        score += Math.random() * 3;
        
        if (score > bestScore) {
          bestScore = score;
          bestNote = candidate;
        }
      }
      
      if (bestNote) {
        notes.push({ beat, pitch: bestNote });
      }
    }
  });
  
  return notes;
}

export function validateCounterpoint(voices, cantusFirmus) {
  const violations = [];
  
  // Check between each pair of voices
  for (let i = 0; i < voices.length; i++) {
    for (let j = i + 1; j < voices.length; j++) {
      const voice1 = i === 0 ? { notes: cantusFirmus } : voices[i - 1];
      const voice2 = j === 0 ? { notes: cantusFirmus } : voices[j - 1];
      
      if (!voice1.notes || !voice2.notes) continue;
      
      // Find common beats
      voice1.notes.forEach((note1, idx) => {
        if (idx === 0) return;
        
        const note2 = voice2.notes.find(n => n.beat === note1.beat);
        const prevNote1 = voice1.notes[idx - 1];
        const prevNote2 = voice2.notes.find(n => n.beat === prevNote1.beat);
        
        if (!note2 || !prevNote2) return;
        
        if (checkParallelFifths(prevNote1.pitch, note1.pitch, prevNote2.pitch, note2.pitch)) {
          violations.push({
            ruleId: 'parallel-fifths',
            message: `Parallel fifths at beat ${note1.beat + 1}`,
            beat: note1.beat
          });
        }
        
        if (checkParallelOctaves(prevNote1.pitch, note1.pitch, prevNote2.pitch, note2.pitch)) {
          violations.push({
            ruleId: 'parallel-octaves',
            message: `Parallel octaves at beat ${note1.beat + 1}`,
            beat: note1.beat
          });
        }
      });
    }
  }
  
  return violations;
}
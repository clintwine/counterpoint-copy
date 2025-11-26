import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shuffle, Trash2, Plus, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export default function CantusFirmusEditor({ 
  notes, 
  onUpdate, 
  mode,
  keySignature = 'C',
  measures = 8
}) {
  const [selectedBeat, setSelectedBeat] = useState(null);

  const getScaleNotes = (key) => {
    // Returns notes in the major scale for the given key
    const scales = {
      'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
      'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
      'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    };
    return scales[key] || scales['C'];
  };

  const scaleNotes = getScaleNotes(keySignature);
  const octaves = [3, 4, 5];

  const pitchOptions = [];
  octaves.forEach(octave => {
    scaleNotes.forEach(note => {
      pitchOptions.push(`${note}${octave}`);
    });
  });

  const handleNoteChange = (beat, pitch) => {
    const newNotes = [...notes];
    const existingIndex = newNotes.findIndex(n => n.beat === beat);
    
    if (existingIndex >= 0) {
      if (pitch) {
        newNotes[existingIndex] = { beat, pitch };
      } else {
        newNotes.splice(existingIndex, 1);
      }
    } else if (pitch) {
      newNotes.push({ beat, pitch });
    }
    
    onUpdate(newNotes.sort((a, b) => a.beat - b.beat));
  };

  const generateRandomCantus = () => {
    const newNotes = [];
    const startNote = `${keySignature}4`;
    const endNote = startNote;
    
    // Start on tonic
    newNotes.push({ beat: 0, pitch: startNote });
    
    // Generate middle notes
    for (let i = 1; i < measures - 1; i++) {
      const prevPitch = newNotes[i - 1].pitch;
      const prevIndex = pitchOptions.indexOf(prevPitch);
      
      // Prefer stepwise motion
      const stepOptions = [-2, -1, 1, 2].map(step => prevIndex + step)
        .filter(idx => idx >= 0 && idx < pitchOptions.length);
      
      const newIndex = stepOptions[Math.floor(Math.random() * stepOptions.length)];
      newNotes.push({ beat: i, pitch: pitchOptions[newIndex] });
    }
    
    // End on tonic
    newNotes.push({ beat: measures - 1, pitch: endNote });
    
    onUpdate(newNotes);
  };

  const clearNotes = () => {
    onUpdate([]);
  };

  return (
    <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-gold" />
          <h3 className="text-cream font-medium">Cantus Firmus</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={generateRandomCantus}
            className="text-cream/70 hover:text-cream hover:bg-slate-700"
          >
            <Shuffle className="w-4 h-4 mr-1" />
            Generate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearNotes}
            className="text-cream/70 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {Array.from({ length: measures }).map((_, beat) => {
            const note = notes.find(n => n.beat === beat);
            
            return (
              <motion.div
                key={beat}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative"
              >
                <Select
                  value={note?.pitch || ''}
                  onValueChange={(value) => handleNoteChange(beat, value)}
                >
                  <SelectTrigger 
                    className={`w-16 h-12 text-sm font-medium transition-all ${
                      note 
                        ? 'bg-gold/20 border-gold/40 text-gold' 
                        : 'bg-slate-900/50 border-slate-700 text-cream/50'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-cream/40">{beat + 1}</span>
                      <SelectValue placeholder="—" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-48">
                    <SelectItem value={null} className="text-cream/50">
                      Clear
                    </SelectItem>
                    {pitchOptions.map(pitch => (
                      <SelectItem key={pitch} value={pitch} className="text-cream">
                        {pitch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="text-cream/40 text-xs mt-3">
        Click each beat to set the note, or use "Generate" for a random melody.
      </p>
    </div>
  );
}
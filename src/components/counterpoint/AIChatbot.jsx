import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Play, Square, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { initAudio, playNote, stopAllNotes } from './audioEngine';

export default function AIChatbot({ 
  isOpen, 
  onClose, 
  settings,
  tempo = 80,
  onApplyMelody,
  currentNotes
}) {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm your AI composer trained on Bach's Inventions. Tell me what kind of melody you'd like and I'll create it for you!\n\nExamples:\n• \"Create a 64-note flowing melody\"\n• \"Make a virtuosic passage with lots of sixteenth notes\"\n• \"Generate an expressive melodic line\""
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [previewPlaying, setPreviewPlaying] = useState(null);
  const previewTimeoutRef = useRef(null);

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

    // Detect requested note count
    const noteCountMatch = userMessage.match(/(\d+)\s*notes?/i);
    const requestedNoteCount = noteCountMatch ? parseInt(noteCountMatch[1]) : 64;

    // Build training context from Bach Inventions
    const trainingExamples = songs.slice(0, 8).map(song => {
      const notes = song.cantusFirmus || [];
      const durations = notes.map(n => n.duration || 1);
      return `
${song.name} - ${song.settings?.key || 'C'} ${song.settings?.mode || 'major'}
Total notes: ${notes.length}
Duration variety: ${Math.min(...durations)} to ${Math.max(...durations)} (uses ${new Set(durations).size} different durations)
Rhythmic pattern: ${durations.slice(0, 20).join(',')}
First 15 notes: ${JSON.stringify(notes.slice(0, 15))}`;
    }).join('\n---\n');

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert composer trained on J.S. Bach's Two-Part Inventions. Create a sophisticated melodic line.

TRAINING EXAMPLES FROM BACH INVENTIONS:
${trainingExamples}

KEY OBSERVATIONS FROM BACH:
1. Uses VARIED note durations (0.25, 0.5, 1, 2, 4) extensively - never just quarter notes
2. Creates rhythmic patterns that repeat and develop
3. Uses sequences (melodic patterns repeated at different pitch levels)
4. Includes scalar runs (8-16 consecutive notes moving stepwise)
5. Balances fast passages (16th notes) with sustained notes
6. Creates melodic contour with peaks and valleys
7. Uses motivic development - introduces ideas and transforms them

CURRENT COMPOSITION CONTEXT:
- Key: ${settings.key} ${settings.mode}
- Tempo: ${tempo} BPM
- Time signature: ${settings.timeSignature || '4/4'}
- Available beats: 0 to ${settings.measures * 16}

USER REQUEST: "${userMessage}"

GENERATION REQUIREMENTS:

1. NOTE COUNT: Generate EXACTLY ${requestedNoteCount} or MORE notes

2. RHYTHM STRATEGY (CRITICAL):
   - Use 16th notes (duration 0.25) for runs and ornamental passages - this creates 4 notes per beat!
   - Use 8th notes (duration 0.5) for moderate motion - 2 notes per beat
   - Mix in quarter (1), half (2), and whole (4) notes for variety
   - Example 8-beat phrase: [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 1, 1] = 8 notes in 4 beats
   - To reach ${requestedNoteCount} notes in ${settings.measures * 4} beats, average ${(requestedNoteCount / (settings.measures * 4)).toFixed(1)} notes per beat

3. MELODIC CONSTRUCTION:
   - Start with a memorable motif (4-6 notes)
   - Develop it through sequence (repeat at different pitch levels)
   - Include scalar runs: 8-16 consecutive notes in one direction
   - Use arpeggios: outline chord tones
   - Create climax around 2/3 through
   - Use steps (2nds) more than leaps (3rds+), but include some leaps for interest

4. PITCH RANGE: C3 to C6 (use full range)

5. BEAT POSITIONING:
   - Distribute notes across full range: 0 to ${settings.measures * 16}
   - Each note's beat value should be: previous_note.beat + previous_note.duration
   - Example: [{beat: 0, duration: 0.25}, {beat: 0.25, duration: 0.25}, {beat: 0.5, duration: 0.5}...]

6. STYLE EMULATION:
   - Study the Bach examples above - notice how they use varied rhythms
   - Create flowing, singable lines
   - Use ornamental figures (trills = fast alternating notes, turns = neighbor tone patterns)
   - Think contrapuntally even for a single line

CRITICAL: Count your notes! You must generate AT LEAST ${requestedNoteCount} notes. Be generous with 16th note runs!`,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" },
            noteCount: { type: "number" },
            rhythmicAnalysis: { type: "string" },
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

      const notes = response.notes || [];
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `${response.description}\n\n**Generated ${notes.length} notes**\n${response.rhythmicAnalysis || ''}`,
        notes: notes
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I had trouble generating that melody. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyNotes = (notes) => {
    if (notes && notes.length > 0 && onApplyMelody) {
      onApplyMelody(notes);
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

    notes.forEach((note) => {
      const startTime = (note.beat || 0) * msPerBeat;
      const timeout = setTimeout(() => {
        const duration = (note.duration || 1) * sixteenthNoteDuration * 0.9;
        playNote(note.pitch, duration, 0.7, 0, 'organ');
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
                    <span className="text-xs text-white/70">{msg.notes.length} notes</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.notes.slice(0, 12).map((n, j) => (
                      <span key={j} className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                        {n.pitch}
                      </span>
                    ))}
                    {msg.notes.length > 12 && (
                      <span className="text-xs text-white/50">+{msg.notes.length - 12}</span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <Button
                      size="sm"
                      onClick={() => handlePreview(msg.notes, i)}
                      variant="outline"
                      className="border-slate-600 text-white text-xs h-7 hover:bg-slate-700"
                    >
                      {previewPlaying === i ? (
                        <><Square className="w-3 h-3 mr-1" />Stop</>
                      ) : (
                        <><Play className="w-3 h-3 mr-1" />Preview</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApplyNotes(msg.notes)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs h-7"
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
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe your melody..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-white/40 h-9 text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-9 w-9 p-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Send, Loader2, Sparkles, Music, Play, Square, Layers, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { initAudio, playNote, stopAllNotes } from './audioEngine';

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
  onApplyMelody,
  onApplyHarmony,
  currentNotes,
  tempo = 80
}) {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm your AI counterpoint composer. I can create complex melodies and harmonies in various styles! Try:\n\n• \"Create a Bach-style fugue subject\"\n• \"Compose a dramatic Beethoven melody\"\n• \"Add a walking bass line\"\n• \"Generate a 32-note virtuosic passage\"\n\nSelect a composer style below for authentic period techniques!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('none');
  const messagesEndRef = useRef(null);

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

    // Detect if user wants a specific number of notes
    const noteCountMatch = userMessage.match(/(\d+)\s*notes?/i);
    const requestedNoteCount = noteCountMatch ? parseInt(noteCountMatch[1]) : null;
    const minNotes = requestedNoteCount || Math.max(16, settings.measures * 4);

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
          prompt: `You are an expert counterpoint composer. Create a complete two-voice contrapuntal composition.

Current settings:
- Key: ${settings.key} ${settings.mode}
- Measures: ${settings.measures}
- Species: ${settings.species || '1st'} species counterpoint
- Tempo: ${tempo} BPM

User request: "${userMessage}"

Generate TWO voices following counterpoint rules:
1. Create a cantus firmus (main melody) in the soprano/upper voice range (C4-G5)
2. Create a harmonizing bass line (E2-C4)
3. Use consonant intervals (3rds, 5ths, 6ths, octaves) on strong beats
4. Avoid parallel 5ths and octaves
5. Prefer contrary motion
6. Start and end on perfect consonances
7. Use stepwise motion primarily

CRITICAL - Create rhythmic variety and musical interest:
- Use varied durations: 0.25 (16th note), 0.5 (8th), 1 (quarter), 2 (half), 4 (whole)
- Include some long held notes (duration 2-4) for tension and release
- Add quick passages with 0.25 or 0.5 duration notes for excitement
- Don't make every note the same length - that's boring!
- The melody can be more active, bass often more sustained
- Create syncopation and rhythmic interplay between voices
- Total beats should span ${settings.measures * 4} beats (${settings.measures} measures)

Provide both the melody and the harmony with varied, interesting rhythms.`,
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
        // Generate just a melody
        response = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an expert composer and music theorist. Create a sophisticated, musically compelling melody.

Current settings:
- Key: ${settings.key} ${settings.mode}
- Measures: ${settings.measures} (total beats: ${settings.measures * 4})
- Tempo: ${tempo} BPM
- Current notes: ${currentNotes.length > 0 ? JSON.stringify(currentNotes) : 'None yet'}
${styleContext}

User request: "${userMessage}"

Generate a SOPHISTICATED melody with AT LEAST ${minNotes} NOTES using advanced compositional techniques:

MELODIC STRUCTURE:
1. MOTIF: Start with a memorable 3-5 note motif
2. DEVELOPMENT: Vary the motif through:
   - Sequence (repeat at different pitch levels)
   - Inversion (flip intervals upside down)
   - Augmentation/Diminution (stretch or compress rhythms)
   - Fragmentation (use just part of the motif)
3. CONTOUR: Build an arc - start moderately, build tension, reach climax, resolve
4. RANGE: Use the full range C4-C6, with the climax often being the highest note

MELODIC DEVICES:
- Scalar runs (ascending/descending scale passages)
- Arpeggiated figures (broken chord patterns)
- Neighbor tones (note-step up/down-return)
- Passing tones (fill in between chord tones)
- Appoggiaturas (accented non-chord tones that resolve)
- Escape tones (step then leap in opposite direction)
- Sequences (2-3 repetitions of a pattern at different levels)

RHYTHM - ABSOLUTELY CRITICAL:
- Generate MANY notes with VARIED durations
- 0.25 = 16th note (very fast, use for runs and ornaments)
- 0.5 = 8th note (quick, good for motion)
- 1 = quarter note (standard)
- 2 = half note (held, expressive)
- 4 = whole note (very long, dramatic)
- Create rhythmic PATTERNS that repeat and vary
- Include: fast runs, held notes, syncopation, dotted rhythms (1.5 + 0.5)
- The beat values are CUMULATIVE positions (beat 0, then beat 0.5, then beat 1, etc.)

EXAMPLE of good variety: A melody might have:
- Opening held note (duration 2)
- Quick scalar run (4 notes at 0.25 each)
- Medium motion (notes at 0.5 and 1)
- Climactic long note (duration 2-4)
- Resolution with mixed rhythms

Total span: ${settings.measures * 4} beats. Generate ${minNotes}+ notes!

Respond with description and notes. Make this sound like REAL MUSIC composed by a master!`,
          response_json_schema: {
            type: "object",
            properties: {
              description: { type: "string" },
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

    const msPerBeat = (60 / tempo) * 1000;
    const timeouts = [];

    // Play melody
    notes.forEach((note, i) => {
      const timeout = setTimeout(() => {
        const duration = (note.duration || 1) * (60 / tempo) * 0.9;
        playNote(note.pitch, duration, 0.7, 0, 'organ');
      }, i * msPerBeat);
      timeouts.push(timeout);
    });

    // Play harmony if exists
    if (harmony && harmony.length > 0) {
      harmony.forEach((note, i) => {
        const timeout = setTimeout(() => {
          const duration = (note.duration || 1) * (60 / tempo) * 0.9;
          playNote(note.pitch, duration, 0.6, 1, 'organ');
        }, i * msPerBeat);
        timeouts.push(timeout);
      });
    }

    // Stop preview after all notes played
    const maxLength = Math.max(notes.length, harmony?.length || 0);
    const endTimeout = setTimeout(() => {
      setPreviewPlaying(null);
    }, maxLength * msPerBeat + 500);
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
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-4 top-20 bottom-4 w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-slate-900" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">AI Composer</h3>
            <p className="text-white/50 text-xs">Create melodies with AI</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
      <div className="p-4 border-t border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-white/60" />
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger className="flex-1 bg-slate-800 border-slate-700 text-white h-8 text-xs">
              <SelectValue placeholder="Select style..." />
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
            placeholder="e.g., Create a 24-note dramatic melody..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-white/40"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {selectedStyle !== 'none' && (
          <p className="text-xs text-amber-400/70">
            Style: {COMPOSER_STYLES[selectedStyle].name}
          </p>
        )}
      </div>
      </motion.div>
      );
}
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Music, Play, Square, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { initAudio, playNote, stopAllNotes } from './audioEngine';

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
      content: "Hi! I'm your AI counterpoint composer. I can create melodies and harmonizing voices! Try:\n\n• \"Create a peaceful melody\"\n• \"Add a bass line to harmonize\"\n• \"Generate a two-voice counterpoint\"\n• \"Create a tenor part for my melody\""
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

    try {
      let response;
      
      if (wantsHarmony && hasExistingMelody) {
        // Generate harmonizing voice
        response = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an expert counterpoint composer. Generate a harmonizing voice to accompany the existing melody.

Current settings:
- Key: ${settings.key} ${settings.mode}
- Species: ${settings.species || '1st'} species counterpoint
- Tempo: ${tempo} BPM

Existing cantus firmus/melody:
${JSON.stringify(currentNotes, null, 2)}

User request: "${userMessage}"

Generate a harmonizing voice following these counterpoint rules:
1. Use notes in ${settings.key} ${settings.mode} scale
2. Create consonant intervals (3rds, 5ths, 6ths, octaves) on strong beats
3. Avoid parallel 5ths and octaves between voices
4. Prefer contrary or oblique motion over parallel motion
5. For bass: use range E2-C4. For tenor: use range C3-G4. For alto: use range F3-D5
6. Start and end on perfect consonances (unison, 5th, or octave)
7. Create smooth melodic lines with mostly stepwise motion

IMPORTANT - Use varied rhythms for musicality:
- Use duration values: 0.25 (16th), 0.5 (8th), 1 (quarter), 2 (half), 4 (whole)
- Mix long held notes with shorter passing notes
- Create rhythmic interest - don't make all notes the same length
- Bass lines often use longer notes, while inner voices can be more active

Determine what type of voice would best harmonize (bass, tenor, or alto) based on the user's request.

Respond with the voice type and the harmonizing notes.`,
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
          prompt: `You are an expert counterpoint melody composer. The user wants help creating a melody.

Current settings:
- Key: ${settings.key} ${settings.mode}
- Measures: ${settings.measures} (total beats: ${settings.measures * 4})
- Tempo: ${tempo} BPM
- Current notes: ${currentNotes.length > 0 ? JSON.stringify(currentNotes) : 'None yet'}

User request: "${userMessage}"

Generate a melody following these rules:
1. Use notes appropriate for ${settings.key} ${settings.mode} scale
2. Start and end on the tonic (${settings.key})
3. Prefer stepwise motion with occasional leaps for interest
4. Use a good melodic contour (arch shape, ascending, descending, etc.)
5. Use pitches like C4, D4, E4, F4, G4, A4, B4, C5 etc.

CRITICAL - Create rhythmic variety:
- Use varied note durations: 0.25 (16th note - very fast), 0.5 (8th note), 1 (quarter note), 2 (half note - held), 4 (whole note - very long)
- DON'T make all notes the same duration - that sounds robotic!
- Include some long held notes (duration 2-4) for expression
- Add quick runs with 0.25 or 0.5 duration notes
- Mix it up! Create patterns like: long-short-short, or short-short-short-long
- The beat values should be cumulative (if note 1 is at beat 0 with duration 2, note 2 starts at beat 2)
- Total should span approximately ${settings.measures * 4} beats

Respond with a brief description and the notes with varied, musical rhythms.`,
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

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe a melody..."
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
      </div>
    </motion.div>
  );
}
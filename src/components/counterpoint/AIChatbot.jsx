import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Music, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { initAudio, playNote, stopAllNotes } from './audioEngine';

export default function AIChatbot({ 
  isOpen, 
  onClose, 
  settings, 
  onApplyMelody,
  currentNotes 
}) {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm your AI counterpoint composer. Tell me what kind of melody you'd like - describe the mood, style, or just ask me to create something! For example:\n\n• \"Create a peaceful 8-note melody in C major\"\n• \"Make something dramatic and ascending\"\n• \"Generate a Bach-style cantus firmus\""
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

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert counterpoint melody composer. The user wants help creating a melody.

Current settings:
- Key: ${settings.key} ${settings.mode}
- Measures/beats: ${settings.measures}
- Current notes: ${currentNotes.length > 0 ? JSON.stringify(currentNotes) : 'None yet'}

User request: "${userMessage}"

Generate a melody following these rules:
1. Use notes appropriate for ${settings.key} ${settings.mode} scale
2. Create ${settings.measures} notes (one per beat)
3. Start and end on the tonic (${settings.key})
4. Prefer stepwise motion
5. Use a good melodic contour

Respond with:
1. A brief description of the melody you created
2. The notes in the format specified in the JSON schema

Use pitches like C4, D4, E4, F4, G4, A4, B4, C5 etc.`,
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

      const notes = parseNotesFromResponse(response);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.description || "Here's a melody I created for you!",
        notes: notes
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
      // Ensure notes have proper structure
      const formattedNotes = notes.map((n, i) => ({
        pitch: n.pitch,
        beat: n.beat !== undefined ? n.beat : i,
        duration: n.duration || 1
      }));
      onApplyMelody(formattedNotes);
    }
  };

  const handlePreview = (notes, messageIndex) => {
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

    const tempo = 120; // Preview tempo
    const msPerBeat = (60 / tempo) * 1000;
    const timeouts = [];

    notes.forEach((note, i) => {
      const timeout = setTimeout(() => {
        const duration = (note.duration || 1) * (60 / tempo) * 0.9;
        playNote(note.pitch, duration, 0.7, 0, 'organ');
      }, i * msPerBeat);
      timeouts.push(timeout);
    });

    // Stop preview after all notes played
    const endTimeout = setTimeout(() => {
      setPreviewPlaying(null);
    }, notes.length * msPerBeat + 500);
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
              {msg.notes && msg.notes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-white/70">{msg.notes.length} notes</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {msg.notes.slice(0, 12).map((n, j) => (
                      <span key={j} className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                        {n.pitch}
                      </span>
                    ))}
                    {msg.notes.length > 12 && (
                      <span className="text-xs text-white/50">+{msg.notes.length - 12} more</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handlePreview(msg.notes, i)}
                      variant="outline"
                      className="flex-1 border-slate-600 text-white text-xs h-7 hover:bg-slate-700"
                    >
                      {previewPlaying === i ? (
                        <>
                          <Square className="w-3 h-3 mr-1" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Preview
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApplyNotes(msg.notes)}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs h-7"
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
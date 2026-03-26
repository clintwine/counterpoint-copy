import React from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';
import PianoKeyboard from './PianoKeyboard';

export default function PianoPopout({
  pianoPopout, setPianoPopout,
  pianoPopoutSize, setPianoPopoutSize,
  activeNotes, voices, setVoices,
  setPressedPianoNotes,
  handleNotePress, handleNoteRelease,
  effects, setEffects,
  envelope, setEnvelope,
  openWaveEditor, customInstruments,
  saveInstrumentMutation, deleteInstrumentMutation,
}) {
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {pianoPopout && (
        <motion.div
          drag
          dragListener={false}
          dragControls={dragControls}
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{ top: 0, left: 0, right: window.innerWidth - pianoPopoutSize.width - 20, bottom: window.innerHeight - pianoPopoutSize.height - 20 }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed z-[100] bg-[#2D2D2D] border-2 border-[#3A3A3A] rounded-xl shadow-2xl"
          style={{ top: '10%', left: '10%', width: `${pianoPopoutSize.width}px`, height: `${pianoPopoutSize.height}px`, maxWidth: '90vw', maxHeight: '80vh' }}
        >
          <div className="cursor-move bg-[#1A1A1A] px-4 py-2 border-b border-[#3A3A3A] rounded-t-xl flex items-center justify-between" onPointerDown={(e) => dragControls.start(e)}>
            <span className="text-white text-sm font-medium">Piano Keyboard</span>
            <Button variant="ghost" size="sm" onClick={() => setPianoPopout(false)} className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-[#3A3A3A]"><X className="w-4 h-4" /></Button>
          </div>
          <div className="p-4 overflow-auto" style={{ height: 'calc(100% - 40px)' }}>
            <PianoKeyboard
              activeNotes={activeNotes}
              instrument={voices[0]?.instrument || 'organ'}
              onInstrumentChange={(inst) => { const newVoices = [...voices]; if (newVoices[0]) { newVoices[0] = { ...newVoices[0], instrument: inst }; setVoices(newVoices); } }}
              onVoiceInstrumentChange={(voiceIndex, inst) => { const newVoices = [...voices]; if (newVoices[voiceIndex]) { newVoices[voiceIndex] = { ...newVoices[voiceIndex], instrument: inst }; setVoices(newVoices); } }}
              onPressedNotesChange={setPressedPianoNotes}
              onNotePress={handleNotePress}
              onNoteRelease={handleNoteRelease}
              effects={effects}
              onEffectsChange={setEffects}
              envelope={envelope}
              onEnvelopeChange={setEnvelope}
              openWaveEditor={openWaveEditor}
              customInstruments={customInstruments}
              onSaveInstrument={(instrument, index) => saveInstrumentMutation.mutate({ instrument, index })}
              onDeleteInstrument={(index) => deleteInstrumentMutation.mutate(index)}
            />
          </div>
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize"
            onPointerDown={(e) => {
              e.stopPropagation(); e.preventDefault();
              const startX = e.clientX, startY = e.clientY;
              const startW = pianoPopoutSize.width, startH = pianoPopoutSize.height;
              const handleMove = (me) => setPianoPopoutSize({ width: Math.max(400, Math.min(window.innerWidth * 0.9, startW + me.clientX - startX)), height: Math.max(200, Math.min(window.innerHeight * 0.8, startH + me.clientY - startY)) });
              const handleUp = () => { document.removeEventListener('pointermove', handleMove); document.removeEventListener('pointerup', handleUp); };
              document.addEventListener('pointermove', handleMove);
              document.addEventListener('pointerup', handleUp);
            }}
          >
            <svg className="absolute bottom-1 right-1 text-white/30" width="12" height="12" viewBox="0 0 12 12">
              <path d="M12 0 L12 12 L0 12" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
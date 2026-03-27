import React from 'react';
import { Button } from "@/components/ui/button";
import PianoKeyboard from './PianoKeyboard';

export default function PianoSection({
  showPiano, setShowPiano,
  showPianoPanel, pianoPopout, setPianoPopout,
  activeNotes, voices, setVoices,
  pressedPianoNotes, setPressedPianoNotes,
  handleNotePress, handleNoteRelease,
  effects, setEffects,
  envelope, setEnvelope,
  openWaveEditor, customInstruments,
  saveInstrumentMutation, deleteInstrumentMutation,
}) {
  return (
    <>
      {/* Piano toggle for mobile */}
      <div className="sm:hidden flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-600">
        <span className="text-white/70 text-sm">Piano Keyboard</span>
        <Button variant="ghost" size="sm" onClick={() => setShowPiano(!showPiano)} className="text-amber-400 h-7 px-2">
          {showPiano ? 'Hide Piano' : 'Show Piano'}
        </Button>
      </div>

      {showPianoPanel && !pianoPopout && (
        <div className={`${showPiano ? 'block' : 'hidden'} sm:block`}>
          <PianoKeyboard
            activeNotes={activeNotes}
            instrument={voices[0]?.instrument || 'organ'}
            onInstrumentChange={(inst) => {
              const newVoices = [...voices];
              if (newVoices[0]) { newVoices[0] = { ...newVoices[0], instrument: inst }; setVoices(newVoices); }
            }}
            onVoiceInstrumentChange={(voiceIndex, inst) => {
              const newVoices = [...voices];
              if (newVoices[voiceIndex]) { newVoices[voiceIndex] = { ...newVoices[voiceIndex], instrument: inst }; setVoices(newVoices); }
            }}
            onPressedNotesChange={setPressedPianoNotes}
            onPopOut={() => setPianoPopout(true)}
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
      )}
    </>
  );
}
import { useEffect } from 'react';

const DEFAULT_DURATION = 1;

export function useNoteGridKeyboard({
  deleteSelected,
  copySelected,
  paste,
  selectAll,
  undo,
  redo,
  quantize,
  onSeek,
  loopStart,
  loopEnd,
  isLooping,
  setSelectedNotes,
  setMarquee,
  selectedNotes,
  cantusFirmus,
  getNoteKey,
  pitches,
  totalBeats,
  saveToHistory,
  onNotesUpdate,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        copySelected();
        deleteSelected();
      } else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        copySelected();
      } else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        paste();
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        setSelectedNotes(new Set());
        setMarquee(null);
      } else if (e.key === ' ') {
        e.preventDefault();
      } else if (e.key === 'ArrowUp' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx - 12;
            if (newIdx >= 0) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowDown' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx + 12;
            if (newIdx < pitches.length) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowUp' && !e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx - 1;
            if (newIdx >= 0) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowDown' && !e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx + 1;
            if (newIdx < pitches.length) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowLeft' && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const newBeat = Math.max(0, n.beat - 1);
            newSelectedKeys.add(getNoteKey(n.pitch, newBeat));
            return { ...n, beat: newBeat };
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowRight' && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const newBeat = Math.min(totalBeats - 1, n.beat + 1);
            newSelectedKeys.add(getNoteKey(n.pitch, newBeat));
            return { ...n, beat: newBeat };
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'q' && cantusFirmus.length > 0) {
        e.preventDefault();
        quantize();
      } else if (e.key === 'H' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const selectedNotesList = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
        const minBeat = Math.min(...selectedNotesList.map(n => n.beat));
        const maxBeat = Math.max(...selectedNotesList.map(n => n.beat + (n.duration || DEFAULT_DURATION)));
        const center = (minBeat + maxBeat) / 2;
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const distanceFromCenter = n.beat - center;
            const newBeat = center - distanceFromCenter - (n.duration || DEFAULT_DURATION);
            return { ...n, beat: Math.max(0, Math.min(totalBeats - 0.125, newBeat)) };
          }
          return n;
        });
        const newSelectedKeys = new Set(selectedNotesList.map(n => {
          const distanceFromCenter = n.beat - center;
          const newBeat = center - distanceFromCenter - (n.duration || DEFAULT_DURATION);
          return getNoteKey(n.pitch, Math.max(0, Math.min(totalBeats - 0.125, newBeat)));
        }));
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'V' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const selectedNotesList = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
        const pitchIndices = selectedNotesList.map(n => pitches.indexOf(n.pitch));
        const minPitchIdx = Math.min(...pitchIndices);
        const maxPitchIdx = Math.max(...pitchIndices);
        const centerPitchIdx = (minPitchIdx + maxPitchIdx) / 2;
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentPitchIdx = pitches.indexOf(n.pitch);
            const distanceFromCenter = currentPitchIdx - centerPitchIdx;
            const newPitchIdx = Math.round(centerPitchIdx - distanceFromCenter);
            const clampedIdx = Math.max(0, Math.min(pitches.length - 1, newPitchIdx));
            return { ...n, pitch: pitches[clampedIdx] };
          }
          return n;
        });
        const newSelectedKeys = new Set(selectedNotesList.map(n => {
          const currentPitchIdx = pitches.indexOf(n.pitch);
          const distanceFromCenter = currentPitchIdx - centerPitchIdx;
          const newPitchIdx = Math.round(centerPitchIdx - distanceFromCenter);
          const clampedIdx = Math.max(0, Math.min(pitches.length - 1, newPitchIdx));
          return getNoteKey(pitches[clampedIdx], n.beat);
        }));
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const seekTo = (loopStart !== null && isLooping) ? loopStart : 0;
        if (onSeek) onSeek(seekTo);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, copySelected, paste, selectAll, undo, redo, selectedNotes, cantusFirmus]);
}
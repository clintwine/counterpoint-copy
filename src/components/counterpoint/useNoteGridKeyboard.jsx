import { useEffect } from 'react';

export function useNoteGridKeyboard({
  deleteSelected, copySelected, paste, selectAll, undo, redo,
  cantusFirmus, selectedNotes, getNoteKey, pitches, totalBeats,
  setSelectedNotes, setMarquee, onNotesUpdate, saveToHistory,
  loopStart, loopEnd, isLooping, onSeek, quantize, setTool,
  DEFAULT_DURATION
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
            const idx = pitches.indexOf(n.pitch);
            const newIdx = idx - 12;
            if (newIdx >= 0) {
              newSelectedKeys.add(getNoteKey(pitches[newIdx], n.beat));
              return { ...n, pitch: pitches[newIdx] };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowDown' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const idx = pitches.indexOf(n.pitch);
            const newIdx = idx + 12;
            if (newIdx < pitches.length) {
              newSelectedKeys.add(getNoteKey(pitches[newIdx], n.beat));
              return { ...n, pitch: pitches[newIdx] };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowUp' && !e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const idx = pitches.indexOf(n.pitch);
            const newIdx = idx - 1;
            if (newIdx >= 0) {
              newSelectedKeys.add(getNoteKey(pitches[newIdx], n.beat));
              return { ...n, pitch: pitches[newIdx] };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowDown' && !e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const idx = pitches.indexOf(n.pitch);
            const newIdx = idx + 1;
            if (newIdx < pitches.length) {
              newSelectedKeys.add(getNoteKey(pitches[newIdx], n.beat));
              return { ...n, pitch: pitches[newIdx] };
            } else { newSelectedKeys.add(getNoteKey(n.pitch, n.beat)); }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
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
        setSelectedNotes(newSelectedKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
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
        setSelectedNotes(newSelectedKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
      } else if (e.key === 'q' && cantusFirmus.length > 0) {
        e.preventDefault();
        quantize();
      } else if (e.key === 'H' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const sel = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
        const minBeat = Math.min(...sel.map(n => n.beat));
        const maxBeat = Math.max(...sel.map(n => n.beat + (n.duration || DEFAULT_DURATION)));
        const center = (minBeat + maxBeat) / 2;
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const dist = n.beat - center;
            const newBeat = center - dist - (n.duration || DEFAULT_DURATION);
            return { ...n, beat: Math.max(0, Math.min(totalBeats - 0.125, newBeat)) };
          }
          return n;
        });
        const newKeys = new Set(sel.map(n => {
          const dist = n.beat - center;
          const nb = center - dist - (n.duration || DEFAULT_DURATION);
          return getNoteKey(n.pitch, Math.max(0, Math.min(totalBeats - 0.125, nb)));
        }));
        setSelectedNotes(newKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
      } else if (e.key === 'V' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        const sel = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
        const indices = sel.map(n => pitches.indexOf(n.pitch));
        const centerIdx = (Math.min(...indices) + Math.max(...indices)) / 2;
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const dist = pitches.indexOf(n.pitch) - centerIdx;
            const newIdx = Math.max(0, Math.min(pitches.length - 1, Math.round(centerIdx - dist)));
            return { ...n, pitch: pitches[newIdx] };
          }
          return n;
        });
        const newKeys = new Set(sel.map(n => {
          const dist = pitches.indexOf(n.pitch) - centerIdx;
          const newIdx = Math.max(0, Math.min(pitches.length - 1, Math.round(centerIdx - dist)));
          return getNoteKey(pitches[newIdx], n.beat);
        }));
        setSelectedNotes(newKeys); saveToHistory(newNotes); onNotesUpdate(newNotes);
      } else if (e.key === 'v') {
        setTool('select');
      } else if (e.key === 'm') {
        setTool('marquee');
      } else if (e.key === 'b') {
        setTool('draw');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const seekTo = (loopStart !== null && isLooping) ? loopStart : 0;
        if (onSeek) onSeek(seekTo);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, copySelected, paste, selectAll, undo, redo]);
}
function noteToFrequency(pitch) {
  const notes = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  
  const match = pitch.match(/([A-G]#?)(\d)/);
  if (!match) return 440;
  
  const [, note, octave] = match;
  const noteNumber = notes[note];
  const midiNote = (parseInt(octave) + 1) * 12 + noteNumber;
  
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export async function renderToWav(notes, tempo, instrumentName) {
  // Calculate duration
  const maxBeat = Math.max(...notes.map(n => n.beat + (n.duration || 1)), 0);
  const duration = (maxBeat * (60 / tempo) / 4) + 2;
  
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
  
  // Render each note with simple sine wave
  notes.forEach(note => {
    const frequency = noteToFrequency(note.pitch);
    const startTime = note.beat * (60 / tempo) / 4;
    const noteDuration = (note.duration || 1) * (60 / tempo) / 4;
    const velocity = note.velocity || 0.8;
    
    const oscillator = offlineCtx.createOscillator();
    const gainNode = offlineCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Apply envelope
    const attack = 0.02;
    const release = 0.1;
    const sustainLevel = velocity * 0.2;
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + attack);
    gainNode.gain.setValueAtTime(sustainLevel, startTime + noteDuration - release);
    gainNode.gain.linearRampToValueAtTime(0, startTime + noteDuration);
    
    oscillator.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + noteDuration);
  });
  
  // Render
  const audioBuffer = await offlineCtx.startRendering();
  
  // Convert to WAV
  return audioBufferToWav(audioBuffer);
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const data = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const intSample = Math.max(-1, Math.min(1, sample));
      data.push(intSample < 0 ? intSample * 0x8000 : intSample * 0x7FFF);
    }
  }
  
  const dataSize = data.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset, data[i], true);
    offset += 2;
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
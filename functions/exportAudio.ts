import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notes, tempo = 80, duration = 30 } = await req.json();

    // Generate WAV file using Web Audio API offline context
    const sampleRate = 44100;
    const numChannels = 2;
    const numSamples = Math.floor(sampleRate * duration);
    
    // Create audio buffer
    const audioData = new Float32Array(numSamples * numChannels);
    
    // Generate audio for each note
    notes.forEach(note => {
      const frequency = noteToFrequency(note.pitch);
      const startTime = note.beat * (60 / tempo) / 4; // Convert beat to seconds
      const noteDuration = (note.duration || 1) * (60 / tempo) / 4;
      const velocity = note.velocity || 0.8;
      
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(numSamples, Math.floor((startTime + noteDuration) * sampleRate));
      
      // Generate sine wave with envelope
      for (let i = startSample; i < endSample; i++) {
        const t = (i - startSample) / sampleRate;
        const envelope = Math.min(1, t / 0.02) * Math.min(1, (noteDuration - t) / 0.1);
        const sample = Math.sin(2 * Math.PI * frequency * t) * velocity * envelope * 0.3;
        
        // Stereo output
        audioData[i * 2] += sample;
        audioData[i * 2 + 1] += sample;
      }
    });

    // Convert to WAV format
    const wavBuffer = createWavBuffer(audioData, sampleRate, numChannels);
    
    return new Response(wavBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `attachment; filename="composition-${Date.now()}.wav"`
      }
    });
  } catch (error) {
    console.error('Export audio error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

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

function createWavBuffer(samples, sampleRate, numChannels) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Audio data
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
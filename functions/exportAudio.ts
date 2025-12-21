import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notes, tempo = 80 } = await req.json();

    // Calculate actual duration based on notes
    const maxBeat = Math.max(...notes.map(n => n.beat + (n.duration || 1)), 0);
    const duration = (maxBeat * (60 / tempo) / 4) + 2;

    const sampleRate = 44100;
    const numChannels = 2;
    const bitsPerSample = 16;
    const numSamples = Math.floor(sampleRate * duration);

    // Generate audio samples
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    notes.forEach(note => {
      const frequency = noteToFrequency(note.pitch);
      const startTime = note.beat * (60 / tempo) / 4;
      const noteDuration = (note.duration || 1) * (60 / tempo) / 4;
      const velocity = note.velocity || 0.8;
      
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(numSamples, Math.floor((startTime + noteDuration) * sampleRate));
      
      for (let i = startSample; i < endSample; i++) {
        const t = (i - startSample) / sampleRate;
        const envelope = Math.min(1, t / 0.02) * Math.min(1, (noteDuration - t) / 0.1);
        const sample = Math.sin(2 * Math.PI * frequency * t) * velocity * envelope * 0.3;
        
        leftChannel[i] += sample;
        rightChannel[i] += sample;
      }
    });

    // Build WAV file
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const fileSize = 44 + dataSize;
    
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true); // File size minus 8 bytes
    writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample
    
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true); // Subchunk2Size
    
    // Write PCM samples (interleaved stereo, little-endian)
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      // Clamp and convert to 16-bit signed integer
      const leftSample = Math.max(-1, Math.min(1, leftChannel[i]));
      const rightSample = Math.max(-1, Math.min(1, rightChannel[i]));
      
      // Convert to 16-bit signed: -1.0 to 1.0 maps to -32768 to 32767
      const leftInt16 = leftSample < 0 ? Math.floor(leftSample * 32768) : Math.floor(leftSample * 32767);
      const rightInt16 = rightSample < 0 ? Math.floor(rightSample * 32768) : Math.floor(rightSample * 32767);
      
      view.setInt16(offset, leftInt16, true);
      offset += 2;
      view.setInt16(offset, rightInt16, true);
      offset += 2;
    }
    
    return new Response(buffer, {
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

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

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
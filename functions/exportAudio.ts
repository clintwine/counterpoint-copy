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
        const sample = Math.sin(2 * Math.PI * frequency * t) * velocity * envelope * 0.15;

        leftChannel[i] += sample;
        rightChannel[i] += sample;
      }
    });

    // Normalize to prevent clipping
    let maxAmplitude = 0;
    for (let i = 0; i < numSamples; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
    }

    if (maxAmplitude > 0.95) {
      const scale = 0.95 / maxAmplitude;
      for (let i = 0; i < numSamples; i++) {
        leftChannel[i] *= scale;
        rightChannel[i] *= scale;
      }
    }

    // Build WAV file - proper format
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    
    // Create buffer
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    // Write WAV header
    // RIFF chunk
    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    view.setUint32(4, 36 + dataSize, true); // ChunkSize
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));
    
    // fmt subchunk
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample
    
    // data subchunk
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataSize, true); // Subchunk2Size
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      // Convert float samples to 16-bit integers
      let leftVal = Math.max(-1, Math.min(1, leftChannel[i]));
      let rightVal = Math.max(-1, Math.min(1, rightChannel[i]));
      
      // Proper conversion: multiply then round
      const leftInt = Math.round(leftVal * (leftVal < 0 ? 32768 : 32767));
      const rightInt = Math.round(rightVal * (rightVal < 0 ? 32768 : 32767));
      
      view.setInt16(offset, leftInt, true);
      view.setInt16(offset + 2, rightInt, true);
      offset += 4;
    }
    
    // Validate WAV file before sending
    const validation = {
      bufferSize: buffer.byteLength,
      expectedSize: 44 + dataSize,
      headerCheck: {
        riff: String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)),
        wave: String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)),
        fmt: String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15)),
        data: String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39)),
      },
      chunkSize: view.getUint32(4, true),
      audioFormat: view.getUint16(20, true),
      numChannels: view.getUint16(22, true),
      sampleRate: view.getUint32(24, true),
      bitsPerSample: view.getUint16(34, true),
      dataSize: view.getUint32(40, true)
    };

    console.log('WAV Validation:', JSON.stringify(validation, null, 2));

    // Check if valid
    if (validation.headerCheck.riff !== 'RIFF' || 
        validation.headerCheck.wave !== 'WAVE' ||
        validation.headerCheck.fmt !== 'fmt ' ||
        validation.headerCheck.data !== 'data') {
      console.error('Invalid WAV header!');
      return Response.json({ error: 'Invalid WAV file generated', validation }, { status: 500 });
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
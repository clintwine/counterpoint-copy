import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import lamejs from 'npm:lamejs@1.2.1';

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
    const duration = (maxBeat * (60 / tempo) / 4) + 2; // Add 2 seconds for tail

    // Generate audio
    const sampleRate = 44100;
    const numChannels = 2;
    const numSamples = Math.floor(sampleRate * duration);

    // Create separate left/right channel buffers
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);
    
    // Generate audio for each note
    notes.forEach(note => {
      const frequency = noteToFrequency(note.pitch);
      const startTime = note.beat * (60 / tempo) / 4;
      const noteDuration = (note.duration || 1) * (60 / tempo) / 4;
      const velocity = note.velocity || 0.8;
      
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(numSamples, Math.floor((startTime + noteDuration) * sampleRate));
      
      // Generate sine wave with envelope
      for (let i = startSample; i < endSample; i++) {
        const t = (i - startSample) / sampleRate;
        const envelope = Math.min(1, t / 0.02) * Math.min(1, (noteDuration - t) / 0.1);
        const sample = Math.sin(2 * Math.PI * frequency * t) * velocity * envelope * 0.3;
        
        leftChannel[i] += sample;
        rightChannel[i] += sample;
      }
    });

    // Convert float samples to 16-bit PCM
    const leftPCM = new Int16Array(numSamples);
    const rightPCM = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      leftPCM[i] = Math.max(-32768, Math.min(32767, Math.round(leftChannel[i] * 32767)));
      rightPCM[i] = Math.max(-32768, Math.min(32767, Math.round(rightChannel[i] * 32767)));
    }

    // Encode to MP3
    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
    const mp3Data = [];
    const blockSize = 1152;
    
    for (let i = 0; i < numSamples; i += blockSize) {
      const leftChunk = leftPCM.subarray(i, Math.min(i + blockSize, numSamples));
      const rightChunk = rightPCM.subarray(i, Math.min(i + blockSize, numSamples));
      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }
    
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Combine all MP3 chunks
    const totalLength = mp3Data.reduce((sum, buf) => sum + buf.length, 0);
    const mp3Buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of mp3Data) {
      mp3Buffer.set(buf, offset);
      offset += buf.length;
    }
    
    return new Response(mp3Buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="composition-${Date.now()}.mp3"`
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
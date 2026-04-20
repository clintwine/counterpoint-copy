import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audioBase64, title, instrument, tempo } = await req.json();

    if (!audioBase64 || !title) {
      return Response.json({ error: 'Missing audioBase64 or title' }, { status: 400 });
    }

    // Decode base64 to binary
    const binaryStr = atob(audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Build multipart form data for upload
    const fileName = `composition-${Date.now()}.wav`;
    const file = new File([bytes], fileName, { type: 'audio/wav' });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    // Save shareable record
    const record = await base44.asServiceRole.entities.SharedAudio.create({
      title,
      audio_url: file_url,
      instrument: instrument || 'organ',
      tempo: tempo || 80,
    });

    return Response.json({ id: record.id, audio_url: file_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
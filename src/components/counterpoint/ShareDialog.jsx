import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Check, Loader2, Play, Pause } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { renderToWav } from './audioExporter';
import toast from 'react-hot-toast';

export default function ShareDialog({ open, onClose, cantusFirmus, generatedVoices, tempo, voices, projectName, effects, envelope, customInstruments }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState(projectName || 'My Composition');
  const [isPlaying, setIsPlaying] = useState(false);
  const [wavBlob, setWavBlob] = useState(null);
  const audioRef = useRef(null);

  const handleShare = async () => {
    if (!cantusFirmus?.length) {
      toast.error('No notes to share');
      return;
    }

    setIsGenerating(true);
    try {
      // Render to WAV blob
      // Build all-voice data matching the live playback structure
      const allVoicesData = [
        { notes: cantusFirmus, instrument: voices?.[0]?.instrument || 'organ', volume: (voices?.[0]?.volume || 80) / 100 },
        ...(generatedVoices || []).map((v, i) => ({
          notes: v.notes || [],
          instrument: voices?.[i + 1]?.instrument || 'organ',
          volume: (voices?.[i + 1]?.volume || 80) / 100,
          enabled: voices?.[i + 1]?.enabled !== false
        })).filter(v => v.enabled !== false)
      ];
      const instrument = voices?.[0]?.instrument || 'organ';
      const wavBlob = await renderToWav(allVoicesData, tempo, instrument, { effects, envelope, customInstruments });
      setWavBlob(wavBlob);

      // Convert blob to base64
      const arrayBuffer = await wavBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Upload via backend function
      const response = await base44.functions.invoke('shareAudio', {
        audioBase64: base64,
        title: title.trim() || 'My Composition',
        instrument,
        tempo,
      });

      const id = response.data?.id;
      if (!id) throw new Error('No share ID returned');

      const url = `${window.location.origin}/share?id=${id}`;
      setShareUrl(url);
      toast.success('Share link created!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create share link: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    setIsPlaying(false);
    setWavBlob(null);
    if (audioRef.current) audioRef.current.pause();
    onClose();
  };

  const togglePlayPreview = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] [&>button]:text-white/70 [&>button]:hover:text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-amber-400" />
            Share Composition
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!shareUrl ? (
            <>
              <div>
                <Label className="text-white/80 text-sm">Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Composition"
                  className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1"
                />
              </div>
              <p className="text-white/50 text-xs">
                This will render your composition as a WAV file and generate a shareable link that anyone can open to listen.
              </p>
              <Button
                onClick={handleShare}
                disabled={isGenerating || !cantusFirmus?.length}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating audio...</>
                ) : (
                  <><Share2 className="w-4 h-4 mr-2" /> Generate Share Link</>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-white/70 text-sm">Your composition is ready to share! Anyone with this link can listen:</p>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="bg-[#1A1A1A] border-[#4A4A4A] text-white/80 text-xs"
                />
                <Button
                  onClick={handleCopy}
                  className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-900"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {wavBlob && (
                <>
                  <audio
                    ref={audioRef}
                    src={URL.createObjectURL(wavBlob)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <Button
                    onClick={togglePlayPreview}
                    className="w-full bg-white/10 hover:bg-white/20 text-white text-sm"
                  >
                    {isPlaying ? (
                      <><Pause className="w-4 h-4 mr-2" /> Pause Preview</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" /> Play Preview</>
                    )}
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                onClick={() => setShareUrl(null)}
                className="w-full text-white/60 hover:text-white hover:bg-[#3A3A3A] text-sm"
              >
                Generate a new link
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
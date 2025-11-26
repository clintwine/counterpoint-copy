import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Music, Volume2, Guitar } from 'lucide-react';

const INSTRUMENTS = [
  { value: 'organ', label: 'Organ' },
  { value: 'distortion', label: 'Distortion Guitar' },
  { value: 'clean', label: 'Clean Guitar' },
  { value: 'bass', label: 'Bass' },
  { value: 'strings', label: 'Strings' },
  { value: 'flute', label: 'Flute' },
  { value: 'synth', label: 'Synth Lead' },
];

const VOICE_COLORS = {
  0: 'bg-[#D4A574]',
  1: 'bg-[#7B9E89]',
  2: 'bg-[#9B8AA6]',
  3: 'bg-[#A68B7B]',
};

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const OCTAVES = [2, 3, 4, 5];

export default function VoiceEditor({ voice, voiceIndex, onUpdate, isCantus = false }) {
  const handleChange = (field, value) => {
    onUpdate({ ...voice, [field]: value });
  };

  const pitchOptions = [];
  OCTAVES.forEach(octave => {
    NOTE_NAMES.forEach(note => {
      pitchOptions.push(`${note}${octave}`);
    });
  });

  return (
    <div className={`bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 ${
      isCantus ? 'ring-1 ring-gold/30' : ''
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${VOICE_COLORS[voiceIndex]}`} />
        <div className="flex-1">
          <h4 className="text-white font-medium text-sm">{voice.name}</h4>
          {isCantus && (
            <span className="text-[10px] text-amber-400 uppercase tracking-wider font-medium">Cantus Firmus</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={voice.enabled}
            onCheckedChange={(checked) => handleChange('enabled', checked)}
            className="data-[state=checked]:bg-gold"
          />
        </div>
      </div>

      {voice.enabled && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/90 text-xs mb-1.5 block font-medium">Low Range</Label>
              <Select
                value={voice.lowRange}
                onValueChange={(value) => handleChange('lowRange', value)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-cream h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {pitchOptions.map(pitch => (
                    <SelectItem key={pitch} value={pitch} className="text-cream">
                      {pitch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90 text-xs mb-1.5 block font-medium">High Range</Label>
              <Select
                value={voice.highRange}
                onValueChange={(value) => handleChange('highRange', value)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-cream h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {pitchOptions.map(pitch => (
                    <SelectItem key={pitch} value={pitch} className="text-cream">
                      {pitch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-white/90 text-xs font-medium">Volume</Label>
              <Volume2 className="w-3 h-3 text-white/60" />
            </div>
            <Slider
              value={[voice.volume || 80]}
              onValueChange={([value]) => handleChange('volume', value)}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-gold [&_[role=slider]]:border-0"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-white/90 text-xs font-medium">Instrument</Label>
              <Guitar className="w-3 h-3 text-white/60" />
            </div>
            <Select
              value={voice.instrument || 'organ'}
              onValueChange={(value) => handleChange('instrument', value)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-cream h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {INSTRUMENTS.map(inst => (
                  <SelectItem key={inst.value} value={inst.value} className="text-cream">
                    {inst.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
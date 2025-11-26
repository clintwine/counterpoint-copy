import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Settings2 } from 'lucide-react';

const SPECIES_OPTIONS = [
  { value: '1st', label: '1st Species', description: 'Note against note' },
  { value: '2nd', label: '2nd Species', description: 'Two notes against one' },
  { value: '3rd', label: '3rd Species', description: 'Four notes against one' },
  { value: '4th', label: '4th Species', description: 'Syncopation' },
  { value: '5th', label: '5th Species', description: 'Florid (mixed)' },
];

const KEY_OPTIONS = ['C', 'G', 'D', 'F', 'A', 'E', 'Bb'];
const MODE_OPTIONS = [
  { value: 'major', label: 'Major (Ionian)' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'phrygian', label: 'Phrygian' },
  { value: 'lydian', label: 'Lydian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'minor', label: 'Minor (Aeolian)' },
];

export default function GenerationSettings({ settings, onUpdate }) {
  const handleChange = (field, value) => {
    onUpdate({ ...settings, [field]: value });
  };

  return (
    <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-5">
        <Settings2 className="w-4 h-4 text-cream/60" />
        <h3 className="text-cream font-medium">Generation Settings</h3>
      </div>

      <div className="space-y-5">
        {/* Species Selection */}
        <div>
          <Label className="text-cream/60 text-xs mb-2 block">Species</Label>
          <Select
            value={settings.species}
            onValueChange={(value) => handleChange('species', value)}
          >
            <SelectTrigger className="bg-slate-900/50 border-slate-700 text-cream">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {SPECIES_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-cream">
                  <div>
                    <span className="font-medium">{option.label}</span>
                    <span className="text-cream/50 ml-2 text-xs">— {option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Key and Mode */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-cream/60 text-xs mb-2 block">Key</Label>
            <Select
              value={settings.key}
              onValueChange={(value) => handleChange('key', value)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-cream">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {KEY_OPTIONS.map(key => (
                  <SelectItem key={key} value={key} className="text-cream">
                    {key} Major
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-cream/60 text-xs mb-2 block">Mode</Label>
            <Select
              value={settings.mode}
              onValueChange={(value) => handleChange('mode', value)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-cream">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {MODE_OPTIONS.map(mode => (
                  <SelectItem key={mode.value} value={mode.value} className="text-cream">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Measures */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-cream/60 text-xs">Measures</Label>
            <span className="text-cream font-mono text-sm">{settings.measures}</span>
          </div>
          <Slider
            value={[settings.measures]}
            onValueChange={([value]) => handleChange('measures', value)}
            min={4}
            max={16}
            step={1}
            className="[&_[role=slider]]:bg-gold [&_[role=slider]]:border-0"
          />
        </div>

        {/* Number of Voices */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-cream/60 text-xs">Number of Voices</Label>
            <span className="text-cream font-mono text-sm">{settings.numVoices}</span>
          </div>
          <Slider
            value={[settings.numVoices]}
            onValueChange={([value]) => handleChange('numVoices', value)}
            min={2}
            max={4}
            step={1}
            className="[&_[role=slider]]:bg-gold [&_[role=slider]]:border-0"
          />
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <Label className="text-cream/70 text-sm">Strict Rules</Label>
            <Switch
              checked={settings.strictRules}
              onCheckedChange={(checked) => handleChange('strictRules', checked)}
              className="data-[state=checked]:bg-gold"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-cream/70 text-sm">Show Violations</Label>
            <Switch
              checked={settings.showViolations}
              onCheckedChange={(checked) => handleChange('showViolations', checked)}
              className="data-[state=checked]:bg-gold"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
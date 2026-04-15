import React from 'react';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Guitar, ChevronDown } from 'lucide-react';
import { initAudio, playNote } from './audioEngine';

export default function InstrumentSelect({ value, onChange, instruments, onCreateNew }) {
  const [open, setOpen] = React.useState(false);
  const selected = instruments.find(i => i.value === value);
  
  const handlePreview = (instrumentValue, e) => {
    e.stopPropagation();
    initAudio();
    playNote('C4', 0.5, 0.7, 0, instrumentValue);
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-40 h-8 justify-between bg-slate-700 border-slate-600 text-white text-xs hover:bg-slate-600"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Guitar className="w-4 h-4 text-white/60 flex-shrink-0" />
            <span className="truncate">{selected?.label || 'Select...'}</span>
          </div>
          <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
        <PopoverContent className="w-52 p-0 bg-slate-800 border-slate-700">
          <Command className="bg-slate-800" value={selected?.label || ''}>
            <CommandInput placeholder="Search instrument..." className="h-8 text-xs text-white" />
            <CommandList>
              <CommandEmpty className="text-white/50 text-xs py-2 text-center">
                No instrument found.
                {onCreateNew && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onCreateNew();
                    }}
                    className="block w-full mt-2 text-amber-400 hover:text-amber-300 underline"
                  >
                    Create new instrument
                  </button>
                )}
              </CommandEmpty>
              <CommandGroup>
                {instruments.map(inst => (
                  <CommandItem
                    key={inst.value}
                    value={inst.label}
                    onSelect={() => {
                      onChange(inst.value);
                      setOpen(false);
                    }}
                    className={`text-white text-xs cursor-pointer flex items-center justify-between group ${inst.value === value ? 'bg-slate-700' : ''}`}
                  >
                    <span>{inst.label}</span>
                    <button
                      onClick={(e) => handlePreview(inst.value, e)}
                      className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-slate-700 transition-opacity text-sm"
                      title="Preview sound"
                    >
                      ▶ Play
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
  );
}
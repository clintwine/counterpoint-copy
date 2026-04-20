import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { FileText, FolderOpen, Save, Download, Sparkles, Menu, Keyboard, Guitar, FileAudio, FilePlus, Check, Music, MessageSquare, Share2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { renderToWav } from './audioExporter';
import RecentProjectsMenu from './RecentProjectsMenu';
import FeedbackDialog from './FeedbackDialog';
import ShareDialog from './ShareDialog';

export default function FileMenu({
  projectName,
  onNewProject,
  onLoadProject,
  onSaveProject,
  onSaveProjectAs,
  onSaveSong,
  onBrowseSongs,
  onExportMidi,
  onImportMidi,
  cantusFirmus,
  tempo,
  voices,
  onTogglePianoPanel,
  showPianoPanel,
  onOpenWaveEditor,
  onAIComposer,
  chatbotActive,
  currentUser,
  gridRef,
  effects,
  envelope,
  customInstruments,
  generatedVoices,
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-white hover:text-white hover:bg-slate-700/50 gap-2"
          onClick={() => setTimeout(() => gridRef.current?.focus(), 0)}
          onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
        >
          <Menu className="w-4 h-4" />
          <span className="font-semibold text-sm">{projectName || 'File'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-[#1E1E1E] border-[#3A3A3A] min-w-[220px] shadow-xl max-h-[80vh] overflow-y-auto">
        <DropdownMenuItem onClick={() => { onNewProject(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <FileText className="w-4 h-4 mr-2" />
          New Project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { onLoadProject(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <FolderOpen className="w-4 h-4 mr-2" />Browse All Projects
        </DropdownMenuItem>
        <RecentProjectsMenu />
        <DropdownMenuItem onClick={() => { onSaveProject(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <Save className="w-4 h-4 mr-2" />Save Project<span className="ml-auto text-xs text-white/40">⌘S</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { onSaveProjectAs(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <FilePlus className="w-4 h-4 mr-2" />Save Project As...<span className="ml-auto text-xs text-white/40">⌘⇧S</span>
        </DropdownMenuItem>
        {onSaveSong && (
          <DropdownMenuItem onClick={() => { onSaveSong(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-amber-400 cursor-pointer font-semibold hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
            <Save className="w-4 h-4 mr-2" />
            Save as Song (Admin)
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-[#3A3A3A]" />
        <DropdownMenuItem onClick={() => { onBrowseSongs(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-amber-400 cursor-pointer hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
          <Music className="w-4 h-4 mr-2" />
          Browse Songs
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#3A3A3A]" />
        <DropdownMenuItem onClick={() => { setShareOpen(true); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-amber-400 cursor-pointer hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#3A3A3A]" />
        <DropdownMenuItem onClick={onExportMidi} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <FileAudio className="w-4 h-4 mr-2" />
          Export MIDI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImportMidi} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <FileAudio className="w-4 h-4 mr-2" />
          Import MIDI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => {
          try {
            const instrument = voices[0]?.instrument || 'organ';
            const blob = await renderToWav(cantusFirmus, tempo, instrument, { effects, envelope, customInstruments });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `composition-${Date.now()}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (error) {
            console.error('Export audio error:', error);
          }
        }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <Download className="w-4 h-4 mr-2" />
          Download as Audio
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#3A3A3A]" />
        <DropdownMenuItem onClick={() => { onTogglePianoPanel(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <Keyboard className="w-4 h-4 mr-2" />
          {showPianoPanel ? 'Hide Piano' : 'Show Piano'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { onOpenWaveEditor(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <Guitar className="w-4 h-4 mr-2" />
          Create Instrument
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#3A3A3A]" />
        <DropdownMenuItem onClick={() => { onAIComposer(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
          <Sparkles className="w-4 h-4 mr-2" />
          AI Composer
          {chatbotActive && <Check className="w-4 h-4 ml-auto text-amber-400" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#3A3A3A]" />
        <DropdownMenuItem onClick={() => { setFeedbackOpen(true); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-amber-400 cursor-pointer hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
          <MessageSquare className="w-4 h-4 mr-2" />
          Give Feedback
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    <ShareDialog
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      cantusFirmus={cantusFirmus}
      generatedVoices={generatedVoices}
      tempo={tempo}
      voices={voices}
      projectName={projectName}
      effects={effects}
      envelope={envelope}
      customInstruments={customInstruments}
    />
    </div>
  );
}
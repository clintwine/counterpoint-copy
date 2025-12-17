import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, BookOpen, BarChart3, GitBranch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChordProgressionGenerator from './ChordProgressionGenerator';
import ScaleExplorer from './ScaleExplorer';
import HarmonicAnalyzer from './HarmonicAnalyzer';
import VoiceLeadingVisualizer from './VoiceLeadingVisualizer';

export default function MusicTheoryPanel({
  isOpen,
  onClose,
  cantusFirmus,
  generatedVoices,
  onApplyProgression,
  onApplyScale,
}) {
  const [activeTab, setActiveTab] = useState('chords');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-slate-900 border-l border-slate-700 z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-slate-900" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">Music Theory Tools</h2>
                  <p className="text-white/50 text-xs">Advanced composition features</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-4 bg-slate-800 mb-4">
                  <TabsTrigger value="chords" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
                    <Music className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Chords</span>
                  </TabsTrigger>
                  <TabsTrigger value="scales" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
                    <GitBranch className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Scales</span>
                  </TabsTrigger>
                  <TabsTrigger value="harmony" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
                    <BarChart3 className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Harmony</span>
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
                    <GitBranch className="w-4 h-4 sm:mr-1 rotate-90" />
                    <span className="hidden sm:inline">Voice</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chords">
                  <ChordProgressionGenerator onApplyProgression={onApplyProgression} />
                </TabsContent>

                <TabsContent value="scales">
                  <ScaleExplorer onApplyScale={onApplyScale} />
                </TabsContent>

                <TabsContent value="harmony">
                  <HarmonicAnalyzer cantusFirmus={cantusFirmus} voices={generatedVoices} />
                </TabsContent>

                <TabsContent value="voice">
                  <VoiceLeadingVisualizer cantusFirmus={cantusFirmus} voices={generatedVoices} />
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
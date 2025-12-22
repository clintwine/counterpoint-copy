import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Midi } from '@tonejs/midi';

export default function BulkMidiImport() {
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setResults([]);
  };

  const parseMidiFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const midi = new Midi(e.target.result);
          
          // Extract notes from all tracks
          const allNotes = [];
          midi.tracks.forEach(track => {
            track.notes.forEach(note => {
              allNotes.push({
                pitch: note.name,
                beat: Math.round(note.ticks / (midi.header.ppq / 4)),
                duration: Math.max(0.25, Math.round((note.durationTicks / (midi.header.ppq / 4)) * 4) / 4),
                velocity: note.velocity
              });
            });
          });

          // Sort by beat
          allNotes.sort((a, b) => a.beat - b.beat);

          const songName = file.name.replace('.mid', '').replace('.midi', '');
          
          resolve({
            name: songName,
            cantusFirmus: allNotes,
            settings: {
              key: 'C',
              mode: 'major',
              measures: Math.ceil((allNotes[allNotes.length - 1]?.beat || 16) / 16),
              tempo: Math.round(midi.header.tempos[0]?.bpm || 120)
            },
            voices: [
              { name: 'Melody', instrument: 'organ', enabled: true, notes: [] }
            ]
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    const importResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const songData = await parseMidiFile(file);
        await base44.entities.Song.create(songData);
        importResults.push({ file: file.name, success: true });
      } catch (error) {
        importResults.push({ file: file.name, success: false, error: error.message });
      }
      setProgress(((i + 1) / files.length) * 100);
    }

    setResults(importResults);
    setImporting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8">
          <h1 className="text-3xl font-bold text-white mb-2">Bulk MIDI Import</h1>
          <p className="text-white/60 mb-8">Import multiple MIDI files as songs to the library</p>

          <div className="space-y-6">
            {/* File Input */}
            <div>
              <label className="block mb-4">
                <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-amber-500 hover:bg-slate-700/30 transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-white/60" />
                  <p className="text-white/80 mb-2">Drop MIDI files or click to browse</p>
                  <p className="text-white/40 text-sm">Select multiple .mid or .midi files</p>
                  <input
                    type="file"
                    accept=".mid,.midi"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </label>

              {files.length > 0 && (
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-white font-medium mb-2">{files.length} file(s) selected</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {files.map((file, i) => (
                      <div key={i} className="text-white/70 text-sm">• {file.name}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Import Button */}
            {files.length > 0 && !importing && results.length === 0 && (
              <Button
                onClick={handleImport}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold h-12"
              >
                Import {files.length} File(s) as Songs
              </Button>
            )}

            {/* Progress */}
            {importing && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  <p className="text-white">Importing... {Math.round(progress)}%</p>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-white font-semibold">Import Results</h3>
                <div className="bg-slate-700/30 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                  {results.map((result, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      {result.success ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                          <span className="text-white/80">{result.file}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                          <span className="text-white/80">{result.file}</span>
                          <span className="text-red-400 text-xs">({result.error})</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    setFiles([]);
                    setResults([]);
                    setProgress(0);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Import More Files
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Edit2, Trash2 } from 'lucide-react';

export default function LibraryDialog({ 
  open, 
  onOpenChange, 
  savedProjects, 
  songs, 
  librarySearchQuery, 
  setLibrarySearchQuery, 
  librarySortBy, 
  setLibrarySortBy, 
  libraryActiveTab, 
  setLibraryActiveTab,
  previewingSongId,
  previewingProjectId,
  currentUser,
  onHandleLoadSong,
  onHandleLoadProject,
  onHandlePreviewSong,
  onHandlePreviewProject,
  onDeleteProject,
  onDeleteSong,
  onEditSong,
  onNewProject
}) {
  const getDuration = (item) => {
    const maxBeat = Math.max(...(item.cantusFirmus || []).map(n => n.beat + (n.duration || 1)), 0);
    const tempo = item.settings?.tempo || 80;
    const sixteenthNoteDuration = (60 / tempo) / 4;
    const totalSeconds = maxBeat * sixteenthNoteDuration;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const filterAndSort = (items) => {
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(librarySearchQuery.toLowerCase())
    );
    
    const sorted = [...filtered].sort((a, b) => {
      if (librarySortBy === 'updated') {
        return new Date(b.updated_date) - new Date(a.updated_date);
      } else if (librarySortBy === 'created') {
        return new Date(b.created_date) - new Date(a.created_date);
      } else {
        return a.name.localeCompare(b.name);
      }
    });
    
    return sorted;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <div style={{ display: 'none' }} />
      </DialogTrigger>
      <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] max-w-2xl [&>button]:text-white/70 [&>button]:hover:text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Browse Library</DialogTitle>
        </DialogHeader>
        
        {/* Search and Sort Controls */}
        <div className="flex gap-3 mb-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Search by name..."
              value={librarySearchQuery}
              onChange={(e) => setLibrarySearchQuery(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-10 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[#D4AF37]"
            />
            {librarySearchQuery && (
              <button
                onClick={() => setLibrarySearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Select value={librarySortBy} onValueChange={setLibrarySortBy}>
            <SelectTrigger className="w-40 bg-[#1A1A1A] border-[#3A3A3A] text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#2D2D2D] border-[#3A3A3A]">
              <SelectItem value="updated" className="text-white">Last Updated</SelectItem>
              <SelectItem value="created" className="text-white">Date Created</SelectItem>
              <SelectItem value="name" className="text-white">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={libraryActiveTab} onValueChange={setLibraryActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#1A1A1A]">
            <TabsTrigger value="songs" className="text-white data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1E1E1E]">
              Song Library
            </TabsTrigger>
            <TabsTrigger value="projects" className="text-white data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1E1E1E]">
              My Projects
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="songs" className="mt-4">
            <div className="space-y-2 max-h-[400px] min-h-[400px] overflow-y-auto">
              {(() => {
                const sorted = filterAndSort(songs);
                if (sorted.length === 0) {
                  return <p className="text-white/60 text-sm text-center py-4">No songs found</p>;
                }

                return sorted.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between p-4 bg-[#3A3A3A] rounded-lg hover:bg-[#424242] cursor-pointer border border-[#4A4A4A]"
                    onClick={() => onHandleLoadSong(song)}
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium text-lg">{song.name}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium">
                          {song.settings?.key || 'C'} {song.settings?.mode || 'major'}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">
                          {song.settings?.timeSignature || '4/4'}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                          {getDuration(song)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => onHandlePreviewSong(song, e)}
                        className={`${previewingSongId === song.id ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500/80 hover:bg-amber-500 text-slate-900'}`}
                      >
                        {previewingSongId === song.id ? '⏹ Stop' : '▶ Preview'}
                      </Button>
                      {currentUser?.role === 'admin' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSong(song);
                            }}
                            className="text-white/60 hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete "${song.name}"?`)) {
                                onDeleteSong(song.id);
                              }
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-400 hover:text-amber-300"
                      >
                        Load →
                      </Button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
            <div className="space-y-2 max-h-[400px] min-h-[400px] overflow-y-auto">
              {(() => {
                const sorted = filterAndSort(savedProjects);
                if (sorted.length === 0) {
                  return <p className="text-white/60 text-sm text-center py-4">No projects found</p>;
                }

                return sorted.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-[#3A3A3A] rounded-lg hover:bg-[#424242] cursor-pointer border border-[#4A4A4A]"
                    onClick={() => { onHandleLoadProject(project); onOpenChange(false); }}
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium text-lg">{project.name}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium">
                          {project.settings?.key || 'C'} {project.settings?.mode || 'major'}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">
                          {project.settings?.timeSignature || '4/4'}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                          {getDuration(project)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => onHandlePreviewProject(project, e)}
                        className={`${previewingProjectId === project.id ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500/80 hover:bg-amber-500 text-slate-900'}`}
                      >
                        {previewingProjectId === project.id ? '⏹ Stop' : '▶ Preview'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${project.name}"?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-400 hover:text-amber-300"
                      >
                        Load →
                      </Button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </TabsContent>
        </Tabs>
        <Button
          onClick={() => {
            onNewProject();
            onOpenChange(false);
          }}
          className="w-full bg-slate-600 text-white hover:bg-slate-500"
        >
          New Project
        </Button>
      </DialogContent>
    </Dialog>
  );
}
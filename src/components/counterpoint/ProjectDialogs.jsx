import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit2, Trash2, Search, X } from 'lucide-react';
import UnsavedChangesDialog from './UnsavedChangesDialog';

export default function ProjectDialogs({
  // Load dialog
  loadDialogOpen, setLoadDialogOpen,
  savedProjects, handleLoadProject, deleteProjectMutation, handleNewProject,
  // Song/project browser dialog
  songDialogOpen, setSongDialogOpen,
  librarySearchQuery, setLibrarySearchQuery,
  librarySortBy, setLibrarySortBy,
  libraryActiveTab, setLibraryActiveTab,
  songs, previewingSongId, handlePreviewSong,
  previewingProjectId, handlePreviewProject,
  currentUser,
  editingSong, setEditingSong, songName, setSongName, songDescription, setSongDescription,
  setEditSongDialogOpen, editSongDialogOpen,
  deleteSongMutation, updateSongMutation, handleUpdateSong,
  // Save project dialog
  saveDialogOpen, setSaveDialogOpen, saveAsMode, setSaveAsMode,
  projectName, setProjectName, saveProjectMutation, handleSaveProject, currentProjectId,
  // Save song dialog
  saveSongDialogOpen, setSaveSongDialogOpen, handleSaveSong, saveSongMutation,
  // Unsaved changes
  unsavedChangesDialog, setUnsavedChangesDialog, pendingAction, setPendingAction,
  hasUnsavedChanges, setHasUnsavedChanges, isLoadingProjectRef,
  handleLoadSong,
}) {
  return (
    <>
      {/* Load Project Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogTrigger asChild><div style={{ display: 'none' }} /></DialogTrigger>
        <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] [&>button]:text-white/70 [&>button]:hover:text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Load Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {savedProjects.length === 0 ? (
              <p className="text-white/60 text-sm text-center py-4">No saved projects yet</p>
            ) : (
              savedProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-[#3A3A3A] rounded-lg hover:bg-[#424242] cursor-pointer" onClick={() => handleLoadProject(project)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{project.name}</p>
                      {project.isLocal && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">Local</span>}
                    </div>
                    <p className="text-white/50 text-xs">{project.settings?.key} {project.settings?.mode} • {project.cantusFirmus?.length || 0} notes</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteProjectMutation.mutate(project.id); }} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">×</Button>
                </div>
              ))
            )}
          </div>
          <Button onClick={() => { handleNewProject(); setLoadDialogOpen(false); }} className="w-full bg-slate-600 text-white hover:bg-slate-500">New Project</Button>
        </DialogContent>
      </Dialog>

      {/* Browse Songs / Projects Dialog */}
      <Dialog open={songDialogOpen} onOpenChange={setSongDialogOpen}>
        <DialogTrigger asChild><div style={{ display: 'none' }} /></DialogTrigger>
        <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] max-w-2xl [&>button]:text-white/70 [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white">Browse Library</DialogTitle></DialogHeader>
          <div className="flex gap-3 mb-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
              <input type="text" placeholder="Search by name..." value={librarySearchQuery} onChange={(e) => setLibrarySearchQuery(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-10 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[#D4AF37]" />
              {librarySearchQuery && <button onClick={() => setLibrarySearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"><X className="w-4 h-4" /></button>}
            </div>
            <Select value={librarySortBy} onValueChange={setLibrarySortBy}>
              <SelectTrigger className="w-40 bg-[#1A1A1A] border-[#3A3A3A] text-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#2D2D2D] border-[#3A3A3A]">
                <SelectItem value="updated" className="text-white">Last Updated</SelectItem>
                <SelectItem value="created" className="text-white">Date Created</SelectItem>
                <SelectItem value="name" className="text-white">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Tabs value={libraryActiveTab} onValueChange={setLibraryActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#1A1A1A]">
              <TabsTrigger value="songs" className="text-white data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1E1E1E]">Song Library</TabsTrigger>
              <TabsTrigger value="projects" className="text-white data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1E1E1E]">My Projects</TabsTrigger>
            </TabsList>
            <TabsContent value="songs" className="mt-4">
              <div className="space-y-2 max-h-[400px] min-h-[400px] overflow-y-auto">
                {(() => {
                  const filtered = songs.filter(s => s.name.toLowerCase().includes(librarySearchQuery.toLowerCase()));
                  const sorted = [...filtered].sort((a, b) => librarySortBy === 'name' ? a.name.localeCompare(b.name) : librarySortBy === 'created' ? new Date(b.created_date) - new Date(a.created_date) : new Date(b.updated_date) - new Date(a.updated_date));
                  if (sorted.length === 0) return <p className="text-white/60 text-sm text-center py-4">No songs found</p>;
                  return sorted.map((song) => (
                    <div key={song.id} className="flex items-center justify-between p-4 bg-[#3A3A3A] rounded-lg hover:bg-[#424242] cursor-pointer border border-[#4A4A4A]" onClick={() => handleLoadSong(song)}>
                      <div className="flex-1">
                        <p className="text-white font-medium text-lg">{song.name}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium">{song.settings?.key || 'C'} {song.settings?.mode || 'major'}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">{song.settings?.timeSignature || '4/4'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={(e) => handlePreviewSong(song, e)} className={`${previewingSongId === song.id ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500/80 hover:bg-amber-500 text-slate-900'}`}>{previewingSongId === song.id ? <>⏹ Stop</> : <>▶ Preview</>}</Button>
                        {currentUser?.role === 'admin' && (<>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingSong(song); setSongName(song.name); setSongDescription(song.description || ''); setEditSongDialogOpen(true); }} className="text-white/60 hover:text-white"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${song.name}"?`)) deleteSongMutation.mutate(song.id); }} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
                        </>)}
                        <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">Load →</Button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </TabsContent>
            <TabsContent value="projects" className="mt-4">
              <div className="space-y-2 max-h-[400px] min-h-[400px] overflow-y-auto">
                {(() => {
                  const filtered = savedProjects.filter(p => p.name.toLowerCase().includes(librarySearchQuery.toLowerCase()));
                  const sorted = [...filtered].sort((a, b) => librarySortBy === 'name' ? a.name.localeCompare(b.name) : librarySortBy === 'created' ? new Date(b.created_date) - new Date(a.created_date) : new Date(b.updated_date) - new Date(a.updated_date));
                  if (sorted.length === 0) return <p className="text-white/60 text-sm text-center py-4">No projects found</p>;
                  return sorted.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 bg-[#3A3A3A] rounded-lg hover:bg-[#424242] cursor-pointer border border-[#4A4A4A]" onClick={() => { handleLoadProject(project); setSongDialogOpen(false); }}>
                      <div className="flex-1">
                        <p className="text-white font-medium text-lg">{project.name}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium">{project.settings?.key || 'C'} {project.settings?.mode || 'major'}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">{project.settings?.timeSignature || '4/4'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={(e) => handlePreviewProject(project, e)} className={`${previewingProjectId === project.id ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500/80 hover:bg-amber-500 text-slate-900'}`}>{previewingProjectId === project.id ? <>⏹ Stop</> : <>▶ Preview</>}</Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${project.name}"?`)) deleteProjectMutation.mutate(project.id); }} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">Load →</Button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Save Project Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={(open) => { setSaveDialogOpen(open); if (!open) setSaveAsMode(false); }}>
        <DialogTrigger asChild><div style={{ display: 'none' }} /></DialogTrigger>
        <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] [&>button]:text-white/70 [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white">{saveAsMode ? 'Save Project As' : 'Save Project'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveProject(false, false); }} className="space-y-4">
            <div>
              <Label className="text-white/80">Project Name</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="My Counterpoint" className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1" autoFocus />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!projectName.trim() || saveProjectMutation.isPending} className={`${currentUser?.role === 'admin' ? 'flex-1' : 'w-full'} bg-[#D4AF37] text-[#1E1E1E] hover:bg-[#E5C158]`}>
                {saveAsMode ? 'Save Locally' : (currentProjectId?.startsWith('local_') ? 'Update Local' : 'Save Locally')}
              </Button>
              {currentUser?.role === 'admin' && (
                <Button type="button" onClick={(e) => { e.preventDefault(); handleSaveProject(false, true); }} disabled={!projectName.trim() || saveProjectMutation.isPending} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">
                  {saveProjectMutation.isPending ? 'Saving...' : 'Save to Database'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Save Song Dialog (Admin Only) */}
      <Dialog open={saveSongDialogOpen} onOpenChange={setSaveSongDialogOpen}>
        <DialogTrigger asChild><div style={{ display: 'none' }} /></DialogTrigger>
        <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] [&>button]:text-white/70 [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white">Save as Song</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveSong(); }} className="space-y-4">
            <div>
              <Label className="text-white/80">Song Name</Label>
              <Input value={songName} onChange={(e) => setSongName(e.target.value)} placeholder="My Beautiful Song" className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1" autoFocus />
            </div>
            <div>
              <Label className="text-white/80">Description</Label>
              <Input value={songDescription} onChange={(e) => setSongDescription(e.target.value)} placeholder="A brief description..." className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1" />
            </div>
            <Button type="submit" disabled={!songName.trim() || saveSongMutation.isPending} className="w-full bg-[#D4AF37] text-[#1E1E1E] hover:bg-[#E5C158]">
              {saveSongMutation.isPending ? 'Saving...' : 'Save Song'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Song Dialog (Admin Only) */}
      <Dialog open={editSongDialogOpen} onOpenChange={(open) => { setEditSongDialogOpen(open); if (!open) { setEditingSong(null); setSongName(''); setSongDescription(''); } }}>
        <DialogTrigger asChild><div style={{ display: 'none' }} /></DialogTrigger>
        <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] [&>button]:text-white/70 [&>button]:hover:text-white">
          <DialogHeader><DialogTitle className="text-white">Edit "{editingSong?.name}"</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleUpdateSong(); }} className="space-y-4">
            <div>
              <Label className="text-white/80">Song Name</Label>
              <Input value={songName} onChange={(e) => setSongName(e.target.value)} placeholder="My Beautiful Song" className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1" autoFocus />
            </div>
            <div>
              <Label className="text-white/80">Description</Label>
              <Input value={songDescription} onChange={(e) => setSongDescription(e.target.value)} placeholder="A brief description..." className="bg-[#3A3A3A] border-[#4A4A4A] text-white mt-1" />
            </div>
            <Button type="submit" disabled={!songName.trim() || updateSongMutation.isPending} className="w-full bg-[#D4AF37] text-[#1E1E1E] hover:bg-[#E5C158]">
              {updateSongMutation.isPending ? 'Updating...' : 'Update Song'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={unsavedChangesDialog}
        onOpenChange={setUnsavedChangesDialog}
        pendingAction={pendingAction}
        onSaveAndContinue={async (action) => {
          isLoadingProjectRef.current = true;
          setUnsavedChangesDialog(false);
          setHasUnsavedChanges(false);
          setPendingAction(null);
          setSaveDialogOpen(false);
          await handleSaveProject(true);
          if (action) {
            setTimeout(() => {
              if (action.type === 'loadSong') handleLoadSong(action.data);
              else if (action.type === 'loadProject') handleLoadProject(action.data);
              else if (action.type === 'newProject') handleNewProject();
            }, 50);
          } else {
            setTimeout(() => { isLoadingProjectRef.current = false; }, 400);
          }
        }}
        onDontSave={(action) => {
          isLoadingProjectRef.current = true;
          setUnsavedChangesDialog(false);
          setHasUnsavedChanges(false);
          setPendingAction(null);
          setTimeout(() => {
            if (action?.type === 'newProject') handleNewProject();
            else if (action?.type === 'loadProject') handleLoadProject(action.data);
            else if (action?.type === 'loadSong') handleLoadSong(action.data);
          }, 50);
        }}
        onCancel={() => { setUnsavedChangesDialog(false); setPendingAction(null); }}
      />
    </>
  );
}
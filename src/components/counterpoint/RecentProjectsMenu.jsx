import { DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FolderOpen, Music } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function RecentProjectsMenu({ onLoadRecent }) {
  const localProjects = JSON.parse(localStorage.getItem('counterpoint-local-projects') || '[]').slice(-3).reverse();
  
  const { data: songs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: () => base44.entities.Song.list('-created_date'),
  });
  
  const recentSongs = songs.slice(0, 3);
  
  const hasItems = localProjects.length > 0 || recentSongs.length > 0;
  if (!hasItems) return null;

  const handleLoad = (item, isSong = false) => {
    if (onLoadRecent) {
      onLoadRecent(item);
    } else if (window.__loadRecentProject && !isSong) {
      window.__loadRecentProject(item);
    } else if (window.__loadRecentSong && isSong) {
      window.__loadRecentSong(item);
    }
    setTimeout(() => document.activeElement?.blur(), 0);
  };

  return (
    <>
      <DropdownMenuSeparator className="bg-[#3A3A3A]" />
      <div className="px-2 py-0.5 text-[10px] text-white/40 uppercase tracking-wider">Recent</div>
      
      {localProjects.map(p => (
        <DropdownMenuItem 
          key={`project-${p.id}`}
          onClick={() => handleLoad(p, false)}
          className="text-white/75 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white text-xs py-1.5"
        >
          <FolderOpen className="w-3 h-3 mr-2 flex-shrink-0 opacity-50" />
          <span className="truncate">{p.name}</span>
        </DropdownMenuItem>
      ))}
      
      {recentSongs.map(song => (
        <DropdownMenuItem 
          key={`song-${song.id}`}
          onClick={() => handleLoad(song, true)}
          className="text-amber-400/75 cursor-pointer hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300 text-xs py-1.5"
        >
          <Music className="w-3 h-3 mr-2 flex-shrink-0 opacity-50" />
          <span className="truncate">{song.name}</span>
        </DropdownMenuItem>
      ))}
      
      <DropdownMenuSeparator className="bg-[#3A3A3A]" />
    </>
  );
}
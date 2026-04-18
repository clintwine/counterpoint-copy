import { DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FolderOpen } from 'lucide-react';

export default function RecentProjectsMenu({ onLoadRecent }) {
  const recent = JSON.parse(localStorage.getItem('counterpoint-local-projects') || '[]').slice(-5).reverse();
  
  if (recent.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator className="bg-[#3A3A3A]" />
      <div className="px-2 py-0.5 text-[10px] text-white/40 uppercase tracking-wider">Recent</div>
      {recent.map(p => (
        <DropdownMenuItem 
          key={p.id} 
          onClick={() => { 
            if (window.__loadRecentProject) window.__loadRecentProject(p);
            else window.location.reload();
            setTimeout(() => document.activeElement?.blur(), 0);
          }} 
          className="text-white/75 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white text-xs py-1.5"
        >
          <FolderOpen className="w-3 h-3 mr-2 flex-shrink-0 opacity-50" />
          <span className="truncate">{p.name}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator className="bg-[#3A3A3A]" />
    </>
  );
}
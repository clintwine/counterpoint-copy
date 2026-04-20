import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MessageSquare, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import FeedbackDialog from './FeedbackDialog';

export default function UserAvatar({ currentUser }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const getInitials = (email) => { if (!email) return '?'; return email.split('@')[0].slice(0, 2).toUpperCase(); };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D4AF37] text-[#1E1E1E] font-semibold text-xs border-2 border-[#3A3A3A] hover:bg-[#E5BF47] transition-colors cursor-pointer flex-shrink-0"
            title={currentUser.email}
          >
            {getInitials(currentUser.email)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#1E1E1E] border-[#3A3A3A]">
          <DropdownMenuItem disabled className="text-white/50 text-xs cursor-default">
            {currentUser.email}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#3A3A3A]" />
          <DropdownMenuItem onClick={() => { setFeedbackOpen(true); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-amber-400 cursor-pointer hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
            <MessageSquare className="w-4 h-4 mr-2" />Give Feedback
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#3A3A3A]" />
          <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
            <LogOut className="w-4 h-4 mr-2" />Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
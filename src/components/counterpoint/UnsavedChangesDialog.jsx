import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function UnsavedChangesDialog({ open, onOpenChange, pendingAction, onSaveAndContinue, onDontSave, onCancel }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] [&>button]:text-white/70 [&>button]:hover:text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Unsaved Changes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-white/70">You have unsaved changes. What would you like to do?</p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={onSaveAndContinue}
              className="bg-[#D4AF37] text-[#1E1E1E] hover:bg-[#E5C158]"
            >
              Save and Continue
            </Button>
            <Button
              onClick={onDontSave}
              variant="outline"
              className="border-[#3A3A3A] text-white hover:bg-[#3A3A3A]"
            >
              Don't Save
            </Button>
            <Button
              onClick={onCancel}
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-[#3A3A3A]"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
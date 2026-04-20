import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Star } from 'lucide-react';

export default function FeedbackDialog({ open, onClose }) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    await base44.entities.Feedback.create({
      message: message.trim(),
      category,
      rating: rating || undefined,
    });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setMessage('');
      setCategory('general');
      setRating(0);
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1E1E1E] border-[#3A3A3A] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Give Feedback</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center text-green-400 text-lg font-semibold">
            ✓ Thanks for your feedback!
          </div>
        ) : (
          <div className="space-y-4">
            {/* Star rating */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Rating (optional)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star === rating ? 0 : star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        star <= (hoverRating || rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-[#2A2A2A] border-[#3A3A3A] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1E1E1E] border-[#3A3A3A]">
                  <SelectItem value="general" className="text-white">General</SelectItem>
                  <SelectItem value="bug" className="text-white">Bug Report</SelectItem>
                  <SelectItem value="feature_request" className="text-white">Feature Request</SelectItem>
                  <SelectItem value="praise" className="text-white">Praise 🎉</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Message</label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what you think…"
                className="bg-[#2A2A2A] border-[#3A3A3A] text-white placeholder:text-slate-500 resize-none h-28"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !message.trim()}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
              >
                {submitting ? 'Sending…' : 'Send Feedback'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
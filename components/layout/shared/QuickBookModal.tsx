"use client";
import { Zap, Search, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuickBookModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-[#FACC15] text-[#050d36] font-bold gap-2 hover:bg-[#FACC15]/90 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
          <Zap size={16} className="fill-current" /> Quick Book
        </Button>
      </DialogTrigger>
      
      <DialogContent className="glass-panel border-white/10 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase">
            Instant <span className="text-[#FACC15]">Reservation</span>
          </DialogTitle>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Walk-in Override</p>
        </DialogHeader>

        <div className="space-y-5 py-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <Search size={12}/> Room Number
            </label>
            <Input placeholder="e.g. 302" className="bg-white/5 border-white/10 focus:border-[#FACC15] rounded-xl" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <UserCheck size={12}/> Student/Faculty ID
            </label>
            <Input placeholder="Enter ID" className="bg-white/5 border-white/10 focus:border-[#FACC15] rounded-xl" />
          </div>
        </div>

        <Button className="w-full bg-[#FACC15] text-[#050d36] font-bold h-12 rounded-xl active:scale-95 transition-transform">
          Finalize & Occupy Now
        </Button>
      </DialogContent>
    </Dialog>
  );
}
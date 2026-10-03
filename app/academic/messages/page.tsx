'use client'

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Search, MessageSquare, Send, RefreshCw, AlertCircle, Plus, ChevronsUpDown, Check, User as UserIcon } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/SkeletonList";


const COMMON_SUBJECTS = [
  { value: 'schedule_approval', label: 'Schedule Approval' },
  { value: 'schedule_rejection', label: 'Schedule Rejection' },
  { value: 'schedule_conflict', label: 'Schedule Conflict' },
  { value: 'room_assignment', label: 'Room Assignment' },
  { value: 'class_schedule_change', label: 'Class Schedule Change' },
  { value: 'faculty_notice', label: 'Faculty Notice' },
  { value: 'general_inquiry', label: 'General Inquiry' },
  { value: 'custom', label: 'Custom Subject...' },
] as const;

const MESSAGE_TEMPLATES: Record<string, string> = {
  schedule_approval: 'Your schedule submission has been reviewed and approved. The rooms have been assigned accordingly.',
  schedule_rejection: 'Your schedule submission could not be approved at this time. Please review comments.',
  schedule_conflict: 'A scheduling conflict has been detected with your submitted schedule.',
  room_assignment: 'A room has been assigned for your class. Please check the updated schedule.',
  class_schedule_change: 'There has been a change to the class schedule that may affect your courses.',
  faculty_notice: 'This is an important notice regarding academic operations.',
  general_inquiry: '',
};

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  subject: string;
  content: string;
  isMine: boolean;
  createdAt: string | null;
}

interface Conversation {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastSubject: string;
  time: string;
  messages: Message[];
}

interface User {
  id: string;
  name: string;
}

export default function AcademicMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubjectType, setComposeSubjectType] = useState("");
  const [composeCustomSubject, setComposeCustomSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [recipientPopoverOpen, setRecipientPopoverOpen] = useState(false);

  const composeSubject = composeSubjectType === 'custom'
    ? composeCustomSubject
    : COMMON_SUBJECTS.find(s => s.value === composeSubjectType)?.label || '';

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const q = userSearchQuery.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q));
  }, [users, userSearchQuery]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/academic-head/users-list');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchMessages = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/academic-head/messages');
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      const msgs: Message[] = (data.messages || []).map((m: any) => ({
        id: m.id,
        senderId: m.senderId || '',
        senderName: m.senderName || 'Unknown',
        recipientId: m.recipientId || '',
        recipientName: m.recipientName || 'Unknown',
        subject: m.subject || '',
        content: m.content || m.body || '',
        isMine: m.isMine ?? false,
        createdAt: m.createdAt || null,
      }));

      const grouped = new Map<string, Conversation>();
      for (const msg of msgs) {
        const partnerId = msg.isMine ? msg.recipientId : msg.senderId;
        const partnerName = msg.isMine ? msg.recipientName : msg.senderName;
        if (!grouped.has(partnerId)) {
          grouped.set(partnerId, {
            partnerId,
            partnerName,
            lastMessage: msg.content,
            lastSubject: msg.subject,
            time: msg.createdAt ? formatTime(msg.createdAt) : '',
            messages: [],
          });
        }
        grouped.get(partnerId)!.messages.push(msg);
      }

      const convos = Array.from(grouped.values()).sort((a, b) => {
        const aTime = a.messages[0]?.createdAt || '';
        const bTime = b.messages[0]?.createdAt || '';
        return bTime.localeCompare(aTime);
      });
      for (const c of convos) {
        c.messages.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      }

      setConversations(convos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(); fetchUsers(); }, [fetchMessages, fetchUsers]);

  const handleSubjectChange = (value: string) => {
    setComposeSubjectType(value);
    if (value !== 'custom') {
      setComposeCustomSubject('');
      const template = MESSAGE_TEMPLATES[value];
      if (template) setComposeBody(template);
    } else {
      setComposeBody('');
    }
  };

  const handleComposeSend = async () => {
    if (!composeRecipient || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    try {
      const res = await fetch('/api/academic-head/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: composeRecipient,
          subject: composeSubject,
          body: composeBody,
          sendAs: 'in-app',
        }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      setComposeOpen(false);
      setComposeRecipient("");
      setComposeSubjectType("");
      setComposeCustomSubject("");
      setComposeBody("");
      setUserSearchQuery("");
      fetchMessages();
    } catch (err: any) {
      alert(err.message || 'Failed to send');
    } finally {
      setComposeSending(false);
    }
  };

  const selectedConv = conversations.find(c => c.partnerId === selectedId);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      const res = await fetch('/api/academic-head/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedId,
          subject: selectedConv?.lastSubject || 'Follow-up',
          body: newMessage,
          sendAs: 'in-app',
        }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      setNewMessage("");
      fetchMessages();
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredConvs = conversations.filter(c =>
    c.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
        <p className="text-nano font-black uppercase tracking-widest text-red-600 dark:text-red-400">{error}</p>
        <Button variant="outline" onClick={fetchMessages} className="rounded-xl font-black text-nano uppercase tracking-widest">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Academic <span className="text-accent-brand">Messages</span></h1>
          <p className="text-nano font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em]">
            Direct communication with Faculty & Staff
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="rounded-2xl h-12 px-6 gap-2 font-black uppercase text-[11px] tracking-widest bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> New Message
        </Button>
      </div>

      <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[600px]">
        {/* Conversation list */}
        <Card className="w-80 flex flex-col shrink-0 overflow-hidden bg-white dark:bg-[#15181E] border-slate-200 dark:border-white/[0.06] rounded-3xl shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="SEARCH FACULTY..." 
                className="pl-10 h-10 bg-slate-50 dark:bg-white/5 border-none rounded-xl text-nano font-black uppercase tracking-widest" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <SkeletonList />
            ) : filteredConvs.length === 0 ? (
              <p className="text-center text-nano font-black uppercase tracking-widest text-slate-400 py-12">No conversations</p>
            ) : (
              filteredConvs.map(conv => (
                <div key={conv.partnerId} onClick={() => setSelectedId(conv.partnerId)}
                  className={cn(
                    "p-4 border-b border-slate-100 dark:border-white/[0.06] cursor-pointer transition-all duration-300", 
                    selectedId === conv.partnerId 
                      ? "bg-slate-50 dark:bg-white/[0.03] border-l-4 border-l-blue-500" 
                      : "hover:bg-slate-50/50 dark:hover:bg-white/[0.01]"
                  )}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <UserIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">{conv.partnerName}</p>
                        <span className="text-[9px] font-bold text-slate-400">{conv.time}</span>
                      </div>
                      <p className="text-nano text-slate-500 dark:text-slate-400 truncate mt-1">{conv.lastMessage}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </Card>

        {/* Message thread */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#15181E] border-slate-200 dark:border-white/[0.06] rounded-3xl shadow-sm">
          {selectedConv ? (
            <>
              <div className="p-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">{selectedConv.partnerName}</h3>
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Online
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchMessages} className="rounded-xl text-slate-400 hover:text-blue-500">
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-6 bg-slate-50/30 dark:bg-transparent">
                <div className="space-y-6">
                  {selectedConv.messages.map(msg => (
                    <div key={msg.id} className={cn("flex flex-col", msg.isMine ? "items-end" : "items-start")}>
                      <div className={cn(
                        "max-w-[70%] px-5 py-4 rounded-2xl shadow-sm transition-all",
                        msg.isMine
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-white dark:bg-white/5 text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] rounded-tl-none"
                      )}>
                        {msg.subject && (
                          <p className={cn(
                            "text-[9px] font-black uppercase tracking-widest mb-2 pb-2 border-b",
                            msg.isMine ? "border-white/10" : "border-slate-100 dark:border-white/10"
                          )}>
                            {msg.subject}
                          </p>
                        )}
                        <p className="text-[12px] leading-relaxed font-medium">{msg.content}</p>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 px-1">
                        {msg.createdAt ? formatTime(msg.createdAt) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 bg-white dark:bg-[#1A1D23] border-t border-slate-100 dark:border-white/[0.06]">
                <div className="flex gap-3 bg-slate-50 dark:bg-white/5 p-2 rounded-2xl border border-slate-200 dark:border-white/[0.06]">
                  <Input 
                    placeholder="TYPE YOUR MESSAGE..." 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()} 
                    className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 text-[11px] font-bold uppercase tracking-widest h-11" 
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={!newMessage.trim() || sending}
                    className="rounded-xl h-11 w-11 p-0 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 shrink-0"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Internal Communications</h3>
              <p className="text-nano font-bold text-slate-500 uppercase tracking-widest mt-2 max-w-[200px] leading-relaxed">
                Select a conversation from the left to start coordinating with faculty.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Compose Dialog - Matches App Premium Aesthetic */}
      <Dialog open={composeOpen} onOpenChange={(open) => {
        setComposeOpen(open);
        if (!open) { setUserSearchQuery(""); setRecipientPopoverOpen(false); }
      }}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-[#15181E] border-slate-200 dark:border-white/[0.06] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tighter text-slate-900 dark:text-white">
              Compose <span className="text-blue-500">Direct Message</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-nano font-black uppercase tracking-[0.2em] text-slate-400">Recipient</Label>
              <Popover open={recipientPopoverOpen} onOpenChange={setRecipientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12 rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-black uppercase tracking-widest">
                    {composeRecipient
                      ? users.find(u => u.id === composeRecipient)?.name ?? "Select user..."
                      : "Search faculty member..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden border-slate-200 dark:border-white/10" align="start">
                  <Command shouldFilter={false} className="dark:bg-[#1A1D23]">
                    <CommandInput
                      placeholder="Search by name..."
                      value={userSearchQuery}
                      onValueChange={setUserSearchQuery}
                      className="text-nano font-black uppercase tracking-widest h-12"
                    />
                    <CommandList>
                      <CommandEmpty className="text-nano font-black uppercase py-4 text-center">No users found.</CommandEmpty>
                      {filteredUsers.map(u => (
                        <CommandItem
                          key={u.id}
                          value={u.id}
                          onSelect={() => {
                            setComposeRecipient(u.id);
                            setRecipientPopoverOpen(false);
                            setUserSearchQuery("");
                          }}
                          className="text-nano font-black uppercase tracking-widest p-3"
                        >
                          <Check className={cn("mr-2 h-4 w-4", composeRecipient === u.id ? "opacity-100 text-blue-500" : "opacity-0")} />
                          {u.name}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-nano font-black uppercase tracking-[0.2em] text-slate-400">Subject Category</Label>
              <Select value={composeSubjectType} onValueChange={handleSubjectChange}>
                <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-black uppercase tracking-widest">
                  <SelectValue placeholder="Categorize message..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 dark:border-white/10 dark:bg-[#1A1D23]">
                  {COMMON_SUBJECTS.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-nano font-black uppercase tracking-widest">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {composeSubjectType === 'custom' && (
                <Input
                  placeholder="ENTER CUSTOM SUBJECT..."
                  className="mt-2 h-12 rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-black uppercase tracking-widest"
                  value={composeCustomSubject}
                  onChange={e => setComposeCustomSubject(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-nano font-black uppercase tracking-[0.2em] text-slate-400">Message Body</Label>
              <Textarea 
                placeholder="TYPE YOUR MESSAGE HERE..." 
                rows={5} 
                className="rounded-2xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-bold uppercase tracking-widest p-4 resize-none"
                value={composeBody} 
                onChange={e => setComposeBody(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setComposeOpen(false)} className="rounded-xl font-black uppercase text-nano tracking-widest">Cancel</Button>
            <Button 
              onClick={handleComposeSend} 
              disabled={!composeRecipient || !composeSubject.trim() || !composeBody.trim() || composeSending}
              className="rounded-xl px-8 font-black uppercase text-nano tracking-widest bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
            >
              {composeSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <RefreshCw className={cn("animate-spin", className)} />
);

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
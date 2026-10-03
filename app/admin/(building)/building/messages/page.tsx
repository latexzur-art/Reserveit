'use client'

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, MessageSquare, Send, RefreshCw, AlertCircle, Plus, User as UserIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* --- CONSTANTS --- */
const COMMON_SUBJECTS = [
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'booking_rejection', label: 'Booking Rejection' },
  { value: 'booking_cancellation', label: 'Booking Cancellation' },
  { value: 'facility_maintenance', label: 'Maintenance Notice' },
  { value: 'general_inquiry', label: 'General Inquiry' },
  { value: 'custom', label: 'Custom Subject...' },
] as const;

const MESSAGE_TEMPLATES: Record<string, string> = {
  booking_confirmation: 'Your booking has been confirmed. Please ensure you arrive on time.',
  booking_rejection: 'We regret to inform you that your booking request has been declined due to availability.',
  booking_cancellation: 'Your booking has been cancelled as requested.',
  facility_maintenance: 'Please be advised that maintenance work is scheduled for the facility.',
  general_inquiry: '',
};

/* --- INTERFACES --- */
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

export default function MessagesPage() {
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
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const composeSubject = composeSubjectType === 'custom'
    ? composeCustomSubject
    : COMMON_SUBJECTS.find(s => s.value === composeSubjectType)?.label || '';

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q));
  }, [users, userSearchQuery]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/users-list?limit=200');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchMessages = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/building/messages');
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      
      const msgs: Message[] = (data.messages || data || []).map((m: any) => ({
        id: m.id,
        senderId: m.senderId || '',
        senderName: m.senderName || 'Unknown',
        recipientId: m.recipientId || '',
        recipientName: m.recipientName || 'Unknown',
        subject: m.subject || '',
        content: m.content || m.body || '',
        isMine: m.isMine ?? true,
        createdAt: m.createdAt || null,
      }));

      const grouped = new Map<string, Conversation>();
      for (const msg of msgs) {
        // FIXED: Changed 'm' to 'msg' to fix the scope error
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
      
      setConversations(convos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(); fetchUsers(); }, [fetchMessages, fetchUsers]);

  const handleComposeSend = async () => {
    if (!composeRecipient || !composeBody || !composeSubject) {
      alert("Recipient, Subject, and Body are required");
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/admin/building/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: composeRecipient,
          subject: composeSubject,
          body: composeBody,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send message');
      }

      setComposeOpen(false);
      setComposeRecipient("");
      setComposeSubjectType("");
      setComposeCustomSubject("");
      setComposeBody("");
      await fetchMessages();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSubjectChange = (value: string) => {
    setComposeSubjectType(value);
    if (value !== 'custom') {
      const template = MESSAGE_TEMPLATES[value];
      if (template) setComposeBody(template);
    }
  };

  const selectedConv = conversations.find(c => c.partnerId === selectedId);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/building/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedId,
          subject: selectedConv?.lastSubject || 'Follow-up',
          body: newMessage,
        }),
      });
      if (res.ok) {
        setNewMessage("");
        fetchMessages();
      }
    } finally {
      setSending(false);
    }
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400 mb-4" />
      <p className="text-xs font-black uppercase tracking-widest">{error}</p>
      <Button variant="link" onClick={fetchMessages}>Retry</Button>
    </div>
  );

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">System <span className="text-accent-brand">Messages</span></h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Direct communication & facility coordination</p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs h-9 px-4 hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4 mr-1.5" /> New Message
        </Button>
      </div>
      
      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <Card className="w-80 flex flex-col overflow-hidden rounded-xl border-border bg-card shadow-xs">
          <div className="p-3.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search conversations..." 
                className="pl-9 h-9 rounded-lg bg-muted/40 border-border text-xs focus-visible:ring-1 focus-visible:ring-primary/30" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
               <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading messages...</div>
            ) : conversations.length === 0 ? (
               <div className="p-8 text-center text-xs text-muted-foreground">No conversations found</div>
            ) : (
              conversations.map(conv => (
                <div 
                  key={conv.partnerId} 
                  onClick={() => setSelectedId(conv.partnerId)}
                  className={cn(
                    "p-3.5 cursor-pointer transition-colors border-b border-border/40 relative", 
                    selectedId === conv.partnerId ? "bg-muted/80 font-semibold" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <p className="text-xs font-semibold text-foreground truncate">{conv.partnerName}</p>
                    <span className="text-[11px] text-muted-foreground">{conv.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-normal">{conv.lastMessage}</p>
                </div>
              ))
            )}
          </ScrollArea>
        </Card>

        {/* CHAT AREA */}
        <Card className="flex-1 flex flex-col overflow-hidden rounded-xl border-border bg-card shadow-xs">
          {selectedConv ? (
            <>
              <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedConv.partnerName}</p>
                  <p className="text-xs text-muted-foreground font-medium">{selectedConv.lastSubject || 'General Conversation'}</p>
                </div>
              </div>

              <ScrollArea className="flex-1 p-5">
                <div className="space-y-4">
                  {selectedConv.messages.map(msg => (
                    <div key={msg.id} className={cn("flex flex-col", msg.isMine ? "items-end" : "items-start")}>
                      <div className={cn(
                        "max-w-[75%] px-4 py-2.5 rounded-xl text-xs font-normal leading-relaxed shadow-xs",
                        msg.isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border/50"
                      )}>
                        {msg.content}
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-1 px-1">{msg.createdAt ? formatTime(msg.createdAt) : ''}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-3.5 border-t border-border">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Type your message..." 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()} 
                    className="flex-1 h-9 rounded-lg bg-muted/30 border-border text-xs focus-visible:ring-1 focus-visible:ring-primary/30" 
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={!newMessage.trim() || sending} 
                    className="h-9 w-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 transition-transform active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Select a conversation</p>
              <p className="text-xs text-muted-foreground mt-1">Choose a contact from the sidebar to start messaging</p>
            </div>
          )}
        </Card>
      </div>

      {/* NEW MESSAGE DIALOG */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-card border-border shadow-xl p-6">
          <DialogHeader><DialogTitle className="text-lg font-bold text-foreground">New Message</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="compose-recipient" className="text-xs font-semibold text-foreground">Recipient</Label>
              <Select onValueChange={setComposeRecipient} value={composeRecipient}>
                <SelectTrigger id="compose-recipient" className="h-9 rounded-lg text-xs border-border bg-background"><SelectValue placeholder="Select Recipient User" /></SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-lg bg-card">
                  {users.map(u => (<SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-subject" className="text-xs font-semibold text-foreground">Subject</Label>
              <Select onValueChange={handleSubjectChange} value={composeSubjectType}>
                <SelectTrigger id="compose-subject" className="h-9 rounded-lg text-xs border-border bg-background"><SelectValue placeholder="Select Message Category..." /></SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-lg bg-card">
                  {COMMON_SUBJECTS.map(s => (<SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
              {composeSubjectType === 'custom' && (
                <Input
                  aria-label="Custom subject"
                  placeholder="Enter custom subject..."
                  value={composeCustomSubject}
                  onChange={e => setComposeCustomSubject(e.target.value)}
                  className="h-9 rounded-lg text-xs bg-background border-border mt-2"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-body" className="text-xs font-semibold text-foreground">Body</Label>
              <Textarea
                id="compose-body"
                rows={4}
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                className="rounded-lg resize-none text-xs p-3 bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setComposeOpen(false)} disabled={sending} className="text-xs font-semibold text-muted-foreground h-9 px-4">Cancel</Button>
            <Button onClick={handleComposeSend} disabled={sending} className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs px-5 h-9 hover:bg-primary/90 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
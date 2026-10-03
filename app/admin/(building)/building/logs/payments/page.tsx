'use client'

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Download, Plus, Search, TrendingUp, AlertCircle,
  CreditCard, Receipt, Wallet, Banknote, Loader2, Clock
} from "lucide-react";
import { StatsCard } from "@/components/admin/dashboard/StatsCard";
import { useBuildingPayments } from "@/hooks/admin/building";
import { cn } from "@/lib/utils";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/enum-labels";

// A 'pending' payment whose link expired — checkout now refuses it (410), but
// nothing else surfaces it, so admins need a way to see which bookings are stuck.
const isExpiredLink = (t: { paymentStatus: string; expiresAt: string | null }): boolean =>
  t.paymentStatus === "pending" && !!t.expiresAt && new Date(t.expiresAt) < new Date();

export default function PaymentLogsPage() {
  const { transactions, loading, search, setSearch, refresh } = useBuildingPayments();
  const [statusFilter, setStatusFilter] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [form, setForm] = useState({
    bookingRef: "",
    amount: "",
    paymentMethod: "Cash",
  });

  // Filter transactions
  const filtered = transactions.filter(t => {
    const searchStr = search.toLowerCase();
    const matchSearch = (t.userName?.toLowerCase() || "").includes(searchStr) ||
      (t.bookingReference?.toLowerCase() || "").includes(searchStr);
    const matchStatus = !statusFilter
      || (statusFilter === "expired_link" ? isExpiredLink(t) : t.paymentStatus === statusFilter);
    return matchSearch && matchStatus;
  });

  const handleAdd = async () => {
    if (!form.bookingRef || !form.amount || !form.paymentMethod) {
      alert("Booking Reference, Amount, and Method are required");
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/building/logs/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef: form.bookingRef,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          paymentStatus: 'completed',
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      setForm({ bookingRef: "", amount: "", paymentMethod: "Cash" });
      setAddDialogOpen(false);
      refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const displayStatus = paymentStatusLabel(status);
    const configs: Record<string, string> = {
      "Completed": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      "Failed": "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      "Refunded": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
    return (
      <Badge className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border-0 shadow-none", configs[displayStatus])}>
        {displayStatus}
      </Badge>
    );
  };

  // Calculate stats
  const totalRevenue = transactions
    .filter(t => t.paymentStatus === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const stats = [
    {
      title: "Total Revenue",
      value: `₱${totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      variant: "success" as const
    },
    { title: "Total Logs", value: transactions.length.toString(), icon: Receipt, variant: "primary" as const },
    { title: "Failed", value: transactions.filter(t => t.paymentStatus === "failed").length.toString(), icon: AlertCircle, variant: "destructive" as const },
    { title: "Refunded", value: transactions.filter(t => t.paymentStatus === "refunded").length.toString(), icon: Wallet, variant: "warning" as const },
    { title: "Expired Links", value: transactions.filter(isExpiredLink).length.toString(), icon: Clock, variant: "warning" as const },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Financial <span className="text-accent-brand">Audit</span></h1>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            Transactional monitoring for STI College Lucena
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddDialogOpen(true)} className="rounded-xl font-semibold text-xs h-9 bg-card border-border hover:bg-accent hover:text-accent-foreground gap-1.5">
            <Plus className="w-4 h-4" /> Log Payment
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold text-xs h-9 px-4 gap-1.5 shadow-xs">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => <StatsCard key={s.title} {...s} />)}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by client or reference..."
            aria-label="Search by client or reference"
            className="pl-9 h-9 rounded-lg bg-card border-border font-medium text-xs shadow-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 rounded-lg bg-card border-border font-medium text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card shadow-lg">
            <SelectItem value="all" className="text-xs">All Entries</SelectItem>
            <SelectItem value="paid" className="text-xs">Paid</SelectItem>
            <SelectItem value="failed" className="text-xs">Failed</SelectItem>
            <SelectItem value="refunded" className="text-xs">Refunded</SelectItem>
            <SelectItem value="expired_link" className="text-xs">Expired Link</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40">
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground px-6 h-12">TXN ID</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Client / Reference</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Facility</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-center">Amount</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Method</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length > 0 ? (
                filtered.map(t => (
                  <TableRow key={t.id} className="border-border/40 hover:bg-muted/30 transition-colors group">
                    <TableCell className="px-6 py-4 font-mono text-xs text-muted-foreground">{t.id}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                          <span className="font-semibold text-xs text-foreground">{t.userName || 'N/A'}</span>
                          <span className="text-xs font-medium text-muted-foreground">{t.bookingReference}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">{t.facilityName || 'N/A'}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-xs text-foreground">₱{t.amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                          <Banknote size={14} className="text-primary" /> {paymentMethodLabel(t.paymentMethod)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isExpiredLink(t) ? (
                        <Badge className="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border-0 shadow-none bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Expired Link
                        </Badge>
                      ) : statusBadge(t.paymentStatus)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-xs font-medium text-muted-foreground italic">
                    No transactions found matching criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl p-6 bg-card border-border shadow-lg max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Log New Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1">
               <Label htmlFor="payment-booking-ref" className="text-xs font-semibold text-foreground">Booking Reference</Label>
               <Input id="payment-booking-ref" value={form.bookingRef} onChange={e => setForm({...form, bookingRef: e.target.value})} className="h-9 rounded-lg bg-card border-border font-medium text-xs" placeholder="BK-2026-000" disabled={formLoading} />
            </div>
            <div className="space-y-1">
               <Label htmlFor="payment-amount" className="text-xs font-semibold text-foreground">Amount (₱)</Label>
               <Input id="payment-amount" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="h-9 rounded-lg bg-card border-border font-medium text-xs" disabled={formLoading} />
            </div>
            <div className="space-y-1">
               <Label htmlFor="payment-method" className="text-xs font-semibold text-foreground">Payment Method</Label>
               <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v})} disabled={formLoading}>
                 <SelectTrigger id="payment-method" className="h-9 rounded-lg bg-card border-border font-medium text-xs"><SelectValue /></SelectTrigger>
                 <SelectContent className="rounded-xl border-border bg-card">
                   <SelectItem value="Cash" className="text-xs">Cash</SelectItem>
                   <SelectItem value="GCash" className="text-xs">GCash</SelectItem>
                   <SelectItem value="Bank Transfer" className="text-xs">Bank Transfer</SelectItem>
                 </SelectContent>
               </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={formLoading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-xl font-semibold text-xs shadow-xs gap-1.5">
              {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Commit Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
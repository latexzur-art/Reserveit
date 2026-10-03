import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TimeSlotPicker } from "@/components/ui/TimeSlotPicker";

interface BlockedRange {
  start: string;
  end: string;
  reason?: string;
}

interface ReservationFormProps {
  type: "gym" | "facility";
  form: any;
  setForm: (val: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  facilities: any[];
  blockedRanges?: BlockedRange[];
}

export const ReservationForm = ({ type, form, setForm, onSubmit, onCancel, facilities, blockedRanges }: ReservationFormProps) => {
  if (type === "gym") {
    const rentalRate = form.period === "AM" ? 580 : 780;
    const hours = Number(form.hours) || 0;
    const rentalFee = rentalRate * hours;
    const soundFee = form.useSoundSystem ? 1500 : 0;
    const ledFee = form.useLED ? 2500 : 0;
    const total = rentalFee + soundFee + ledFee;

    return (
      <div className="space-y-10">
        <section>
          <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-foreground">Renter Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Organization/Company</Label><Input value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} /></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Contact Number</Label><Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-black uppercase">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-black uppercase">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-foreground">Rental Details</h2>
          <div className="space-y-6">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Purpose of Rental/Event</Label><Textarea value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} /></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Event/Activity Name *</Label><Input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Date Requested *</Label><Input type="date" value={form.dateRequested} onChange={e => setForm({ ...form, dateRequested: e.target.value })} /></div>
              <div className="space-y-2">
                <TimeSlotPicker
                  label="Start Time"
                  value={form.timeStart}
                  onChange={(t) => setForm({ ...form, timeStart: t })}
                  blockedRanges={blockedRanges}
                />
              </div>
              <div className="space-y-2">
                <TimeSlotPicker
                  label="End Time"
                  value={form.timeEnd}
                  onChange={(t) => setForm({ ...form, timeEnd: t })}
                  minTime={form.timeStart}
                  blockedRanges={blockedRanges}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Expected Number of Attendees</Label><Input type="number" value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })} /></div>
              <div className="flex items-center gap-3 pt-8">
                <Switch checked={form.isRecurring} onCheckedChange={v => setForm({ ...form, isRecurring: v })} />
                <Label className="text-[10px] font-black uppercase">Is this a recurring event?</Label>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-foreground">Brought-in Equipment & Personnel</h2>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Equipment/Materials to be brought in</Label><Textarea value={form.broughtEquipment} onChange={e => setForm({ ...form, broughtEquipment: e.target.value })} /></div>
            <div className="flex items-center gap-3">
              <Switch checked={form.needPersonnel} onCheckedChange={v => setForm({ ...form, needPersonnel: v })} />
              <Label className="text-[10px] font-black uppercase">Require additional facility personnel?</Label>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground italic leading-relaxed">
              Note: Use of electrical equipment (e.g. sound systems, lighting) may incur additional fees. ₱1,500 per sound system and ₱2,500 for LED lights. Additional personnel requests are subject to availability.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-foreground">Fees and Charges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Period</Label>
                <Select value={form.period} onValueChange={v => setForm({ ...form, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM (₱580/hr)</SelectItem>
                    <SelectItem value="PM">PM (₱780/hr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Hour(s)</Label>
                <Input type="number" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} />
              </div>
            </div>

            <Card className="p-6 bg-muted/30 border-dashed space-y-3">
              <div className="flex justify-between text-[11px] font-bold uppercase"><span>Rental Fee ({form.period} ₱{rentalRate}/hr × {hours}hrs)</span><span>₱{rentalFee.toLocaleString()}</span></div>
              <div className="flex justify-between text-[11px] font-bold uppercase items-center">
                <div className="flex items-center gap-2"><Checkbox checked={form.useSoundSystem} onCheckedChange={v => setForm({ ...form, useSoundSystem: v })} /> <span>Sound System</span></div>
                <span>₱{soundFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold uppercase items-center">
                <div className="flex items-center gap-2"><Checkbox checked={form.useLED} onCheckedChange={v => setForm({ ...form, useLED: v })} /> <span>LED Lights</span></div>
                <span>₱{ledFee.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-black text-[#0072bc]"><span>TOTAL</span><span>₱{total.toLocaleString()}</span></div>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-foreground">Terms and Conditions</h2>
          <ul className="text-[10px] font-bold text-muted-foreground uppercase space-y-2 list-disc pl-4">
            <li>The applicant is responsible for damage to the facility or equipment.</li>
            <li>The facility must be cleaned and returned to its original condition after use.</li>
            <li>Use of unauthorized areas is prohibited.</li>
            <li>Cancellation must be communicated at least two (2) days in advance for a refund.</li>
          </ul>
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
            <Checkbox checked={form.agreeTerms} onCheckedChange={v => setForm({ ...form, agreeTerms: v })} className="mt-1" />
            <Label className="text-[10px] font-black uppercase leading-normal">I agree to abide by the terms and conditions and confirm all information is accurate. *</Label>
          </div>
        </section>

        <div className="flex gap-4 pt-6">
          <Button onClick={onSubmit} disabled={!form.agreeTerms} className="flex-1 h-14 bg-[#0072bc] hover:bg-[#005fa3] text-white font-black uppercase rounded-2xl">Submit Reservation</Button>
          <Button onClick={onCancel} variant="outline" className="flex-1 h-14 font-black uppercase rounded-2xl border-2">Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-foreground">Requester Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Official Email *</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Date of Request</Label><Input type="date" value={form.dateOfRequest} onChange={e => setForm({ ...form, dateOfRequest: e.target.value })} className="font-bold" /></div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-foreground">Event/Activity Information</h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase">Purpose *</Label>
            <Select value={form.purpose} onValueChange={v => setForm({ ...form, purpose: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="make-up-class">Make-up Class</SelectItem>
                <SelectItem value="seminar">Seminar</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Event/Activity Name</Label><Input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Date of Event *</Label><Input type="date" value={form.dateOfEvent} onChange={e => setForm({ ...form, dateOfEvent: e.target.value })} /></div>
            <div className="space-y-2">
              <TimeSlotPicker
                label="Start Time"
                value={form.timeStart}
                onChange={(t) => setForm({ ...form, timeStart: t })}
                blockedRanges={blockedRanges}
              />
            </div>
            <div className="space-y-2">
              <TimeSlotPicker
                label="End Time"
                value={form.timeEnd}
                onChange={(t) => setForm({ ...form, timeEnd: t })}
                minTime={form.timeStart}
                blockedRanges={blockedRanges}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Number of Attendees</Label><Input type="number" value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })} /></div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Room No. / Facility *</Label>
              <Input value={form.facility} readOnly className="bg-muted font-bold" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-foreground">Equipment/Setups Needed</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2"><Label className="text-[10px] font-black uppercase">Items</Label><Input value={form.equipmentNeeded} onChange={e => setForm({ ...form, equipmentNeeded: e.target.value })} /></div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Quantity</Label><Input type="number" value={form.equipmentQty} onChange={e => setForm({ ...form, equipmentQty: e.target.value })} /></div>
        </div>
      </section>

      <div className="flex gap-4 pt-6">
        <Button onClick={onSubmit} className="flex-1 h-14 bg-[#0072bc] hover:bg-[#005fa3] text-white font-black uppercase rounded-2xl">Submit Request</Button>
        <Button onClick={onCancel} variant="outline" className="flex-1 h-14 font-black uppercase rounded-2xl border-2">Cancel</Button>
      </div>
    </div>
  );
};
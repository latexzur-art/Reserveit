import { Facility, Booking, ClassSchedule, MaintenanceRecord } from "@/lib/data-store";

interface MergedActivity {
  id: string;
  title: string;
  subtitle?: string;
  startTime: string;
  endTime: string;
  date: string;
  type: 'class' | 'booking' | 'maintenance' | 'hold';
  status?: string;
}

interface UseAvailabilityGridParams {
  bookings: Booking[];
  classSchedules: ClassSchedule[];
  maintenance: MaintenanceRecord[];
}

export function getMergedActivity(
  room: Facility,
  targetDate: string,
  { bookings, classSchedules, maintenance }: UseAvailabilityGridParams
): MergedActivity[] {
  const activities: MergedActivity[] = [];

  const dayOfWeek = new Date(targetDate).getDay();
  const classes = (classSchedules || []).filter(c =>
    c.facilityId === room.id &&
    c.dayOfWeek === dayOfWeek &&
    targetDate >= c.effectiveStartDate &&
    targetDate <= c.effectiveEndDate
  );
  classes.forEach(c => activities.push({
    id: `class-${c.id}`,
    title: c.courseName,
    subtitle: `${c.courseCode} • ${c.section}`,
    startTime: c.startTime,
    endTime: c.endTime,
    date: targetDate,
    type: 'class'
  }));

  const roomBookings = (bookings || []).filter(b =>
    b.facility === room.roomNumber &&
    b.date === targetDate &&
    (b.status === "approved" || b.status === "auto_approved")
  );
  roomBookings.forEach(b => activities.push({
    id: `book-${b.id}`,
    title: b.purpose,
    subtitle: b.requester,
    startTime: b.startTime,
    endTime: b.endTime,
    date: targetDate,
    type: 'booking',
    status: b.status
  }));

  const roomMaint = (maintenance || []).filter(m =>
    m.item === room.roomNumber &&
    m.scheduleDate === targetDate &&
    m.status !== "Completed"
  );
  roomMaint.forEach(m => activities.push({
    id: `maint-${m.id}`,
    title: "Maintenance",
    subtitle: m.technician || "Staff",
    startTime: "08:00",
    endTime: "17:00",
    date: targetDate,
    type: 'maintenance'
  }));

  if (room.status?.toLowerCase() === "occupied") {
    activities.push({
      id: `hold-${room.id}`,
      title: "Manual Hold",
      subtitle: "Admin Block",
      startTime: "00:00",
      endTime: "23:59",
      date: targetDate,
      type: 'hold'
    });
  } else if (room.status?.toLowerCase() === "maintenance" && roomMaint.length === 0) {
    activities.push({
      id: `hold-${room.id}`,
      title: "Facility Maintenance",
      subtitle: "Admin Block",
      startTime: "00:00",
      endTime: "23:59",
      date: targetDate,
      type: 'maintenance'
    });
  }

  return activities.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export type { MergedActivity };

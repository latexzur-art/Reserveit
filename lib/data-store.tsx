'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Initialize the Supabase client
const supabase = createClient();

// ─── CONSTANTS ───
export const FLOORS = [
  { label: "1st Floor", value: "1st Floor" },
  { label: "Mezzanine", value: "Mezzanine" },
  { label: "2nd Floor", value: "2nd Floor" },
  { label: "3rd Floor", value: "3rd Floor" },
  { label: "4th Floor", value: "4th Floor" },
  { label: "5th Floor", value: "5th Floor" },
];

// ─── TYPES ───
export interface Facility {
  id: string;
  roomNumber: string;
  name: string;
  type: string;
  floor: string;
  capacity: number;
  status: "Available" | "Occupied" | "Maintenance" | string; 
  equipment: string[];
  amenities: string[];
  restrictionNote?: string;
  deleted?: boolean;
  area?: number;
}

export interface Booking {
  id: string;
  requester: string;
  facility: string; 
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: "approved" | "declined" | "completed" | "cancelled" | "pending_admin" | "pending" | "auto_approved" | "flagged" | "pending_faculty_response";
  payment_status?: "pending" | "processing" | "completed" | "failed" | "cancelled";
  type: "internal" | "external";
  source: string;
  booking_course_code?: string | null;
  course_name?: string | null;
  is_elective?: boolean;
  elective_type?: string | null;
}

export interface ClassSchedule {
  id: string;
  courseCode: string;
  courseName: string;
  section: string;
  instructorName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  facilityId: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
}

export interface EquipmentItem {
  id: number;
  name: string;
  category: string;
  status: "Available" | "In-use" | "Maintenance" | "Discarded" | string;
  quantity: number;
  location: string;
  lastMaintenance: string;
  assignedRoom?: string;
  deleted?: boolean;
}

export interface MaintenanceRecord {
  id: number;
  type: "Facility" | "Equipment";
  item: string;
  scheduleDate: string;
  completedDate?: string;
  technician?: string;
  status: "Scheduled" | "In-progress" | "Completed" | string;
  deleted?: boolean;
}

export interface Transaction {
  id: string;
  bookingRef: string;
  client: string;
  facility: string;
  amount: number;
  date: string;
  method: string;
  status: "Paid" | "Failed" | "Refunded";
}

export interface CalendarEvent {
  id: string | number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "approved" | "occupied" | "maintenance" | "class"; 
  facility?: string;
}

// ─── DB → UI NORMALIZERS ───
const FACILITY_TYPE_MAP: Record<string, string> = {
  classroom: "Classroom",
  computer_lab: "Laboratory",
  science_lab: "Laboratory",
  multipurpose_hall: "Multi-Purpose Hall",
  auditorium: "Multi-Purpose Hall",
  gym: "Gymnasium",
  library_room: "Library",
  studio: "Specialty",
  outdoor_area: "Specialty",
  conference_room: "Conference Room",
};

const normalizeFacilityType = (raw: string): string =>
  FACILITY_TYPE_MAP[raw?.toLowerCase?.() ?? ""] ?? raw ?? "Classroom";

const normalizeFacilityStatus = (raw: string): "Available" | "Occupied" | "Maintenance" => {
  const lower = raw?.toLowerCase?.() ?? "";
  if (lower === "available") return "Available";
  if (lower === "maintenance") return "Maintenance";
  return "Occupied";
};

// ─── THE 49-FACILITY GENERATOR (FALLBACK DATA) ───
const buildInitialFacilities = (): Facility[] => {
  const rooms: Facility[] = [];
  let id = 1;

  rooms.push({ id: String(id++), roomNumber: "104", name: "Room 104 - Laboratory", type: "Laboratory", floor: "1st Floor", capacity: 53, status: "Available", equipment: ["Desktop Computers"], amenities: ["AC"] });
  rooms.push({ id: String(id++), roomNumber: "MPH 1", name: "Multi-Purpose Hall 1", type: "Multi-Purpose Hall", floor: "1st Floor", capacity: 80, status: "Available", equipment: ["Projector", "PA System"], amenities: ["Stage"] });
  rooms.push({ id: String(id++), roomNumber: "GYM", name: "STI Gymnasium", type: "Gymnasium", floor: "1st Floor", capacity: 200, status: "Available", equipment: ["Basketball Net"], amenities: ["Bleachers"] });
  rooms.push({ id: String(id++), roomNumber: "M01", name: "MPH 2", type: "Multi-Purpose Hall", floor: "Mezzanine", capacity: 100, status: "Available", equipment: ["Projector"], amenities: ["AC"], area: 105.48 });

  const secondFloorNums = ["201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "212", "214"];
  secondFloorNums.forEach(num => {
    const cap = (parseInt(num) >= 209 && parseInt(num) <= 212) ? 48 : num === "214" ? 50 : 40;
    rooms.push({ id: String(id++), roomNumber: num, name: `Room ${num}`, type: "Classroom", floor: "2nd Floor", capacity: cap, status: "Available", equipment: ["Whiteboard"], amenities: ["AC"] });
  });

  const thirdFloorData = [
    { num: "301", name: "Room 301 - Physics Laboratory", type: "Laboratory", cap: 40 },
    { num: "302", name: "Room 302 - Chemistry Laboratory", type: "Laboratory", cap: 40 },
    { num: "303", name: "Room 303 - Laboratory", type: "Laboratory", cap: 41 },
    { num: "304", name: "Room 304 - Laboratory", type: "Laboratory", cap: 50 },
    { num: "305", name: "Room 305", type: "Classroom", cap: 50 },
    { num: "306", name: "Room 306 - Hotel Suite", type: "Specialty", cap: 40 },
    { num: "307", name: "Room 307 - Bar and Dining", type: "Specialty", cap: 30 },
    { num: "308", name: "Room 308 - Laboratory", type: "Laboratory", cap: 47 },
    { num: "309", name: "Room 309 - Laboratory", type: "Laboratory", cap: 45 },
    { num: "310", name: "Room 310", type: "Classroom", cap: 40 },
    { num: "311", name: "Room 311 - Hotel Reception", type: "Specialty", cap: 40 },
  ];
  thirdFloorData.forEach(r => {
    rooms.push({ id: String(id++), roomNumber: r.num, name: r.name, type: r.type, floor: "3rd Floor", capacity: r.cap, status: "Available", equipment: ["Projector"], amenities: ["AC"] });
  });

  const fourthFloorData = [
    { num: "401", name: "Room 401 - Photography", type: "Specialty", cap: 40 },
    { num: "402", name: "Room 402 - Broadcasting", type: "Specialty", cap: 40 },
    { num: "403", name: "Room 403", type: "Classroom", cap: 40 },
    { num: "404", name: "Room 404", type: "Classroom", cap: 40 },
    { num: "405", name: "Room 405", type: "Classroom", cap: 40 },
    { num: "406", name: "Room 406", type: "Classroom", cap: 40 },
    { num: "407", name: "Room 407", type: "Classroom", cap: 40 },
    { num: "LIB", name: "Library", type: "Library", cap: 100 },
  ];
  fourthFloorData.forEach(r => {
    rooms.push({ id: String(id++), roomNumber: r.num, name: r.name, type: r.type, floor: "4th Floor", capacity: r.cap, status: "Available", equipment: ["Whiteboard"], amenities: ["AC"] });
  });

  for (let i = 501; i <= 512; i++) {
    const cap = (i >= 507 && i <= 510) ? 50 : i >= 511 ? 30 : 40;
    rooms.push({ id: String(id++), roomNumber: String(i), name: `Room ${i}`, type: "Classroom", floor: "5th Floor", capacity: cap, status: "Available", equipment: ["Whiteboard"], amenities: ["AC"] });
  }
  rooms.push({ id: String(id++), roomNumber: "MPH 3", name: "Multi-Purpose Hall 3", type: "Multi-Purpose Hall", floor: "5th Floor", capacity: 100, status: "Available", equipment: ["Projector"], amenities: ["AC"] });

  return rooms; 
};

// ─── CONTEXT INTERFACE ───
interface DataStore {
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  availableFloors: string[];
  setAvailableFloors: React.Dispatch<React.SetStateAction<string[]>>;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  equipment: EquipmentItem[];
  setEquipment: React.Dispatch<React.SetStateAction<EquipmentItem[]>>;
  deletedEquipment: EquipmentItem[];
  setDeletedEquipment: React.Dispatch<React.SetStateAction<EquipmentItem[]>>;
  maintenance: MaintenanceRecord[];
  setMaintenance: React.Dispatch<React.SetStateAction<MaintenanceRecord[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  classSchedules: ClassSchedule[];
  setClassSchedules: React.Dispatch<React.SetStateAction<ClassSchedule[]>>;
  syncWithSupabase: () => Promise<void>;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => Promise<void>;
  generateRoomNumber: (floor: string) => string;
  loading: boolean;
}

const DataContext = createContext<DataStore | null>(null);

export const useDataStore = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataStore must be used within DataProvider");
  return ctx;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [availableFloors, setAvailableFloors] = useState<string[]>(FLOORS.map(f => f.value));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [deletedEquipment, setDeletedEquipment] = useState<EquipmentItem[]>([]);
  const [maintenanceRecords, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [classSchedules, setClassSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const syncWithSupabase = useCallback(async () => {
    setLoading(true);
    try {
      const { data: eqData } = await supabase.from('equipment').select('*').eq('is_active', true);
      if (eqData) setEquipment(eqData as EquipmentItem[]);

      const { data: facData, error: facError } = await supabase
        .from('facilities')
        .select(`
          *,
          floors ( name ),
          facility_types ( name ),
          facility_amenity_map (
            amenity:facility_amenities ( name )
          )
        `)
        .eq('is_active', true)
        .order('room_number', { ascending: true });

      if (facError) throw facError;

      if (facData && facData.length > 0) {
        const mappedFacilities: Facility[] = facData.map((f: any) => {
          const dbMapAmenities = (f.facility_amenity_map || [])
            .map((m: any) => m.amenity?.name)
            .filter(Boolean);
          const assignedEq = (eqData || [])
            .filter((e: any) => e.assigned_facility_id === f.id || e.facility_id === f.id)
            .map((e: any) => e.equipment_name || e.name)
            .filter(Boolean);

          const amenitiesList = Array.from(new Set([...(f.amenities || []), ...dbMapAmenities]));
          const equipmentList = Array.from(new Set([...(f.equipment || []), ...assignedEq]));

          return {
            id: f.id,
            roomNumber: f.room_number || f.roomNumber,
            name: f.name,
            type: normalizeFacilityType(f.facility_types?.name || f.type || "classroom"),
            floor: f.floors?.name || f.floor || "1st Floor",
            capacity: f.capacity,
            status: normalizeFacilityStatus(f.status),
            equipment: equipmentList,
            amenities: amenitiesList,
            restrictionNote: f.restriction_note || f.restrictionNote,
            deleted: f.deleted,
            area: f.area
          };
        });
        
        setFacilities(mappedFacilities);
        const uniqueFloors = Array.from(new Set(mappedFacilities.map((f) => f.floor))) as string[];
        if (uniqueFloors.length > 0) setAvailableFloors(uniqueFloors);
      } else {
        setFacilities(buildInitialFacilities());
      }

      const { data: bookData } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
      const rawBookings = (bookData as any[]) || [];

      const courseCodes = [...new Set(
        rawBookings.filter(b => b.booking_course_code).map(b => `${b.booking_department_code}:${b.booking_course_code}`)
      )];
      const courseInfoMap = new Map<string, { course_name: string; is_elective: boolean; elective_type: string | null }>();
      if (courseCodes.length > 0) {
        const { data: courses } = await supabase
          .from('courses')
          .select('course_code, department_code, course_name, is_elective, elective_type');
        for (const c of courses ?? []) {
          courseInfoMap.set(`${c.department_code}:${c.course_code}`, {
            course_name: c.course_name,
            is_elective: c.is_elective,
            elective_type: c.elective_type,
          });
        }
      }

      const currentBookings: Booking[] = rawBookings.map(b => {
        const courseInfo = b.booking_course_code
          ? courseInfoMap.get(`${b.booking_department_code}:${b.booking_course_code}`)
          : undefined;
        return {
          ...b,
          // Map current_status (DB column) to status (UI interface)
          status: b.current_status || b.status,
          course_name: courseInfo?.course_name ?? null,
          is_elective: courseInfo?.is_elective ?? false,
          elective_type: courseInfo?.elective_type ?? null,
        };
      });
      setBookings(currentBookings);

      const { data: txnData } = await supabase.from('transactions').select('*');
      if (txnData) setTransactions(txnData as Transaction[]);

      const { data: maintData } = await supabase.from('maintenance_records').select('*').eq('is_active', true).order('schedule_date', { ascending: true });
      if (maintData) setMaintenance(maintData as MaintenanceRecord[]);

      const { data: schedData } = await supabase.from('class_schedules').select('*').eq('is_active', true);
      
      let currentSchedules: ClassSchedule[] = [];
      if (schedData) {
        currentSchedules = schedData.map((s: any) => ({
          id: s.id,
          courseCode: s.course_code,
          courseName: s.course_name,
          section: s.section,
          instructorName: s.instructor_name,
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime: s.end_time,
          facilityId: s.facility_id,
          effectiveStartDate: s.effective_start_date,
          effectiveEndDate: s.effective_end_date
        }));
        setClassSchedules(currentSchedules);
      }

      // Generate Calendar Events
      const events: CalendarEvent[] = [];
      currentBookings.forEach(b => {
        if (['approved', 'auto_approved', 'pending', 'flagged'].includes(b.status)) {
          events.push({
            id: b.id,
            title: `${b.facilityName} - ${b.requester}`,
            date: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            type: b.status.includes('approved') ? 'approved' : 'occupied',
            facility: b.facility
          });
        }
      });

      currentSchedules.forEach(s => {
        events.push({
          id: `class-${s.id}`,
          title: `${s.courseCode} - ${s.section}`,
          date: new Date().toISOString().split('T')[0],
          startTime: s.startTime,
          endTime: s.endTime,
          type: 'class',
          facility: String(s.facilityId)
        });
      });

      if (maintData) {
        (maintData as MaintenanceRecord[]).forEach(m => {
          events.push({
            id: `maint-${m.id}`,
            title: `Maint: ${m.item}`,
            date: m.scheduleDate,
            startTime: "08:00",
            endTime: "17:00",
            type: 'maintenance',
          });
        });
      }
      setCalendarEvents(events);

    } catch (err: any) {
      console.error("Master Sync Error:", err.message || err);
      setFacilities(buildInitialFacilities());
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status, current_status: status })
        .eq('id', bookingId);
      
      if (error) throw error;
      await syncWithSupabase();
    } catch (err) {
      console.error("Failed to update booking status:", err);
      throw err;
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('global-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, () => syncWithSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => syncWithSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_records' }, () => syncWithSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_schedules' }, () => syncWithSupabase())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncWithSupabase]);

  useEffect(() => {
    syncWithSupabase();
  }, [syncWithSupabase]);
  
  const generateRoomNumber = useCallback((floor: string): string => {
    if (floor === "Mezzanine") return `M0${facilities.filter(f => f.floor === "Mezzanine").length + 1}`;
    const floorPrefixes: Record<string, number> = { "1st Floor": 104, "2nd Floor": 200, "3rd Floor": 300, "4th Floor": 400, "5th Floor": 500 };
    const prefix = floorPrefixes[floor] || 0;
    const existingNums = facilities
      .filter(f => !f.deleted && f.floor === floor)
      .map(f => parseInt(f.roomNumber))
      .filter(n => !isNaN(n));
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : prefix;
    return String(maxNum + 1);
  }, [facilities]);

  return (
    <DataContext.Provider value={{
      facilities, setFacilities,
      availableFloors, setAvailableFloors,
      bookings, setBookings,
      equipment, setEquipment,
      deletedEquipment, setDeletedEquipment,
      maintenance: maintenanceRecords, setMaintenance,
      transactions, setTransactions,
      calendarEvents, setCalendarEvents,
      classSchedules, setClassSchedules,
      syncWithSupabase,
      updateBookingStatus,
      generateRoomNumber,
      loading
    }}>
      {children}
    </DataContext.Provider>
  );
};
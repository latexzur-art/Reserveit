export const BOOKING_PURPOSES = [
  { value: 'academic', label: 'Academic / Class' },
  { value: 'school_event', label: 'School Event' },
  { value: 'department_use', label: 'Department Use' },
  { value: 'personal', label: 'Personal' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'community', label: 'Community' },
]

export const JUSTIFICATIONS = [
  { value: '', label: '— Select a reason (optional) —' },
  { value: 'makeup_class', label: 'Make-up Class', purpose: 'Make-up class session' },
  { value: 'lab_activity', label: 'Lab Activity / Practical Exam', purpose: 'Laboratory activity or practical examination' },
  { value: 'faculty_meeting', label: 'Faculty / Department Meeting', purpose: 'Faculty or department meeting' },
  { value: 'student_consultation', label: 'Student Consultation', purpose: 'Student consultation or advising session' },
  { value: 'thesis_defense', label: 'Thesis / Capstone Defense', purpose: 'Thesis or capstone project defense' },
  { value: 'review_session', label: 'Review / Tutorial Session', purpose: 'Review or tutorial session for students' },
  { value: 'research_activity', label: 'Research Activity', purpose: 'Research-related activity' },
  { value: 'org_event', label: 'Student Organization Event', purpose: 'Student organization event or activity' },
  { value: 'seminar_workshop', label: 'Seminar / Workshop', purpose: 'Seminar or workshop session' },
  { value: 'other', label: 'Other (describe below)', purpose: '' },
]

export const MISMATCH_REASONS = [
  { value: '', label: '— Select a reason —' },
  { value: 'No available room in home department', label: 'No available room in home department' },
  { value: 'Requires specialized equipment in this facility', label: 'Requires specialized equipment in this facility' },
  { value: 'Cross-department collaboration or joint class', label: 'Cross-department collaboration or joint class' },
  { value: 'Lab or practical exam requirement', label: 'Lab or practical exam requirement' },
  { value: 'Faculty exchange or guest lecture', label: 'Faculty exchange or guest lecture' },
  { value: 'Event or seminar requiring this venue', label: 'Event or seminar requiring this venue' },
  { value: 'other', label: 'Other (type below)' },
]

export const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  auto_approved: { label: 'Approved', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' },
  flagged: { label: 'Pending Admin Review', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' },
  approved: { label: 'Approved', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' },
  routed_to_manual: { label: 'Pending Manual Review', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  still_processing: { label: 'Still Processing', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
}

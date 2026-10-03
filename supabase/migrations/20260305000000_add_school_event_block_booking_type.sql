-- Add dedicated booking_type for school events managed by academic head
-- This distinguishes management-page school events from regular bookings
-- that happen to have booking_purpose = 'school_event'
ALTER TYPE booking_type ADD VALUE IF NOT EXISTS 'school_event_block';

-- Seed emergency settings into system_settings table
-- These are configurable by the building admin via the Emergency Settings panel

INSERT INTO public.system_settings (key, value, category, description)
VALUES
  (
    'emergency_helpdesk_phone',
    '"(043) 123-4567"',
    'emergency',
    'Helpdesk contact number shown to users who decline an emergency reschedule'
  ),
  (
    'emergency_reschedule_message_template',
    '"Due to an emergency situation (e.g., typhoon signal, safety concern), we are unable to proceed with your booking on the original schedule. We propose a reschedule to a new date and time. Please review and respond at your earliest convenience."',
    'emergency',
    'Default message for emergency reschedule proposals sent to users'
  ),
  (
    'emergency_decline_response_template',
    '"We understand your decision. Please contact our helpdesk at the number below to discuss further options, including cancellation with refund or an alternative arrangement."',
    'emergency',
    'Message sent to user after they decline an emergency reschedule proposal'
  ),
  (
    'emergency_cancel_message_template',
    '"We sincerely apologize for the inconvenience. Your booking has been cancelled due to a force majeure event. A full refund will be processed and our team will contact you."',
    'emergency',
    'Message sent to user when admin processes a refund cancellation'
  )
ON CONFLICT (key) DO NOTHING;

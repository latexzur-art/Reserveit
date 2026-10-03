-- Add notification_email column to users table.
-- This is the external email address (e.g. Gmail) where booking notifications
-- and password reset emails are delivered. Separate from the Entra sign-in email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email TEXT;

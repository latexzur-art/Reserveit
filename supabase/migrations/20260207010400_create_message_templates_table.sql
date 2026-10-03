-- Create message templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Lightbulb',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  default_audience TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages templates"
  ON public.message_templates FOR ALL
  USING (auth.role() = 'service_role');

-- Seed system templates
INSERT INTO public.message_templates (name, icon, subject, body, is_system) VALUES
  ('Welcome Message', 'UserPlus', 'Welcome to ReserveIT!', 'Dear [User Name],

Welcome to ReserveIT! Your account has been created successfully.

You can now access the system using your STI Microsoft 365 credentials. Please log in at your earliest convenience to verify your account details.

If you have any questions, please contact the IT department.

Best regards,
ReserveIT Administration', true),
  ('Account Deactivation', 'UserX', 'Your ReserveIT Account Has Been Deactivated', 'Dear [User Name],

This is to inform you that your ReserveIT account has been deactivated. You will no longer be able to access the system.

If you believe this was done in error, please contact your department administrator or the IT helpdesk.

Best regards,
ReserveIT Administration', true),
  ('Password Reset', 'KeyRound', 'Password Reset Instructions', 'Dear [User Name],

A password reset has been initiated for your ReserveIT account. Please click the link below to set a new password.

If you did not request this reset, please contact the IT department immediately.

Best regards,
ReserveIT Administration', true),
  ('Role Change Notice', 'ShieldCheck', 'Your Role Has Been Updated', 'Dear [User Name],

Your role in ReserveIT has been updated. Your new role is: [New Role].

This change may affect your access permissions within the system. Please log out and log back in for the changes to take effect.

If you have any questions about your new role, please contact your administrator.

Best regards,
ReserveIT Administration', true);

-- =====================================================
-- FAQ Items — Initial Seed Data
-- =====================================================
-- Description: Pre-populates FAQ entries for every role
--   so users see real content from day one with no manual
--   entry required. Safe to re-apply (ON CONFLICT DO NOTHING).
-- Date: 2026-05-14
-- =====================================================

INSERT INTO public.faq_items (question, answer, category, role_tags, sort_order) VALUES

-- ─── ALL ROLES ──────────────────────────────────────────────────────────────
('How do I reset my password?',
'To reset your password:

1. Click **Sign Out** from the sidebar
2. On the login page, click **"Forgot password?"**
3. Enter your registered email address
4. Check your inbox for the reset link and follow the instructions

> If you signed in with Microsoft (Azure), password changes must be done through your Microsoft account settings.',
'Account', ARRAY['all'], 10),

('How do I update my profile information?',
'Navigate to **Profile** in the sidebar. From there you can update your:

- Display name and contact number
- Profile photo (click the avatar image to upload)

Some fields (email, employee ID) are managed by your administrator and cannot be self-edited.',
'Account', ARRAY['all'], 20),

('What do I do if I see an "Unauthorized" page?',
'Your session may have expired. Try the following:

1. **Sign out** using the option in the sidebar
2. **Sign back in** with your credentials
3. If the problem persists, contact the system administrator

> Azure/Microsoft users: ensure you are signed into the correct Microsoft account.',
'Account', ARRAY['all'], 30),

-- ─── EXTERNAL CLIENT ────────────────────────────────────────────────────────
('How do I make a new booking?',
'1. Click **"New Booking"** in the sidebar
2. Browse the available facilities and select one
3. Choose your preferred **date and time slot**
4. Review the booking summary and add any notes
5. Click **"Submit Booking"** to send your request for approval

You will receive a notification once your booking is approved or rejected.',
'Bookings', ARRAY['external_client'], 10),

('How do I cancel a booking?',
'1. Go to **My Bookings** in the sidebar
2. Find the booking you want to cancel
3. Click the **"Cancel"** button on that booking

> Cancellations are only available before the cutoff deadline. If the button is greyed out, the cancellation window has passed — contact the building admin for assistance.',
'Bookings', ARRAY['external_client'], 20),

('Can I book the same facility twice in one day?',
'Yes — you can book the same facility multiple times in a single day as long as the **time slots do not overlap**.

If you try to book an already-occupied slot, you will see an availability conflict message and will need to choose a different time.',
'Bookings', ARRAY['external_client'], 30),

('How do I view my booking history?',
'Click **"My Bookings"** in the sidebar. Use the **status filter** to narrow results:

- **Pending** — awaiting admin approval
- **Approved** — confirmed bookings
- **Rejected** — declined by admin
- **Cancelled** — cancelled by you
- **Completed** — past bookings',
'Bookings', ARRAY['external_client'], 40),

('How do I pay for a booking?',
'After your booking is approved:

1. Navigate to **Payment** in the sidebar
2. Find the booking under **"Pending Invoices"**
3. Click **"Pay Now"** and follow the on-screen instructions

You will receive a confirmation receipt once payment is verified.',
'Payments', ARRAY['external_client'], 10),

('What payment methods are accepted?',
'Accepted payment methods are listed on the **Payment** page. Typically these include:

- **Bank transfer** (BDO, BPI, etc.)
- **GCash / Maya**
- **On-site cash** (contact the building admin to arrange)

Upload your proof of payment after transferring so the admin can verify it.',
'Payments', ARRAY['external_client'], 20),

('Why is my booking status still "Pending" after I paid?',
'Payment verification is a **manual process** by the building admin and can take up to **1 business day**.

If it has been more than 1 business day:
1. Check that your **proof of payment** was uploaded correctly
2. Contact the building admin directly through the messaging channel',
'Payments', ARRAY['external_client'], 30),

('What does the calendar view show?',
'The **Calendar** page displays all your bookings in a monthly or weekly view:

- **Blue** — Pending (awaiting approval)
- **Green** — Approved / Confirmed
- **Red** — Rejected or Cancelled

Click any booking on the calendar to view its full details.',
'Calendar', ARRAY['external_client'], 10),

-- ─── FACULTY ────────────────────────────────────────────────────────────────
('How do I submit a new facility reservation?',
'1. Click **"New Reservation"** in the sidebar
2. Fill in the request form: facility, date, time, purpose, and number of attendees
3. Click **"Submit"** to send the request for admin approval

You will be notified when the reservation is approved or rejected.',
'Reservations', ARRAY['faculty'], 10),

('How do I check the status of my reservation?',
'Go to **My Reservations** in the sidebar. Each reservation shows its current status:

- **Pending** — waiting for admin review
- **Approved** — confirmed, your slot is reserved
- **Rejected** — not approved (a reason is usually provided)
- **Cancelled** — you or the admin cancelled it',
'Reservations', ARRAY['faculty'], 20),

('Can I edit a reservation after submitting?',
'- **Pending reservations** — you can edit or withdraw them before admin review
- **Approved reservations** — these are locked; contact the building admin if changes are needed, or cancel and re-submit a new request

To edit a pending reservation, go to **My Reservations**, open the reservation, and click **"Edit"**.',
'Reservations', ARRAY['faculty'], 30),

('Where do I view my class schedule?',
'Click **"My Schedules"** in the sidebar to see your uploaded or assigned class timetable for the current term.

If your schedule is not appearing, contact your Program Head — schedules are uploaded and managed by program heads.',
'Schedules', ARRAY['faculty'], 10),

('How do I see upcoming school events?',
'Open the **Calendar** in the sidebar. School events are displayed alongside your personal reservations.

You can filter by event type using the legend at the top of the calendar.',
'Schedules', ARRAY['faculty'], 20),

('How do I view my payment history?',
'Navigate to **Payment** in the sidebar. Here you can see:

- Outstanding invoices for approved reservations
- Past payment transactions and receipts
- Payment status for each reservation',
'Payments', ARRAY['faculty'], 10),

-- ─── PROGRAM HEAD ───────────────────────────────────────────────────────────
('How do I upload a schedule file?',
'1. Go to **Management → Schedule Uploads** in the sidebar
2. Click **"Upload Schedule"**
3. Select your CSV or Excel file (download the template if needed)
4. Review the parsed preview for errors
5. Click **"Confirm Upload"** to submit

Uploaded schedules are sent to the Academic Head for review.',
'Schedule Management', ARRAY['program_head'], 10),

('How do I review submitted schedule changes?',
'Go to **Management → Schedule Management** in the sidebar. The **Review Queue** shows all pending change requests from faculty.

- Click a request to view the details
- Use **Approve** or **Reject** (with a reason) to process it',
'Schedule Management', ARRAY['program_head'], 20),

('How do I manage school events?',
'Go to **Management → Schedule Uploads → School Events**.

From here you can:
- **Create** a new school event with name, date, and description
- **Edit** existing events
- **Cancel** events that are no longer happening',
'Schedule Management', ARRAY['program_head'], 30),

('How do I view the curriculum under my program?',
'Click **"Curriculum"** in the sidebar under **Management**. This shows all courses assigned to your program for the current academic year.',
'Curriculum', ARRAY['program_head'], 10),

('How do I submit a curriculum change request?',
'1. Go to **Curriculum** in the sidebar
2. Find the course you want to modify
3. Click **"Request Change"** and fill in the requested modification
4. Submit — the request goes to the Academic Head for approval',
'Curriculum', ARRAY['program_head'], 20),

('Where do I see finalized schedules?',
'Click **"Approved Schedules"** in the sidebar under **Management**. This shows all class schedules that have been reviewed and confirmed for the current term.',
'Approved Schedules', ARRAY['program_head'], 10),

-- ─── ACADEMIC HEAD ──────────────────────────────────────────────────────────
('How do I review schedule uploads from program heads?',
'Go to **Schedules → Review Queue** in the sidebar.

Each upload shows the program, term, and number of classes. You can:
- **Approve** to finalize the schedule
- **Flag** with comments for the program head to revise and re-upload',
'Schedule Management', ARRAY['academic_head'], 10),

('How do I manage schedule change requests?',
'Navigate to **Schedules → Change Requests**. This shows all pending and resolved change requests.

- Use the **status filter** to view Pending, Approved, or Rejected items
- Click any request to review the full details and take action',
'Schedule Management', ARRAY['academic_head'], 20),

('How do I create or update academic terms?',
'Go to **Schedules → Academic Terms**.

From here you can:
- **Create** a new term (e.g., "1st Semester 2026–2027") with start and end dates
- **Edit** term dates or label
- **Archive** completed terms',
'Schedule Management', ARRAY['academic_head'], 30),

('How do I approve curriculum changes?',
'Go to **Curriculum → Approval Queue**. This shows all curriculum change requests submitted by program heads.

- Review the proposed change details
- Click **Approve** or **Reject** with an optional comment',
'Curriculum', ARRAY['academic_head'], 10),

('How do I view the full course catalog?',
'Navigate to **Curriculum → Course Catalog**. This lists all courses across all programs.

Use the search bar and department filter to quickly find a specific course.',
'Curriculum', ARRAY['academic_head'], 20),

('How do I view all departments?',
'Click **"Departments"** in the sidebar under **Personnel**. This shows the full directory of academic departments with their assigned faculty and programs.',
'Departments', ARRAY['academic_head'], 10),

('How do I reserve a facility for an academic event?',
'1. Click **"Reserve Room"** in the sidebar under **Operations**
2. Fill in the event details: facility, date, time, purpose
3. Submit — the request goes to the building admin for approval

Check **History** in the sidebar to track the status of your reservation.',
'Reservations', ARRAY['academic_head'], 10),

-- ─── BUILDING ADMIN ─────────────────────────────────────────────────────────
('How do I add a new facility or room?',
'1. Go to **Operations → Facility Management**
2. Click **"Add Facility"**
3. Fill in: name, building floor, type (classroom, lab, conference room, etc.), capacity, and available amenities
4. Click **"Save"** — the facility is immediately available for booking',
'Facility Management', ARRAY['building_admin'], 10),

('How do I mark a room as under maintenance?',
'1. Go to **Operations → Facility Management**
2. Open the facility''s detail view
3. Change the **Status** field to **"Under Maintenance"**
4. Enter an estimated return-to-service date and a reason note
5. Save — the room will be blocked from new bookings during that period',
'Facility Management', ARRAY['building_admin'], 20),

('How do I update room pricing?',
'1. Navigate to **Operations → Pricing & Rates**
2. Find the facility you want to update
3. Click **"Edit Rate"** and set the new price per hour (or per day)
4. Save — new bookings will use the updated rate immediately',
'Facility Management', ARRAY['building_admin'], 30),

('How do I approve or reject a reservation request?',
'1. Go to **Operations → Reservations**
2. Find the request with **"Pending"** status
3. Click the request to open its detail view
4. Click **"Approve"** to confirm the booking, or **"Reject"** to decline it
5. Add an optional note — the requester will be notified automatically',
'Reservations', ARRAY['building_admin'], 10),

('How do I view all reservations on a calendar?',
'Click **Calendar** in the sidebar under **Operations**. The calendar shows all reservations color-coded by facility.

Use the facility filter at the top to focus on a specific room.',
'Reservations', ARRAY['building_admin'], 20),

('How do I add equipment to a facility?',
'1. Go to **Operations → Equipment**
2. Click **"Add Equipment"**
3. Enter the equipment name, assign it to a facility, and set the quantity and unit
4. Save — the equipment appears in that facility''s profile and booking form',
'Equipment', ARRAY['building_admin'], 10),

('How do I mark equipment as unavailable?',
'1. Go to **Operations → Equipment**
2. Find the equipment item
3. Click **"Edit"** and change the **Status** to **"Unavailable"**
4. Add a reason (e.g., "Under repair") and save

Unavailable equipment will not appear as an option during new bookings.',
'Equipment', ARRAY['building_admin'], 20),

('How do I add maintenance staff?',
'1. Go to **Personnel → Directory**
2. Click **"Add Maintenance Staff"**
3. Enter the staff member''s name, contact number, specialization, and assigned area
4. Save — they will appear in the directory and can be assigned to maintenance tasks',
'Directory', ARRAY['building_admin'], 10),

('How do I assign a staff member to a facility?',
'1. Go to **Personnel → Directory**
2. Click on the staff member''s name to open their detail drawer
3. Click **"Assign Facility"**
4. Select the facility from the list and confirm

The staff member will now be listed as a contact for that facility.',
'Directory', ARRAY['building_admin'], 20),

('How do I restrict a user from booking?',
'1. Go to **Security → Restricted Users**
2. Click **"Add Restriction"**
3. Search for the user by name or email
4. Set the restriction reason, start date, and optional end date
5. Save — the user will see a restriction notice when trying to book',
'Restricted Users', ARRAY['building_admin'], 10),

('How do I remove a booking restriction?',
'1. Go to **Security → Restricted Users**
2. Find the user in the list
3. Click **"Remove Restriction"** and confirm

The user will immediately regain full booking access.',
'Restricted Users', ARRAY['building_admin'], 20),

('How do I view payment logs?',
'Go to **Audit Trail → Payments** in the sidebar. This shows a full history of all payment transactions including:

- Payer name and booking reference
- Amount and payment method
- Verification status and date',
'Reports & Logs', ARRAY['building_admin'], 10),

('How do I view maintenance logs?',
'Go to **Audit Trail → Maintenance** in the sidebar. This shows a log of all maintenance activities:

- Facility or equipment involved
- Staff assigned
- Date, description, and resolution notes',
'Reports & Logs', ARRAY['building_admin'], 20),

('How do I generate a usage report?',
'1. Navigate to **Overview → Reports & Analytics**
2. Select a **date range** and optionally filter by **facility**
3. The report shows booking counts, occupancy rates, and revenue summaries

Reports can be exported to CSV using the **"Export"** button.',
'Reports & Logs', ARRAY['building_admin'], 30),

('How do I add a new FAQ?',
'1. Go to **FAQ Management** in the sidebar
2. Click **"Add FAQ"**
3. Enter the **question** and write the **answer** (markdown is supported — use **bold**, lists, links, etc.)
4. Set the **category**, **applicable roles**, and **sort order**
5. Make sure **Active** is toggled on, then click **"Save"**

The FAQ is immediately visible to users with the matching roles.',
'FAQ Management', ARRAY['building_admin'], 10),

('How do I control which roles see a FAQ?',
'In the **Add FAQ** or **Edit FAQ** dialog, use the **"Applicable Roles"** checkboxes to select which roles can see the entry.

- Check **"All Roles"** to make it visible to everyone
- Check specific roles (e.g., Faculty, External Client) to limit visibility

Building admin can always see all FAQs in the management page regardless of role tags.',
'FAQ Management', ARRAY['building_admin'], 20),

('How do I temporarily hide a FAQ without deleting it?',
'1. Open **FAQ Management**
2. Click the **edit (pencil) icon** on the FAQ you want to hide
3. Toggle the **"Active"** switch to **off**
4. Save

The FAQ disappears from all user Help sheets but remains in the management table where you can reactivate it later.',
'FAQ Management', ARRAY['building_admin'], 30)

ON CONFLICT DO NOTHING;

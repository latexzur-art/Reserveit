import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBookings() {
  console.log('Checking bookings in database...\n');

  // Get total count
  const { count: totalCount, error: countError } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting bookings:', countError);
    return;
  }

  console.log(`Total bookings in database: ${totalCount}\n`);

  if (totalCount && totalCount > 0) {
    // Get a sample of bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, booking_reference, user_id, booking_type, booking_purpose, current_status, booking_date, start_time, end_time, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching bookings:', error);
      return;
    }

    console.log('Sample of recent bookings (up to 10):');
    console.log('==========================================\n');

    bookings?.forEach((booking, index) => {
      console.log(`${index + 1}. Booking Reference: ${booking.booking_reference}`);
      console.log(`   ID: ${booking.id}`);
      console.log(`   User ID: ${booking.user_id}`);
      console.log(`   Type: ${booking.booking_type}`);
      console.log(`   Purpose: ${booking.booking_purpose}`);
      console.log(`   Status: ${booking.current_status}`);
      console.log(`   Date: ${booking.booking_date}`);
      console.log(`   Time: ${booking.start_time} - ${booking.end_time}`);
      console.log(`   Created: ${new Date(booking.created_at).toLocaleString()}`);
      console.log('');
    });

    // Get status breakdown
    const { data: statusBreakdown, error: statusError } = await supabase
      .from('bookings')
      .select('current_status');

    if (!statusError && statusBreakdown) {
      const statusCounts = statusBreakdown.reduce((acc: Record<string, number>, booking: any) => {
        acc[booking.current_status] = (acc[booking.current_status] || 0) + 1;
        return acc;
      }, {});

      console.log('Breakdown by status:');
      console.log('====================');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`${status}: ${count}`);
      });
    }
  } else {
    console.log('No bookings found in the database.');
  }
}

checkBookings().catch(console.error);

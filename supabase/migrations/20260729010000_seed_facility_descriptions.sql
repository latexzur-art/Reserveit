-- =====================================================
-- Seed Detailed Descriptions for Campus Facilities
-- =====================================================
-- Description: Updates the description column for all seeded facilities
--   with distinct, non-generic, and unique room specifications for brochure display.
-- Date: 2026-07-29
-- =====================================================

UPDATE public.facilities SET description = 'High-capacity indoor athletic arena equipped for basketball, volleyball, PE instruction, intramurals, and major institutional gatherings with bleacher seating and dedicated scoreboard control.' WHERE room_number = 'GYM' OR code = 'GF-GYM-001';

UPDATE public.facilities SET description = 'Ground-floor computing lab configured with 50+ desktop workstations, high-speed wired LAN, and overhead projection tailored for introductory programming and digital literacy coursework.' WHERE room_number = '103' OR code = 'GF-CL-103';

UPDATE public.facilities SET description = 'Ground-level multi-purpose venue featuring acoustic wall treatment, modular stage setup, and flexible floor seating tailored for seminars, guest lectures, and student showcases.' WHERE room_number = 'MPH1' OR code = 'GF-MPH-001';

UPDATE public.facilities SET description = 'Mid-tier assembly hall outfitted with dual high-definition projection screens, integrated sound mixing console, and adaptable seating ideal for department symposia and cultural rehearsals.' WHERE room_number = 'MPH2' OR code = '2F-MPH-002';

UPDATE public.facilities SET description = 'Top-floor event hall offering panoramic campus views, overhead LED stage lighting, and open layout suited for thesis defenses, formal ceremonies, and institutional banquets.' WHERE room_number = 'MPH3' OR code = '5F-MPH-003';

UPDATE public.facilities SET description = 'Executive boardroom equipped with an oval conference table, executive ergonomic leather seating, glass whiteboard wall, and integrated teleconferencing hardware for leadership meetings.' WHERE room_number = 'CR' OR code = '2F-CR-001';

UPDATE public.facilities SET description = 'Specialized physical science lab equipped with precision mechanics apparatus, optics benches, digital motion sensors, and emergency safety stations for hands-on physics experiments.' WHERE room_number = '301' OR code = '3F-SL-301';

UPDATE public.facilities SET description = 'Wet lab facility featuring chemical fume hoods, eyewash stations, acid-resistant countertops, and micro-titration glassware for general and organic chemistry experiments.' WHERE room_number = '302' OR code = '3F-SL-302';

UPDATE public.facilities SET description = 'Software engineering lab featuring dual-boot OS workstations, local subnet testing tools, and developer IDE suites optimized for web and mobile app development.' WHERE room_number = '303' OR code = '3F-CL-303';

UPDATE public.facilities SET description = 'Expanded IT laboratory equipped with dual ceiling-mounted projectors, gigabit networking hardware, and virtualization tools for network administration and cybersecurity labs.' WHERE room_number = '304' OR code = '3F-CL-304';

UPDATE public.facilities SET description = 'Digital media & graphics lab featuring color-calibrated monitors, creative suite software, and ergonomic workstation bays designed for UI/UX and multimedia design.' WHERE room_number = '308' OR code = '3F-CL-308';

UPDATE public.facilities SET description = 'Enterprise systems laboratory outfitted with server database management tools, cloud sandbox environments, and high-performance computing units for advanced data analytics.' WHERE room_number = '309' OR code = '3F-CL-309';

UPDATE public.facilities SET description = 'Media studio featuring adjustable backdrop rigging systems, studio strobe controllers, softbox lighting grids, and tethered shooting stations for commercial photography training.' WHERE room_number = '401' OR code = '4F-ST-401';

UPDATE public.facilities SET description = 'Acoustically treated media production room with green-screen chroma key wall, multi-camera live video switcher, audio mixing console, and teleprompter setup for broadcast journalism.' WHERE room_number = '402' OR code = '4F-ST-402';

UPDATE public.facilities SET description = 'Simulated hotel guestroom and housekeeping training suite complete with realistic master bedroom setup, linen management station, and guest service simulation area.' WHERE room_number = '306' OR code = '3F-RM-306';

UPDATE public.facilities SET description = 'Food & beverage simulation lab featuring a fully operational service bar, mixology workstations, POS terminal, and fine-dining table layouts for hospitality management training.' WHERE room_number = '307' OR code = '3F-RM-307';

UPDATE public.facilities SET description = 'Front-office training laboratory equipped with hotel check-in reception counters, mock travel agency booking desks, and GDS reservation system terminals.' WHERE room_number = '311' OR code = '3F-RM-311';

UPDATE public.facilities SET description = 'Central academic library featuring quiet individual study carrels, collaborative group research tables, online catalog search terminals, and curated physical book collections.' WHERE room_number = 'Library' OR code = '4F-LIB-001';

UPDATE public.facilities SET description = 'Standard lecture classroom featuring ergonomic tablet armchairs, magnetic whiteboard, and natural window lighting optimized for general education lectures.' WHERE room_number IN ('201', '202', '203', '204', '205', '206', '207', '208');

UPDATE public.facilities SET description = 'Expanded lecture classroom equipped with long-throw digital projector, elevated instructor podium, and wider seating rows for large section classes.' WHERE room_number IN ('209', '210', '211', '212');

UPDATE public.facilities SET description = 'Multipurpose lecture room with modular desk arrangements supporting both standard instructional lectures and small-group discussions.' WHERE room_number IN ('213', '214');

UPDATE public.facilities SET description = 'Interactive learning classroom equipped with flip-nesting movable desks to facilitate rapid transitions between lectures and collaborative group work.' WHERE room_number IN ('305', '310');

UPDATE public.facilities SET description = 'Upper-level academic classroom with wall-to-wall whiteboards and focused LED lighting, ideal for upper-division seminars and intensive tutorials.' WHERE room_number IN ('403', '404', '405', '406', '407');

UPDATE public.facilities SET description = 'Quiet top-floor classroom offering an undisturbed academic environment optimal for exam proctoring, review sessions, and capstone presentations.' WHERE room_number IN ('501', '502', '503', '504', '505', '506', '507', '508', '509', '510', '511');

/**
 * Seed sample class schedules for CLASS_CONFLICT constraint testing
 * Populates realistic class schedule data across departments
 *
 * Schedule pattern:
 * - CS classes: Mon-Wed-Fri or Tue-Thu patterns
 * - Business classes: Tue-Thu or Mon-Wed patterns
 * - Engineering: Mon-Thu with lab sessions
 * - Time slots: 7:30-9:00, 9:00-10:30, 10:30-12:00, 13:00-14:30, 14:30-16:00, 16:00-17:30
 */

DO $$
DECLARE
  v_cs_dept_id UUID;
  v_business_dept_id UUID;
  v_engineering_dept_id UUID;
  v_gen_ed_dept_id UUID;
  v_current_term_id UUID;
  v_classroom_201 UUID;
  v_classroom_202 UUID;
  v_classroom_203 UUID;
  v_classroom_204 UUID;
  v_classroom_205 UUID;
  v_comp_lab_1 UUID;
  v_comp_lab_2 UUID;
  v_comp_lab_3 UUID;
  v_science_lab_1 UUID;
  v_science_lab_2 UUID;
BEGIN
  -- Get department IDs
  SELECT id INTO v_cs_dept_id FROM departments WHERE name ILIKE '%computer%science%' OR name ILIKE '%IT%' OR name ILIKE '%CS%' LIMIT 1;
  SELECT id INTO v_business_dept_id FROM departments WHERE name ILIKE '%business%' OR name ILIKE '%management%' LIMIT 1;
  SELECT id INTO v_engineering_dept_id FROM departments WHERE name ILIKE '%engineering%' LIMIT 1;
  SELECT id INTO v_gen_ed_dept_id FROM departments WHERE name ILIKE '%general%education%' OR name ILIKE '%gen%ed%' LIMIT 1;

  -- Get current academic term
  SELECT id INTO v_current_term_id
  FROM academic_terms
  WHERE CURRENT_DATE BETWEEN start_date AND end_date
  ORDER BY start_date DESC
  LIMIT 1;

  -- Get facility IDs
  SELECT id INTO v_classroom_201 FROM facilities WHERE room_number = '201' LIMIT 1;
  SELECT id INTO v_classroom_202 FROM facilities WHERE room_number = '202' LIMIT 1;
  SELECT id INTO v_classroom_203 FROM facilities WHERE room_number = '203' LIMIT 1;
  SELECT id INTO v_classroom_204 FROM facilities WHERE room_number = '204' LIMIT 1;
  SELECT id INTO v_classroom_205 FROM facilities WHERE room_number = '205' LIMIT 1;
  SELECT id INTO v_comp_lab_1 FROM facilities WHERE name ILIKE '%computer%lab%1%' LIMIT 1;
  SELECT id INTO v_comp_lab_2 FROM facilities WHERE name ILIKE '%computer%lab%2%' LIMIT 1;
  SELECT id INTO v_comp_lab_3 FROM facilities WHERE name ILIKE '%computer%lab%3%' LIMIT 1;
  SELECT id INTO v_science_lab_1 FROM facilities WHERE name ILIKE '%science%lab%1%' LIMIT 1;
  SELECT id INTO v_science_lab_2 FROM facilities WHERE name ILIKE '%science%lab%2%' LIMIT 1;

  -- Only seed if we have at least one department and term
  IF v_current_term_id IS NULL THEN
    RAISE NOTICE 'No active academic term found. Skipping class schedule seeding.';
    RETURN;
  END IF;

  IF v_cs_dept_id IS NULL AND v_business_dept_id IS NULL THEN
    RAISE NOTICE 'No departments found. Skipping class schedule seeding.';
    RETURN;
  END IF;

  -- Computer Science Department Classes (Mon-Wed-Fri pattern)
  IF v_cs_dept_id IS NOT NULL AND v_comp_lab_1 IS NOT NULL THEN
    -- CS101: Data Structures - Mon/Wed/Fri 7:30-9:00 in Computer Lab 1
    INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
    VALUES
      ('CS101', 'Data Structures', 'A', 'Prof. Maria Santos', 1, '07:30', '09:00', v_comp_lab_1, v_cs_dept_id, v_current_term_id, true),
      ('CS101', 'Data Structures', 'A', 'Prof. Maria Santos', 3, '07:30', '09:00', v_comp_lab_1, v_cs_dept_id, v_current_term_id, true),
      ('CS101', 'Data Structures', 'A', 'Prof. Maria Santos', 5, '07:30', '09:00', v_comp_lab_1, v_cs_dept_id, v_current_term_id, true);

    -- CS102: Database Systems - Tue/Thu 9:00-10:30 in Computer Lab 2
    IF v_comp_lab_2 IS NOT NULL THEN
      INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
      VALUES
        ('CS102', 'Database Systems', 'B', 'Prof. Juan Dela Cruz', 2, '09:00', '10:30', v_comp_lab_2, v_cs_dept_id, v_current_term_id, true),
        ('CS102', 'Database Systems', 'B', 'Prof. Juan Dela Cruz', 4, '09:00', '10:30', v_comp_lab_2, v_cs_dept_id, v_current_term_id, true);
    END IF;

    -- CS201: Web Development - Mon/Wed/Fri 10:30-12:00 in Computer Lab 3
    IF v_comp_lab_3 IS NOT NULL THEN
      INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
      VALUES
        ('CS201', 'Web Development', 'A', 'Prof. Anna Reyes', 1, '10:30', '12:00', v_comp_lab_3, v_cs_dept_id, v_current_term_id, true),
        ('CS201', 'Web Development', 'A', 'Prof. Anna Reyes', 3, '10:30', '12:00', v_comp_lab_3, v_cs_dept_id, v_current_term_id, true),
        ('CS201', 'Web Development', 'A', 'Prof. Anna Reyes', 5, '10:30', '12:00', v_comp_lab_3, v_cs_dept_id, v_current_term_id, true);
    END IF;
  END IF;

  -- Business Department Classes
  IF v_business_dept_id IS NOT NULL AND v_classroom_201 IS NOT NULL THEN
    -- BUS101: Principles of Management - Tue/Thu 13:00-14:30 in Room 201
    INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
    VALUES
      ('BUS101', 'Principles of Management', 'A', 'Prof. Roberto Cruz', 2, '13:00', '14:30', v_classroom_201, v_business_dept_id, v_current_term_id, true),
      ('BUS101', 'Principles of Management', 'A', 'Prof. Roberto Cruz', 4, '13:00', '14:30', v_classroom_201, v_business_dept_id, v_current_term_id, true);

    -- BUS102: Marketing Fundamentals - Mon/Wed/Fri 14:30-16:00 in Room 202
    IF v_classroom_202 IS NOT NULL THEN
      INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
      VALUES
        ('BUS102', 'Marketing Fundamentals', 'B', 'Prof. Elena Gomez', 1, '14:30', '16:00', v_classroom_202, v_business_dept_id, v_current_term_id, true),
        ('BUS102', 'Marketing Fundamentals', 'B', 'Prof. Elena Gomez', 3, '14:30', '16:00', v_classroom_202, v_business_dept_id, v_current_term_id, true),
        ('BUS102', 'Marketing Fundamentals', 'B', 'Prof. Elena Gomez', 5, '14:30', '16:00', v_classroom_202, v_business_dept_id, v_current_term_id, true);
    END IF;
  END IF;

  -- Engineering Department with Lab Sessions
  IF v_engineering_dept_id IS NOT NULL AND v_science_lab_1 IS NOT NULL THEN
    -- ENGR101: Physics Lab - Mon 13:00-16:00 (3-hour lab session)
    INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
    VALUES
      ('ENGR101', 'Physics Laboratory', 'A', 'Prof. Carlos Mendez', 1, '13:00', '16:00', v_science_lab_1, v_engineering_dept_id, v_current_term_id, true);

    -- ENGR102: Chemistry Lab - Wed 13:00-16:00
    IF v_science_lab_2 IS NOT NULL THEN
      INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
      VALUES
        ('ENGR102', 'Chemistry Laboratory', 'B', 'Prof. Linda Torres', 3, '13:00', '16:00', v_science_lab_2, v_engineering_dept_id, v_current_term_id, true);
    END IF;
  END IF;

  -- General Education Classes (high enrollment, use standard classrooms)
  IF v_gen_ed_dept_id IS NOT NULL OR v_cs_dept_id IS NOT NULL THEN
    -- Use CS dept as fallback for gen ed
    IF v_gen_ed_dept_id IS NULL THEN
      v_gen_ed_dept_id := v_cs_dept_id;
    END IF;

    IF v_classroom_203 IS NOT NULL THEN
      -- GNED101: English Composition - Tue/Thu 7:30-9:00
      INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
      VALUES
        ('GNED101', 'English Composition', 'A', 'Prof. Sarah Johnson', 2, '07:30', '09:00', v_classroom_203, v_gen_ed_dept_id, v_current_term_id, true),
        ('GNED101', 'English Composition', 'A', 'Prof. Sarah Johnson', 4, '07:30', '09:00', v_classroom_203, v_gen_ed_dept_id, v_current_term_id, true);
    END IF;

    IF v_classroom_204 IS NOT NULL THEN
      -- GNED102: Mathematics - Mon/Wed/Fri 9:00-10:30
      INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
      VALUES
        ('GNED102', 'College Mathematics', 'A', 'Prof. Michael Lee', 1, '09:00', '10:30', v_classroom_204, v_gen_ed_dept_id, v_current_term_id, true),
        ('GNED102', 'College Mathematics', 'A', 'Prof. Michael Lee', 3, '09:00', '10:30', v_classroom_204, v_gen_ed_dept_id, v_current_term_id, true),
        ('GNED102', 'College Mathematics', 'A', 'Prof. Michael Lee', 5, '09:00', '10:30', v_classroom_204, v_gen_ed_dept_id, v_current_term_id, true);
    END IF;

    IF v_classroom_205 IS NOT NULL THEN
      -- GNED103: Philippine History - Tue/Thu 10:30-12:00
      INSERT INTO class_schedules (course_code, course_name, section, instructor_name, day_of_week, start_time, end_time, facility_id, department_id, academic_term_id, is_active)
      VALUES
        ('GNED103', 'Philippine History', 'B', 'Prof. Antonio Valdez', 2, '10:30', '12:00', v_classroom_205, v_gen_ed_dept_id, v_current_term_id, true),
        ('GNED103', 'Philippine History', 'B', 'Prof. Antonio Valdez', 4, '10:30', '12:00', v_classroom_205, v_gen_ed_dept_id, v_current_term_id, true);
    END IF;
  END IF;

  RAISE NOTICE 'Sample class schedules seeded successfully.';
END $$;

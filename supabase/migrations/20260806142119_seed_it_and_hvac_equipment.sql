-- =====================================================
-- Seed IT (tech) + Building (HVAC) equipment inventory
-- =====================================================
-- Description: The tech (managed_by='it') scope only had reclassified laptops,
--   and the building (managed_by='building') HVAC scope had no items. Seed
--   realistic inventory so the IT Admin and Building Admin (HVAC) dashboards
--   reflect actual assets. New units start unassigned (Storage); assigning
--   them to rooms is done via the assign / assignment-request flows.
--   Idempotent via ON CONFLICT (equipment_code) DO NOTHING.
-- Date: 2026-08-06
-- =====================================================

DO $$
DECLARE
  type_tv UUID;
  type_monitor UUID;
  type_desktop UUID;
  type_pc_parts UUID;
  type_webcam UUID;
  type_hvac UUID;
  status_available UUID;
BEGIN
  SELECT id INTO type_tv FROM public.equipment_types WHERE type_code = 'TV';
  SELECT id INTO type_monitor FROM public.equipment_types WHERE type_code = 'MONITOR';
  SELECT id INTO type_desktop FROM public.equipment_types WHERE type_code = 'DESKTOP_COMPUTER';
  SELECT id INTO type_pc_parts FROM public.equipment_types WHERE type_code = 'PC_PARTS';
  SELECT id INTO type_webcam FROM public.equipment_types WHERE type_code = 'WEBCAM';
  SELECT id INTO type_hvac FROM public.equipment_types WHERE type_code = 'HVAC';
  SELECT id INTO status_available FROM public.equipment_status_types WHERE status_code = 'AVAILABLE';

  IF status_available IS NULL THEN
    RAISE EXCEPTION 'AVAILABLE status not found';
  END IF;

  -- ---- IT-managed tech ----
  IF type_tv IS NOT NULL THEN
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('TV-001', 'Smart TV 55"', type_tv, status_available, 'Samsung', 'AU7000'),
      ('TV-002', 'Smart TV 55"', type_tv, status_available, 'Samsung', 'AU7000'),
      ('TV-003', 'Smart TV 43"', type_tv, status_available, 'LG', 'UR7500'),
      ('TV-004', 'Smart TV 43"', type_tv, status_available, 'LG', 'UR7500')
    ON CONFLICT (equipment_code) DO NOTHING;
  END IF;

  IF type_monitor IS NOT NULL THEN
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('MON-001', 'LED Monitor 24"', type_monitor, status_available, 'Dell', 'P2422H'),
      ('MON-002', 'LED Monitor 24"', type_monitor, status_available, 'Dell', 'P2422H'),
      ('MON-003', 'LED Monitor 24"', type_monitor, status_available, 'Dell', 'P2422H'),
      ('MON-004', 'LED Monitor 24"', type_monitor, status_available, 'Dell', 'P2422H'),
      ('MON-005', 'LED Monitor 24"', type_monitor, status_available, 'Acer', 'V246HQL'),
      ('MON-006', 'LED Monitor 24"', type_monitor, status_available, 'Acer', 'V246HQL'),
      ('MON-007', 'LED Monitor 24"', type_monitor, status_available, 'Acer', 'V246HQL'),
      ('MON-008', 'LED Monitor 24"', type_monitor, status_available, 'Acer', 'V246HQL'),
      ('MON-009', 'LED Monitor 27"', type_monitor, status_available, 'LG', '27MK430H'),
      ('MON-010', 'LED Monitor 27"', type_monitor, status_available, 'LG', '27MK430H'),
      ('MON-011', 'LED Monitor 27"', type_monitor, status_available, 'LG', '27MK430H'),
      ('MON-012', 'LED Monitor 27"', type_monitor, status_available, 'LG', '27MK430H')
    ON CONFLICT (equipment_code) DO NOTHING;
  END IF;

  IF type_desktop IS NOT NULL THEN
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('PC-001', 'Desktop Workstation', type_desktop, status_available, 'HP', 'ProDesk 400 G7'),
      ('PC-002', 'Desktop Workstation', type_desktop, status_available, 'HP', 'ProDesk 400 G7'),
      ('PC-003', 'Desktop Workstation', type_desktop, status_available, 'HP', 'ProDesk 400 G7'),
      ('PC-004', 'Desktop Workstation', type_desktop, status_available, 'HP', 'ProDesk 400 G7'),
      ('PC-005', 'Desktop Workstation', type_desktop, status_available, 'HP', 'ProDesk 400 G7'),
      ('PC-006', 'Desktop Workstation', type_desktop, status_available, 'Dell', 'OptiPlex 3090'),
      ('PC-007', 'Desktop Workstation', type_desktop, status_available, 'Dell', 'OptiPlex 3090'),
      ('PC-008', 'Desktop Workstation', type_desktop, status_available, 'Dell', 'OptiPlex 3090'),
      ('PC-009', 'Desktop Workstation', type_desktop, status_available, 'Dell', 'OptiPlex 3090'),
      ('PC-010', 'Desktop Workstation', type_desktop, status_available, 'Dell', 'OptiPlex 3090'),
      ('PC-011', 'Desktop Workstation', type_desktop, status_available, 'Lenovo', 'ThinkCentre M70'),
      ('PC-012', 'Desktop Workstation', type_desktop, status_available, 'Lenovo', 'ThinkCentre M70'),
      ('PC-013', 'Desktop Workstation', type_desktop, status_available, 'Lenovo', 'ThinkCentre M70'),
      ('PC-014', 'Desktop Workstation', type_desktop, status_available, 'Lenovo', 'ThinkCentre M70'),
      ('PC-015', 'Desktop Workstation', type_desktop, status_available, 'Lenovo', 'ThinkCentre M70')
    ON CONFLICT (equipment_code) DO NOTHING;
  END IF;

  IF type_webcam IS NOT NULL THEN
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('CAM-001', 'HD Webcam 1080p', type_webcam, status_available, 'Logitech', 'C920'),
      ('CAM-002', 'HD Webcam 1080p', type_webcam, status_available, 'Logitech', 'C920'),
      ('CAM-003', 'HD Webcam 1080p', type_webcam, status_available, 'Logitech', 'C920'),
      ('CAM-004', 'HD Webcam 1080p', type_webcam, status_available, 'A4Tech', 'PK-940H')
    ON CONFLICT (equipment_code) DO NOTHING;
  END IF;

  IF type_pc_parts IS NOT NULL THEN
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('PART-001', 'RAM Module 8GB DDR4', type_pc_parts, status_available, 'Kingston', 'Fury'),
      ('PART-002', 'RAM Module 8GB DDR4', type_pc_parts, status_available, 'Kingston', 'Fury'),
      ('PART-003', 'SSD 256GB SATA', type_pc_parts, status_available, 'Crucial', 'BX500'),
      ('PART-004', 'SSD 256GB SATA', type_pc_parts, status_available, 'Crucial', 'BX500'),
      ('PART-005', 'Power Supply 500W', type_pc_parts, status_available, 'Seasonic', 'S12III')
    ON CONFLICT (equipment_code) DO NOTHING;
  END IF;

  -- ---- Building-managed HVAC fixtures ----
  IF type_hvac IS NOT NULL THEN
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('HVAC-001', 'Split-type Air Conditioner 2.0HP', type_hvac, status_available, 'Carrier', 'FP-53CEF024'),
      ('HVAC-002', 'Split-type Air Conditioner 2.0HP', type_hvac, status_available, 'Carrier', 'FP-53CEF024'),
      ('HVAC-003', 'Split-type Air Conditioner 2.0HP', type_hvac, status_available, 'Panasonic', 'CS-PN18'),
      ('HVAC-004', 'Split-type Air Conditioner 2.5HP', type_hvac, status_available, 'Panasonic', 'CS-PN24'),
      ('HVAC-005', 'Window-type Air Conditioner 1.5HP', type_hvac, status_available, 'Kolin', 'KAG-125'),
      ('HVAC-006', 'Window-type Air Conditioner 1.5HP', type_hvac, status_available, 'Kolin', 'KAG-125')
    ON CONFLICT (equipment_code) DO NOTHING;
  END IF;
END $$;

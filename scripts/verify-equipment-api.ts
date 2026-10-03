
import { BuildingEquipmentService } from '../backend/admin/building/building-equipment.service';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
  console.log('🔍 Starting API Verification...');

  try {
    // 1. Get all equipment to find a test ID
    console.log('--- Step 1: Fetching equipment ---');
    const { equipment } = await BuildingEquipmentService.getAll();
    if (equipment.length === 0) {
      console.error('❌ No equipment found in database.');
      return;
    }
    const testId = equipment[0].id;
    const originalName = equipment[0].equipmentName;
    console.log(`✅ Found test equipment: ${originalName} (${testId})`);

    // 2. Test PATCH with camelCase (Should work now)
    console.log('--- Step 2: Testing PATCH with camelCase ---');
    const updatedName = `${originalName} (Updated)`;
    const patched = await BuildingEquipmentService.update(testId, {
      equipmentName: updatedName
    });
    
    if (patched.equipmentName === updatedName) {
      console.log('✅ PATCH with camelCase successful!');
    } else {
      console.error(`❌ PATCH with camelCase failed. Expected "${updatedName}", got "${patched.equipmentName}"`);
    }

    // 3. Test PATCH with empty/unknown keys (Should NOT throw 500)
    console.log('--- Step 3: Testing PATCH with unknown keys (safety check) ---');
    const safePatched = await BuildingEquipmentService.update(testId, {
      unknownKey: 'value'
    });
    if (safePatched.id === testId) {
      console.log('✅ PATCH with unknown keys handled safely!');
    }

    // 4. Test CREATE with missing fields (Should work now with defaults)
    console.log('--- Step 4: Testing CREATE with missing fields ---');
    const { data: types } = await (await import('../lib/supabase/server')).createAdminClient()
        .from('equipment_types').select('id').limit(1).single();
    
    if (!types) {
        console.error('❌ Could not find equipment types to test create.');
    } else {
        const newItem = await BuildingEquipmentService.create({
            equipmentName: 'Test Automation Item',
            equipmentTypeId: types.id
        } as any) as { equipmentCode: string };
        console.log(`✅ CREATE successful! New Code: ${newItem.equipmentCode}`);
    }

    // Revert changes to test item
    await BuildingEquipmentService.update(testId, {
      equipmentName: originalName
    });
    console.log('✅ Cleanup successful.');

  } catch (error: any) {
    console.error('❌ Verification failed with error:');
    console.error(error.message);
  }
}

verify();

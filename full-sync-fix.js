// full-sync-fix.js - ทำ Full Sync เพื่อแก้ไขปัญหาข้อมูลซ้ำ
require('dotenv').config({ path: '.env.local' });

async function fullSyncFix() {
  try {
    console.log('🔄 Starting Full Sync to fix duplicate data issue...\n');

    // ส่ง request ไป API full sync all
    const response = await fetch('http://localhost:3001/api/sync/all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        fullSync: true 
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Full Sync Result:');
    console.log(`📊 Total Configs: ${result.totalConfigs}`);
    console.log(`✅ Success Count: ${result.successCount}`);
    console.log(`❌ Fail Count: ${result.failCount}`);
    console.log(`📈 Total Rows Synced: ${result.totalRowsSynced}`);
    console.log(`🔧 Sync Type: ${result.syncType}`);
    console.log(`💬 Message: ${result.message}\n`);

    if (result.results && result.results.length > 0) {
      console.log('📋 Individual Results:');
      result.results.forEach((res, i) => {
        console.log(`  ${i + 1}. ${res.configName}:`);
        console.log(`     Status: ${res.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`     Rows: ${res.rowsSynced}`);
        console.log(`     Type: ${res.syncType}`);
        if (res.error) console.log(`     Error: ${res.error}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error running full sync:', error);
  }
}

// เรียกใช้
fullSyncFix().then(() => {
  console.log('🎉 Full sync completed! Please run debug-sync.js again to verify the fix.');
}).catch(console.error);

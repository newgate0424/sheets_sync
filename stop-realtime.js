// stop-realtime.js - หยุด Real-time Sync และทำ Full Sync
require('dotenv').config({ path: '.env.local' });

async function stopAndFullSync() {
  try {
    console.log('🔴 Stopping all Real-time Sync and doing Full Sync...\n');

    // ทำ Full Sync All
    const fullSyncResponse = await fetch('http://localhost:3001/api/sync/all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        fullSync: true 
      })
    });

    if (!fullSyncResponse.ok) {
      throw new Error(`Full sync failed: ${fullSyncResponse.status}`);
    }

    const result = await fullSyncResponse.json();
    
    console.log('✅ Full Sync All Result:');
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

    console.log('🎯 Full Sync completed! Database should now exactly match Google Sheets.');

  } catch (error) {
    console.error('❌ Error in full sync:', error);
  }
}

// เรียกใช้
stopAndFullSync().catch(console.error);

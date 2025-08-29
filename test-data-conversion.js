// Test data conversion functions - TypeScript compatible
const path = require('path');

async function testDataConversion() {
  console.log('🧪 Testing Data Conversion Functions...\n');
  
  // Import and create service instance (compatible with TypeScript modules)
  const { default: googleSheetsService } = await import('./lib/googleSheetsService.js');
  
  // Test date conversion
  console.log('📅 Testing Date Conversion:');
  const testDates = [
    '15/12/2024',
    '15-12-2024', 
    '2024/12/15',
    '2024-12-15',
    '30/01/2023',
    '01-05-2024',
    'invalid-date',
    '',
    null
  ];
  
  testDates.forEach(date => {
    try {
      const converted = googleSheetsService.convertDateFormat(date);
      console.log(`  "${date}" → "${converted}"`);
    } catch (error) {
      console.log(`  "${date}" → ERROR: ${error.message}`);
    }
  });
  
  console.log('\n🔧 Testing Cell Value Conversion:');
  const testValues = [
    { value: '15/12/2024', dataType: 'DATE' },
    { value: '15-12-2024 10:30:00', dataType: 'DATETIME' },
    { value: '123.45', dataType: 'DECIMAL(10,2)' },
    { value: '123', dataType: 'INT' },
    { value: 'Hello World', dataType: 'VARCHAR(255)' },
    { value: '', dataType: 'TEXT' },
    { value: null, dataType: 'DATE' }
  ];
  
  testValues.forEach(({ value, dataType }) => {
    try {
      const converted = googleSheetsService.convertCellValue(value, dataType);
      console.log(`  ${dataType}: "${value}" → "${converted}"`);
    } catch (error) {
      console.log(`  ${dataType}: "${value}" → ERROR: ${error.message}`);
    }
  });
  
  console.log('\n✅ Data Conversion Test Completed!');
}

// Run the test
testDataConversion().catch(console.error);

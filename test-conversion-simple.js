// Test data conversion with direct testing
console.log('🧪 Testing Date Conversion Logic...\n');

// Function to convert date format dd/mm/yyyy or dd-mm-yyyy to yyyy-mm-dd
function convertDateFormat(value) {
  if (!value || typeof value !== 'string') {
    return String(value || '');
  }

  // Convert dd/mm/yyyy or dd-mm-yyyy to yyyy-mm-dd
  const datePatterns = [
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, format: 'dd/mm/yyyy' },
    { pattern: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, format: 'yyyy/mm/dd' }
  ];

  for (const { pattern, format } of datePatterns) {
    const match = value.match(pattern);
    if (match) {
      let [, part1, part2, part3] = match;
      
      // แยกส่วน date และ time (ถ้ามี)
      const parts = value.split(' ');
      const datePart = parts[0];
      const timePart = parts.length > 1 ? parts.slice(1).join(' ') : '';
      
      // Re-match กับ date part
      const dateMatch = datePart.match(pattern);
      if (dateMatch) {
        [, part1, part2, part3] = dateMatch;
      }
      
      // แยกส่วน date และ time (ถ้ามี)
      const parts = value.split(' ');
      const datePart = parts[0];
      const timePart = parts.length > 1 ? parts.slice(1).join(' ') : '';

      if (format === 'dd/mm/yyyy') {
        const day = part1.padStart(2, '0');
        const month = part2.padStart(2, '0'); 
        const year = part3;
        
        // Validate date
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() == year && date.getMonth() == month - 1 && date.getDate() == day) {
          const convertedDate = `${year}-${month}-${day}`;
          return timePart ? `${convertedDate} ${timePart}` : convertedDate;
        }
      } else if (format === 'yyyy/mm/dd') {
        const year = part1;
        const month = part2.padStart(2, '0');
        const day = part3.padStart(2, '0');
        
        // Already in correct format, just validate
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() == year && date.getMonth() == month - 1 && date.getDate() == day) {
          const convertedDate = `${year}-${month}-${day}`;
          return timePart ? `${convertedDate} ${timePart}` : convertedDate;
        }
      }
    }
  }

  return String(value); // Return as-is if no pattern matches
}

// Function to convert cell value based on data type
function convertCellValue(value, dataType) {
  // First convert everything to string to prevent type mismatch
  let stringValue = String(value || '');
  
  // Apply specific formatting for date types
  if (dataType === 'DATE' || dataType === 'DATETIME' || dataType === 'TIMESTAMP') {
    stringValue = convertDateFormat(stringValue);
  }
  
  return stringValue;
}

// Test cases
console.log('📅 Testing Date Conversion:');
const testDates = [
  '15/12/2024',
  '15-12-2024', 
  '2024/12/15',
  '2024-12-15',
  '30/01/2023',
  '01-05-2024',
  '31/02/2024', // Invalid date
  'invalid-date',
  '',
  null
];

testDates.forEach(date => {
  try {
    const converted = convertDateFormat(date);
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
  { value: null, dataType: 'DATE' },
  { value: undefined, dataType: 'VARCHAR(255)' }
];

testValues.forEach(({ value, dataType }) => {
  try {
    const converted = convertCellValue(value, dataType);
    console.log(`  ${dataType}: "${value}" → "${converted}"`);
  } catch (error) {
    console.log(`  ${dataType}: "${value}" → ERROR: ${error.message}`);
  }
});

console.log('\n✅ Date Conversion Test Completed!');
console.log('\n📝 Summary:');
console.log('- All values are converted to strings first to prevent type mismatch');
console.log('- Date formats dd/mm/yyyy and dd-mm-yyyy are converted to yyyy-mm-dd');
console.log('- Invalid dates are returned as-is (converted to string)');
console.log('- Empty/null values are converted to empty strings');

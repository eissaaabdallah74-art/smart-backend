require('dotenv').config();
const { Breakdown } = require('./src/models');

async function inspect() {
  try {
    const breakdown = await Breakdown.findOne();
    if (breakdown && breakdown.entries) {
      console.log('Sample entry type:', typeof breakdown.entries);
      if (Array.isArray(breakdown.entries) && breakdown.entries.length > 0) {
        console.log('Sample entry:', JSON.stringify(breakdown.entries[0], null, 2));
      } else {
        console.log('Entries:', breakdown.entries);
      }
    } else {
      console.log('No breakdown found or no entries.');
    }
  } catch (err) {
    console.error('Error fetching breakdown:', err);
  } finally {
    process.exit(0);
  }
}

inspect();

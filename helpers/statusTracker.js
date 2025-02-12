const fs = require('fs');
const statusFile = './listingStatus.json';

// Load existing statuses from a file
function loadStatuses() {
  if (!fs.existsSync(statusFile)) return {};
  return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
}

// Get previous status of a listing
async function getPreviousStatus(listingId) {
  const statuses = loadStatuses();
  return statuses[listingId] || null;
}

// Save new status to the file
async function saveStatus(listingId, newStatus) {
  const statuses = loadStatuses();
  statuses[listingId] = newStatus;
  fs.writeFileSync(statusFile, JSON.stringify(statuses, null, 2), 'utf8');
}

module.exports = { getPreviousStatus, saveStatus };

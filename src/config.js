const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { promoUrl: '', promoDesc: '', tasks: [], platforms: {}, logs: [] };
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { loadConfig, saveConfig };

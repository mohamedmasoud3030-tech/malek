const fs = require('node:fs');
const path = require('node:path');

const orig = fs.readFileSync;
fs.readFileSync = function remapArchivedMigrations(file, options) {
  try {
    return orig.call(this, file, options);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const raw = String(file);
    const marker = `${path.sep}supabase${path.sep}migrations${path.sep}`;
    const idx = raw.lastIndexOf(marker);
    if (idx === -1) throw error;
    const alt = raw.replace(
      `${path.sep}supabase${path.sep}migrations${path.sep}`,
      `${path.sep}supabase${path.sep}migrations_history${path.sep}`,
    );
    return orig.call(this, alt, options);
  }
};

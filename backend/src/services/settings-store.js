import fs from 'node:fs/promises';
import path from 'node:path';

const settingsFile = process.env.CRM_SETTINGS_FILE || '/app/data/settings.json';
export const defaultSettings = {
  maxConcurrency: 3, batchSize: 10, maxAttempts: 3,
  callingStart: '09:00', callingEnd: '19:00', timezone: 'Europe/Madrid',
  notificationEmail: 'alerts@example.com',
  notificationBcc: 'audit@example.com', requireHumanApproval: true,
  respectDoNotCall: true,
};

export async function readSettings() {
  try {
    const stored = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
    return { ...defaultSettings, ...stored };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { ...defaultSettings };
  }
}

export async function writeSettings(settings) {
  await fs.mkdir(path.dirname(settingsFile), { recursive: true });
  const temporary = `${settingsFile}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(settings, null, 2), { mode: 0o600 });
  await fs.rename(temporary, settingsFile);
  return settings;
}

function normalizeClientName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/&/g, ' Y ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readExcludedPatterns() {
  const encoded = process.env.CAMPAIGN_EXCLUDED_CLIENT_PATTERNS_B64;
  if (!encoded) return [];

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return Array.isArray(parsed) ? parsed.map(normalizeClientName).filter(Boolean) : [];
  } catch {
    console.error('CAMPAIGN_EXCLUDED_CLIENT_PATTERNS_B64 no contiene una lista válida.');
    return [];
  }
}

const excludedPatterns = readExcludedPatterns();

function containsPattern(value, pattern) {
  const normalized = normalizeClientName(value);
  return normalized === pattern ||
    normalized.startsWith(`${pattern} `) ||
    normalized.endsWith(` ${pattern}`) ||
    normalized.includes(` ${pattern} `);
}

export function isCampaignClientExcluded(record = {}) {
  if (!excludedPatterns.length) return false;
  const values = [record.customer_name, record.contact_name];
  return excludedPatterns.some((pattern) => values.some((value) => containsPattern(value, pattern)));
}


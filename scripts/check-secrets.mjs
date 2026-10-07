import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const forbiddenPaths = [/(^|\/)\.env($|\.)/, /(^|\/)\.deploy\//, /(^|\/)work\//, /\.(pem|key|p12|pfx)$/i];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/,
  /\bservice_role\b[^\n=]*=[^\n]{20,}/i,
];

let files = [];
try {
  files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch {
  console.error('No se pudo obtener la lista de archivos versionados.');
  process.exit(1);
}

const unsafePaths = files.filter((file) =>
  forbiddenPaths.some((pattern) => pattern.test(file)) && !file.endsWith('.example'),
);
const unsafeContents = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (secretPatterns.some((pattern) => pattern.test(content))) unsafeContents.push(file);
}

if (unsafePaths.length || unsafeContents.length) {
  console.error('Revisión fallida: hay archivos o contenidos sensibles versionados.');
  for (const file of [...new Set([...unsafePaths, ...unsafeContents])]) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Revisión superada: ${files.length} archivos sin secretos detectables.`);

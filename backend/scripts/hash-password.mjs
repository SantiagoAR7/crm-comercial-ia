import { randomBytes, scryptSync } from 'node:crypto';
import { stdin, stdout, stderr, exit } from 'node:process';
import { createInterface } from 'node:readline/promises';

const password = process.argv[2];

async function readPassword() {
  if (password) return password;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question('Contraseña: ');
  rl.close();
  return answer;
}

const plain = await readPassword();
if (!plain || plain.length < 8) {
  stderr.write('La contraseña debe tener al menos 8 caracteres.\n');
  exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(plain, salt, 64);
stdout.write(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}\n`);

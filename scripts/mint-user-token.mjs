/**
 * Genera un JWT de usuario para Agent Studio Memory (header
 * `X-Algolia-Secure-User-Token`). Firma HS256 con tu authentication key.
 *
 * El secreto NUNCA debe ir al navegador: este script corre en Node y solo
 * imprime el token, que luego pegas en .env.local como VITE_ALGOLIA_USER_TOKEN.
 *
 * Requisitos (créalos en Agent Studio > Settings > User authentication):
 *   ALGOLIA_KEY_ID      = id de la authentication key (columna ID)
 *   ALGOLIA_SECRET_KEY  = la key sk-alg-...
 *
 * Uso (PowerShell):
 *   $env:ALGOLIA_KEY_ID=""; $env:ALGOLIA_SECRET_KEY=""; node scripts/mint-user-token.mjs usuario-demo
 * 
 * Uso (bash):
 *   ALGOLIA_KEY_ID=... ALGOLIA_SECRET_KEY=sk-alg-... node scripts/mint-user-token.mjs usuario-demo
 */
import { createHmac } from 'node:crypto';

const KEY_ID = process.env.ALGOLIA_KEY_ID;
const SECRET = process.env.ALGOLIA_SECRET_KEY;
const SUBJECT = process.argv[2] || 'usuario-demo';
const TTL_HOURS = Number(process.env.TOKEN_TTL_HOURS || 24);

if (!KEY_ID || !SECRET) {
  console.error(
    'Falta ALGOLIA_KEY_ID y/o ALGOLIA_SECRET_KEY en el entorno.\n' +
      'Créalos en Agent Studio > Settings > User authentication > Create authentication key.'
  );
  process.exit(1);
}

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const header = { alg: 'HS256', typ: 'JWT', kid: KEY_ID };
const payload = {
  sub: SUBJECT, // identificador único del usuario => scope de la memoria
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + TTL_HOURS * 3600,
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const signature = createHmac('sha256', SECRET)
  .update(signingInput)
  .digest('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const token = `${signingInput}.${signature}`;

console.log(`\nJWT para sub="${SUBJECT}", expira en ${TTL_HOURS}h:\n`);
console.log(token);
console.log('\nPégalo en .env.local:\n');
console.log(`VITE_ALGOLIA_USER_TOKEN=${token}\n`);

/**
 * Crea y puebla el índice de PROMPT SUGGESTIONS que consume el buscador
 * (widget EXPERIMENTAL_autocomplete -> showPromptSuggestions).
 *
 * Agent Studio NO genera este índice (sus "prompt suggestions" son chips
 * dinámicos del chat). El buscador necesita un índice propio cuyos registros
 * tengan `query` (texto del prompt) y, opcional, `label`. Al seleccionar una
 * sugerencia, el widget abre el chat con ese prompt.
 *
 * Requiere una ADMIN/WRITE API key (la search-only no puede escribir). El
 * secreto NUNCA va al navegador: este script corre en Node.
 *
 * Requeridas:
 *   ALGOLIA_APP_ID     = tu Application ID
 *   ALGOLIA_ADMIN_KEY  = key con permisos addObject + editSettings
 * Opcional:
 *   PROMPT_INDEX       = nombre del índice (default productos_prompt_suggestions)
 *
 * Uso (PowerShell):
 *   $env:ALGOLIA_APP_ID="..."; $env:ALGOLIA_ADMIN_KEY="..."; node scripts/seed-prompt-suggestions.mjs
 *
 * Uso (bash):
 *   ALGOLIA_APP_ID=... ALGOLIA_ADMIN_KEY=... node scripts/seed-prompt-suggestions.mjs
 */

const APP_ID = process.env.ALGOLIA_APP_ID;
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const INDEX = process.env.PROMPT_INDEX || 'productos_prompt_suggestions';

if (!APP_ID || !ADMIN_KEY) {
  console.error(
    'Faltan variables de entorno.\n' +
      '  ALGOLIA_APP_ID    = tu Application ID\n' +
      '  ALGOLIA_ADMIN_KEY = key con permisos addObject + editSettings\n' +
      'La key la obtienes en Algolia > Settings > API Keys (Admin API Key u otra con escritura).'
  );
  process.exit(1);
}

// Prompts curados (tienda de tecnología CTonline). `query` es el texto que se
// inserta/manda al chat; `label` es un texto corto de apoyo. objectID fijo para
// que re-correr el script sea idempotente (actualiza, no duplica).
const SUGGESTIONS = [
  { objectID: 'ps-1', query: '¿Qué laptop me recomiendas para diseño gráfico?', label: 'Laptops' },
  { objectID: 'ps-2', query: 'Mejores mouse inalámbricos por menos de $500', label: 'Periféricos' },
  { objectID: 'ps-3', query: 'Quiero un monitor para home office', label: 'Monitores' },
  { objectID: 'ps-4', query: '¿Qué SSD es más rápido para mi PC?', label: 'Almacenamiento' },
  { objectID: 'ps-5', query: 'Teclados mecánicos para gaming', label: 'Gaming' },
  { objectID: 'ps-6', query: 'Router WiFi 6 para una casa grande', label: 'Redes' },
  { objectID: 'ps-7', query: 'Necesito una webcam HD para videollamadas', label: 'Video' },
  { objectID: 'ps-8', query: '¿Qué impresora láser conviene para una oficina pequeña?', label: 'Impresión' },
];

const base = `https://${APP_ID}.algolia.net/1/indexes/${INDEX}`;
const headers = {
  'X-Algolia-Application-Id': APP_ID,
  'X-Algolia-API-Key': ADMIN_KEY,
  'Content-Type': 'application/json',
};

const req = async (method, path, body) => {
  const res = await fetch(`https://${APP_ID}.algolia.net/1/indexes${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
};

try {
  console.log(`Índice: ${INDEX} (app ${APP_ID})`);

  // 1) Settings: solo `query`/`label` buscables; sin typo agresivo.
  console.log('• Configurando settings…');
  await req('PUT', `/${INDEX}/settings`, {
    searchableAttributes: ['query', 'label'],
    attributesToHighlight: ['query'],
    minWordSizefor1Typo: 4,
    minWordSizefor2Typos: 8,
  });

  // 2) Subir registros (updateObject = upsert idempotente).
  console.log(`• Subiendo ${SUGGESTIONS.length} prompt suggestions…`);
  const { taskID } = await req('POST', `/${INDEX}/batch`, {
    requests: SUGGESTIONS.map((body) => ({ action: 'updateObject', body })),
  });

  // 3) Esperar a que el task se aplique.
  if (taskID) {
    console.log('• Esperando indexación…');
    for (let i = 0; i < 30; i++) {
      const { status } = await req('GET', `/${INDEX}/task/${taskID}`);
      if (status === 'published') break;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n✓ Listo. ${SUGGESTIONS.length} sugerencias en "${INDEX}".`);
  console.log('  Verifica en .env.local:  VITE_ALGOLIA_PROMPT_INDEX=' + INDEX);
  console.log('  Reinicia el dev server y escribe en el buscador para verlas.');
} catch (err) {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
}

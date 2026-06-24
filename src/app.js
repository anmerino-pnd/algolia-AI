// ============================================================================
//  Mockup local de UX — Algolia Agent Studio (CTonline Shopping Assistant)
//  - (a) Chat conversacional  -> widget `chat` + `chatTrigger`
//  - (b) Search bar con IA     -> widget `EXPERIMENTAL_autocomplete`
//  Base del snippet del dashboard, limpiada y comentada. Ver SPEC.md.
// ============================================================================

import { liteClient as algoliasearch } from 'algoliasearch/lite';
import instantsearch from 'instantsearch.js';
import {
  chat,
  chatTrigger,
  EXPERIMENTAL_autocomplete as autocomplete,
} from 'instantsearch.js/es/widgets';

// Tema satélite: en instantsearch.css 8.17 incluye los estilos de `ais-Chat`
// y `ais-Autocomplete` (no existe ya el import por componente del SPEC original).
import 'instantsearch.css/themes/satellite.css';
import './styles.css';

// ---------------------------------------------------------------------------
// Configuración / credenciales. TODO se lee de variables de entorno VITE_*
// (desde .env.local, que está en .gitignore). Este repo es PÚBLICO, así que no
// se hardcodea ninguna credencial. Copia .env.example a .env.local y rellénalo.
// ---------------------------------------------------------------------------
const APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID;
const SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_KEY;
const AGENT_ID = import.meta.env.VITE_ALGOLIA_AGENT_ID;
const INDEX = import.meta.env.VITE_ALGOLIA_INDEX || 'productos';
// Índice de query suggestions (sugerencias de búsqueda reales). Tiene atributo `query`.
const QS_INDEX = import.meta.env.VITE_ALGOLIA_QS_INDEX || `${INDEX}_query_suggestions`;

if (!APP_ID || !SEARCH_KEY || !AGENT_ID) {
  throw new Error(
    'Faltan credenciales de Algolia. Copia .env.example a .env.local y define ' +
      'VITE_ALGOLIA_APP_ID, VITE_ALGOLIA_SEARCH_KEY y VITE_ALGOLIA_AGENT_ID.'
  );
}

// Índice de PROMPT suggestions (sugerencias de IA que abren el chat al
// seleccionarse; registros con `query` + opcional `label`). Es un índice
// DEDICADO y DISTINTO al de query suggestions; NO lo genera Agent Studio, lo
// creas tú (ver scripts/seed-prompt-suggestions.mjs). OJO: si apunta a un índice
// inexistente, la multiconsulta del autocomplete devuelve 404 y rompe TODO el
// dropdown; por eso solo se activa si esta env var está definida.
const PROMPT_INDEX = import.meta.env.VITE_ALGOLIA_PROMPT_INDEX || '';

// (Memoria, opcional) JWT de usuario para `X-Algolia-Secure-User-Token`.
// Si está presente, el chat se conecta con memoria por usuario; ver scripts/mint-user-token.mjs.
const USER_TOKEN = import.meta.env.VITE_ALGOLIA_USER_TOKEN || '';

const searchClient = algoliasearch(APP_ID, SEARCH_KEY);

// El widget `chat` construye internamente la URL de completions:
//   https://<APP_ID>.algolia.net/agent-studio/1/agents/<AGENT_ID>/completions?compatibilityMode=ai-sdk-5
// (verificado en connectChat.js). Solo necesita `agentId` + el searchClient.
const COMPLETIONS_API = `https://${APP_ID}.algolia.net/agent-studio/1/agents/${AGENT_ID}/completions?compatibilityMode=ai-sdk-5`;

// Se pasa `indexName` raíz por si InstantSearch lo reclama al arrancar (§12.3).
const search = instantsearch({ searchClient, indexName: INDEX });

// ---------------------------------------------------------------------------
// Template de tarjeta de producto para el chat. OBLIGATORIO cuando el agente
// usa una search tool; si falta, los resultados no se renderizan.
// Defensivo: los atributos reales del índice pueden variar (§12.1), así que
// probamos varios nombres y degradamos con elegancia.
// ---------------------------------------------------------------------------
function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function productItem(item, { html }) {
  const image = pick(item, ['imagen_url', 'image_url', 'image', 'imagen', 'thumbnail']);
  const title = pick(item, ['descripcion', 'nombre', 'name', 'title']) || 'Producto';
  const sku = pick(item, ['clave', 'sku', 'objectID']);
  const brand = pick(item, ['marca', 'brand']);
  const price = pick(item, ['precio_mxn', 'precio', 'price']);

  const url = pick(item, ['url', 'link', 'product_url']);
  const card = html`
    <article class="product-card">
      ${image
        ? html`<img
            class="product-card__img"
            src=${image}
            alt=${title}
            loading="lazy"
            referrerpolicy="no-referrer"
          />`
        : html`<div class="product-card__img product-card__img--ph"></div>`}
      <div class="product-card__body">
        <h3 class="product-card__title">${title}</h3>
        ${brand ? html`<p class="product-card__brand">${brand}</p>` : null}
        ${sku ? html`<p class="product-card__sku">SKU: ${sku}</p>` : null}
        ${price != null
          ? html`<p class="product-card__price">$${price}</p>`
          : null}
      </div>
    </article>
  `;

  return url
    ? html`<a class="product-card__link" href=${url} target="_blank" rel="noopener">${card}</a>`
    : card;
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------
// El widget `chat` arma su transport con headers fijos cuando recibe `agentId`.
// Para inyectar el token de memoria (`X-Algolia-Secure-User-Token`) hay que usar
// la opción `transport` y OMITIR `agentId` (el feedback con pulgares depende de
// `agentId`, así que en modo memoria se desactiva). Elegimos uno u otro:
const MEMORY_ON = Boolean(USER_TOKEN);

const chatOptions = MEMORY_ON
  ? {
      container: '#chat',
      // Transport manual con el token de usuario => memoria por usuario.
      transport: {
        api: COMPLETIONS_API,
        headers: {
          'x-algolia-application-id': APP_ID,
          'x-algolia-api-key': SEARCH_KEY,
          'X-Algolia-Secure-User-Token': USER_TOKEN,
        },
      },
      templates: { item: productItem },
    }
  : {
      container: '#chat',
      agentId: AGENT_ID,
      feedback: true, // pulgares arriba/abajo en las respuestas
      templates: { item: productItem },
    };

search.addWidgets([
  // (b) SEARCH BAR CON IA — superficie clave a analizar.
  autocomplete({
    container: '#searchbox',
    aiMode: true, // toggle "AI mode" (se conecta con el widget chat)
    placeholder: 'Busca productos o pregúntale a la IA…',
    searchParameters: { hitsPerPage: 5 },
    // Resultados de producto en vivo (search-as-you-type), con imagen.
    indices: [{ indexName: INDEX, templates: { item: productItem } }],
    // Sugerencias de búsqueda reales (atributo `query`).
    showQuerySuggestions: { indexName: QS_INDEX },
    // PROMPT suggestions (sugerencias de IA que abren el chat al seleccionarse).
    // Solo se incluye si VITE_ALGOLIA_PROMPT_INDEX apunta a un índice EXISTENTE;
    // si no, se omite para no romper el dropdown con un 404 (ver nota en PROMPT_INDEX).
    ...(PROMPT_INDEX ? { showPromptSuggestions: { indexName: PROMPT_INDEX } } : {}),
  }),

  // (a) CHAT conversacional.
  chat(chatOptions),

  // Botón flotante que abre/cierra el panel de chat.
  chatTrigger({
    container: '#chat-trigger',
  }),
]);

search.start();

// ---------------------------------------------------------------------------
// Panel de observación de UX (§9) — checklist + notas + contexto.
// ---------------------------------------------------------------------------
const OBS_CHECKLIST = [
  {
    group: 'Search bar con IA (modo dual)',
    items: [
      '¿Cómo se ofrece el toggle de "AI mode"? ¿Es obvio en qué modo está el usuario?',
      'Modo normal: ¿se comporta como autocomplete / search-as-you-type?',
      'AI mode: al enviar una pregunta, ¿abre el chat con el contexto de la pregunta?',
      'Sugerencias de prompt: ¿aparecen al escribir? ¿son relevantes? ¿abren el chat?',
    ],
  },
  {
    group: 'Chat',
    items: [
      'Latencia hasta el primer token y sensación del streaming.',
      'Pasos de "Reasoning" y "Tool used": ¿se ven? ¿ayudan o son ruido?',
      'Render de tarjetas: imagen, nombre, precio, link.',
      'Feedback (pulgares) y su affordance.',
    ],
  },
  {
    group: 'Handoff y contexto',
    items: [
      'La transición search bar → chat, ¿conserva la intención del usuario?',
      'Responsividad del overlay en desktop vs. móvil (probar con devtools).',
    ],
  },
];

function renderObservationPanel() {
  const apiEl = document.getElementById('obs-api');
  if (apiEl) apiEl.textContent = COMPLETIONS_API;

  const memEl = document.getElementById('obs-memory');
  if (memEl) {
    memEl.textContent = MEMORY_ON
      ? 'ON (token de usuario presente · feedback desactivado)'
      : 'OFF (sin token · feedback activo)';
    memEl.className = MEMORY_ON ? 'obs-on' : 'obs-off';
  }

  const vpEl = document.getElementById('obs-viewport');
  const updateViewport = () => {
    if (vpEl) vpEl.textContent = `${window.innerWidth}×${window.innerHeight}px`;
  };
  updateViewport();
  window.addEventListener('resize', updateViewport);

  const checklistEl = document.getElementById('obs-checklist');
  if (checklistEl) {
    checklistEl.innerHTML = OBS_CHECKLIST.map(
      (block, gi) => `
        <fieldset class="obs-group">
          <legend>${block.group}</legend>
          ${block.items
            .map((text, ii) => {
              const id = `chk-${gi}-${ii}`;
              return `<label class="obs-item"><input type="checkbox" id="${id}" /> <span>${text}</span></label>`;
            })
            .join('')}
        </fieldset>`
    ).join('');
  }

  // Toggle colapsable.
  const panel = document.getElementById('obs-panel');
  const toggle = document.getElementById('obs-toggle');
  if (panel && toggle) {
    toggle.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }
}

renderObservationPanel();

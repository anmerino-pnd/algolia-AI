# SPEC — Mockup local de UX para Algolia Agent Studio (CTonline Shopping Assistant)

> Documento de especificación para construir, con Claude Code, una app web **local** que sirva como visualizador / mockup para probar y analizar la UX de dos superficies de Algolia Agent Studio: el **chat conversacional** y el **search bar con IA**.

---

## 1. Propósito y alcance

Construir una app web mínima, **solo para correr en localhost**, que conecte con el agente ya publicado en Agent Studio y permita evaluar la experiencia de usuario de:

- **(a) Chat conversacional** — botón flotante (`chatTrigger`) que abre un panel de chat (`chat`).
- **(b) Search bar con IA** — barra de búsqueda con "AI mode" y sugerencias de prompt (`EXPERIMENTAL_autocomplete`).

Es un artefacto **desechable de evaluación**: no se despliega a producción ni a dev. El objetivo es ver "cómo se vería" y "qué se necesita para implementarlo", y juzgar la UX de ambas herramientas.

### Fuera de alcance

- Autenticación, despliegue, analítica, build de producción.
- Persistencia de conversaciones server-side (existe vía `id` de conversación + `id` de mensaje en la API, mencionada en §11 por si se quisiera después).

---

## 2. Lo que ya existe (confirmado funcionando)

- Agente configurado y **publicado** en Agent Studio (estado Draft → Published).
- Código de implementación generado por el dashboard (InstantSearch.js vanilla).
- Credenciales e IDs (ver §4).

---

## 3. Stack técnico

| Pieza                | Elección                                                                               | Razón                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Bundler / dev server | **Vite** (plantilla `vanilla`)                                                  | El dashboard generó el snippet en InstantSearch.js**vanilla**; lo replicamos sin framework. Arranque y HMR instantáneos. |
| UI de Algolia        | `instantsearch.js` + widgets `chat`, `chatTrigger`, `EXPERIMENTAL_autocomplete` | Son los widgets del snippet oficial.                                                                                             |
| Cliente de búsqueda | `algoliasearch/lite`                                                                  | Suficiente para search-only.                                                                                                     |
| Estilos              | `instantsearch.css` (chat) + CSS propio mínimo                                       | Estilos base de Algolia + layout sencillo.                                                                                       |
| Node                 | 18+                                                                                     | Requisito de Vite.                                                                                                               |

> Alternativa: existe versión **React InstantSearch** (`<InstantSearch>` + `<Chat>`) y un **AI SDK UI** (`@ai-sdk/react` + `useChat`). No se usan aquí para mantener el mockup idéntico al snippet generado, pero quedan como opción si se prefiere React.

---

## 4. Configuración / credenciales

```
APP_ID      = <tu Application ID>
SEARCH_KEY  = <tu Search-Only API Key>   # search-only (read), segura para el navegador
AGENT_ID    = <tu Agent ID de Agent Studio>
INDEX       = <tu índice de productos, p.ej. prod_productos>
```

- Van en `.env.local` con prefijo `VITE_` (`VITE_ALGOLIA_APP_ID`, etc.). `.env.local` está en `.gitignore`. **Este repo es público: nunca hardcodees credenciales** en `app.js`/`SPEC.md`. Copia `.env.example` a `.env.local` y rellena los valores.
- **Nota de seguridad:** las *search-only API keys* están diseñadas para vivir en el cliente, pero no conviene publicarlas en un repo público (los bots escanean GitHub y se podría abusar de la cuota o scrapear el índice). Para producción, acota la key (rate limits, atributos permitidos).

---

## 5. Estructura del proyecto

```
algolia-ux-mockup/
├─ index.html          # contiene #searchbox, #chat, #chat-trigger + layout de tienda falsa
├─ src/
│  ├─ app.js           # InstantSearch + widgets (base del snippet, limpiado y comentado)
│  └─ styles.css       # layout mínimo + panel de observación
├─ .env.local          # (opcional) credenciales VITE_*
└─ package.json
```

---

## 6. Setup / dependencias

```bash
npm create vite@latest algolia-ux-mockup -- --template vanilla
cd algolia-ux-mockup
npm i algoliasearch instantsearch.js instantsearch.css
```

> **Pinear versiones:** `EXPERIMENTAL_autocomplete` es experimental y su API puede cambiar. Fijar versiones exactas de `instantsearch.js` en `package.json` para que el mockup no se rompa con un update.

---

## 7. Layout del mockup (qué se ve en pantalla)

Una sola página que simule un contexto de tienda realista, para que ambas superficies se juzguen "en su hábitat":

- **Header** con el **search bar con IA** (`#searchbox`) centrado, estilo buscador de e-commerce.
- **Cuerpo** con contenido placeholder (un hero + unas tarjetas de producto falsas o una grilla simple) para dar contexto visual. No necesita datos reales; es solo escenografía.
- **Botón flotante de chat** (`#chat-trigger`) abajo a la derecha, que abre el **panel de chat** (`#chat`).
- **Panel de observación** colapsable (lateral o inferior) para anotar hallazgos de UX y, opcionalmente, instrumentación (ver §9–10).

Diseño visual: limpio, neutro, no hace falta branding de CTonline. Prioridad a que se distingan claramente las dos superficies y se puedan accionar.

---

## 8. Comportamiento base (a partir del snippet ya funcional)

`index.html` debe incluir los tres contenedores: `#searchbox`, `#chat`, `#chat-trigger`.

`src/app.js` (base limpiada del código que entregó el dashboard — ajustar atributos del template según §12):

```js
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import instantsearch from 'instantsearch.js';
import { chat, chatTrigger, EXPERIMENTAL_autocomplete } from 'instantsearch.js/es/widgets';
import 'instantsearch.css/components/chat.css';

// Las credenciales se leen de .env.local (prefijo VITE_); nunca hardcodear (repo público).
const APP_ID     = import.meta.env.VITE_ALGOLIA_APP_ID;
const SEARCH_KEY  = import.meta.env.VITE_ALGOLIA_SEARCH_KEY;
const AGENT_ID    = import.meta.env.VITE_ALGOLIA_AGENT_ID;
const INDEX       = import.meta.env.VITE_ALGOLIA_INDEX;

const searchClient = algoliasearch(APP_ID, SEARCH_KEY);

// Si InstantSearch reclama un índice raíz, añadir: { searchClient, indexName: INDEX }
const search = instantsearch({ searchClient });

search.addWidgets([
  // (b) SEARCH BAR CON IA — superficie clave a analizar
  EXPERIMENTAL_autocomplete({
    container: '#searchbox',
    aiMode: true,                                  // habilita el toggle "AI mode"
    showPromptSuggestions: { indexName: INDEX },   // sugerencias de prompt al escribir
  }),

  // (a) CHAT
  chat({
    container: '#chat',
    agentId: AGENT_ID,
    feedback: true,                                // pulgares arriba/abajo en respuestas
    templates: {
      // OBLIGATORIO si el agente usa search tool: define cómo se ven los resultados.
      // Ajustar atributos a los reales del índice (ver §12).
      item: (item, { html }) => html`
        <article class="product-card">
          <img src=${item.imagen_url} alt=${item.descripcion} />
          <h3>${item.descripcion}</h3>
          <p>${item.clave}</p>
        </article>
      `,
    },
  }),

  // botón flotante que abre el chat
  chatTrigger({
    container: '#chat-trigger',
  }),
]);

search.start();
```

Notas para Claude Code:

- El `templates.item` (o `itemComponent` en React) **es obligatorio** cuando el agente usa una search tool; sin él los resultados no se renderizan bien en el chat.
- Si `EXPERIMENTAL_autocomplete` no existe en la versión instalada o cambió de nombre, revisar el changelog/exports de `instantsearch.js/es/widgets` y ajustar.

---

## 9. Objetivos de evaluación de UX (el "para qué" del mockup)

Esto es el núcleo del motivo #2. El mockup debe permitir **observar y comparar** lo siguiente. Idealmente, renderizar esta lista como un checklist visible en el panel de observación:

**Search bar con IA (modo dual)**

- ¿Cómo se ofrece el toggle de "AI mode"? ¿Es obvio en qué modo está el usuario?
- En modo normal: ¿se comporta como autocomplete / search-as-you-type?
- En AI mode: al enviar una pregunta, ¿qué pasa? ¿abre el chat con el contexto de la pregunta?
- Sugerencias de prompt: ¿aparecen al escribir? ¿son relevantes? ¿iniciar una sugerencia abre el chat?

**Chat**

- Latencia hasta el primer token y sensación del streaming.
- Cómo se muestran los pasos de "Reasoning" y los "Tool used" (¿se ven?, ¿son ruido o ayudan?).
- Render de las tarjetas de producto: imagen, nombre, precio, link.
- Feedback (pulgares) y su affordance.

**Handoff y contexto**

- ¿La transición search bar → chat conserva la intención del usuario?
- Responsividad del overlay en desktop vs. móvil (probar con devtools).

---

## 10. Instrumentación opcional (stretch)

Para que el mockup sea una herramienta de análisis y no solo un clon:

- **Visualizar tool calls:** usar la opción `tools` del widget `chat` con un `layoutComponent`/template propio para mostrar cuándo se dispara `algolia_search_index_*` y con qué query. (Ver la sección "Tools" de la doc de integración.)
- **Latencia:** registrar timestamps de envío y de primer/último token; mostrarlos en el panel.
- **Comparador A/B de modo:** un switch para forzar `aiMode: true/false` y comparar la barra lado a lado.

---

## 11. Persistencia (referencia, no requerido)

Si más adelante se quisiera historial server-side, la API de completions acepta `id` de conversación (prefijo `alg_cnv_`) e `id` por mensaje (prefijo `alg_msg_`), y luego se recupera con la Conversations API. No se implementa en este mockup.

---

## 12. Verificar antes / durante el build (importante)

1. **Atributos reales del índice `demo_productos`:** confirmar en el Index Browser de Algolia que existen `imagen_url`, `descripcion` y `clave`. Si el campo de imagen tiene otro nombre, las tarjetas saldrán sin imagen. Ajustar el template a los atributos reales (en `prod_productos` se usaban `descripcion`, `clave`, `marca`, `precio_mxn`, etc.).
2. **¿Qué índice busca el agente publicado?** El `AGENT_ID` debe apuntar al mismo índice cuyos atributos espera el template. Antes trabajábamos con `prod_productos` y el snippet usa `demo_productos`; alinear ambos o ajustar el template en consecuencia.
3. **Índice raíz de InstantSearch:** si arranca con error por falta de índice, pasar `indexName: INDEX` a `instantsearch({ ... })`.
4. **Versión del widget experimental:** pinear y verificar que el export `EXPERIMENTAL_autocomplete` siga vigente.

---

## 13. Cómo correrlo

```bash
npm run dev
# abrir http://localhost:5173
```

Criterio de "listo": la página carga; el search bar muestra el toggle de AI mode y sugerencias al escribir; el botón flotante abre el chat; una pregunta de producto (ej. "quiero un mouse inalámbrico") devuelve tarjetas con imagen, nombre y clave; el panel de observación lista el checklist de §9.

---

## 14. Referencias

- Integración Agent Studio: https://www.algolia.com/doc/guides/algolia-ai/agent-studio/how-to/integration
- Dashboard Agent Studio: https://www.algolia.com/doc/guides/algolia-ai/agent-studio/how-to/dashboard
- SearchBox (React, referencia de widget): https://www.algolia.com/doc/api-reference/widgets/search-box/react

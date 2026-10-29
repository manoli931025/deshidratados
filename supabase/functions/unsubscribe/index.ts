// Supabase Edge Function: unsubscribe
// Baja del boletín mediante un enlace firmado (HMAC). El suscriptor recibe
// en su email un enlace personalizado que esta función valida antes de borrar.
//
// Uso:
//   GET  /functions/v1/unsubscribe?e=<email>&s=<firma>
//     → página de confirmación con botón (NO borra nada)
//   POST /functions/v1/unsubscribe  (cuerpo: e, s; admite JSON o formulario)
//     → borra al suscriptor y muestra la página de éxito
//
// SEGURIDAD:
//   - La firma es HMAC-SHA256(email, clave de servicio). Sin la clave no se
//     puede dar de baja a un tercero adivinando URLs.
//   - El GET no borra nada: solo la confirmación POST ejecuta la baja.
//     Gmail y Outlook precargan los enlaces de los correos (escáneres de
//     seguridad), así que un GET que borrara daría de baja a personas sin
//     que pulsen nada.
//   - Debe desplegarse con "Verify JWT" DESACTIVADO, porque el navegador
//     del suscriptor no lleva la cabecera Authorization de Supabase.
//     Ver NEWSLETTER_SETUP.md, Paso 3.
//
// NO necesita secretos nuevos: usa la misma clave de servicio de Supabase
// que send-email (inyectada automáticamente por la plataforma).
//
// NUNCA pegues aquí API keys: este fichero va al repositorio.

// El prefijo `npm:` en línea es el patrón que documenta Supabase para
// Edge Functions (no hay deno.json en la nube), por eso se ignora la
// regla que prefiere declararlo como dependencia.
// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Enlace de vuelta a la tienda (misma URL que usa el email de bienvenida).
const SHOP_URL = 'https://manoli931025.github.io/deshidratados/';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return page('Método no permitido', '<p>Usa GET o POST.</p>', 405);
  }

  try {
    // GET: los parámetros llegan en la query. POST: en el cuerpo del
    // formulario (application/x-www-form-urlencoded) o en JSON.
    const url = new URL(req.url);
    let email = url.searchParams.get('e') || '';
    let sig = url.searchParams.get('s') || '';

    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        email = String(body.e ?? '');
        sig = String(body.s ?? '');
      } else {
        const form = new URLSearchParams(await req.text().catch(() => ''));
        email = form.get('e') || '';
        sig = form.get('s') || '';
      }
    }

    email = email.trim().toLowerCase();
    sig = sig.trim();

    if (!email || !sig) {
      return page('Baja del boletín', invalidBody(), 400);
    }

    const serviceKey = getServiceKey();
    const expected = await hmacHex(email, serviceKey);
    if (!safeEqual(expected, sig)) {
      // Firma incorrecta: no se toca la base de datos.
      console.error('[unsubscribe] Firma no válida para', email);
      return page('Baja del boletín', invalidBody(), 400);
    }

    if (req.method === 'GET') {
      // Confirmación ANTES de borrar (ver nota de seguridad arriba).
      return page('Confirmar baja', confirmBody(email, sig));
    }

    // --- POST: baja real ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const db = createClient(supabaseUrl, serviceKey);

    // ilike con los comodines escapados: casa sin distinguir mayúsculas
    // (el índice único de la tabla es sobre lower(trim(email)) y el valor
    // guardado pudo escribirse con otras mayúsculas). Con los comodines
    // escapados solo puede coincidir con esa dirección exacta.
    const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { error } = await db.from('subscribers').delete().ilike('email', pattern);

    if (error) {
      console.error('[unsubscribe] No se pudo borrar el suscriptor:', error.message);
      return page(
        'Algo salió mal',
        '<h2>No se pudo completar la baja</h2>' +
          '<p>Ha habido un problema técnico. Inténtalo de nuevo en unos minutos.</p>',
        500
      );
    }

    // Idempotente: si ya no estaba suscrito, también sale "Listo".
    return page('Baja completada', successBody());
  } catch (err) {
    console.error('[unsubscribe] Error inesperado:', err);
    return page(
      'Algo salió mal',
      '<h2>No se pudo completar la baja</h2>' +
        '<p>Ha habido un problema técnico. Inténtalo de nuevo en unos minutos.</p>',
      500
    );
  }
});

// ============================================================
// Firma HMAC
// ============================================================

/**
 * HMAC-SHA256 en hexadecimal del correo, con la clave de servicio.
 * Es la misma operación que hace send-email al generar el enlace.
 */
async function hmacHex(email: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(email));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparación en tiempo constante: evita adivinar la firma carácter a carácter. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lee la clave de servicio, soportando ambos sistemas de claves. */
function getServiceKey(): string {
  const fromNew = (() => {
    try {
      const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
      return keys['default'] || keys['secret'] || '';
    } catch {
      return '';
    }
  })();

  const key = fromNew || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!key) {
    throw new Error('Falta la clave de servicio de Supabase en los secrets.');
  }
  return key;
}

// ============================================================
// Páginas (HTML con el estilo de la tienda)
// ============================================================

/** Escapa caracteres especiales para insertar texto en HTML. */
function esc(s: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, (c) => entities[c] || c);
}

function confirmBody(email: string, sig: string): string {
  return `
    <h2>¿Darte de baja del boletín?</h2>
    <p>Dejarás de recibir ofertas y novedades de Solaria.
       Podrás volver a suscribirte cuando quieras desde la tienda.</p>
    <form method="POST">
      <input type="hidden" name="e" value="${esc(email)}">
      <input type="hidden" name="s" value="${esc(sig)}">
      <button class="btn" type="submit">Sí, darme de baja</button>
    </form>
    <p class="muted">Si no fuiste tú quien abrió este enlace, no hagas nada:
       sin pulsar el botón, no cambia nada.</p>`;
}

function successBody(): string {
  return `
    <h2>¡Listo! Ya estás dado de baja</h2>
    <p>No recibirás más boletines de Solaria.</p>
    <p class="muted">Si cambiaste de opinión, puedes suscribirte de nuevo
       desde el pie de la tienda.</p>
    <p><a class="btn" href="${SHOP_URL}">Volver a la tienda</a></p>`;
}

function invalidBody(): string {
  return `
    <h2>Este enlace no es válido</h2>
    <p>El enlace de baja está incompleto o no lo reconocemos. Algunos clientes
       de correo cortan los enlaces largos: copia el enlace completo del
       último boletín que recibiste.</p>
    <p class="muted">También puedes escribirnos desde la tienda y te damos
       de baja nosotros.</p>`;
}

/** Envuelve el cuerpo en la página con el estilo de Solaria. */
function page(title: string, body: string, status = 200): Response {
  const doc = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} · Solaria</title>
  <style>
    body { margin: 0; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f6f0e6; color: #1e1710; }
    .container { max-width: 520px; margin: 0 auto; padding: 28px 24px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }
    h1 { margin: 0 0 4px; color: #C4531F; font-size: 22px; }
    h2 { margin: 0 0 16px; font-size: 18px; }
    p { line-height: 1.6; color: #1e1710; }
    .btn { display: inline-block; margin: 8px 0; padding: 12px 28px; background: #C4531F; color: #fff; font-size: 16px; border: 0; border-radius: 8px; cursor: pointer; text-decoration: none; }
    .muted { color: #8a7a63; font-size: 13px; }
    .shop { margin-top: 18px; font-size: 12px; }
    .shop a { color: #C4531F; }
  </style>
</head>
<body>
  <div class="container">
    <h1>☀ Solaria · Deshidratados</h1>
    ${body}
    <p class="shop"><a href="${SHOP_URL}">solaria.cu</a></p>
  </div>
</body>
</html>`;

  return new Response(doc, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// Servicio de envío de emails mediante Supabase Edge Function.
//
// La API key de Resend vive como secret en Supabase y NUNCA llega al
// frontend: el navegador solo conoce la URL de la función y la anon key
// pública (que es pública por diseño).
//
// El remitente se resuelve dentro de la función, leyendo
// settings → newsletter_from. El cliente no puede cambiarlo.

const EDGE_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-email`;

/**
 * Llama a la Edge Function send-email de Supabase.
 * La API key de Resend vive como secret en Supabase:
 * el navegador solo ve la URL de la función y la anon key pública.
 * @param {object} payload
 * @param {string[]} payload.to - Destinatarios
 * @param {string} payload.subject - Asunto
 * @param {string} payload.html - Contenido HTML
 * @param {'newsletter'|'welcome'} [payload.type] - Tipo (para el historial)
 * @param {string} [payload.replyTo] - Dirección de respuesta
 * @returns {Promise<{ok: boolean, sent: number, failed: number, remaining: number, errors: Array}>}
 */
async function callEdgeFunction(payload) {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('REACT_APP_SUPABASE_URL no está definida');
  }

  const headers = {
    'Content-Type': 'application/json',
    // La Edge Function valida este header (apikey) igual que cualquier
    // endpoint de Supabase. No es un secreto: es la anon key pública.
    'apikey': anonKey || '',
    'Authorization': `Bearer ${anonKey || ''}`,
  };

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || `Error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// Tamaño de lote: la Edge Function procesa como mucho 50 correos por
// invocación para no agotar su timeout. Este servicio va troceando y
// los va sumando, así el panel solo hace una llamada "lógica".
const CHUNK_SIZE = 50;

/**
 * Envía un boletín a una lista de correos.
 * Procesa la lista completa en lotes internos.
 * @param {string[]} emails - Lista de correos a enviar
 * @param {object} options
 * @param {string} options.subject - Asunto del email
 * @param {string} options.html - HTML del email
 * @returns {Promise<{ok: boolean, sent: number, failed: number, total: number, errors: Array}>}
 */
export async function sendNewsletter(emails, options = {}) {
  if (!emails || emails.length === 0) {
    throw new Error('Debe proporcionar al menos un email');
  }
  if (!options.subject) {
    throw new Error('Falta el asunto del boletín');
  }
  if (!options.html) {
    throw new Error('Falta el contenido HTML del boletín');
  }

  // Sin duplicados y con formato limpio.
  const unique = [...new Set(
    emails.map(e => String(e || '').trim().toLowerCase()).filter(Boolean)
  )];
  if (unique.length === 0) {
    throw new Error('Debe proporcionar al menos un email válido');
  }

  let sent = 0;
  const errors = [];

  // Avanza según lo que el servidor haya procesado de verdad, no según
  // un tamaño de lote fijado aquí: así, si cambia MAX_PER_CALL en la
  // Edge Function, no se pierde ningún destinatario en silencio.
  let pending = unique;
  let guard = 0;

  while (pending.length > 0 && guard++ < 1000) {
    const batch = pending.slice(0, CHUNK_SIZE);
    const res = await callEdgeFunction({
      to: batch,
      subject: options.subject,
      html: options.html,
      type: 'newsletter',
    });

    sent += res.sent || 0;
    if (Array.isArray(res.errors) && res.errors.length) {
      errors.push(...res.errors);
    }

    const processed = (res.sent || 0) + (res.failed || 0);
    if (processed <= 0) break; // nada progresó: cortamos para no buclear
    pending = pending.slice(processed);
  }

  return {
    ok: errors.length === 0,
    sent,
    failed: errors.length,
    total: unique.length,
    errors,
  };
}

/**
 * Envía un email de bienvenida a un nuevo suscriptor.
 * @param {string} email - Email del suscriptor
 * @param {object} options
 * @param {string} [options.subject] - Asunto (opcional)
 * @param {string} [options.html] - HTML (opcional)
 * @returns {Promise<{ok: boolean, id: string, from: string, recipients: number}>}
 */
export async function sendWelcomeEmail(email, options = {}) {
  if (!email) {
    throw new Error('Falta el email del suscriptor');
  }

  const subject = options.subject || 'Bienvenido a Solaria · Deshidratados 🌴';
  const html = options.html || WELCOME_HTML;

  return callEdgeFunction({
    to: [email],
    subject,
    html,
    type: 'welcome',
  });
}

// ============================================================
// Plantillas por defecto
// ============================================================

export const DEFAULT_SUBJECT = '📰 Solaria · Boletín de ofertas';

export const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solaria · Boletín</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f6f0e6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C4531F; }
    .header h1 { margin: 0; color: #C4531F; font-size: 24px; }
    .header p { margin: 8px 0 0; color: #8a7a63; font-size: 14px; }
    .content { padding: 20px 0; line-height: 1.6; color: #1e1710; }
    .content h2 { margin-top: 0; color: #1e1710; }
    .content p { margin-bottom: 16px; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e7dcc8; color: #8a7a63; font-size: 12px; }
    .footer a { color: #C4531F; }
    .unsubscribe { margin-top: 20px; padding: 12px; background: #f6f0e6; border-radius: 8px; text-align: center; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>☀ Solaria · Deshidratados</h1>
      <p>Tu boletín semanal de ofertas y novedades</p>
    </div>
    <div class="content">
      <h2>Bienvenido al boletín de Solaria</h2>
      <p>En este boletín encontrarás:</p>
      <ul>
        <li>✨ Nuevas presentaciones disponibles</li>
        <li>🎁 Ofertas especiales de temporada</li>
        <li>🌱 Tips para conservar tus deshidratados</li>
      </ul>
      <h2>¿Qué encontrarás?</h2>
      <p>Las frutas deshidratadas al 100% sin conservantes, listas para llevarte a cualquier lugar. Desde nuestros clásicos (mango, piña, papaya) hasta nuestras nuevas incorporaciones.</p>
      <h2>Consejo de la semana</h2>
      <p>Guarda tus deshidratados en un lugar fresco y seco, lejos de la luz directa del sol. Así mantendrás su sabor y textura por más tiempo.</p>
    </div>
    <div class="footer">
      <p>Hecho con ❤️ para Solaria · Deshidratados</p>
      <p>¿No quieres recibir más emails? <a href="#">Darse de baja</a></p>
    </div>
    <div class="unsubscribe">
      <p>Este es un email automático. No responder a este mensaje.</p>
    </div>
  </div>
</body>
</html>`;

const WELCOME_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Solaria</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f6f0e6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C4531F; }
    .header h1 { margin: 0; color: #C4531F; font-size: 24px; }
    .content { padding: 20px 0; line-height: 1.6; color: #1e1710; }
    .content h2 { margin-top: 0; color: #1e1710; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e7dcc8; color: #8a7a63; font-size: 12px; }
    .footer a { color: #C4531F; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>☀ Solaria · Deshidratados</h1>
    </div>
    <div class="content">
      <h2>¡Bienvenido a Solaria!</h2>
      <p>Gracias por suscribirte a nuestro boletín. A partir de ahora recibirás ofertas exclusivas, nuevas presentaciones y consejos para conservar tus deshidratados.</p>
      <p>¿Qué encontrarás en nuestro catálogo?</p>
      <ul>
        <li>🍌 Mango deshidratado de la mejor calidad</li>
        <li>🍍 Piña natural sin conservantes</li>
        <li>🍉 Papaya al 100%</li>
        <li>🥭 Pitaya y más...</li>
      </ul>
      <p>Visítanos en <a href="https://manoli931025.github.io/deshidratados/">solaria.cu</a> para explorar todo nuestro catálogo.</p>
      <p>¡Disfruta tus deshidratados! 🌴</p>
    </div>
    <div class="footer">
      <p>Hecho con ❤️ para Solaria · Deshidratados</p>
      <p>¿No quieres recibir más emails? <a href="#">Darse de baja</a></p>
    </div>
  </div>
</body>
</html>`;

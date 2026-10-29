// Supabase Edge Function: send-email
// Proxy seguro para Brevo (ex-Sendinblue). La API key nunca sale del servidor.
//
// Uso:
//   POST /functions/v1/send-email
//   Body: { to: string[], subject: string, html: string, type?: 'newsletter'|'welcome', replyTo?: string }
//
// Respuesta:
//   { ok, sent, failed, remaining, errors: [{email, error}] }
//
// El campo "from" SIEMPRE se lee de la tabla settings (newsletter_from),
// nunca del cliente: así nadie puede suplantar el remitente.
//
// CONFIGURACIÓN (una sola vez, desde el dashboard):
//   1. Brevo → SMTP & API → Senders → verificar la dirección remitente
//   2. Brevo → SMTP & API → API Keys → generar una clave
//   3. Supabase → Edge Functions → Secrets → añadir BREVO_API_KEY
//   4. Supabase → Edge Functions → "Deploy a new function" → nombre: send-email
//
// NUNCA pegues aquí la API key: este fichero va al repositorio.

// El prefijo `npm:` en línea es el patrón que documenta Supabase para
// Edge Functions (no hay deno.json en la nube), por eso se ignora la
// regla que prefiere declararlo como dependencia.
// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Límite por invocación: Brevo acepta lotes, pero así no se agota el
// timeout de Supabase. El frontend va troceando solo y sigue el progreso
// real del servidor.
const MAX_PER_CALL = 50;

/** Error con mensaje ya redactado para el usuario final. */
class EmailError extends Error {}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) {
      return json({
        error:
          'Falta el secret BREVO_API_KEY. ' +
          'Añádelo en Supabase → Edge Functions → Secrets.',
      }, 500);
    }

    if (req.method !== 'POST') {
      return json({ error: 'Método no permitido. Usa POST.' }, 405);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return json({ error: 'El cuerpo de la petición no es JSON válido.' }, 400);
    }

    const { to, subject, html, type, replyTo } = body;

    // --- Validaciones ---
    if (!Array.isArray(to) || to.length === 0) {
      return json({ error: 'Debes indicar al menos un destinatario (to).' }, 400);
    }
    if (!subject || typeof subject !== 'string') {
      return json({ error: 'Falta el asunto (subject).' }, 400);
    }
    if (!html || typeof html !== 'string') {
      return json({ error: 'Falta el contenido (html).' }, 400);
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const clean = [...new Set(to.map((e: unknown) => String(e || '').trim().toLowerCase()))]
      .filter((e: string) => e.length > 0);
    const invalid = clean.filter((e: string) => !emailRe.test(e));
    if (invalid.length > 0) {
      return json({ error: `Correos inválidos: ${invalid.join(', ')}` }, 400);
    }

    // --- El remitente SIEMPRE sale de la base de datos ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = getServiceKey();
    const db = createClient(supabaseUrl, serviceKey);

    const { data: settingsRows, error: settingsError } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['newsletter_from', 'email']);

    if (settingsError) {
      return json({ error: `Error leyendo configuración: ${settingsError.message}` }, 500);
    }

    const map: Record<string, string> = {};
    (settingsRows || []).forEach(r => { map[r.key] = r.value; });

    const from = (map.newsletter_from || '').trim();
    if (!from) {
      return json({
        error:
          'Falta el "Email remitente del boletín". Ve a tu panel → Configuración ' +
          'y rellénalo (debe estar verificado en Brevo: SMTP & API → Senders).',
      }, 500);
    }

    // Brevo separa nombre visible y dirección en el body
    // ("Solaria <solaria024@gmail.com>" → {name, email}).
    const sender = parseSender(from);
    if (!emailRe.test(sender.email)) {
      return json({
        error: `El email remitente ("${from}") no tiene un formato de correo válido.`,
      }, 500);
    }

    // Si quien responde lo hace a la dirección de contacto de la tienda,
    // los correos de los clientes llegan a un buzón real.
    const contactEmail = (map.email || '').trim();
    const replyAddress = replyTo || (emailRe.test(contactEmail) ? contactEmail : undefined);

    // --- Troceado: nunca más de MAX_PER_CALL por invocación ---
    const batch = clean.slice(0, MAX_PER_CALL);
    const remaining = Math.max(0, clean.length - batch.length);

    const errors: { email: string; error: string }[] = [];
    let sent = 0;

    for (const recipient of batch) {
      try {
        const payload: Record<string, unknown> = {
          sender,
          to: [{ email: recipient }], // uno a uno: nadie ve la lista de los demás
          subject,
          htmlContent: html,
        };
        if (replyAddress) {
          payload.replyTo = { email: replyAddress };
        }

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          sent++;
        } else {
          const errText = await res.text();
          console.error(`[send-email] Brevo ${res.status} con ${recipient}:`, errText);
          errors.push({ email: recipient, error: explainBrevoError(res.status, errText) });
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'error de red';
        console.error(`[send-email] Excepción con ${recipient}:`, detail);
        errors.push({ email: recipient, error: detail });
      }
    }

    // --- Registrar en el historial (solo boletines) ---
    if (type === 'newsletter' && sent > 0) {
      const { error: histErr } = await db.from('newsletter_history').insert({
        subject,
        html,
        recipients_count: sent,
        sent_by: 'admin',
      });
      if (histErr) {
        console.error('[send-email] No se pudo guardar el historial:', histErr.message);
      }
    }

    return json({
      ok: errors.length === 0,
      sent,
      failed: errors.length,
      remaining,
      errors,
    });
  } catch (err) {
    const msg = err instanceof EmailError ? err.message : 'Error interno del servidor.';
    console.error('[send-email] Error inesperado:', err);
    return json({ error: msg }, 500);
  }
});

/**
 * Extrae nombre visible y dirección de un remitente tipo
 * "Solaria · Deshidratados <solaria024@gmail.com>" o solo "solaria024@gmail.com".
 */
function parseSender(from: string): { email: string; name?: string } {
  const lt = from.indexOf('<');
  const gt = from.lastIndexOf('>');

  if (lt !== -1 && gt > lt) {
    const email = from.slice(lt + 1, gt).trim();
    const name = from.slice(0, lt).trim() || from.slice(gt + 1).trim();
    // El nombre visible de Brevo admite como máximo 70 caracteres.
    return name ? { email, name: name.slice(0, 70) } : { email };
  }

  return { email: from.trim() };
}

/**
 * Traduce los códigos de Brevo a algo accionable en castellano.
 * Brevo devuelve JSON {code, message}; aquí lo resumimos.
 */
function explainBrevoError(status: number, raw: string): string {
  let code = '';
  let message = '';
  try {
    const parsed = JSON.parse(raw);
    code = parsed.code || '';
    message = parsed.message || '';
  } catch {
    message = raw.slice(0, 200);
  }

  // Errores de cuenta/configuración (400 con código específico)
  const codeHints: Record<string, string> = {
    unauthorized: 'La API key de Brevo no es válida. Revísala en Edge Functions → Secrets.',
    not_acceptable:
      'Ese remitente no está verificado en Brevo. Ve a Brevo → SMTP & API → Senders ' +
      'y verifica la dirección (te envía un código de confirmación a ese correo).',
    account_under_validation:
      'Tu cuenta de Brevo está en revisión (normal las primeras horas). ' +
      'Completa la validación desde el dashboard de Brevo o espera unos minutos.',
    not_enough_credits: 'Límite diario del plan gratuito de Brevo alcanzado. Inténtalo mañana.',
    permission_denied: 'La API key no tiene permisos de envío. Genera una nueva en Brevo.',
    '': 'Revisa el remitente y los destinatarios.',
  };

  // Errores HTTP sin código (401, 429…)
  const statusHints: Record<number, string> = {
    401: 'La API key de Brevo no es válida o fue revocada. Revísala en Edge Functions → Secrets.',
    429: 'Límite de peticiones de Brevo alcanzado. Espera un momento y reintenta.',
  };

  const hint = codeHints[code] || statusHints[status] || '';
  const detail = message.slice(0, 200);
  return `Brevo respondió ${status}${code ? ` (${code})` : ''}. ${hint}${detail ? ` (${detail})` : ''}`.trim();
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
    throw new EmailError('Falta la clave de servicio de Supabase en los secrets.');
  }
  return key;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

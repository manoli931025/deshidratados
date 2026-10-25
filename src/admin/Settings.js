import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../data/supabase';
import { SHOP } from '../data/config';
import { LEGAL } from '../data/legalContent';
import { sendNewsletter, DEFAULT_SUBJECT, DEFAULT_HTML } from '../services/newsletter';
import Notice from './Notice';

const FIELDS = [
  { key: 'shopName', label: 'Nombre de la tienda', type: 'text', help: 'Aparece en el logo y el pie de página.' },
  { key: 'whatsapp', label: 'Número de WhatsApp', type: 'text', help: 'Solo dígitos, con código de país. Cuba: 535…' },
  { key: 'freeShip', label: 'Envío gratis a partir de', type: 'number', help: 'Monto en la moneda base (la de los precios del catálogo).' },
  { key: 'email', label: 'Correo de contacto', type: 'email', help: 'Aparece en el pie de página.' },
  { key: 'newsletter_from', label: 'Email remitente del boletín', type: 'text', help: 'Remitente que usa Resend. Debe ser una dirección de un dominio VERIFICADO en Resend. Para probar sin dominio usa onboarding@resend.dev (los correos llegan, pero a Spam).' },
  { key: 'instagram', label: 'Instagram', type: 'text', help: 'Con @ o con la URL completa. Déjalo vacío si no lo manejas.' },
  { key: 'hours', label: 'Horario (pie de página)', type: 'textarea', help: 'Un renglón por horario. Déjalo vacío para ocultar la columna.' },
  { key: 'currencyBase', label: 'Moneda de los precios', type: 'select', options: ['USD', 'CUP', 'EUR'], help: 'En qué moneda escribes los precios en Productos. El visitante ve la conversión a su moneda.' },
  { key: 'rateCUP', label: 'CUP por 1 USD', type: 'number', help: 'Tipo de cambio manual. No es automático: ajústalo cada vez que cambie el mercado.' },
  { key: 'rateEUR', label: 'EUR por 1 USD', type: 'number', help: 'Tipo de cambio manual hacia el euro.' }
];

// Configuración del boletín (HTML y asunto).
// Las plantillas por defecto viven en src/services/newsletter.js: una sola fuente.
const NEWSLETTER_FIELDS = [
  { key: 'newsletter_subject', label: 'Asunto del boletín', type: 'text', help: 'Lo que aparece en el asunto del email.', default: DEFAULT_SUBJECT },
  { key: 'newsletter_html', label: 'Contenido HTML del boletín', type: 'textarea', help: 'HTML completo. Puedes usar {nombre} para personalizar (no está implementado aún).', default: DEFAULT_HTML }
];

// Cada documento legal vive en una clave propia de `settings`.
// Si la clave está vacía, la tienda usa el texto original de src/data/legalContent.js.
const LEGAL_FIELDS = [
  { key: 'legal_envios', slug: 'envios', doc: LEGAL.envios, label: 'Envíos y pagos' },
  { key: 'legal_terminos', slug: 'terminos', doc: LEGAL.terminos, label: 'Términos y condiciones' },
  { key: 'legal_privacidad', slug: 'privacidad', doc: LEGAL.privacidad, label: 'Aviso de privacidad' },
  { key: 'legal_cookies', slug: 'cookies', doc: LEGAL.cookies, label: 'Aviso de cookies' }
];

// Lo que muestra el formulario antes de cargar la base: los mismos valores
// por defecto que usa la tienda. Así guardar sin tocar nada no borra nada.
const DEFAULTS = {
  shopName: SHOP.name,
  whatsapp: SHOP.whatsapp,
  freeShip: String(SHOP.freeShip),
  email: SHOP.email,
  newsletter_from: 'onboarding@resend.dev',
  instagram: SHOP.instagram,
  hours: SHOP.hours,
  currencyBase: SHOP.currencyBase,
  rateCUP: SHOP.rateCUP,
  rateEUR: SHOP.rateEUR,
};

const LEGAL_DEFAULTS = LEGAL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: f.doc.body }), {});
const NEWSLETTER_DEFAULTS = NEWSLETTER_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: f.default || '' }), {});

// ============================================================
// Validación del boletín
// ============================================================
// Se ejecuta al pulsar "Enviar": primero los ERRORS, que bloquean el envío,
// y después los AVISOS, que se muestran en la confirmación y decide el admin.

// Etiquetas void: nunca llevan cierre, y contarlas daría falsos positivos.
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/**
 * Etiquetas de bloque que quedaron sin cerrar.
 *
 * DOMParser "arregla" el HTML él solo, así que no sirve para detectar esto:
 * hay que recorrerlo con una pila. Un `</div>` que falta hace que Gmail se
 * trague el resto del contenido, que es justo lo que queremos evitar.
 *
 * Es una heurística a propósito: sirve para avisar, no para validar sintaxis.
 */
function findUnclosedTags(html) {
  const stack = [];
  const unclosed = new Set();
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let m;

  while ((m = re.exec(html)) !== null) {
    const isClosing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const selfClosed = m[3] === '/';

    if (VOID_TAGS.has(tag) || selfClosed) continue;

    if (isClosing) {
      const idx = stack.lastIndexOf(tag);
      // Cierre sin apertura suelta: lo ignora, ya lo gestiona el parser.
      if (idx === -1) continue;
      // Clave: todo lo que haya por ENCIMA quedó sin cerrar. Si no lo
      // anotamos aquí, el </body> de cierre se lo traga en silencio y el
      // desbalance de un </div> perdido nunca se detecta (era el bug que
      // hacía que el fallo no se reportara nunca).
      for (let i = idx + 1; i < stack.length; i++) unclosed.add(stack[i]);
      stack.length = idx;
    } else {
      stack.push(tag);
    }
  }

  // Lo que siga en la pila al terminar tampoco se cerró nunca.
  for (const tag of stack) unclosed.add(tag);

  return [...unclosed];
}

/**
 * Comprueba asunto y HTML antes de enviar.
 *
 * @param {object} opts
 * @param {string} opts.subject  Asunto actual
 * @param {string} opts.html     Contenido actual
 * @param {string} opts.baseline Última versión GUARDADA. Se usa para detectar
 *                               borrados accidentales (el típico Ctrl+A),
 *                               comparando contra lo que había y no contra la
 *                               plantilla de fábrica, así un recorte
 *                               intencionado grande solo avisa, no molesta.
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateNewsletter({ subject, html, baseline }) {
  const errors = [];
  const warnings = [];

  if (!String(subject || '').trim()) {
    errors.push('El asunto del boletín está vacío.');
  }

  const content = String(html || '');
  if (!content.trim()) {
    errors.push('El contenido del boletín está vacío.');
    return { errors, warnings };
  }

  const doc = new DOMParser().parseFromString(content, 'text/html');
  if (!doc.body || !doc.body.textContent.trim()) {
    errors.push('El contenido no tiene texto visible.');
  }

  const unclosed = findUnclosedTags(content);
  if (unclosed.length > 0) {
    warnings.push(
      `Etiquetas sin cerrar: ${unclosed.join(', ')}. ` +
      'Los clientes de correo suelen tragar el resto del contenido.'
    );
  }

  if (!/<style[\s>]/i.test(content)) {
    warnings.push('No hay bloque <style>: el boletín llegará sin diseño.');
  }

  if (!/darse de baja|unsubscribe/i.test(content)) {
    warnings.push(
      'Falta el enlace de baja ("Darse de baja"): afecta a la reputación del remitente y a la normativa.'
    );
  }

  const prev = String(baseline || '');
  if (prev.trim() && content.length < prev.length * 0.5) {
    warnings.push(
      `El contenido es mucho más corto que la última versión guardada ` +
      `(${content.length} de ${prev.length} caracteres).`
    );
  }

  return { errors, warnings };
}

/** Fecha corta para el historial; si el formato falla, devuelve el texto crudo. */
function formatSentAt(iso) {
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso || '');
  }
}

export default function Settings() {
  const [values, setValues] = useState(DEFAULTS);
  const [legal, setLegal] = useState(LEGAL_DEFAULTS);
  const [newsletter, setNewsletter] = useState(NEWSLETTER_DEFAULTS);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [legalErr, setLegalErr] = useState('');
  const [legalOk, setLegalOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [legalBusy, setLegalBusy] = useState(false);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterErr, setNewsletterErr] = useState('');
  const [newsletterOk, setNewsletterOk] = useState('');

  // Última versión GUARDADA del HTML. Sirve de referencia para avisar si el
  // contenido encoge de golpe al pulsar "Enviar".
  const [savedHtml, setSavedHtml] = useState(NEWSLETTER_DEFAULTS.newsletter_html || '');
  const [subscriberCount, setSubscriberCount] = useState(0);
  // true = se está mostrando la confirmación en línea de envío.
  const [confirming, setConfirming] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [history, setHistory] = useState([]);
  // La vista previa va con debounce: reparsear el HTML completo en cada
  // pulsación del textarea es un gasto innecesario.
  const [previewHtml, setPreviewHtml] = useState(NEWSLETTER_DEFAULTS.newsletter_html || '');

  useEffect(() => {
    supabase.from('settings').select('key, value')
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        const map = {};
        (data || []).forEach(r => { map[r.key] = r.value; });
        setValues(v => ({ ...v, ...map }));
        // En documentos: solo pisa el texto por defecto si guardaron algo no vacío.
        setLegal(l => {
          const next = { ...l };
          LEGAL_FIELDS.forEach(f => {
            const stored = map[f.key];
            if (stored !== undefined && String(stored).trim() !== '') next[f.key] = stored;
          });
          return next;
        });
        // En boletín: cargamos lo guardado (si no está vacío) y lo tomamos
        // como referencia para las comparaciones de validación.
        const loaded = { ...NEWSLETTER_DEFAULTS };
        NEWSLETTER_FIELDS.forEach(f => {
          const stored = map[f.key];
          if (stored !== undefined && String(stored).trim() !== '') loaded[f.key] = stored;
        });
        setNewsletter(loaded);
        setSavedHtml(loaded.newsletter_html || '');
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusy(true);
    const rows = FIELDS.map(f => ({ key: f.key, value: String(values[f.key] ?? '').trim() }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk('Configuración guardada ☀');
  };

  const submitLegal = async (e) => {
    e.preventDefault();
    setLegalErr('');
    setLegalOk('');
    setLegalBusy(true);
    const rows = LEGAL_FIELDS.map(f => ({ key: f.key, value: String(legal[f.key] ?? '') }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    setLegalBusy(false);
    if (error) { setLegalErr(error.message); return; }
    setLegalOk('Documentos legales guardados ☀  Ya se muestran en la tienda.');
  };

  // ------------------------------------------------------------
  // Recuento de suscriptores: se lee una vez al montar para poder
  // avisar en el propio botón de cuánta gente va a recibir el boletín.
  // ------------------------------------------------------------
  useEffect(() => {
    supabase
      .from('subscribers')
      .select('email', { count: 'exact', head: true })
      .then(({ count }) => setSubscriberCount(count || 0));
  }, []);

  // ------------------------------------------------------------
  // Historial de envíos. La tabla puede no existir en bases antiguas
  // (aún no migradas), y en ese caso dejamos la sección vacía en vez
  // de romper el panel.
  // ------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('newsletter_history')
      .select('id, subject, html, sent_at, recipients_count')
      .order('sent_at', { ascending: false })
      .limit(20);
    if (error) {
      console.warn('[newsletter] No se pudo leer el historial:', error.message);
      return;
    }
    setHistory(data || []);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Vista previa con debounce de 300ms.
  useEffect(() => {
    const t = setTimeout(() => setPreviewHtml(newsletter.newsletter_html || ''), 300);
    return () => clearTimeout(t);
  }, [newsletter.newsletter_html]);

  // ------------------------------------------------------------
  // Acciones del boletín
  // ------------------------------------------------------------

  /** Guarda el contenido en settings. NUNCA envía nada. */
  const saveNewsletterDraft = async () => {
    setNewsletterErr('');
    setNewsletterOk('');
    setNewsletterBusy(true);
    try {
      const rows = NEWSLETTER_FIELDS.map(f => ({
        key: f.key,
        value: String(newsletter[f.key] ?? '')
      }));
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) throw new Error(`No se pudo guardar: ${error.message}`);
      setSavedHtml(newsletter.newsletter_html || '');
      setNewsletterOk('Borrador guardado. No se ha enviado nada ☀');
    } catch (e) {
      setNewsletterErr(e.message || 'Error al guardar el borrador.');
    }
    setNewsletterBusy(false);
  };

  /** Paso 1 del envío: validar y pasar a la confirmación en línea. */
  const startSend = (e) => {
    e.preventDefault();
    setNewsletterErr('');
    setNewsletterOk('');
    setConfirming(false);

    const { errors, warnings: warns } = validateNewsletter({
      subject: newsletter.newsletter_subject,
      html: newsletter.newsletter_html,
      baseline: savedHtml
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setWarnings(warns);
    setConfirming(true);
  };

  /** Paso 2 del envío: lo que ocurre tras pulsar "Sí, enviar". */
  const doSend = async () => {
    setConfirming(false);
    setNewsletterErr('');
    setNewsletterOk('');
    setNewsletterBusy(true);
    try {
      // 1) Guardar: si no, el contenido editado se pierde al recargar.
      const rows = NEWSLETTER_FIELDS.map(f => ({
        key: f.key,
        value: String(newsletter[f.key] ?? '')
      }));
      const { error: saveErr } = await supabase
        .from('settings').upsert(rows, { onConflict: 'key' });
      if (saveErr) throw new Error(`No se pudo guardar el contenido: ${saveErr.message}`);
      setSavedHtml(newsletter.newsletter_html || '');

      // 2) Cargar la lista real de suscriptores en ese momento.
      const { data: subs, error: subErr } = await supabase
        .from('subscribers').select('email');
      if (subErr) throw new Error(`No se pudieron leer los suscriptores: ${subErr.message}`);

      const emails = [...new Set(
        (subs || []).map(s => String(s.email || '').trim().toLowerCase())
      )].filter(Boolean);

      if (emails.length === 0) {
        throw new Error('Todavía no hay suscriptores. Suscríbete primero desde el pie de la tienda.');
      }

      // 3) Enviar (el servicio trocea internamente en lotes de 50).
      const result = await sendNewsletter(emails, {
        subject: newsletter.newsletter_subject,
        html: newsletter.newsletter_html
      });

      if (result.failed > 0) {
        const muestras = result.errors.slice(0, 3).map(e => e.email).join(', ');
        throw new Error(
          `Enviados ${result.sent} de ${result.total}. ` +
          `${result.failed} fallaron: ${muestras}${result.errors.length > 3 ? '…' : ''}`
        );
      }

      setNewsletterOk(
        `Boletín enviado a ${result.sent} suscriptor${result.sent === 1 ? '' : 'es'} ☀`
      );
      setSubscriberCount(result.sent);
      await loadHistory();
    } catch (e) {
      setNewsletterErr(e.message || 'Error desconocido al enviar.');
    }
    setNewsletterBusy(false);
  };

  /** Recupera la plantilla de fábrica. Solo toca el editor: no guarda ni envía. */
  const restoreDefaultTemplate = () => {
    if (!window.confirm('¿Restaurar la plantilla original? Se sustituirá el contenido que tengas en el editor (aún no guardado).')) return;
    setNewsletter(n => ({
      ...n,
      newsletter_subject: DEFAULT_SUBJECT,
      newsletter_html: DEFAULT_HTML
    }));
    setValidationErrors([]);
    setConfirming(false);
    setNewsletterOk('Plantilla original cargada en el editor. Revísala antes de guardar o enviar.');
    document.getElementById('newsletter-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Carga un boletín ya enviado en el editor, para recuperarlo. */
  const restoreFromHistory = (item) => {
    if (!window.confirm(`¿Cargar "${item.subject}" en el editor? Se sustituirá el contenido actual (aún no guardado).`)) return;
    setNewsletter(n => ({
      ...n,
      newsletter_subject: item.subject,
      newsletter_html: item.html
    }));
    setValidationErrors([]);
    setConfirming(false);
    setNewsletterOk('Contenido cargado en el editor. Revísalo antes de guardar o enviar.');
    document.getElementById('newsletter-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section>
      <header className="adm-head">
        <div><h2>Configuración</h2><p>Datos generales que usa la tienda y el pie de página.</p></div>
      </header>
      <form className="adm-card adm-form" onSubmit={submit}>
        {FIELDS.map(f => (
          <label key={f.key}>
            {f.label}
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              />
            ) : f.type === 'select' ? (
              <select
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              >
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={f.type}
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
            <span className="adm-muted small">{f.help}</span>
          </label>
        ))}
        <Notice kind="error" title="No se ha podido guardar la configuración." onDismiss={() => setErr('')}>
          {err}
        </Notice>
        <Notice kind="ok" onDismiss={() => setOk('')}>{ok}</Notice>
        <button className="adm-btn" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <header className="adm-head" style={{ marginTop: 30 }}>
        <div>
          <h2>Documentos legales</h2>
          <p>Páginas enlazadas en el pie. Puedes reescribirlas aquí sin tocar código.</p>
        </div>
      </header>
      <form className="adm-card adm-form" onSubmit={submitLegal}>
        <p className="adm-muted small" style={{ marginTop: 0 }}>
          Formato permitido: <code>#</code> y <code>##</code> para títulos, <code>**negritas**</code>,
          listas con <code>-</code>, enlaces con <code>[texto](https://…)</code> y citas con <code>&gt;</code>.
          Deja un renglón en blanco para separar párrafos. Todo lo demás se muestra tal cual.
        </p>
        {LEGAL_FIELDS.map(f => (
          <label key={f.key}>
            {f.label}
            <span className="legal-links">
              <Link className="adm-link" to={`/doc/${f.slug}`} target="_blank">Ver en la tienda ↗</Link>
            </span>
            <textarea
              rows={10}
              spellCheck={true}
              value={legal[f.key] ?? ''}
              onChange={e => setLegal(l => ({ ...l, [f.key]: e.target.value }))}
            />
            <span className="adm-muted small">
              Si vacías este campo, se restaura el texto original de la tienda.
            </span>
          </label>
        ))}
        <Notice kind="error" title="No se han podido guardar los documentos." onDismiss={() => setLegalErr('')}>
          {legalErr}
        </Notice>
        <Notice kind="ok" onDismiss={() => setLegalOk('')}>{legalOk}</Notice>
        <button className="adm-btn" type="submit" disabled={legalBusy}>
          {legalBusy ? 'Guardando…' : 'Guardar documentos'}
        </button>
      </form>

      <header className="adm-head" style={{ marginTop: 30 }}>
        <div>
          <h2>Boletín</h2>
          <p>Edita el contenido y revísalo en la vista previa. «Guardar borrador» nunca envía nada: el envío siempre pasa por una confirmación.</p>
        </div>
      </header>
      <form className="adm-card adm-form" onSubmit={startSend}>
        {NEWSLETTER_FIELDS.filter(f => f.type !== 'textarea').map(f => (
          <label key={f.key}>
            {f.label}
            <input
              type={f.type}
              value={newsletter[f.key] ?? ''}
              onChange={e => {
                setNewsletter(n => ({ ...n, [f.key]: e.target.value }));
                // Lo que cambia invalida la validación anterior.
                setValidationErrors([]);
                setConfirming(false);
              }}
            />
            <span className="adm-muted small">{f.help}</span>
          </label>
        ))}

        <div className="adm-newsletter-grid" id="newsletter-editor">
          <label>
            {NEWSLETTER_FIELDS.find(f => f.type === 'textarea').label}
            <textarea
              rows={20}
              spellCheck={false}
              value={newsletter.newsletter_html ?? ''}
              onChange={e => {
                setNewsletter(n => ({ ...n, newsletter_html: e.target.value }));
                setValidationErrors([]);
                setConfirming(false);
              }}
            />
            <span className="adm-muted small">
              {NEWSLETTER_FIELDS.find(f => f.type === 'textarea').help}
            </span>
            <button type="button" className="adm-linkbtn danger adm-newsletter-restore" onClick={restoreDefaultTemplate}>
              Restaurar plantilla original
            </button>
          </label>

          <div className="adm-newsletter-preview">
            <div className="adm-preview-head">
              <span className="adm-muted small">Vista previa · así se verá en la bandeja</span>
              <strong title={newsletter.newsletter_subject || '(sin asunto)'}>
                {newsletter.newsletter_subject || '(sin asunto)'}
              </strong>
            </div>
            <iframe
              sandbox=""
              title="Vista previa del boletín"
              srcDoc={previewHtml}
            />
          </div>
        </div>

        <Notice kind="error" title="No se ha podido completar." onDismiss={() => setNewsletterErr('')}>
          {newsletterErr}
        </Notice>
        <Notice kind="ok" onDismiss={() => setNewsletterOk('')}>{newsletterOk}</Notice>
        <Notice kind="info" title="Trabajando…">
          {newsletterBusy ? 'Guardando contenido y enviando. No cierres esta ventana.' : ''}
        </Notice>
        <Notice kind="error" title="No se puede enviar todavía:">
          {validationErrors.length > 0 && (
            <ul>
              {validationErrors.map(m => <li key={m}>{m}</li>)}
            </ul>
          )}
        </Notice>

        {confirming ? (
          <div className="adm-confirm">
            <p>
              Se enviará a <strong>{subscriberCount} suscriptor{subscriberCount === 1 ? '' : 'es'}</strong>.
              Una vez enviado no se puede deshacer.
            </p>

            {subscriberCount === 0 && (
              <p className="adm-confirm-warn-title">
                Todavía no hay suscriptores: suscríbete desde el pie de la tienda para poder probar.
              </p>
            )}

            {warnings.length > 0 && (
              <>
                <p className="adm-confirm-warn-title">Antes de enviar, revisa:</p>
                <ul className="adm-confirm-warn">
                  {warnings.map(w => <li key={w}>{w}</li>)}
                </ul>
              </>
            )}

            <div className="adm-form-actions">
              <button
                className="adm-btn"
                type="button"
                onClick={doSend}
                disabled={newsletterBusy || subscriberCount === 0}
              >
                {newsletterBusy
                  ? 'Enviando…'
                  : `Sí, enviar a ${subscriberCount} suscriptor${subscriberCount === 1 ? '' : 'es'}`}
              </button>
              <button
                className="adm-btn ghost"
                type="button"
                onClick={() => setConfirming(false)}
                disabled={newsletterBusy}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : newsletterBusy ? (
          // Mientras trabaja no mostramos acciones: solo arriba está el
          // mensaje que dice qué está pasando exactamente.
          <div className="adm-form-actions">
            <button className="adm-btn" type="button" disabled>
              Trabajando…
            </button>
          </div>
        ) : (
          <div className="adm-form-actions">
            <button className="adm-btn ghost" type="button" onClick={saveNewsletterDraft}>
              Guardar borrador
            </button>
            <button className="adm-btn" type="submit">
              {subscriberCount > 0
                ? `Enviar boletín a ${subscriberCount} suscriptor${subscriberCount === 1 ? '' : 'es'}`
                : 'Revisar y enviar boletín'}
            </button>
          </div>
        )}
      </form>

      <header className="adm-head" style={{ marginTop: 30 }}>
        <div>
          <h2>Historial de envíos</h2>
          <p>Últimos boletines enviados. Sirve para recuperar el contenido si algo salió mal.</p>
        </div>
      </header>
      {history.length === 0 ? (
        <p className="adm-status-hint">Todavía no has enviado ningún boletín desde el panel.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Asunto</th>
                <th>Fecha</th>
                <th>Destinatarios</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{h.subject}</td>
                  <td>{formatSentAt(h.sent_at)}</td>
                  <td>{h.recipients_count}</td>
                  <td>
                    <button type="button" className="adm-linkbtn" onClick={() => restoreFromHistory(h)}>
                      Restaurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

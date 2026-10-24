import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../data/supabase';
import { SHOP } from '../data/config';
import { LEGAL } from '../data/legalContent';
import { sendNewsletter, DEFAULT_SUBJECT, DEFAULT_HTML } from '../services/newsletter';

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
        // En boletín: también cargamos si existe
        setNewsletter(n => {
          const next = { ...n };
          NEWSLETTER_FIELDS.forEach(f => {
            const stored = map[f.key];
            if (stored !== undefined && String(stored).trim() !== '') next[f.key] = stored;
          });
          return next;
        });
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

  return (
    <section>
      <header className="adm-head">
        <div><h2>Configuración</h2><p>Datos generales que usa la tienda y el pie de página.</p></div>
      </header>
      {err && <p className="adm-err">{err}</p>}
      {ok && <p className="adm-ok">{ok}</p>}
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
      {legalErr && <p className="adm-err">{legalErr}</p>}
      {legalOk && <p className="adm-ok">{legalOk}</p>}
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
        <button className="adm-btn" type="submit" disabled={legalBusy}>
          {legalBusy ? 'Guardando…' : 'Guardar documentos'}
        </button>
      </form>

      <header className="adm-head" style={{ marginTop: 30 }}>
        <div>
          <h2>Boletín</h2>
          <p>Contenido del boletín y opciones de envío. Usa este formulario para editar el HTML y enviarlo manualmente.</p>
        </div>
      </header>
      {newsletterErr && <p className="adm-err">{newsletterErr}</p>}
      {newsletterOk && <p className="adm-ok">{newsletterOk}</p>}
      {newsletterBusy && <p className="adm-muted">Guardando contenido y enviando…</p>}
      {!newsletterBusy && (
        <form className="adm-card adm-form" onSubmit={async (e) => {
          e.preventDefault();
          setNewsletterErr('');
          setNewsletterOk('');
          setNewsletterBusy(true);
          try {
            // 1) Guardar el contenido editado: si no, se pierde al recargar.
            const rows = NEWSLETTER_FIELDS.map(f => ({
              key: f.key,
              value: String(newsletter[f.key] ?? '')
            }));
            const { error: saveErr } = await supabase
              .from('settings').upsert(rows, { onConflict: 'key' });
            if (saveErr) throw new Error(`No se pudo guardar el contenido: ${saveErr.message}`);

            // 2) Cargar la lista real de suscriptores (antes iba vacía: []).
            const { data: subs, error: subErr } = await supabase
              .from('subscribers').select('email');
            if (subErr) throw new Error(`No se pudieron leer los suscriptores: ${subErr.message}`);

            const emails = [...new Set(
              (subs || []).map(s => String(s.email || '').trim().toLowerCase())
            )].filter(Boolean);

            if (emails.length === 0) {
              throw new Error('Todavía no hay suscriptores. Suscríbete primero desde el pie de la tienda.');
            }

            // 3) Enviar a todos (el servicio trocea internamente en lotes de 50).
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
          } catch (err) {
            setNewsletterErr(err.message || 'Error desconocido al enviar.');
          }
          setNewsletterBusy(false);
        }}>
          {NEWSLETTER_FIELDS.map(f => (
            <label key={f.key}>
              {f.label}
              {f.type === 'textarea' ? (
                <textarea
                  rows={15}
                  spellCheck={false}
                  value={newsletter[f.key] ?? ''}
                  onChange={e => setNewsletter(n => ({ ...n, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  type={f.type}
                  value={newsletter[f.key] ?? ''}
                  onChange={e => setNewsletter(n => ({ ...n, [f.key]: e.target.value }))}
                />
              )}
              <span className="adm-muted small">{f.help}</span>
            </label>
          ))}
          <button className="adm-btn" type="submit" disabled={newsletterBusy}>
            {newsletterBusy ? 'Enviando…' : 'Enviar boletín a todos los suscriptores'}
          </button>
        </form>
      )}
    </section>
  );
}

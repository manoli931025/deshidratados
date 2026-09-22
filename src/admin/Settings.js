import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

const FIELDS = [
  { key: 'shopName', label: 'Nombre de la tienda', type: 'text', help: 'Aparece en el logo y el pie de página.' },
  { key: 'whatsapp', label: 'Número de WhatsApp', type: 'text', help: 'Solo dígitos, con código de país. Ej: 5215500000000' },
  { key: 'freeShip', label: 'Envío gratis a partir de ($)', type: 'number', help: 'Monto en pesos para el envío gratis.' }
];

export default function Settings() {
  const [values, setValues] = useState({ shopName: '', whatsapp: '', freeShip: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('key, value')
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        const map = {};
        (data || []).forEach(r => { map[r.key] = r.value; });
        setValues(v => ({ ...v, ...map }));
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

  return (
    <section>
      <header className="adm-head">
        <div><h2>Configuración</h2><p>Datos generales que usa la tienda.</p></div>
      </header>
      {err && <p className="adm-err">{err}</p>}
      {ok && <p className="adm-ok">{ok}</p>}
      <form className="adm-card adm-form" onSubmit={submit}>
        {FIELDS.map(f => (
          <label key={f.key}>
            {f.label}
            <input
              type={f.type}
              value={values[f.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            />
            <span className="adm-muted small">{f.help}</span>
          </label>
        ))}
        <button className="adm-btn" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  );
}
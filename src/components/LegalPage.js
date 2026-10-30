import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, configured } from '../data/supabase';
import { LEGAL, LEGAL_ORDER } from '../data/legalContent';

// ============================================================
// Renderizador de Markdown simple.
//
// El texto viene del panel de administración, así que PRIMERO se
// escapa todo el HTML y solo después se aplican las marcas. De ese
// modo quien edita no puede inyectar scripts ni romper el diseño.
// ============================================================

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// **negrita** · *cursiva* · [texto](https://enlace)
// La cursiva va después de la negrita: al llegar aquí ya no queda `**` que confundir.
const inline = (s) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null;
  let para = [];

  const closePara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const closeList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { closePara(); closeList(); continue; }

    // Cita "> texto"
    const quote = line.match(/^&gt;\s*(.*)$/) || line.match(/^>\s*(.*)$/);
    if (quote) {
      closePara(); closeList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    // Encabezados "# " "## " "### "
    const head = line.match(/^(#{1,3})\s+(.*)$/);
    if (head) {
      closePara(); closeList();
      const n = head[1].length;
      out.push(`<h${n}>${inline(head[2])}</h${n}>`);
      continue;
    }

    // Puntos de lista "- " o "* "
    const item = line.match(/^[-*]\s+(.*)$/);
    if (item) {
      closePara();
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(item[1])}</li>`);
      continue;
    }

    // Numerado "1. "
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (num) {
      closePara();
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(num[1])}</li>`);
      continue;
    }

    para.push(line);
  }

  closePara(); closeList();
  return out.join('\n');
}

export default function LegalPage() {
  const { slug } = useParams();
  const doc = LEGAL[slug];
  const [override, setOverride] = useState('');

  useEffect(() => {
    if (!configured || !supabase || !doc) return;
    let alive = true;
    supabase.from('settings').select('value').eq('key', doc.key).maybeSingle()
      .then(({ data }) => {
        if (alive && data && typeof data.value === 'string' && data.value.trim()) {
          setOverride(data.value);
        }
      })
      .catch(() => { /* sin red seguimos con el texto de código */ });
    return () => { alive = false; };
  }, [doc]);

  if (!doc) {
    return (
      <section className="doc-page">
        <div className="wrap doc-wrap">
          <h1>Página no encontrada</h1>
          <p>Ese documento no existe o fue retirado.</p>
          <p><Link className="doc-back" to="/">← Volver a la tienda</Link></p>
        </div>
      </section>
    );
  }

  const body = override || doc.body;
  const related = LEGAL_ORDER.filter(s => s !== slug);

  return (
    <section className="doc-page">
      <div className="wrap doc-wrap">
        <div
          className="doc-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
        <footer className="doc-foot">
          <Link className="doc-back" to="/">← Volver a la tienda</Link>
          <nav className="doc-related" aria-label="Otros documentos">
            {related.map(s => (
              <Link key={s} to={`/doc/${s}`}>{LEGAL[s].title}</Link>
            ))}
          </nav>
        </footer>
      </div>
    </section>
  );
}

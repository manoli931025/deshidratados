import { useEffect, useRef } from 'react';

/**
 * Cartel de aviso para los formularios del panel.
 *
 * Diseño pensado para el fallo que motivó su creación: al pulsar "Enviar"
 * al final de un formulario largo, el mensaje salía en la cabecera, fuera
 * de pantalla, y parecía que no había pasado nada.
 *
 * Por eso el componente se MONTA SIEMPRE y solo se muestra cuando tiene
 * contenido: así el scroll automático se dispara en cuanto aparece el
 * mensaje, llevándolo al centro de la vista.
 *
 * @param {'error'|'ok'|'info'} kind      Tipo de cartel
 * @param {string} [title]                Cabecera en negrita
 * @param {React.ReactNode} children      Contenido
 * @param {() => void} [onDismiss]        Si se pasa, añade botón de cierre
 */
export default function Notice({ kind = 'error', title, children, onDismiss }) {
  const ref = useRef(null);
  const visible = Boolean(children);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const reduce = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }, [visible, children]);

  if (!visible) return null;

  const isError = kind === 'error';

  return (
    <div
      ref={ref}
      className={`adm-notice is-${kind}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="adm-notice-icon" aria-hidden="true">
        {kind === 'error' ? '⚠' : kind === 'ok' ? '✓' : 'ℹ'}
      </span>
      <div className="adm-notice-body">
        {title && <div className="adm-notice-title">{title}</div>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="adm-notice-close"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
        >
          ×
        </button>
      )}
    </div>
  );
}

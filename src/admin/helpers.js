export const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

export const money = (n) => `$${Number(n || 0).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;

export const ORDER_STATUS = ['Nuevo', 'Confirmado', 'Enviado', 'Completado', 'Cancelado'];

export const STATUS_HINTS = {
  Nuevo: 'Recién recibido, sin contactar aún.',
  Confirmado: 'Ya hablaste con el cliente y acordaste el pago/envío.',
  Enviado: 'Empacado y entregado a la paquetería o en camino.',
  Completado: 'Entregado y pagado. Pedido cerrado.',
  Cancelado: 'El cliente o la tienda lo anularon.'
};

export const STATUS_CLASS = (s) => {
  const map = {
    Nuevo: 'st-new',
    Confirmado: 'st-conf',
    Enviado: 'st-sent',
    Completado: 'st-done',
    Cancelado: 'st-cancel'
  };
  return map[s] || 'st-new';
};
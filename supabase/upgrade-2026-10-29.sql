-- ============================================================
-- upgrade-2026-10-29.sql
-- Migración del proveedor de correo: Resend → Brevo
--
-- Cambia el remitente del boletín a una dirección VERIFICADA en Brevo.
-- Idempotente y no destructivo: puede ejecutarse muchas veces.
--
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- El remitente del boletín. Debe coincidir EXACTAMENTE con la dirección
-- verificada en Brevo (SMTP & API → Senders). Si la cambias allí,
-- actualízala también aquí o desde el panel (/admin → Configuración).
--
-- Nota: a diferencia del seed anterior (ON CONFLICT DO NOTHING), aquí se
-- usa DO UPDATE a propósito: queremos pisar el valor heredado de Resend
-- ('onboarding@resend.dev') en bases existentes.
insert into public.settings (key, value) values
  ('newsletter_from', 'solaria024@gmail.com')
on conflict (key) do update set value = excluded.value;

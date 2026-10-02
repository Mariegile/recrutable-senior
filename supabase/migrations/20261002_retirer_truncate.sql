-- Retire le droit TRUNCATE (non soumis aux règles RLS) accordé par défaut
-- aux rôles publics sur les tables de crédits. L'application ne vide jamais
-- ces tables ; seuls postgres / service_role (webhook, fonctions) y écrivent,
-- et ils ne sont pas concernés.
revoke truncate on table public.profils      from anon, authenticated;
revoke truncate on table public.transactions from anon, authenticated;

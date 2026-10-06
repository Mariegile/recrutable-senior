-- Vérification après application des migrations 20261002_consentements_achat
-- et 20261006_credits_codes_expirants (lecture seule, aucun changement).
-- Résultat attendu : la colonne « ok » vaut true sur toutes les lignes.
select 'consentements_achat : RLS active' as controle,
       (select relrowsecurity from pg_class where oid = 'public.consentements_achat'::regclass) as ok
union all
select 'consentements_achat : fermée au navigateur',
       not has_table_privilege('authenticated', 'public.consentements_achat', 'select')
       and not has_table_privilege('anon', 'public.consentements_achat', 'select')
union all
select 'consentements_achat : écriture par les fonctions Netlify',
       has_table_privilege('service_role', 'public.consentements_achat', 'insert')
union all
select 'credits_expirants : RLS active',
       (select relrowsecurity from pg_class where oid = 'public.credits_expirants'::regclass)
union all
select 'credits_expirants : fermée au navigateur',
       not has_table_privilege('authenticated', 'public.credits_expirants', 'select')
union all
select 'codes_cadeau.validite_credits existe',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'codes_cadeau' and column_name = 'validite_credits')
union all
select 'déclencheur de consommation sur profils',
       exists (select 1 from pg_trigger where tgname = 'profils_consommer_credits_expirants')
union all
select 'utiliser_code_cadeau : appelable par les fonctions Netlify',
       has_function_privilege('service_role', 'public.utiliser_code_cadeau(uuid, text)', 'execute')
union all
select 'utiliser_code_cadeau : fermée au navigateur',
       not has_function_privilege('anon', 'public.utiliser_code_cadeau(uuid, text)', 'execute')
       and not has_function_privilege('authenticated', 'public.utiliser_code_cadeau(uuid, text)', 'execute')
union all
select 'expirer_credits : appelable par la tâche quotidienne',
       has_function_privilege('service_role', 'public.expirer_credits()', 'execute')
union all
select 'expirer_credits : fermée au navigateur',
       not has_function_privilege('authenticated', 'public.expirer_credits()', 'execute')
union all
select 'fonctions de crédit existantes toujours appelables par Netlify',
       has_function_privilege('service_role', 'public.depenser_credit_atomique(uuid, integer)', 'execute')
       and has_function_privilege('service_role', 'public.crediter_paiement(uuid, integer, text)', 'execute')
       and has_function_privilege('service_role', 'public.rembourser_credit(uuid, integer)', 'execute');

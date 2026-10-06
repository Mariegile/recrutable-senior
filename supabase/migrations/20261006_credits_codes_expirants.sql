-- Crédits offerts par code partenaire, valables une durée limitée
-- (ex. 5 crédits valables 3 mois). Les crédits achetés ne sont pas
-- concernés : ils n'expirent pas.
--
-- Principe (modification minimale, sans toucher aux fonctions de paiement
-- ni de dépense existantes) :
--   1. codes_cadeau.validite_credits : durée de validité des crédits offerts
--      (null = n'expirent pas, comportement actuel).
--   2. credits_expirants : un lot par utilisation d'un tel code (restant,
--      date d'échéance).
--   3. Déclencheur sur profils : toute dépense consomme d'abord les lots
--      qui expirent le plus tôt.
--   4. expirer_credits() (appelée chaque jour par la fonction Netlify
--      keepalive-supabase) : retire du solde ce qui reste des lots échus.

alter table public.codes_cadeau
  add column if not exists validite_credits interval;

create table if not exists public.credits_expirants (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  restant   integer not null check (restant >= 0),
  expire_le timestamptz not null,
  origine   text not null,
  cree_le   timestamptz not null default now()
);
create index if not exists credits_expirants_actifs_idx
  on public.credits_expirants (user_id, expire_le) where restant > 0;
alter table public.credits_expirants enable row level security;
revoke all on table public.credits_expirants from anon, authenticated;

-- 3. Dépense : consommer d'abord les crédits qui expirent le plus tôt.
create or replace function public.consommer_credits_expirants()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a_consommer int := old.credits - new.credits;
  lot record;
  pris int;
begin
  -- Hausse du solde, ou retrait effectué par expirer_credits() : rien à faire.
  if a_consommer <= 0 or coalesce(current_setting('recrutable.expiration', true), '') = '1' then
    return new;
  end if;
  for lot in
    select id, restant from public.credits_expirants
     where user_id = new.id and restant > 0 and expire_le > now()
     order by expire_le, id
     for update
  loop
    exit when a_consommer <= 0;
    pris := least(lot.restant, a_consommer);
    update public.credits_expirants set restant = restant - pris where id = lot.id;
    a_consommer := a_consommer - pris;
  end loop;
  return new;
end $$;

drop trigger if exists profils_consommer_credits_expirants on public.profils;
create trigger profils_consommer_credits_expirants
  after update of credits on public.profils
  for each row execute function public.consommer_credits_expirants();

-- 4. Expiration : retire du solde ce qui reste des lots échus.
create or replace function public.expirer_credits()
returns integer language plpgsql security definer set search_path = public as $$
declare
  lot record;
  retire int;
  total int := 0;
begin
  perform set_config('recrutable.expiration', '1', true);
  for lot in
    select * from public.credits_expirants
     where restant > 0 and expire_le <= now()
     order by id
     for update
  loop
    update public.profils
       set credits = greatest(credits - lot.restant, 0)
     where id = lot.user_id;
    retire := lot.restant;
    -- Type existant (« code_cadeau ») pour respecter d'éventuelles contraintes.
    insert into public.transactions (user_id, montant, type, details)
         values (lot.user_id, -retire, 'code_cadeau', 'expiration:' || lot.origine);
    update public.credits_expirants set restant = 0 where id = lot.id;
    total := total + retire;
  end loop;
  perform set_config('recrutable.expiration', '0', true);
  return total;
end $$;

-- utiliser_code_cadeau : identique à la version en production, avec en plus
-- la création d'un lot à échéance quand le code a une validite_credits.
create or replace function public.utiliser_code_cadeau(p_user_id uuid, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code   public.codes_cadeau%rowtype;
  v_solde  int;
begin
  -- Verrou sur la ligne du code : empêche la double utilisation en parallèle.
  select * into v_code
    from public.codes_cadeau
   where code = upper(trim(p_code))
   for update;

  if not found then
    return json_build_object('ok', false, 'raison', 'inconnu');
  end if;

  if not v_code.actif then
    return json_build_object('ok', false, 'raison', 'inconnu');
  end if;

  if v_code.expire_le is not null and v_code.expire_le < now() then
    return json_build_object('ok', false, 'raison', 'expire');
  end if;

  if v_code.max_utilisations is not null
     and v_code.utilisations >= v_code.max_utilisations then
    return json_build_object('ok', false, 'raison', 'epuise');
  end if;

  -- Usage unique par compte (la clé primaire fait le contrôle).
  begin
    insert into public.codes_cadeau_usages (code, user_id)
         values (v_code.code, p_user_id);
  exception when unique_violation then
    return json_build_object('ok', false, 'raison', 'deja');
  end;

  update public.codes_cadeau
     set utilisations = utilisations + 1
   where code = v_code.code;

  update public.profils
     set credits = credits + v_code.credits
   where id = p_user_id
  returning credits into v_solde;

  if v_solde is null then
    raise exception 'PROFIL_INTROUVABLE';
  end if;

  if v_code.validite_credits is not null then
    insert into public.credits_expirants (user_id, restant, expire_le, origine)
         values (p_user_id, v_code.credits, now() + v_code.validite_credits, v_code.code);
  end if;

  insert into public.transactions (user_id, montant, type, details)
       values (p_user_id, v_code.credits, 'code_cadeau', 'code:' || v_code.code || ':' || p_user_id::text);

  return json_build_object('ok', true, 'credits', v_code.credits, 'total', v_solde,
                           'expire_le', case when v_code.validite_credits is not null
                                             then now() + v_code.validite_credits end);
end $$;

-- Aucune de ces fonctions n'est appelable depuis le navigateur.
revoke execute on function public.consommer_credits_expirants() from public, anon, authenticated;
revoke execute on function public.expirer_credits() from public, anon, authenticated;
revoke execute on function public.utiliser_code_cadeau(uuid, text) from public, anon, authenticated;

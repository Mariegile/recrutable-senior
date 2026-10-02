-- Preuve du consentement avant paiement : accord aux CGV et renonciation
-- au droit de rétractation (art. L221-28 13° du Code de la consommation).
-- Écrite uniquement par la fonction Netlify « consentement » (service_role).
-- Conservation : durée de la relation contractuelle + 5 ans (prescription).
create table if not exists public.consentements_achat (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  offre         text not null check (offre in ('recharge', 'mensuel', 'annuel')),
  version_texte text not null,
  langue        text not null default 'fr',
  accepte_le    timestamptz not null default now()
);

create index if not exists consentements_achat_user_idx
  on public.consentements_achat (user_id, accepte_le desc);

-- Aucun accès depuis le navigateur : RLS activée sans politique.
alter table public.consentements_achat enable row level security;
revoke all on table public.consentements_achat from anon, authenticated;

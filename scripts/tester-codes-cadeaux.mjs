// Tests SQL des codes cadeaux et des crédits à échéance, dans un vrai
// Postgres en mémoire (PGlite). Le schéma reproduit celui de production
// (relevé le 2026-10-02), puis la migration du dépôt est appliquée.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = fs.readFileSync(new URL("../supabase/migrations/20261006_credits_codes_expirants.sql", import.meta.url), "utf8");

const SCHEMA_PROD = `
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create table public.profils (id uuid primary key references auth.users(id), email text, credits integer default 0, created_at timestamptz default now(), stripe_customer_id text);
create table public.transactions (id bigint generated always as identity primary key, user_id uuid, montant integer, type text, details text, created_at timestamptz default now());
create table public.codes_cadeau (code text primary key, credits integer, actif boolean default true, max_utilisations integer, utilisations integer default 0, expire_le timestamptz, note text, created_at timestamptz default now());
create table public.codes_cadeau_usages (code text, user_id uuid, used_at timestamptz default now(), primary key (code, user_id));
`;

let n = 0;
const uuid = () => `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;

async function base() {
  const db = new PGlite();
  await db.exec(SCHEMA_PROD);
  await db.exec(MIGRATION);
  return db;
}
async function compte(db, credits = 0) {
  const id = uuid();
  await db.query("insert into auth.users (id) values ($1)", [id]);
  await db.query("insert into public.profils (id, credits) values ($1, $2)", [id, credits]);
  return id;
}
const utiliser = async (db, id, code) => (await db.query("select public.utiliser_code_cadeau($1, $2) as r", [id, code])).rows[0].r;
const solde = async (db, id) => (await db.query("select credits from public.profils where id = $1", [id])).rows[0].credits;
const lots = async (db, id) => (await db.query("select restant, expire_le from public.credits_expirants where user_id = $1 order by expire_le", [id])).rows;
// Équivalents des fonctions serveur existantes (dépense / remboursement / achat)
const depenser = (db, id, k = 1) => db.query("update public.profils set credits = credits - $2 where id = $1 and credits >= $2", [id, k]);
const crediter = (db, id, k) => db.query("update public.profils set credits = credits + $2 where id = $1", [id, k]);
const vieillir = (db, id) => db.query("update public.credits_expirants set expire_le = now() - interval '1 second' where user_id = $1", [id]);
const expirer = async (db) => (await db.query("select public.expirer_credits() as n")).rows[0].n;

const CODE_ASSO = "insert into public.codes_cadeau (code, credits, max_utilisations, expire_le, validite_credits, note) values ('FORCEFEMMES', 5, 50, now() + interval '6 months', interval '3 months', 'test')";

test("règle partenaire : 5 crédits, valables 3 mois, une fois par compte", async () => {
  const db = await base(); await db.exec(CODE_ASSO);
  const a = await compte(db);
  const r = await utiliser(db, a, " forcefemmes ");
  assert.equal(r.ok, true); assert.equal(r.credits, 5); assert.equal(r.total, 5);
  const [lot] = await lots(db, a);
  assert.equal(lot.restant, 5);
  const jours = (new Date(lot.expire_le) - Date.now()) / 86400000;
  assert.ok(jours > 88 && jours < 93, `échéance à ~3 mois (${jours.toFixed(1)} j)`);
  assert.equal((await utiliser(db, a, "FORCEFEMMES")).raison, "deja");
  assert.equal(await solde(db, a), 5);
});

test("50 comptes différents au maximum, le 51e est refusé", async () => {
  const db = await base(); await db.exec(CODE_ASSO);
  for (let i = 0; i < 50; i++) assert.equal((await utiliser(db, await compte(db), "FORCEFEMMES")).ok, true);
  assert.equal((await utiliser(db, await compte(db), "FORCEFEMMES")).raison, "epuise");
  assert.equal((await db.query("select utilisations from public.codes_cadeau")).rows[0].utilisations, 50);
});

test("code échu, inactif ou inconnu : refusé avec le bon motif", async () => {
  const db = await base();
  await db.exec("insert into public.codes_cadeau (code, credits, expire_le) values ('VIEUX', 5, now() - interval '1 day')");
  await db.exec("insert into public.codes_cadeau (code, credits, actif) values ('COUPE', 5, false)");
  const a = await compte(db);
  assert.equal((await utiliser(db, a, "VIEUX")).raison, "expire");
  assert.equal((await utiliser(db, a, "COUPE")).raison, "inconnu");
  assert.equal((await utiliser(db, a, "NIMPORTE")).raison, "inconnu");
  assert.equal(await solde(db, a), 0);
});

test("code sans validite_credits : comportement actuel inchangé (crédits sans échéance)", async () => {
  const db = await base();
  await db.exec("insert into public.codes_cadeau (code, credits) values ('MERCI', 2)");
  const a = await compte(db);
  assert.equal((await utiliser(db, a, "MERCI")).ok, true);
  assert.equal((await lots(db, a)).length, 0);
  await expirer(db);
  assert.equal(await solde(db, a), 2);
});

test("les dépenses consomment d'abord les crédits offerts ; à l'échéance seul le reste offert disparaît", async () => {
  const db = await base(); await db.exec(CODE_ASSO);
  const a = await compte(db, 3);               // 3 crédits achetés
  await utiliser(db, a, "FORCEFEMMES");        // + 5 offerts
  await depenser(db, a, 2);                     // 2 réécritures
  assert.equal((await lots(db, a))[0].restant, 3);
  await crediter(db, a, 8);                     // un achat ne touche pas aux lots
  assert.equal((await lots(db, a))[0].restant, 3);
  await vieillir(db, a);
  assert.equal(await expirer(db), 3);
  assert.equal(await solde(db, a), 3 + 8);     // crédits achetés intacts
  const tx = (await db.query("select montant, type, details from public.transactions where user_id = $1 and montant < 0", [a])).rows;
  assert.deepEqual(tx, [{ montant: -3, type: "code_cadeau", details: "expiration:FORCEFEMMES" }]);
  assert.equal(await expirer(db), 0);           // idempotent
  assert.equal(await solde(db, a), 11);
});

test("crédits offerts entièrement utilisés avant l'échéance : rien n'est retiré", async () => {
  const db = await base(); await db.exec(CODE_ASSO);
  const a = await compte(db, 3);
  await utiliser(db, a, "FORCEFEMMES");
  await depenser(db, a, 6);
  assert.equal((await lots(db, a))[0].restant, 0);
  await vieillir(db, a);
  assert.equal(await expirer(db), 0);
  assert.equal(await solde(db, a), 2);
});

test("deux codes : le lot qui expire le plus tôt est consommé en premier", async () => {
  const db = await base();
  await db.exec("insert into public.codes_cadeau (code, credits, validite_credits) values ('COURT', 2, interval '1 month'), ('LONG', 5, interval '3 months')");
  const a = await compte(db);
  await utiliser(db, a, "LONG"); await utiliser(db, a, "COURT");
  await depenser(db, a, 3);
  assert.deepEqual((await lots(db, a)).map(l => l.restant), [0, 4]);
});

test("aucune des fonctions n'est exécutable par anon / authenticated", async () => {
  const db = await base();
  for (const f of ["public.expirer_credits()", "public.consommer_credits_expirants()", "public.utiliser_code_cadeau(uuid, text)"]) {
    for (const role of ["anon", "authenticated"]) {
      const r = (await db.query(`select has_function_privilege('${role}', '${f}', 'execute') as p`)).rows[0].p;
      assert.equal(r, false, `${role} ne doit pas exécuter ${f}`);
    }
  }
});

// ── Fonction planifiée : expiration quotidienne ──────────────────────
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const keepalive = require("../netlify/functions/keepalive-supabase.js");

function fauxClient({ rpcErreur = null, retires = 0 } = {}) {
  const appels = [];
  return {
    appels,
    from: () => ({ select: async () => ({ error: null }) }),
    rpc: async (nom) => { appels.push(nom); return rpcErreur ? { data: null, error: { message: rpcErreur } } : { data: retires, error: null }; },
  };
}
test("keepalive : appelle expirer_credits chaque jour", async () => {
  process.env.SUPABASE_URL = "x"; process.env.SUPABASE_SERVICE_ROLE_KEY = "y";
  const c = fauxClient({ retires: 3 });
  const r = await keepalive._test.creerHandler(() => c)();
  assert.equal(r.body, "ok");
  assert.deepEqual(c.appels, ["expirer_credits"]);
});
test("keepalive : migration absente -> avertissement, réponse 200 (jamais de plantage)", async () => {
  process.env.SUPABASE_URL = "x"; process.env.SUPABASE_SERVICE_ROLE_KEY = "y";
  const r = await keepalive._test.creerHandler(() => fauxClient({ rpcErreur: "function expirer_credits() does not exist" }))();
  assert.equal(r.statusCode, 200);
  assert.equal(r.body, "ok");
});

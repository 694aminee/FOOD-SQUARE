-- =====================================================================
-- Food Square : base de données Supabase
-- À coller en entier dans Supabase > SQL Editor > New query, puis "Run".
-- Le script peut être relancé sans risque.
-- =====================================================================

create extension if not exists pgcrypto;

-- Équipe autorisée à voir l'écran cuisine -----------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Infos des clients inscrits (prénom, téléphone, adresse) -------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  phone      text,
  address    text,
  city       text,
  updated_at timestamptz not null default now()
);

-- Compteur qui donne les numéros de commande (repart à 1 chaque jour) --
create table if not exists public.order_counters (
  day date primary key,
  n   integer not null default 0
);

-- Commandes ------------------------------------------------------------
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  number      integer not null,
  day         date not null default (now() at time zone 'Europe/Paris')::date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,   -- vide = commande en invité
  status      text not null default 'nouvelle'
              check (status in ('nouvelle','preparation','prete','terminee','annulee')),
  mode        text not null check (mode in ('emporter','livraison')),
  pickup_time text not null default 'asap',
  payment     text not null,
  customer    jsonb not null,
  items       jsonb not null,
  total       numeric(8,2) not null check (total >= 0 and total < 1000),
  unique (day, number)
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_user_idx on public.orders (user_id);

-- Est-ce que la personne connectée fait partie de l'équipe ? ----------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- Sécurité : chacun ne voit que ce qu'il a le droit de voir ------------
alter table public.orders         enable row level security;
alter table public.profiles       enable row level security;
alter table public.staff          enable row level security;
alter table public.order_counters enable row level security;

drop policy if exists "orders: client voit les siennes, équipe voit tout" on public.orders;
create policy "orders: client voit les siennes, équipe voit tout" on public.orders
  for select using (auth.uid() = user_id or public.is_staff());

drop policy if exists "orders: équipe change le statut" on public.orders;
create policy "orders: équipe change le statut" on public.orders
  for update using (public.is_staff()) with check (public.is_staff());
-- Pas de droit d'insertion direct : les commandes passent par place_order().

drop policy if exists "profiles: lecture perso" on public.profiles;
create policy "profiles: lecture perso" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: création perso" on public.profiles;
create policy "profiles: création perso" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles: modification perso" on public.profiles;
create policy "profiles: modification perso" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "staff: chacun voit sa propre ligne" on public.staff;
create policy "staff: chacun voit sa propre ligne" on public.staff for select using (auth.uid() = user_id);

-- Passer une commande (invité ou client connecté) -----------------------
-- Renvoie {id, number}. Le numéro est donné dans l'ordre d'arrivée du jour.
create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  today   date := (now() at time zone 'Europe/Paris')::date;
  num     integer;
  new_id  uuid;
  tot     numeric;
  phone   text;
begin
  if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Le panier est vide.';
  end if;
  if jsonb_array_length(payload->'items') > 60 then
    raise exception 'Commande trop grande : appelle le snack.';
  end if;
  if coalesce(trim(payload->'customer'->>'name'), '') = '' then
    raise exception 'Le prénom est obligatoire.';
  end if;
  phone := regexp_replace(coalesce(payload->'customer'->>'phone', ''), '\D', '', 'g');
  if length(phone) < 10 then
    raise exception 'Le numéro de téléphone est incomplet.';
  end if;
  if payload->>'mode' not in ('emporter', 'livraison') then
    raise exception 'Mode de commande inconnu.';
  end if;
  tot := (payload->>'total')::numeric;
  if payload->>'mode' = 'livraison' then
    if tot < 20 then raise exception 'La livraison démarre à 20 €.'; end if;
    if coalesce(trim(payload->'customer'->>'address'), '') = '' then raise exception 'L''adresse de livraison est obligatoire.'; end if;
  end if;
  -- Anti-abus : 5 commandes max par numéro de téléphone sur 10 minutes.
  if (select count(*) from public.orders
      where regexp_replace(customer->>'phone', '\D', '', 'g') = phone
        and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Trop de commandes en peu de temps : appelle le snack.';
  end if;

  insert into public.order_counters as c (day, n) values (today, 1)
    on conflict (day) do update set n = c.n + 1
    returning c.n into num;

  insert into public.orders (number, day, user_id, mode, pickup_time, payment, customer, items, total)
  values (num, today, auth.uid(), payload->>'mode',
          left(coalesce(payload->>'time', 'asap'), 10),
          left(coalesce(payload->>'payment', 'Carte bancaire'), 40),
          payload->'customer', payload->'items', tot)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'number', num);
end $$;

-- Suivi d'une commande par son identifiant (fonctionne aussi pour les invités).
create or replace function public.order_status(order_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('number', number, 'status', status, 'mode', mode)
  from public.orders where id = order_id;
$$;

revoke all on function public.place_order(jsonb) from public;
revoke all on function public.order_status(uuid) from public;
grant execute on function public.place_order(jsonb)  to anon, authenticated;
grant execute on function public.order_status(uuid)  to anon, authenticated;
grant execute on function public.is_staff()          to authenticated;

-- Temps réel pour l'écran cuisine ---------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

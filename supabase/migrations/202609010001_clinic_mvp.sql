create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text not null,
  state text not null,
  timezone text not null default 'America/Sao_Paulo',
  is_demo boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, slug),
  unique (id, clinic_id)
);

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, clinic_id)
);

create table if not exists public.professional_services (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (professional_id, service_id),
  foreign key (professional_id, clinic_id) references public.professionals(id, clinic_id) on delete cascade,
  foreign key (service_id, clinic_id) references public.services(id, clinic_id) on delete cascade
);

create table if not exists public.weekly_availability (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  professional_id uuid not null,
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (professional_id, clinic_id) references public.professionals(id, clinic_id) on delete cascade,
  unique (professional_id, iso_weekday, start_time, end_time)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  idempotency_key text not null unique,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  service_id uuid not null,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  patient_name text not null check (char_length(patient_name) between 3 and 80),
  patient_whatsapp text not null check (patient_whatsapp ~ '^[+]55[0-9]{10,11}$'),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  source text not null check (source in ('web', 'webmcp', 'admin')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at),
  foreign key (service_id, clinic_id) references public.services(id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals(id, clinic_id) on delete restrict
);

alter table public.appointments
  add constraint appointments_no_professional_overlap
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed');

create index if not exists appointments_clinic_starts_at_idx
  on public.appointments (clinic_id, starts_at);

create table if not exists public.rate_limits (
  key_hash text primary key,
  clinic_id uuid references public.clinics(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

alter table public.clinics enable row level security;
alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.weekly_availability enable row level security;
alter table public.appointments enable row level security;
alter table public.rate_limits enable row level security;

alter table public.clinics force row level security;
alter table public.services force row level security;
alter table public.professionals force row level security;
alter table public.professional_services force row level security;
alter table public.weekly_availability force row level security;
alter table public.appointments force row level security;
alter table public.rate_limits force row level security;

revoke all on table public.clinics from anon, authenticated;
revoke all on table public.services from anon, authenticated;
revoke all on table public.professionals from anon, authenticated;
revoke all on table public.professional_services from anon, authenticated;
revoke all on table public.weekly_availability from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.create_demo_appointment(
  p_idempotency_key text,
  p_clinic_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_patient_name text,
  p_patient_whatsapp text,
  p_source text
)
returns table (
  id uuid,
  confirmation_code text,
  idempotency_key text,
  clinic_id uuid,
  service_id uuid,
  professional_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  patient_name text,
  patient_whatsapp text,
  status text,
  source text,
  created_at timestamptz,
  cancelled_at timestamptz,
  service_name text,
  professional_name text,
  replayed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appointment_id uuid;
  v_duration integer;
  v_timezone text;
  v_code text;
begin
  select a.id into v_appointment_id
  from public.appointments a
  where a.idempotency_key = p_idempotency_key;

  if found then
    return query
      select a.id, a.confirmation_code, a.idempotency_key, a.clinic_id, a.service_id,
        a.professional_id, a.starts_at, a.ends_at, a.patient_name, a.patient_whatsapp,
        a.status, a.source, a.created_at, a.cancelled_at, s.name, p.name, true
      from public.appointments a
      join public.services s on s.id = a.service_id
      join public.professionals p on p.id = a.professional_id
      where a.id = v_appointment_id;
    return;
  end if;

  perform 1
  from public.professionals p
  where p.id = p_professional_id
    and p.clinic_id = p_clinic_id
    and p.active
  for update;

  if not found then
    raise exception 'CATALOG_ITEM_NOT_FOUND';
  end if;

  select a.id into v_appointment_id
  from public.appointments a
  where a.idempotency_key = p_idempotency_key;

  if found then
    return query
      select a.id, a.confirmation_code, a.idempotency_key, a.clinic_id, a.service_id,
        a.professional_id, a.starts_at, a.ends_at, a.patient_name, a.patient_whatsapp,
        a.status, a.source, a.created_at, a.cancelled_at, s.name, p.name, true
      from public.appointments a
      join public.services s on s.id = a.service_id
      join public.professionals p on p.id = a.professional_id
      where a.id = v_appointment_id;
    return;
  end if;

  select s.duration_minutes, c.timezone
    into v_duration, v_timezone
  from public.services s
  join public.clinics c on c.id = s.clinic_id
  join public.professional_services ps
    on ps.service_id = s.id
    and ps.professional_id = p_professional_id
    and ps.clinic_id = p_clinic_id
  where s.id = p_service_id
    and s.clinic_id = p_clinic_id
    and s.active
    and c.active;

  if not found then
    raise exception 'CATALOG_ITEM_NOT_FOUND';
  end if;

  if p_source not in ('web', 'webmcp', 'admin')
    or p_ends_at <> p_starts_at + make_interval(mins => v_duration)
    or p_starts_at < now() + interval '25 minutes'
    or (p_starts_at at time zone v_timezone)::date > (now() at time zone v_timezone)::date + 14
    or (p_starts_at at time zone v_timezone)::date < (now() at time zone v_timezone)::date then
    raise exception 'INVALID_APPOINTMENT';
  end if;

  if not exists (
    select 1
    from public.weekly_availability wa
    where wa.clinic_id = p_clinic_id
      and wa.professional_id = p_professional_id
      and wa.active
      and wa.iso_weekday = extract(isodow from p_starts_at at time zone v_timezone)
      and (p_starts_at at time zone v_timezone)::time >= wa.start_time
      and (p_ends_at at time zone v_timezone)::time <= wa.end_time
      and mod(
        floor(extract(epoch from ((p_starts_at at time zone v_timezone)::time - wa.start_time)) / 60)::integer,
        wa.slot_interval_minutes
      ) = 0
  ) then
    raise exception 'OUTSIDE_AVAILABILITY';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.professional_id = p_professional_id
      and a.status = 'confirmed'
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'SLOT_CONFLICT';
  end if;

  v_code := 'CL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.appointments as a (
    confirmation_code, idempotency_key, clinic_id, service_id, professional_id,
    starts_at, ends_at, patient_name, patient_whatsapp, source
  ) values (
    v_code, p_idempotency_key, p_clinic_id, p_service_id, p_professional_id,
    p_starts_at, p_ends_at, btrim(p_patient_name), p_patient_whatsapp, p_source
  ) returning a.id into v_appointment_id;

  return query
    select a.id, a.confirmation_code, a.idempotency_key, a.clinic_id, a.service_id,
      a.professional_id, a.starts_at, a.ends_at, a.patient_name, a.patient_whatsapp,
      a.status, a.source, a.created_at, a.cancelled_at, s.name, p.name, false
    from public.appointments a
    join public.services s on s.id = a.service_id
    join public.professionals p on p.id = a.professional_id
    where a.id = v_appointment_id;
exception
  when exclusion_violation then
    raise exception 'SLOT_CONFLICT';
end;
$$;

create or replace function public.consume_demo_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_maximum integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_window_seconds < 1 or p_maximum < 1 or char_length(p_key_hash) < 32 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  insert into public.rate_limits as rl (key_hash, window_started_at, request_count)
  values (p_key_hash, v_now, 1)
  on conflict (key_hash) do update
    set window_started_at = case
          when rl.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
          else rl.window_started_at
        end,
        request_count = case
          when rl.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
          else rl.request_count + 1
        end
  returning request_count into v_count;

  return v_count <= p_maximum;
end;
$$;

revoke all on function public.create_demo_appointment(text, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.consume_demo_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.create_demo_appointment(text, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) to service_role;
grant execute on function public.consume_demo_rate_limit(text, integer, integer) to service_role;

insert into public.clinics (id, name, slug, city, state, timezone, is_demo, active)
values (
  '11111111-1111-4111-8111-111111111111',
  'Clínica WebMCP Campo Largo — Demonstração',
  'clinica-webmcp-campo-largo',
  'Campo Largo',
  'PR',
  'America/Sao_Paulo',
  true,
  true
)
on conflict (id) do update set
  name = excluded.name,
  city = excluded.city,
  state = excluded.state,
  timezone = excluded.timezone,
  is_demo = excluded.is_demo,
  active = excluded.active;

insert into public.services (id, clinic_id, name, slug, description, duration_minutes, active)
values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Consulta de Clínica Geral', 'clinica-geral', 'Consulta fictícia de 30 minutos para validar o fluxo de agendamento.', 30, true),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'Pediatria — futura', 'pediatria', 'Especialidade inativa reservada para a próxima fase.', 30, false),
  ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'Dermatologia — futura', 'dermatologia', 'Especialidade inativa reservada para a próxima fase.', 30, false)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  active = excluded.active;

insert into public.professionals (id, clinic_id, name, active)
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Profissional de Demonstração', true)
on conflict (id) do update set name = excluded.name, active = excluded.active;

insert into public.professional_services (clinic_id, professional_id, service_id)
values ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222')
on conflict (professional_id, service_id) do nothing;

insert into public.weekly_availability (
  id, clinic_id, professional_id, iso_weekday, start_time, end_time, slot_interval_minutes, active
)
values
  ('44444444-4444-4444-8101-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 1, '09:00', '12:00', 30, true),
  ('44444444-4444-4444-8102-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 1, '14:00', '17:00', 30, true),
  ('44444444-4444-4444-8201-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 2, '09:00', '12:00', 30, true),
  ('44444444-4444-4444-8202-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 2, '14:00', '17:00', 30, true),
  ('44444444-4444-4444-8301-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 3, '09:00', '12:00', 30, true),
  ('44444444-4444-4444-8302-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 3, '14:00', '17:00', 30, true),
  ('44444444-4444-4444-8401-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 4, '09:00', '12:00', 30, true),
  ('44444444-4444-4444-8402-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 4, '14:00', '17:00', 30, true),
  ('44444444-4444-4444-8501-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 5, '09:00', '12:00', 30, true),
  ('44444444-4444-4444-8502-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 5, '14:00', '17:00', 30, true)
on conflict (id) do update set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  slot_interval_minutes = excluded.slot_interval_minutes,
  active = excluded.active;

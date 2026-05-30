-- ═══════════════════════════════════════════════════════════
--  BERESPA — Schema de Supabase
--  Pega esto en: supabase.com → tu proyecto → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════


-- ── 1. TABLA DE PERFILES (se crea automáticamente al registrarse) ──
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  nombre      text,
  created_at  timestamptz default now()
);

-- Trigger: cuando un usuario se registra, crea su perfil automáticamente
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, nombre)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. TABLA DE PROGRESO DE MÓDULOS ──
create table if not exists public.module_progress (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade not null,
  modulo_slug    text not null,
  modulo_titulo  text,
  visto          boolean default true,
  completado     boolean default false,
  visto_at       timestamptz default now(),
  completado_at  timestamptz,
  updated_at     timestamptz default now(),

  -- Un usuario solo tiene una fila por módulo
  unique (user_id, modulo_slug)
);

-- Índices para consultas rápidas
create index if not exists idx_progress_user_id   on public.module_progress(user_id);
create index if not exists idx_progress_slug       on public.module_progress(modulo_slug);
create index if not exists idx_progress_completado on public.module_progress(completado);


-- ── 3. ROW LEVEL SECURITY (RLS) — cada usuario solo ve sus datos ──

alter table public.profiles        enable row level security;
alter table public.module_progress enable row level security;

-- Profiles: solo leer/editar el propio perfil
create policy "Usuarios ven su perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuarios editan su perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Module progress: CRUD solo sobre los propios registros
create policy "Usuarios ven su progreso"
  on public.module_progress for select
  using (auth.uid() = user_id);

create policy "Usuarios insertan su progreso"
  on public.module_progress for insert
  with check (auth.uid() = user_id);

create policy "Usuarios actualizan su progreso"
  on public.module_progress for update
  using (auth.uid() = user_id);

create policy "Usuarios borran su progreso"
  on public.module_progress for delete
  using (auth.uid() = user_id);


-- ── 4. VISTA ÚTIL: estadísticas por módulo (para analytics tuyo) ──
create or replace view public.modulo_stats as
select
  modulo_slug,
  modulo_titulo,
  count(*)                                        as total_visitas,
  count(*) filter (where completado = true)       as total_completados,
  round(
    count(*) filter (where completado = true)::numeric
    / nullif(count(*), 0) * 100, 1
  )                                               as pct_completado
from public.module_progress
group by modulo_slug, modulo_titulo
order by total_visitas desc;

-- Nota: para ver esta vista ve a supabase.com → Table Editor → modulo_stats
-- Solo tú (service_role) puedes verla, los usuarios no tienen acceso.

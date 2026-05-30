// ─────────────────────────────────────────────
//  BERESPA — Supabase client + auth helpers
//  Rellena SUPABASE_URL y SUPABASE_ANON_KEY con
//  los valores de tu proyecto en supabase.com
// ─────────────────────────────────────────────
const SUPABASE_URL      = 'https://ktgwdiujpwzmdyftsvqm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Z3dkaXVqcHd6bWR5ZnRzdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDQ2MTksImV4cCI6MjA5NTcyMDYxOX0.5HTJeHkt16O8R15-aZ7QJI5wvlMs9Dx7SSGa0eLQQW8';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth helpers ──────────────────────────────

async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function signUp(email, password, nombre) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nombre } }
  });
  return { data, error };
}

async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = '/';
}

// ── Progreso helpers ──────────────────────────

// Registra que el usuario ha visto un módulo
async function marcarVisto(moduloSlug, moduloTitulo) {
  const user = await getUser();
  if (!user) return;

  const { error } = await sb
    .from('module_progress')
    .upsert({
      user_id:       user.id,
      modulo_slug:   moduloSlug,
      modulo_titulo: moduloTitulo,
      visto:         true,
      visto_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,modulo_slug', ignoreDuplicates: false });

  return !error;
}

// Marca un módulo como completado (llamado desde el botón del módulo)
async function marcarCompletado(moduloSlug, moduloTitulo) {
  const user = await getUser();
  if (!user) return false;

  const { error } = await sb
    .from('module_progress')
    .upsert({
      user_id:        user.id,
      modulo_slug:    moduloSlug,
      modulo_titulo:  moduloTitulo,
      visto:          true,
      completado:     true,
      visto_at:       new Date().toISOString(),
      completado_at:  new Date().toISOString(),
    }, { onConflict: 'user_id,modulo_slug' });

  return !error;
}

// Obtiene todo el progreso del usuario
async function getProgreso() {
  const user = await getUser();
  if (!user) return [];

  const { data } = await sb
    .from('module_progress')
    .select('*')
    .eq('user_id', user.id)
    .order('visto_at', { ascending: false });

  return data || [];
}

// Comprueba si un módulo está completado
async function isCompletado(moduloSlug) {
  const user = await getUser();
  if (!user) return false;

  const { data } = await sb
    .from('module_progress')
    .select('completado')
    .eq('user_id', user.id)
    .eq('modulo_slug', moduloSlug)
    .single();

  return data?.completado || false;
}

// ── Nav helper: inyecta estado de sesión en el nav ──
async function initNav() {
  const user = await getUser();
  const navEl = document.getElementById('nav-auth');
  if (!navEl) return;

  if (user) {
    const nombre = user.user_metadata?.nombre || user.email.split('@')[0];
    navEl.innerHTML = `
      <a href="/mi-progreso.html" style="font-size:.88rem;color:var(--muted);font-weight:500">
        👤 ${nombre}
      </a>
      <button onclick="signOut()" style="font-size:.82rem;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">
        Salir
      </button>`;
  } else {
    navEl.innerHTML = `
      <a href="/auth.html" style="background:var(--accent);color:#fff;padding:7px 18px;border-radius:8px;font-size:.85rem;font-weight:600">
        Acceder
      </a>`;
  }
}

  import { supabase, requireAuth } from '../supabase.js';

  // Si ya hay sesión activa → ir directo al dashboard
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.replace('modulos/ahorro.html');

  // ── Toggle ver/ocultar contraseña ──────────────────────
  document.getElementById('togglePwd').addEventListener('click', () => {
    const input = document.getElementById('password');
    const icon  = document.querySelector('#togglePwd i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'bi bi-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'bi bi-eye';
    }
  });

  // ── Submit login ───────────────────────────────────────
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Mostrar spinner en botón
    document.getElementById('btnLoginText').classList.add('d-none');
    document.getElementById('btnLoginSpinner').classList.remove('d-none');
    document.getElementById('alertError').classList.add('d-none');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      document.getElementById('alertMsg').textContent =
        'Correo o contraseña incorrectos. Verifica tus datos.';
      document.getElementById('alertError').classList.remove('d-none');
      document.getElementById('btnLoginText').classList.remove('d-none');
      document.getElementById('btnLoginSpinner').classList.add('d-none');
      return;
    }

    // Éxito → redirigir al dashboard
    window.location.replace('modulos/ahorro.html');
  });
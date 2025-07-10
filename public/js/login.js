document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })  
    });

    const result = await response.json();

    if (response.ok) {
      // Guardar token y usuario en sessionStorage
      sessionStorage.setItem('authToken', result.token);
      sessionStorage.setItem('usuario', JSON.stringify(result.usuario));

      // Redireccionar
      window.location.href = 'home.html';
    } else {
      alert(result.error || 'Error al iniciar sesión');
    }

  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    alert('Ocurrió un error en el servidor');
  }
});

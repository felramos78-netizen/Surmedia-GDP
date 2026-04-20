const USERS = [
  { username: 'Usuario', password: '1234', role: 'user',  redirect: 'user-dashboard.html' },
  { username: 'Admin',   password: 'admin', role: 'admin', redirect: 'admin-dashboard.html' },
];

const form          = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMsg      = document.getElementById('errorMsg');
const toggleBtn     = document.getElementById('togglePassword');
const eyeIcon       = document.getElementById('eyeIcon');
const eyeOffIcon    = document.getElementById('eyeOffIcon');

toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  eyeIcon.style.display    = isPassword ? 'none'  : '';
  eyeOffIcon.style.display = isPassword ? ''      : 'none';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  const match = USERS.find(u => u.username === username && u.password === password);

  if (!match) {
    showError('Nombre de cuenta o contraseña incorrectos.');
    usernameInput.classList.add('input-error');
    passwordInput.classList.add('input-error');
    return;
  }

  sessionStorage.setItem('gdp_user', JSON.stringify({ username: match.username, role: match.role }));
  window.location.href = match.redirect;
});

[usernameInput, passwordInput].forEach(input => {
  input.addEventListener('input', clearError);
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}

function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.remove('visible');
  usernameInput.classList.remove('input-error');
  passwordInput.classList.remove('input-error');
}

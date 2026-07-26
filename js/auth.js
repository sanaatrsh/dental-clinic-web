// ===========================
// AUTH SYSTEM (API-backed)
// نظام تسجيل الدخول عبر الخادم (Laravel Sanctum)
// ===========================

const SESSION_KEY = 'dental_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 ساعات

// --- إظهار/إخفاء كلمة المرور ---
function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// --- فحص جلسة الواجهة (بوابة 8 ساعات) ---
function isSessionValid() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;
  try {
    const { expiry } = JSON.parse(session);
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

function createSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ expiry: Date.now() + SESSION_DURATION }));
}

function destroySession() {
  localStorage.removeItem(SESSION_KEY);
}

// --- إدارة واجهة تسجيل الدخول ---
function showLoginScreen() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'none';
  setTimeout(() => {
    const emailEl = document.getElementById('login-email');
    if (emailEl && !emailEl.value) emailEl.focus();
    else document.getElementById('login-password').focus();
  }, 100);
}

function hideLoginScreen() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'block';
}

// --- تسجيل الدخول عبر الخادم ---
async function handleLogin() {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const btn = document.getElementById('login-btn');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput.value;

  if (!email || !password) {
    showLoginError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'جاري التحقق...';

  try {
    await Backend.getApi().login(email, password);
    createSession();
    hideLoginScreen();
    document.getElementById('login-error').style.display = 'none';
    if (typeof toast === 'function') toast('تم تسجيل الدخول ✅');
  } catch (err) {
    const msg = err && err.status === 422
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      : ((err && err.message) || 'تعذّر الاتصال بالخادم — تحقق من عنوان الخادم');
    showLoginError(msg);
    passwordInput.value = '';
    passwordInput.focus();
  } finally {
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
}

function showLoginError(msg) {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
  const card = document.getElementById('login-card');
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 500);
}

// --- تسجيل الخروج ---
async function logout() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  try { await Backend.getApi().logout(); } catch (e) { /* ignore */ }
  destroySession();
  showLoginScreen();
  const pwd = document.getElementById('login-password');
  if (pwd) pwd.value = '';
  const err = document.getElementById('login-error');
  if (err) err.style.display = 'none';
}

// --- تغيير كلمة المرور يُدار على الخادم ---
function openChangePasswordModal() {
  if (typeof toast === 'function') {
    toast('تُدار كلمة المرور من حساب الخادم', 'danger');
  }
}
function saveNewPassword() {
  if (typeof toast === 'function') {
    toast('تُدار كلمة المرور من حساب الخادم', 'danger');
  }
}

// --- Enter key للدخول ---
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && document.getElementById('auth-overlay').style.display !== 'none') {
    handleLogin();
  }
});

// --- تهيئة ---
function initAuth() {
  const titleEl = document.getElementById('login-title');
  const subEl = document.getElementById('login-subtitle');
  if (titleEl) titleEl.textContent = '🔐 تسجيل الدخول';
  if (subEl) subEl.textContent = 'أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى النظام';

  if (Backend.getApi().isAuthenticated() && isSessionValid()) {
    hideLoginScreen();
  } else {
    showLoginScreen();
  }
}

initAuth();

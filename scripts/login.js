(function () {
  function init() {
    var uidInput   = document.getElementById('uid');
    var roleSelect = document.getElementById('role');
    var submitBtn  = document.getElementById('submitBtn');
    var form       = document.getElementById('loginForm');
    var live       = document.getElementById('live');
    var toastWrap  = document.getElementById('toastWrap');

    if (!uidInput || !roleSelect || !submitBtn || !form) return;

    // Toasts
    function showToast(message, type, ttl) {
      if (type === undefined) type = 'error';
      if (ttl === undefined) ttl = 3000;
      var el = document.createElement('div');
      el.className = 'toast ' + type;
      el.textContent = message;
      toastWrap.appendChild(el);
      requestAnimationFrame(function(){ el.classList.add('show'); });
      if (live) live.textContent = message;
      setTimeout(function(){
        el.classList.remove('show');
        setTimeout(function(){ el.remove(); }, 200);
      }, ttl);
    }

    var UID_REGEX = /^U\d{8}$/;

    function normalizeUid() {
      uidInput.value = (uidInput.value || '').toUpperCase().replace(/\s+/g, '');
    }
    function computeEnabled() {
      var hasUid  = uidInput.value.trim().length > 0;
      var hasRole = roleSelect.value !== '';
      submitBtn.disabled = !(hasUid && hasRole);
    }

    // live enable/disable
    ['input','keyup','change','blur','paste'].forEach(function(ev){
      uidInput.addEventListener(ev, function(){ normalizeUid(); computeEnabled(); });
    });
    ['change','input','blur'].forEach(function(ev){
      roleSelect.addEventListener(ev, computeEnabled);
    });

    // submit handler → redirect based on role
    form.addEventListener('submit', function(e){
      e.preventDefault();
      normalizeUid();
      var uid  = uidInput.value.trim();
      var role = (roleSelect.value || '').toLowerCase();

      var ok = true;
      if (!UID_REGEX.test(uid)) {
        ok = false; showToast('Invalid U-number. Use format: U followed by 8 digits (e.g., U12345678).', 'error');
      }
      if (!role) {
        ok = false; showToast("Please choose 'Student' or 'Teacher' in the I'm a dropdown.", 'error');
      }
      if (!ok) return;

      // Optional: persist for later use (e.g., role chip)
      try { localStorage.setItem('viz4edu_uid', uid); localStorage.setItem('viz4edu_role', role); } catch(e){}

      showToast('Looks good! Logging you in…', 'success', 700);

      setTimeout(function () {
        if (role === 'student') {
          window.location.href = 'dashboard-student.html';
        } else if (role === 'teacher') {
          window.location.href = 'dashboard-teacher.html';
        } else {
          // Fallback (shouldn’t happen with current dropdown)
          window.location.href = 'dashboard-student.html';
        }
      }, 700);
    });

    // init state (also catches autofill)
    normalizeUid();
    computeEnabled();
    setTimeout(computeEnabled, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

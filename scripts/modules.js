(function () {
  // ---------- Role + Course ----------
  var role = (localStorage.getItem('viz4edu_role') || 'student').toLowerCase();
  var params = new URLSearchParams(location.search);
  var qpRole = (params.get('role') || '').toLowerCase();
  if (qpRole === 'student' || qpRole === 'teacher') {
    role = qpRole;
    try { localStorage.setItem('viz4edu_role', role); } catch(e){}
  }
  var courseName = params.get('course') || 'Course';

  // ---------- DOM ----------
  var modulesBrandHome   = document.getElementById('modulesBrandHome');
  var modulesRoleChip    = document.getElementById('modulesRoleChip');
  var modulesCourseTitle = document.getElementById('modulesCourseTitle');
  var modulesSummary     = document.getElementById('modulesSummary');
  var moduleToolsWrap    = document.getElementById('moduleTools');
  var addModuleBtn       = document.getElementById('addModuleBtn');
  var modulesGrid        = document.getElementById('modulesGrid');
  var emptyTpl           = document.getElementById('modulesEmptyTpl');

  var searchInput        = document.getElementById('moduleSearch');
  var sortSelect         = document.getElementById('moduleSort');

  var confirmOverlay     = document.getElementById('confirmOverlay');
  var confirmMsgEl       = document.getElementById('confirmMsg');
  var confirmCancelBtn   = document.getElementById('confirmCancel');
  var confirmOKBtn       = document.getElementById('confirmOK');

  var openMenuRef = null;

  // ---------- Navbar role routing ----------
  if (role === 'teacher') {
    modulesRoleChip.textContent = 'Teacher';
    modulesRoleChip.classList.add('role-chip-teacher');
    modulesBrandHome.href = 'dashboard-teacher.html';
    moduleToolsWrap.classList.remove('hidden');
  } else {
    modulesRoleChip.textContent = 'Student';
    modulesBrandHome.href = 'dashboard-student.html';
    moduleToolsWrap && moduleToolsWrap.classList.add('hidden');
  }
  modulesCourseTitle.textContent = courseName;

  // ---------- Storage Keys ----------
  var MODULES_KEY        = 'viz4edu_modules_' + courseName;
  var MODULE_COUNTER_KEY = 'viz4edu_module_counter_' + courseName;
  var SORT_KEY           = 'viz4edu_module_sort_' + courseName;
  var QUERY_KEY          = 'viz4edu_module_query_' + courseName;

  // ---------- Helpers ----------
  function mkId() { return 'm_' + Date.now() + '_' + Math.floor(Math.random()*1e9); }

  function getModuleCounter() {
    var n = parseInt(localStorage.getItem(MODULE_COUNTER_KEY), 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }
  function setModuleCounter(n) {
    n = Math.max(1, n|0);
    localStorage.setItem(MODULE_COUNTER_KEY, String(n));
  }
  function nameExists(list, name, excludeId) {
    var target = String(name).trim().toLowerCase();
    return list.some(m => m && m.id !== excludeId && String(m.name).trim().toLowerCase() === target);
  }
  function suggestNextModuleName(list) {
    var n = Math.max(1, getModuleCounter());
    n = Math.max(n + 1, list.length + 1);
    while (nameExists(list, 'Module ' + n)) n++;
    return 'Module ' + n;
  }
  function advanceCounterToName(name) {
    var m = /^Module\s+(\d+)$/i.exec(String(name).trim());
    if (m) {
      var n = parseInt(m[1], 10);
      if (Number.isFinite(n)) setModuleCounter(Math.max(getModuleCounter(), n));
    }
  }

  function loadModulesRaw() {
    try {
      var raw = localStorage.getItem(MODULES_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }
  function loadModules() {
    // de-dup by name (case-insensitive), keep first
    var arr = loadModulesRaw();
    var seen = new Set(), ded = [];
    for (var i=0;i<arr.length;i++){
      var it = arr[i]; if (!it || !it.name) continue;
      var key = String(it.name).trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); ded.push(it);
    }
    if (ded.length !== arr.length) saveModules(ded);
    return ded;
  }
  function saveModules(list) {
    try { localStorage.setItem(MODULES_KEY, JSON.stringify(list)); } catch(e){}
  }

  // materials count per module (reads your course.js storage)
  function getMaterialsCount(moduleName) {
    var key = 'viz4edu_materials_' + courseName + '__' + moduleName;
    try {
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.length : 0;
    } catch(e){ return 0; }
  }

  function closeMenu() {
    if (!openMenuRef) return;
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onDocKey, true);
    window.removeEventListener('resize', closeMenu, true);
    window.removeEventListener('scroll', closeMenu, true);
    if (openMenuRef.el && openMenuRef.el.parentNode) openMenuRef.el.parentNode.removeChild(openMenuRef.el);
    if (openMenuRef.btn) openMenuRef.btn.setAttribute('aria-expanded','false');
    openMenuRef = null;
}

    function onDocClick(e) {
        if (!openMenuRef) return;
        if (openMenuRef.el.contains(e.target) || openMenuRef.btn.contains(e.target)) return;
        var btn = openMenuRef && openMenuRef.btn;
        closeMenu();
        if (btn) btn.focus();
    }

    function onDocKey(e) {
        if (!openMenuRef) return;
        var items = Array.from(openMenuRef.el.querySelectorAll('.menu-item'));
        var idx = items.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault();
            var btn = openMenuRef && openMenuRef.btn;
            closeMenu();
            if (btn) btn.focus();
            // openMenuRef && openMenuRef.btn.focus();
        }
        else if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(idx+1, items.length-1)].focus(); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); items[Math.max(idx-1, 0)].focus(); }
        else if (e.key === 'Tab')       { e.preventDefault(); /* trap focus */ }
    }

    function positionMenuToButton(menuEl, btn) {
        var r = btn.getBoundingClientRect();
        var x = Math.min(window.innerWidth - menuEl.offsetWidth - 8, r.right + window.scrollX - menuEl.offsetWidth + 8);
        var y = r.bottom + window.scrollY + 8;
        menuEl.style.left = x + 'px';
        menuEl.style.top  = y + 'px';
    }

    function openKebabMenu(btn, mod) {
        closeMenu();

        var el = document.createElement('div');
        el.className = 'menu-pop';
        el.setAttribute('role','menu');
        el.innerHTML = `
            <button class="menu-item" role="menuitem" type="button">
            <span class="mi-icon">✏️</span><span>Rename</span>
            </button>
            <div class="menu-sep"></div>
            <button class="menu-item" role="menuitem" type="button">
            <span class="mi-icon">🗑️</span><span>Delete</span>
            </button>
        `;

        var items = el.querySelectorAll('.menu-item');
        var renameItem = items[0];
        var deleteItem = items[1];

        if (!renameItem || !deleteItem) {
            // Defensive: if CSS/HTML changes, just bail
            document.body.removeChild(el);
            return;
        }

        renameItem.addEventListener('click', function (e) {
            e.stopPropagation();
            closeMenu();
            inlineRename(mod);
        });
        deleteItem.addEventListener('click', async function (e) {
            e.stopPropagation();
            closeMenu();
            await deleteModule(mod);
        });

        renameItem.addEventListener('click', function(e){ e.stopPropagation(); closeMenu(); inlineRename(mod); });
        deleteItem.addEventListener('click', async function(e){ e.stopPropagation(); closeMenu(); await deleteModule(mod); });

        document.body.appendChild(el);
        positionMenuToButton(el, btn);

        btn.setAttribute('aria-expanded','true');
        openMenuRef = { el, btn };

        // focus first item
        // renameItem.focus();

        // outside interactions close
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onDocKey, true);
        window.addEventListener('resize', closeMenu, true);
        window.addEventListener('scroll', closeMenu, true);
    }

  // ---------- Confirm modal ----------
  function confirmModal(message){
    return new Promise(function(resolve){
      confirmMsgEl.textContent = message || 'Are you sure?';
      confirmOverlay.classList.remove('hidden');
      confirmOverlay.setAttribute('aria-hidden','false');
      function close(ok){
        confirmOverlay.classList.add('hidden');
        confirmOverlay.setAttribute('aria-hidden','true');
        confirmCancelBtn.removeEventListener('click', onCancel);
        confirmOKBtn.removeEventListener('click', onOK);
        document.removeEventListener('keydown', onKey);
        resolve(!!ok);
      }
      function onCancel(){ close(false); }
      function onOK(){ close(true); }
      function onKey(e){ if (e.key === 'Escape') close(false); if (e.key === 'Enter') close(true); }
      confirmCancelBtn.addEventListener('click', onCancel);
      confirmOKBtn.addEventListener('click', onOK);
      document.addEventListener('keydown', onKey);
    });
  }

  // ---------- State ----------
  var modulesList = loadModules();

  if (modulesList.length === 0) {
    modulesList.push({ id: mkId(), name: 'Module 1', created: Date.now() });
    saveModules(modulesList);
    setModuleCounter(1);
  } else {
    // seed created timestamps if missing
    modulesList.forEach(function(m){ if (!m.created) m.created = Date.now(); });
    // initialize counter: max numeric suffix among existing
    var maxN = 1;
    modulesList.forEach(function(m){
      var mm = /^Module\s+(\d+)$/i.exec(String(m.name).trim());
      if (mm) { var n = parseInt(mm[1],10); if (Number.isFinite(n)) maxN = Math.max(maxN, n); }
    });
    setModuleCounter(Math.max(getModuleCounter(), maxN));
    saveModules(modulesList);
  }

  // Persisted sort/query
  var currentSort  = localStorage.getItem(SORT_KEY)  || 'newest';
  var currentQuery = localStorage.getItem(QUERY_KEY) || '';
  sortSelect.value = currentSort;
  searchInput.value = currentQuery;

  // ---------- Render ----------
  function renderSummary() {
    var count = modulesList.length;
    modulesSummary.innerHTML = `<span>${count} module${count===1?'':'s'}</span>`;
  }

  function renderModules() {
    modulesGrid.innerHTML = '';

    // Filter + sort
    var q = (currentQuery || '').trim().toLowerCase();
    var list = modulesList.filter(m => !q || String(m.name).toLowerCase().includes(q));

    if (currentSort === 'az') {
      list.sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true}));
    } else if (currentSort === 'za') {
      list.sort((a,b)=>b.name.localeCompare(a.name, undefined, {numeric:true}));
    } else { // newest
      list.sort((a,b)=>(b.created||0)-(a.created||0));
    }

    if (!list.length) {
      var t = emptyTpl.content.cloneNode(true);
      modulesGrid.appendChild(t);
      var emptyAdd = document.getElementById('emptyAdd');
      if (role === 'teacher' && emptyAdd) {
        emptyAdd.addEventListener('click', onAddModule);
      } else if (emptyAdd) {
        emptyAdd.disabled = true;
        emptyAdd.classList.add('disabled');
      }
      return;
    }

    list.forEach(function(mod){
      var card = document.createElement('article');
      card.className = 'course-card module-card';
      card.tabIndex = 0;

      // go to course (module content)
      function goToModule() {
        var url = 'course.html?course=' + encodeURIComponent(courseName) +
                  '&module=' + encodeURIComponent(mod.name) +
                  '&role=' + encodeURIComponent(role);
        location.href = url;
      }
      card.addEventListener('click', goToModule);
      card.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToModule(); }
      });

      var inner = document.createElement('div');
      inner.className = 'course-card-body';

      // chip / header row
      var head = document.createElement('div');
      head.className = 'module-meta-row';
      head.innerHTML = `<span class="module-chip">📚 ${escapeHtml(mod.name)}</span>`;
      inner.appendChild(head);

      // title (inline-rename on teacher double click)
      var title = document.createElement('h2');
      title.className = 'course-card-title';
      title.textContent = mod.name;
      if (role === 'teacher') {
        title.title = 'Double-click to rename';
        title.addEventListener('dblclick', function(ev){
          ev.stopPropagation();
          inlineRename(mod);
        });
      }
      inner.appendChild(title);

      // meta line
      var meta = document.createElement('div');
      meta.className = 'module-meta';
      var count = getMaterialsCount(mod.name);
      meta.innerHTML = `<span>• Materials: <strong>${count}</strong></span><span>• Created: <strong>${timeAgo(mod.created)}</strong></span>`;
      inner.appendChild(meta);

      // teacher quick actions (hover reveal)
      if (role === 'teacher') {
        // var actions = document.createElement('div');
        // actions.className = 'module-actions';
        // var renameBtn = document.createElement('button');
        // renameBtn.type = 'button';
        // renameBtn.className = 'btn-secondary module-rename-btn';
        // renameBtn.textContent = 'Rename';
        // renameBtn.addEventListener('click', function(e){ e.stopPropagation(); inlineRename(mod); });

        // var delBtn = document.createElement('button');
        // delBtn.type = 'button';
        // delBtn.className = 'btn-secondary module-delete-btn';
        // delBtn.textContent = 'Delete';
        // delBtn.addEventListener('click', async function(e){
        //   e.stopPropagation();
        //   await deleteModule(mod);
        // });

        // actions.appendChild(renameBtn);
        // actions.appendChild(delBtn);
        // inner.appendChild(actions);

        // kebab menu (optional hook for future)
        var kebab = document.createElement('button');
        kebab.type = 'button';
        kebab.className = 'module-kebab';
        kebab.setAttribute('aria-label','Module menu');
        kebab.setAttribute('aria-haspopup','menu');
        kebab.setAttribute('aria-expanded','false');
        kebab.textContent = '⋮';
        kebab.addEventListener('click', function (e) {
            e.stopPropagation();
            // If this kebab already owns an open menu → close it (toggle)
            if (openMenuRef && openMenuRef.btn === kebab) {
                var btn = openMenuRef && openMenuRef.btn;
                closeMenu();
                btn.focus();
                return;
            }
            openKebabMenu(kebab, mod);
        });
        card.appendChild(kebab);
      }

      card.appendChild(inner);
      modulesGrid.appendChild(card);
    });

    renderSummary();
  }

  function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function timeAgo(ts){
    var d = Date.now() - (ts||Date.now());
    var mins = Math.floor(d/60000);
    if (mins<1) return 'just now';
    if (mins<60) return mins+'m ago';
    var hrs = Math.floor(mins/60);
    if (hrs<24) return hrs+'h ago';
    var days = Math.floor(hrs/24);
    if (days<30) return days+'d ago';
    var months = Math.floor(days/30);
    if (months<12) return months+'mo ago';
    var years = Math.floor(months/12);
    return years+'y ago';
  }

  // ---------- Inline rename ----------
  function inlineRename(mod){
    // build input replacing title
    var cards = modulesGrid.querySelectorAll('.module-card');
    cards.forEach(function(c){
      var t = c.querySelector('.course-card-title');
      if (t && t.dataset.editing === '1') { t.dataset.editing='0'; }
    });

    var card = Array.from(cards).find(c => (c.querySelector('.course-card-title')||{}).textContent === mod.name);
    if (!card) return;
    var titleEl = card.querySelector('.course-card-title');
    if (!titleEl) return;

    var input = document.createElement('input');
    input.type = 'text';
    input.value = mod.name;
    input.className = 'input-plain';
    input.style.width = '100%';
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    function finish(ok){
      input.removeEventListener('keydown', onKey);
      input.removeEventListener('blur', onBlur);
      if (!ok) { renderModules(); return; }
      var newName = input.value.trim();
      if (!newName || newName === mod.name) { renderModules(); return; }
      if (nameExists(modulesList, newName, mod.id)) { alert('A module with that name already exists.'); renderModules(); return; }
      mod.name = newName;
      saveModules(modulesList);
      advanceCounterToName(newName);
      renderModules();
    }
    function onKey(e){ if (e.key==='Enter') finish(true); else if (e.key==='Escape') finish(false); }
    function onBlur(){ finish(true); }

    input.addEventListener('keydown', onKey);
    input.addEventListener('blur', onBlur);
  }

  // ---------- Delete ----------
  async function deleteModule(mod){
    if (modulesList.length === 1) { alert('At least one module is required.'); return; }
    var ok = await confirmModal('Delete "' + mod.name + '"? This will not delete existing materials but the module link will be removed.');
    if (!ok) return;
    modulesList = modulesList.filter(m => m.id !== mod.id);
    saveModules(modulesList);
    renderModules();
  }

  // ---------- Add ----------
  function onAddModule(){
    var suggested = suggestNextModuleName(modulesList);
    var name = window.prompt('New module name:', suggested);
    if (name == null) return;
    name = name.trim();
    if (!name) return;
    if (nameExists(modulesList, name)) { alert('A module with that name already exists.'); return; }
    var mod = { id: mkId(), name: name, created: Date.now() };
    modulesList.push(mod);
    saveModules(modulesList);
    advanceCounterToName(name);
    renderModules();
  }

  if (role === 'teacher' && addModuleBtn) addModuleBtn.addEventListener('click', onAddModule);

  // ---------- Search / Sort ----------
  searchInput.addEventListener('input', function(){
    currentQuery = this.value || '';
    localStorage.setItem(QUERY_KEY, currentQuery);
    renderModules();
  });
  sortSelect.addEventListener('change', function(){
    currentSort = this.value || 'newest';
    localStorage.setItem(SORT_KEY, currentSort);
    renderModules();
  });

  // ---------- Init ----------
  setTimeout(renderModules, 180); // let skeleton show briefly
})();

(function () {
  // ----- read role from localStorage / URL -----
  var role = (localStorage.getItem('viz4edu_role') || 'student').toLowerCase();
  var params = new URLSearchParams(location.search);
  var qpRole = (params.get('role') || '').toLowerCase();
  if (qpRole === 'student' || qpRole === 'teacher') {
    role = qpRole;
    try { localStorage.setItem('viz4edu_role', role); } catch(e){}
  }

  // ----- which course are we in? -----
  var courseName = params.get('course') || 'Course';

  // ----- DOM references -----
  var modulesBrandHome = document.getElementById('modulesBrandHome');
  var modulesRoleChip  = document.getElementById('modulesRoleChip');
  var modulesCourseTitle = document.getElementById('modulesCourseTitle');
  var moduleTools = document.getElementById('moduleTools');
  var addModuleBtn = document.getElementById('addModuleBtn');
  var modulesGrid = document.getElementById('modulesGrid');

  // ----- set navbar/home link per role -----
  if (role === 'teacher') {
    modulesRoleChip.textContent = 'Teacher';
    modulesRoleChip.classList.add('role-chip-teacher');
    modulesBrandHome.href = 'dashboard-teacher.html';
    moduleTools.classList.remove('hidden');
  } else {
    modulesRoleChip.textContent = 'Student';
    modulesBrandHome.href = 'dashboard-student.html';
    // Hide teacher tools if present
    moduleTools && moduleTools.classList.add('hidden');
  }

  modulesCourseTitle.textContent = courseName;

  // ----- storage key for modules in this course -----
  // We'll store an array of module objects: { name: "Module 1", id: "uuid" }
  // id is stable so if you rename, we don't lose link identity later.
  // Per-course module counter (persists across refresh)
    var MODULES_KEY        = 'viz4edu_modules_' + courseName;
    var MODULE_COUNTER_KEY = 'viz4edu_module_counter_' + courseName;

    function getModuleCounter() {
        var n = parseInt(localStorage.getItem(MODULE_COUNTER_KEY), 10);
        return Number.isFinite(n) && n >= 1 ? n : 1;
    }
    function setModuleCounter(n) {
        n = Math.max(1, n|0);
        localStorage.setItem(MODULE_COUNTER_KEY, String(n));
    }

    // Utility: case-insensitive name check
    function nameExists(list, name, excludeId) {
        var target = String(name).trim().toLowerCase();
        return list.some(m => m && m.id !== excludeId && String(m.name).trim().toLowerCase() === target);
    }

    // Suggest the next "Module N" that doesn't collide.
    // Uses the stored counter but skips ahead if that name already exists.
    function suggestNextModuleName(list) {
        var n = Math.max(1, getModuleCounter());
        // Start at counter+1 by convention (Module 2 after Module 1)
        n = Math.max(n + 1, list.length + 1); // also guard with count heuristic
        while (nameExists(list, 'Module ' + n)) n++;
        return 'Module ' + n;
    }

    // When we successfully create "Module N", advance the counter to N
    function advanceCounterToName(name) {
        var m = /^Module\s+(\d+)$/i.exec(String(name).trim());
        if (m) {
            var n = parseInt(m[1], 10);
            if (Number.isFinite(n)) setModuleCounter(Math.max(getModuleCounter(), n));
        }
    }


  function loadModules() {
  try {
        var raw = localStorage.getItem(MODULES_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        // Deduplicate by case-insensitive name (keep first occurrence)
        var seen = new Set();
        var deduped = [];
        for (var i = 0; i < arr.length; i++) {
            var m = arr[i];
            if (!m || !m.name) continue;
            var key = String(m.name).trim().toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(m);
        }
        // If we removed any, persist the cleanup
        if (deduped.length !== arr.length) {
            try { localStorage.setItem(MODULES_KEY, JSON.stringify(deduped)); } catch(e){}
        }
        return deduped;
    } catch(e){}
    return [];
    }


  function saveModules(list) {
    try { localStorage.setItem(MODULES_KEY, JSON.stringify(list)); } catch(e){}
  }

  // simple id generator for modules
  function mkId() {
    return 'm_' + Date.now() + '_' + Math.floor(Math.random()*1e9);
  }

    var modulesList = loadModules();

    // If empty, create "Module 1"
    if (modulesList.length === 0) {
        modulesList.push({ id: mkId(), name: 'Module 1' });
        saveModules(modulesList);
        setModuleCounter(1); // start counter at 1
    } else {
        // Initialize counter to the max numeric suffix among "Module N"
        var maxN = 1;
        modulesList.forEach(function(m){
            var mm = /^Module\s+(\d+)$/i.exec(String(m.name).trim());
            if (mm) { var n = parseInt(mm[1], 10); if (Number.isFinite(n)) maxN = Math.max(maxN, n); }
        });
        // Only bump forward (never shrink) in case you already had a stored counter
        setModuleCounter(Math.max(getModuleCounter(), maxN));
    }


  // ----- render -----
  function renderModules() {
    modulesGrid.innerHTML = '';

    modulesList.forEach(function(mod, idx){
      // card layout similar to course cards you already have
      var card = document.createElement('article');
      card.className = 'course-card module-card';
      card.tabIndex = 0;

      // Click goes to course.html with course+module
      function goToModule() {
        // encode module name in URL
        var url = 'course.html?course=' + encodeURIComponent(courseName) +
                  '&module=' + encodeURIComponent(mod.name) +
                  '&role=' + encodeURIComponent(role);
        location.href = url;
      }

      card.addEventListener('click', goToModule);
      card.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToModule();
        }
      });

      // inner card body
      // show module name big
      var inner = document.createElement('div');
      inner.className = 'course-card-body';

      var title = document.createElement('h2');
      title.className = 'course-card-title';
      title.textContent = mod.name;

      // description or metadata
      var sub = document.createElement('p');
      sub.className = 'course-card-sub muted small';
      sub.textContent = 'Click to open module content';

      inner.appendChild(title);
      inner.appendChild(sub);

      // teacher controls (rename / delete) — visible only to teacher
      if (role === 'teacher') {
        var actions = document.createElement('div');
        actions.className = 'module-actions';

        var renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'btn-secondary module-rename-btn';
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', function(ev){
            ev.stopPropagation();
            var newName = window.prompt('Rename module:', mod.name);
            if (newName == null) return;
            newName = newName.trim();
            if (!newName || newName === mod.name) return;

            if (nameExists(modulesList, newName, mod.id)) {
                alert('A module with that name already exists.');
                return;
            }

            mod.name = newName;
            saveModules(modulesList);
            advanceCounterToName(newName);
            renderModules();
        });

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-secondary module-delete-btn';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', function(ev){
          ev.stopPropagation();
          if (!window.confirm('Delete this module?')) return;
          // don't allow deleting last module
          if (modulesList.length === 1) {
            alert('At least one module is required.');
            return;
          }
          modulesList.splice(idx, 1);
          saveModules(modulesList);
          renderModules();
        });

        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);
        inner.appendChild(actions);
      }

      card.appendChild(inner);
      modulesGrid.appendChild(card);
    });
  }

  // ----- Add module (teacher only) -----
  if (role === 'teacher' && addModuleBtn) {
        addModuleBtn.addEventListener('click', function(){
        // Suggest next "Module N"
        var suggested = suggestNextModuleName(modulesList);
        var name = window.prompt('New module name:', suggested);
        if (name == null) return;  // user cancelled
        name = name.trim();
        if (!name) return;

        // Block duplicates (case-insensitive)
        if (nameExists(modulesList, name)) {
        alert('A module with that name already exists.');
        return;
        }

        // Create
        var mod = { id: mkId(), name: name };
        modulesList.push(mod);
        saveModules(modulesList);

        // If it follows "Module N", advance the counter to N
        advanceCounterToName(name);

        renderModules();
    });
    }


  // init
  renderModules();
})();

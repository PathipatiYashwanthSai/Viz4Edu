(function(){
    // ---------- IndexedDB helpers ----------
    var DB_NAME = 'viz4edu-db';
    var STORE = 'materials';
    function idbOpen(){ return new Promise((res,rej)=>{ var r=indexedDB.open(DB_NAME,1); r.onupgradeneeded=e=>{var db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);}; r.onsuccess=e=>res(e.target.result); r.onerror=e=>rej(e.target.error); });}
    async function idbPut(key, blob){ var db=await idbOpen(); return new Promise((res,rej)=>{ var tx=db.transaction([STORE],'readwrite'); tx.objectStore(STORE).put(blob,key); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); });}
    async function idbGet(key){ var db=await idbOpen(); return new Promise((res,rej)=>{ var tx=db.transaction([STORE],'readonly'); var req=tx.objectStore(STORE).get(key); req.onsuccess=()=>res(req.result||null); req.onerror=e=>rej(e.target.error); });}
    async function idbDel(key){ var db=await idbOpen(); return new Promise((res,rej)=>{ var tx=db.transaction([STORE],'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); });}

    // ---------- role & course ----------
    var role = (localStorage.getItem('viz4edu_role') || 'student').toLowerCase();
    var params = new URLSearchParams(location.search);
    var qpRole = (params.get('role') || '').toLowerCase();
    if (qpRole === 'student' || qpRole === 'teacher') { role = qpRole; try{ localStorage.setItem('viz4edu_role', role);}catch(e){} }
    var courseName = params.get('course') || 'Course';
    document.getElementById('courseTitle').textContent = courseName;

    var roleChip = document.getElementById('roleChip');
    if (role === 'teacher') {
        roleChip.textContent = 'Teacher';
        roleChip.classList.add('role-chip-teacher');
        document.getElementById('brandHome').href = 'dashboard-teacher.html';
        document.getElementById('teacherTools').classList.remove('hidden');
    } else {
        roleChip.textContent = 'Student';
        document.getElementById('brandHome').href = 'dashboard-student.html';
    }

    // ---------- elements ----------
    var courseShell = document.querySelector('.course-shell');
    var courseMain  = document.querySelector('.course-main');
    var fsBtn       = document.getElementById('expandBtn');
    var statsWrap = document.getElementById('statsWrap');
    var primaryButtons = document.querySelectorAll('.course-side.primary .side-icon');
    var panes = {
        materials: document.getElementById('pane-materials'),
        assignments: document.getElementById('pane-assignments'),
        grading: document.getElementById('pane-grading'),
        discussions: document.getElementById('pane-discussions'),
        announcements: document.getElementById('pane-announcements'),
        stats: document.getElementById('pane-stats')
    };

    var materialsNav = document.getElementById('materialsNav');
    var materialsListEl = document.getElementById('materialsList');
    var materialsHint = document.getElementById('materialsHint');
    var fileInput = document.getElementById('fileInput');
    var seedDemoBtn = document.getElementById('seedDemoBtn');
    var clearAllBtn = document.getElementById('clearAllBtn');

    var materialTitle = document.getElementById('materialTitle');
    var materialTypeBadge = document.getElementById('materialType');
    var viewer = document.getElementById('viewer');
    var prevBtn = document.getElementById('prevMat');
    var nextBtn = document.getElementById('nextMat');

    // ---------- storage for list ----------
    var storeKey = 'viz4edu_materials_' + courseName;

    // ------- Fullscreen support (with vendor fallbacks) -------
    function fsEnabled() {
        return document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled || false;
    }
    function fsElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
    }
    function requestFS(el) {
        if (!el) return;
        (el.requestFullscreen && el.requestFullscreen()) ||
        (el.webkitRequestFullscreen && el.webkitRequestFullscreen()) ||
        (el.msRequestFullscreen && el.msRequestFullscreen());
    }
    function exitFS() {
        (document.exitFullscreen && document.exitFullscreen()) ||
        (document.webkitExitFullscreen && document.webkitExitFullscreen()) ||
        (document.msExitFullscreen && document.msExitFullscreen());
    }
    function updateFsBtnState() {
        if (!fsBtn) return;
        var on = !!fsElement();
        fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        fsBtn.title = on ? 'Exit full screen (F or Esc)' : 'Full screen (F)';
        // Optional icon swap:
        // fsBtn.textContent = on ? '🗗' : '⛶';
    }

    // Button click -> toggle FS (fallback to expand layout if FS unsupported)
    if (fsBtn) {
        fsBtn.addEventListener('click', function () {
            if (fsEnabled()) {
            if (fsElement()) exitFS();
            else requestFS(courseMain || courseShell || document.documentElement);
            } else {
            // Fallback: toggle your existing "expanded" layout
            if (courseShell) courseShell.classList.toggle('expanded');
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        if (e.defaultPrevented) return;
        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            if (fsEnabled()) {
            if (fsElement()) exitFS();
            else requestFS(courseMain || courseShell || document.documentElement);
            } else {
            if (courseShell) courseShell.classList.toggle('expanded');
            }
        } else if (e.key === 'Escape' && fsElement()) {
            exitFS();
        }
    });

    // Double-click the viewer to enter/exit FS quickly
    if (viewer) {
        viewer.addEventListener('dblclick', function () {
            if (fsEnabled()) {
            if (fsElement()) exitFS();
            else requestFS(courseMain || courseShell || document.documentElement);
            } else {
            if (courseShell) courseShell.classList.toggle('expanded');
            }
        });
    }

    // Keep button state in sync with FS changes
    ['fullscreenchange','webkitfullscreenchange','MSFullscreenChange'].forEach(function(ev){
        document.addEventListener(ev, updateFsBtnState);
    });
    updateFsBtnState();

    // Persisted upload counter (per course)
    var UPLOAD_COUNT_KEY = 'viz_uploaded_count_' + courseName;

    function getUploadCount() {
        var v = parseInt(localStorage.getItem(UPLOAD_COUNT_KEY), 10);
        return Number.isFinite(v) && v >= 0 ? v : 0;
    }
    function setUploadCount(v) {
        v = Math.max(0, v|0);
        localStorage.setItem(UPLOAD_COUNT_KEY, String(v));
        window.__viz_uploaded_count = v; // keep session var in sync
    }
    function incUploadCount(delta) {
        setUploadCount(getUploadCount() + (delta|0));
    }
    function resetUploadCount() { setUploadCount(0); }

    // (1) No broken defaults; start empty
    function defaultMaterials(){ return []; }

    function loadMaterials(){
        try {
        var raw = localStorage.getItem(storeKey);
        if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
        } catch(e){}
        return defaultMaterials();
    }
    function saveMaterials(){ try{ localStorage.setItem(storeKey, JSON.stringify(materials)); }catch(e){} }

    var materials = loadMaterials();
    setUploadCount(getUploadCount());
    materials = migrateLegacyBlobUrls(materials);
    saveMaterials(); // persist the cleaned list
    var currentIndex = 0;

    // ---------- helpers ----------
    function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    async function getMaterialUrl(mat){
        if (mat._objectUrl) return mat._objectUrl;

        if (typeof mat.url === 'string') {
            // Legacy guard: never reuse expired blob: URLs
            if (mat.url.startsWith('blob:')) return '';
            return mat.url; // real HTTP/data URLs, or static assets if you add them later
        }

        if (mat.storeKey) {
            var blob = await idbGet(mat.storeKey);
            if (blob) {
            mat._objectUrl = URL.createObjectURL(blob);
            return mat._objectUrl;
            }
        }
        return '';
    }


    function migrateLegacyBlobUrls(list) {
        if (!Array.isArray(list)) return [];
        var changed = false;
        var cleaned = [];
        list.forEach(function(m) {
            if (!m || typeof m !== 'object') return;
            // If it was saved as a blob: URL and there's no storeKey, it cannot be recovered
            if (m.url && String(m.url).startsWith('blob:') && !m.storeKey) {
            changed = true;
            return; // drop it
            }
            cleaned.push(m);
        });
        if (changed) {
            console.info('Viz4Edu: cleaned legacy blob: URLs from materials (they expire on refresh).');
        }
        return cleaned;
    }

    function revokeObjectUrl(mat){ try{ if(mat && mat._objectUrl){ URL.revokeObjectURL(mat._objectUrl); mat._objectUrl=null; }}catch(e){} }

    function computeStats() {
        var total = materials.length;
        var pdfs = materials.filter(m => m.type === 'pdf').length;
        var pptx = materials.length - pdfs;
        // var uploadedThisSession = (window.__viz_uploaded_count || 0);
        var uploadedThisSession = getUploadCount();
        return { total, pdfs, pptx, uploadedThisSession };
    }

    function renderStats() {
        if (!statsWrap) return;
        var s = computeStats();
        statsWrap.innerHTML = [
            statCard('Total materials', s.total),
            statCard('PDF files', s.pdfs),
            statCard('PPTX files', s.pptx),
            statCard('Uploads (this session)', s.uploadedThisSession)
        ].join('');
    }

    function statCard(label, value) {
        return (
            '<div class="stat-card">' +
            '<div class="stat-value">' + value + '</div>' +
            '<div class="stat-label">' + label + '</div>' +
            '</div>'
        );
    }

    // ---------- UI: list ----------
    function rebuildList(){
        materialsListEl.innerHTML = '';
        materials.forEach(function(m, idx){
        var li = document.createElement('li');
        li.className = 'materials-item' + (idx === currentIndex ? ' active' : '');
        li.setAttribute('role','option'); li.setAttribute('tabindex','0');

        var icon = (m.type === 'pdf') ? '📄' : '📑';
        var iconSpan = document.createElement('span'); iconSpan.className = 'mi-icon'; iconSpan.textContent = icon;
        var titleSpan = document.createElement('span'); titleSpan.className = 'mi-title'; titleSpan.textContent = m.title;

        li.appendChild(iconSpan); li.appendChild(titleSpan);

        if (role === 'teacher') {
            var delBtn = document.createElement('button');
            delBtn.className = 'mi-del'; delBtn.title = 'Delete'; delBtn.setAttribute('aria-label','Delete material'); delBtn.textContent = '🗑️';
            delBtn.addEventListener('click', function(e){ e.stopPropagation(); deleteMaterial(idx); });
            li.appendChild(delBtn);
        }

        li.addEventListener('click', function(){ loadMaterial(idx); });
        li.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadMaterial(idx); } });

        materialsListEl.appendChild(li);
        });
        materialsHint.classList.toggle('hidden', materials.length > 0);
    }

    async function deleteMaterial(idx){
        if (idx < 0 || idx >= materials.length) return;
        var removed = materials.splice(idx, 1)[0];
        if (removed && removed.storeKey) { try { await idbDel(removed.storeKey); } catch(e){} }
        revokeObjectUrl(removed);
        saveMaterials();

        if (currentIndex >= materials.length) currentIndex = materials.length - 1;
        if (currentIndex < 0) currentIndex = 0;

        rebuildList();
        renderStats();
        if (materials.length) { loadMaterial(currentIndex); } else { viewer.innerHTML = '<div class="pptx-panel"><p class="muted">No materials yet.</p></div>'; updateNavButtons(); }
    }

    // ---------- viewer ----------
    async function renderViewer(mat){
        viewer.innerHTML = '';
        if (mat.type === 'pdf') {
        var url = await getMaterialUrl(mat);
        if (!url) {
            viewer.innerHTML = '<div class="pptx-panel"><p class="muted">Could not load this PDF. It may have been moved or deleted.</p></div>';
        } else {
            var iframe = document.createElement('iframe');
            iframe.className = 'pdf-frame';
            iframe.title = mat.title;
            const clean = String(url).split('#')[0];
            iframe.src = clean + '#zoom=page-width';
            iframe.setAttribute('aria-label', 'PDF viewer: ' + mat.title);
            viewer.appendChild(iframe);
        }
        materialTypeBadge.textContent = 'PDF';
        materialTypeBadge.className = 'badge badge-new';
        } else {
        var purl = await getMaterialUrl(mat);
        var box = document.createElement('div'); box.className = 'pptx-panel';
        var link = purl ? ('<a class="btn-primary" href="'+purl+'" download>Download '+escapeHtml(mat.title)+'.pptx</a>') : '<span class="muted">File not found</span>';
        box.innerHTML = '<p class="muted">PPTX preview is not supported in most browsers.</p><p>'+link+'</p><p class="muted small">Tip: convert to PDF to enable inline viewing.</p>';
        viewer.appendChild(box);
        materialTypeBadge.textContent = 'PPTX';
        materialTypeBadge.className = 'badge badge-progress';
        }
        materialTitle.textContent = mat.title;
    }

    function updateNavButtons(){ prevBtn.disabled = (currentIndex <= 0); nextBtn.disabled = (currentIndex >= materials.length - 1); }
    function setActiveInList(){ materialsListEl.querySelectorAll('.materials-item').forEach((li,i)=>li.classList.toggle('active', i===currentIndex)); }
    async function loadMaterial(idx){
        if (!materials.length) return;
        currentIndex = Math.max(0, Math.min(idx, materials.length - 1));
        setActiveInList();
        await renderViewer(materials[currentIndex]);
        updateNavButtons();
    }

    // ---------- upload (teacher) ----------
    if (role === 'teacher' && fileInput) {
        fileInput.addEventListener('change', async function(e){
        var files = Array.prototype.slice.call(e.target.files || []);
        if (!files.length) return;

        for (var i=0; i<files.length; i++){
            var f = files[i];
            var ext = (f.name.split('.').pop() || '').toLowerCase();
            var type = (ext === 'pdf') ? 'pdf' : 'pptx';
            var key = courseName + '::' + Date.now() + '::' + f.name;
            try { await idbPut(key, f); } catch(err) { console.warn('Store failed', err); }
            materials.push({ title: f.name.replace(/\.[^.]+$/,''), type: type, storeKey: key });
        }

        saveMaterials();
        rebuildList();
        incUploadCount(files.length);
        renderStats();
        window.__viz_uploaded_count = (window.__viz_uploaded_count || 0) + files.length;
        if (materials.length === files.length) { await loadMaterial(0); } else { await loadMaterial(materials.length - 1); }
        fileInput.value = '';
        });
    }

    // ---------- Seed demo PDFs (teacher) ----------
    if (role === 'teacher' && seedDemoBtn) {
        seedDemoBtn.addEventListener('click', async function(){
        const demos = [
            { title: 'Lecture1_CourseOverview', blob: tinyPdfBlob('Lecture 1 — Course Overview\n' + courseName) },
            { title: 'Lecture2_BiometricsIntro', blob: tinyPdfBlob('Lecture 2 — Biometrics Intro\n' + courseName) }
        ];
        for (const d of demos) {
            const key = courseName + '::demo::' + d.title + '::' + Date.now();
            await idbPut(key, d.blob);
            materials.push({ title: d.title, type: 'pdf', storeKey: key });
        }
        saveMaterials();
        rebuildList();
        incUploadCount(2);
        renderStats();
        window.__viz_uploaded_count = (window.__viz_uploaded_count || 0) + 2;
        await loadMaterial(materials.length - 2); // show first demo
        });
    }

    // ---------- Clear all materials (teacher) ----------
    if (role === 'teacher' && clearAllBtn) {
        clearAllBtn.addEventListener('click', async function(){
        // remove persisted blobs for this course
        for (const m of materials) { if (m.storeKey) { try { await idbDel(m.storeKey); } catch(e){} } revokeObjectUrl(m); }
        materials = [];
        saveMaterials();
        rebuildList();
        window.__viz_uploaded_count = 0;
        resetUploadCount();
        renderStats();
        viewer.innerHTML = '<div class="pptx-panel"><p class="muted">No materials yet.</p></div>';
        updateNavButtons();
        });
    }

    // Hide stats for students
    if (role !== 'teacher') {
        var statsBtn = document.querySelector('.course-side.primary .side-icon[data-pane="stats"]');
        if (statsBtn) statsBtn.style.display = 'none';
        if (panes.stats) panes.stats.classList.add('hidden');
    }

    // ---------- panes ----------
    primaryButtons.forEach(function(btn){
        btn.addEventListener('click', function(){
        primaryButtons.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var pane = btn.dataset.pane;
        Object.keys(panes).forEach(function(key){ panes[key].classList.toggle('hidden', key !== pane); });
        materialsNav.classList.toggle('hidden', pane !== 'materials');
        });
    });

    // ---------- Prev/Next ----------
    prevBtn.addEventListener('click', function(){ if (currentIndex > 0) loadMaterial(currentIndex - 1); });
    nextBtn.addEventListener('click', function(){ if (currentIndex < materials.length - 1) loadMaterial(currentIndex + 1); });

    // ---------- init ----------
    rebuildList();
    renderStats();
    if (materials.length) { loadMaterial(0); } else { updateNavButtons(); }

    // ------- Demo PDF generator (minimal, valid PDF) -------
    function tinyPdfBlob(text){
        // A tiny single-page PDF with your text in it.
        // This is not pretty typesetting, but it’s valid and works in all PDF viewers.
        const esc = (s)=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
        const lines = esc(text).split('\n').map((t,i)=>`(${t}) Tj 0 -18 Td`).join(' ');
        const content = `
    %PDF-1.4
    1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
    2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
    3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
    4 0 obj << /Length  ${61 + lines.length} >> stream
    BT /F1 12 Tf 72 770 Td ${lines} ET
    endstream endobj
    5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
    xref
    0 6
    0000000000 65535 f
    0000000010 00000 n
    0000000062 00000 n
    0000000118 00000 n
    0000000266 00000 n
    0000000457 00000 n
    trailer << /Size 6 /Root 1 0 R >>
    startxref
    548
    %%EOF`;
        return new Blob([content], { type: 'application/pdf' });
    }
})();

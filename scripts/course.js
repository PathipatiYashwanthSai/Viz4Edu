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
    var moduleName = params.get('module') || 'Module 1';
    var courseTitleEl = document.getElementById('courseTitle');
    if (courseTitleEl) {
        courseTitleEl.textContent = courseName + ' — ' + moduleName;
    }

    var roleChip = document.getElementById('roleChip');
    if (role === 'teacher') {
        if (roleChip) {
            roleChip.textContent = 'Teacher';
            roleChip.classList.add('role-chip-teacher');
        }
        var brandHome = document.getElementById('brandHome');
        if (brandHome) brandHome.href = 'dashboard-teacher.html';
        var teacherTools = document.getElementById('teacherTools');
        if (teacherTools) teacherTools.classList.remove('hidden');
    } else {
        if (roleChip) roleChip.textContent = 'Student';
        var brandHome2 = document.getElementById('brandHome');
        if (brandHome2) brandHome2.href = 'dashboard-student.html';
    }

    // === Assignments storage keys (per course + module) ===
    var ASMTS_KEY = 'viz4edu_assignments_' + courseName + '__' + moduleName;
    // Submissions keyed by assignment id (per user). We'll mint a per-device user id:
    var USER_ID_KEY = 'viz4edu_user_id';
    var currentUserId = localStorage.getItem(USER_ID_KEY);
    if (!currentUserId) {
        currentUserId = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(USER_ID_KEY, currentUserId);
    }

    // ---------- elements ----------
    var courseShell = document.querySelector('.course-shell');
    var courseMain  = document.querySelector('.course-main');
    var fsBtn       = document.getElementById('expandBtn');
    var statsWrap   = document.getElementById('statsWrap');
    var primaryButtons = document.querySelectorAll('.course-side.primary .side-icon');
    var panes = {
        materials: document.getElementById('pane-materials'),
        assignments: document.getElementById('assignmentsPane'),
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

    var assignmentsNav      = document.getElementById('assignmentsNav');
    var assignmentsListEl   = document.getElementById('assignmentsList');
    var assignmentsHint     = document.getElementById('assignmentsHint');
    var asmtTeacherToolsSide= document.getElementById('asmtTeacherToolsSide');

    // Assignments DOM
    var assignmentsPane   = document.getElementById('assignmentsPane');
    var asmtSummary       = document.getElementById('asmtSummary');
    var asmtNewBtn        = document.getElementById('asmtNewBtn');
    var asmtComposer      = document.getElementById('asmtComposer');
    var asmtTitleInput    = document.getElementById('asmtTitle');
    var asmtDueInput      = document.getElementById('asmtDue');
    var asmtPdfInput      = document.getElementById('asmtPdf');
    var asmtDescInput     = document.getElementById('asmtDesc');
    var asmtSaveBtn       = document.getElementById('asmtSave');
    var asmtCancelBtn     = document.getElementById('asmtCancel');
    var asmtList          = document.getElementById('asmtList');

    // Assignments detail viewer
    var asmtDetail         = document.getElementById('asmtDetail');
    var asmtDetailTitle    = document.getElementById('asmtDetailTitle');
    var asmtDetailBadge    = document.getElementById('asmtDetailBadge');

    var currentAsmtIndex   = -1;

    if (role === 'teacher') {
        asmtTeacherToolsSide && asmtTeacherToolsSide.classList.remove('hidden');
    } else {
        asmtTeacherToolsSide && asmtTeacherToolsSide.classList.add('hidden');
    }

    // ---------- storage for list ----------
    var storeKey = 'viz4edu_materials_' + courseName + '__' + moduleName;

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
    }

    // Button click -> toggle FS (fallback to expand layout if FS unsupported)
    if (fsBtn) {
        fsBtn.addEventListener('click', function () {
            if (fsEnabled()) {
                if (fsElement()) exitFS();
                else requestFS(courseMain || courseShell || document.documentElement);
            } else {
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
    var UPLOAD_COUNT_KEY = 'viz_uploaded_count_' + courseName + '__' + moduleName;

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
            if (mat.url.startsWith('blob:')) return '';
            return mat.url;
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

    // ---------- Assignments store ----------
    function loadAssignments() {
        try {
            var raw = localStorage.getItem(ASMTS_KEY);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch(e) { return []; }
    }
    function saveAssignments(list) {
        try { localStorage.setItem(ASMTS_KEY, JSON.stringify(list)); } catch(e){}
    }
    function makeAsmtId() { return 'a_' + Date.now() + '_' + Math.floor(Math.random()*1e9); }

    // Each assignment structure:
    // { id, title, due (ISO or ''), desc, created, briefKey (IDB key for teacher PDF), submissionsCount }

    // Submissions per assignment (per-user single latest):
    // IDB key: course::module::assignmentId::submission::<userId>
    function submissionKey(asmtId, userId) {
        return courseName + '::' + moduleName + '::' + asmtId + '::submission::' + userId;
    }
    // Assignment brief (PDF) key:
    function asmtBriefKey(asmtId, filename) {
        return courseName + '::' + moduleName + '::' + asmtId + '::brief::' + filename;
    }

    var assignments = loadAssignments();

    function updateAsmtSummary() {
        if (!asmtSummary) return;
        asmtSummary.textContent = assignments.length
            ? assignments.length + ' assignment' + (assignments.length>1?'s':'')
            : 'No assignments yet';
    }

    async function deleteAssignment(a){
        if (!confirm('Delete this assignment?')) return;

        // delete brief
        try { if (a.briefKey) await idbDel(a.briefKey); } catch(e){}

        // delete submissions blobs using the index
        var idxKey = ASMTS_KEY + '::subidx::' + a.id;
        var idx = []; try { idx = JSON.parse(localStorage.getItem(idxKey)||'[]'); } catch(e){}
        for (const si of idx) { try { await idbDel(submissionKey(a.id, si.userId)); } catch(e){} }
        localStorage.removeItem(idxKey);

        // remove from array + persist + refresh UI
        assignments = assignments.filter(x => x.id !== a.id);
        saveAssignments(assignments);
        updateAsmtSummary();
        currentAsmtIndex = -1;
        rebuildAssignmentsList();
        renderAssignmentDetail(null);
    }

    function rebuildAssignmentsList(){
        if (!assignmentsListEl) return;
        assignmentsListEl.innerHTML = '';
        if (assignmentsHint) assignmentsHint.classList.toggle('hidden', assignments.length > 0);

        assignments.forEach(function(a, idx){
            var li = document.createElement('li');
            li.className = 'materials-item' + (idx === currentAsmtIndex ? ' active' : '');
            li.setAttribute('role','option'); li.setAttribute('tabindex','0');

            var iconSpan  = document.createElement('span'); iconSpan.className='mi-icon';  iconSpan.textContent='📄';
            var titleSpan = document.createElement('span'); titleSpan.className='mi-title'; titleSpan.textContent = a.title || ('Assignment ' + (idx+1));

            li.appendChild(iconSpan); li.appendChild(titleSpan);

            if (role === 'teacher') {
                var delBtn = document.createElement('button');
                delBtn.className = 'mi-del'; delBtn.title='Delete';
                delBtn.setAttribute('aria-label','Delete assignment');
                delBtn.textContent='🗑️';
                delBtn.addEventListener('click', function(e){
                    e.stopPropagation();
                    deleteAssignment(a);
                });
                li.appendChild(delBtn);
            }

            li.addEventListener('click', function(){ selectAssignment(idx); });
            li.addEventListener('keydown', function(e){
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAssignment(idx); }
            });

            assignmentsListEl.appendChild(li);
        });

        updateAsmtSummary();
    }

    function selectAssignment(idx){
        if (!assignments.length) return;
        currentAsmtIndex = Math.max(0, Math.min(idx, assignments.length-1));
        if (assignmentsListEl){
            Array.from(assignmentsListEl.children).forEach((li,i)=>li.classList.toggle('active', i===currentAsmtIndex));
        }
        renderAssignmentDetail(assignments[currentAsmtIndex]);
    }

    async function renderAssignmentDetail(a){
        if (!asmtDetail || !asmtDetailTitle || !asmtDetailBadge) return;

        if (!a) {
            asmtDetailTitle.textContent = 'Assignments';
            asmtDetailBadge.hidden = true;
            asmtDetail.innerHTML = '<p class="muted">Select an assignment from the left.</p>';
            return;
        }

        asmtDetailTitle.textContent = a.title || 'Assignment';
        asmtDetailBadge.hidden = false;

        var dueTxt = a.due ? ('Due ' + new Date(a.due).toLocaleDateString()) : 'No due date';
        var descHtml = a.desc ? ('<p class="asmt-desc">'+escapeHtml(a.desc)+'</p>') : '';

        var briefBtn = `<button class="btn-secondary" id="openBriefBtn">View brief</button>`;
        var studentBox = '';

        if (role !== 'teacher') {
            studentBox = `
            <div class="asmt-submission" style="margin-top:12px;">
                <div class="row">
                    <label>Upload your submission (PDF/PPTX):</label>
                    <input id="studentSubmitFile" type="file" class="input-plain"
                        accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" />
                    <button id="studentSubmitBtn" class="btn-primary">Submit</button>
                </div>
                <div class="row" style="margin-top:6px;">
                    <span id="mineStatus" class="muted small">Checking status…</span>
                    <button class="btn-secondary" id="openMine" disabled>Open</button>
                </div>
            </div>`;
        }

        var teacherTable = '';
        if (role === 'teacher') {
            teacherTable = `
            <table class="asmt-table" style="margin-top:12px;">
                <thead><tr><th>Student</th><th>Submitted</th><th>File</th><th></th></tr></thead>
                <tbody id="asmtSubsTBody"></tbody>
            </table>`;
        }

        asmtDetail.innerHTML = `
            <div class="asmt-card" style="border:0;padding:0;background:transparent;box-shadow:none;">
                <div class="asmt-meta" style="margin:0 0 6px 0;">
                    <span class="asmt-badge">PDF</span>
                    <span>${dueTxt}</span>
                    <span>Posted ${timeAgo(a.created)}</span>
                </div>
                ${descHtml}
                <div class="asmt-actions" style="margin-top:10px;">
                    ${briefBtn}
                    ${role==='teacher' ? '<button id="deleteAsmtBtn" class="btn-secondary">Delete</button>' : ''}
                </div>
                ${studentBox}
                ${teacherTable}
            </div>
        `;

        document.getElementById('deleteAsmtBtn')?.addEventListener('click', () => deleteAssignment(a));

        document.getElementById('openBriefBtn')?.addEventListener('click', async function(){
            var blob = await idbGet(a.briefKey);
            if (!blob) { alert('Brief not found.'); return; }
            var url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(()=>URL.revokeObjectURL(url), 5000);
        });

        // student submission UI
        if (role !== 'teacher') {
            var fileInput = document.getElementById('studentSubmitFile');
            var submitBtn = document.getElementById('studentSubmitBtn');
            var mineStatus= document.getElementById('mineStatus');
            var openMine  = document.getElementById('openMine');

            async function refreshMine() {
                var blob = await idbGet(submissionKey(a.id, currentUserId));
                if (mineStatus) mineStatus.textContent = blob ? 'Submitted' : 'No submission yet.';
                if (openMine) openMine.disabled = !blob;
            }
            refreshMine();

            openMine?.addEventListener('click', async function(){
                var blob = await idbGet(submissionKey(a.id, currentUserId));
                if (!blob) { alert('No submission found.'); return; }
                var url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(()=>URL.revokeObjectURL(url), 5000);
            });

            submitBtn?.addEventListener('click', async function(){
                var f = (fileInput && fileInput.files||[])[0];
                if (!f) { alert('Choose a file first.'); return; }
                await idbPut(submissionKey(a.id, currentUserId), f);

                var idxKey = ASMTS_KEY + '::subidx::' + a.id;
                var idx = []; try { idx = JSON.parse(localStorage.getItem(idxKey)||'[]'); } catch(e){}
                var existing = idx.find(x => x.userId === currentUserId);
                var rec = { userId: currentUserId, time: Date.now(), filename: f.name };
                if (existing) Object.assign(existing, rec); else idx.push(rec);
                localStorage.setItem(idxKey, JSON.stringify(idx));

                if (fileInput) fileInput.value = '';
                refreshMine();
                alert('Submitted!');
            });
        }

        // teacher submissions table population
        if (role === 'teacher') {
            var tbody = document.getElementById('asmtSubsTBody');
            var idxKey = ASMTS_KEY + '::subidx::' + a.id;
            var subIdx = [];
            try { subIdx = JSON.parse(localStorage.getItem(idxKey) || '[]'); } catch(e) { subIdx = []; }

            if (!tbody) return;

            if (!subIdx.length) {
                var tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="4" class="muted">No submissions yet.</td>`;
                tbody.appendChild(tr);
            } else {
                subIdx.sort((x,y)=>(y.time||0)-(x.time||0));
                subIdx.forEach(function(si){
                    var tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${si.userId}</td>
                        <td>${new Date(si.time).toLocaleString()}</td>
                        <td>${si.filename || 'submission'}</td>
                        <td><button class="btn-secondary btn-sm">Open</button></td>`;
                    tr.querySelector('button')?.addEventListener('click', async function(){
                        var blob = await idbGet(submissionKey(a.id, si.userId));
                        if (!blob) { alert('File missing.'); return; }
                        var url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        setTimeout(()=>URL.revokeObjectURL(url), 5000);
                    });
                    tbody.appendChild(tr);
                });
            }
        }
    }

    // ---------- Materials UI ----------
    function rebuildList(){
        if (!materialsListEl) return;
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
        if (materialsHint) materialsHint.classList.toggle('hidden', materials.length > 0);
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
        if (materials.length) { loadMaterial(currentIndex); } else { if (viewer) viewer.innerHTML = '<div class="pptx-panel"><p class="muted">No materials yet.</p></div>'; updateNavButtons(); }
    }

    // ---------- viewer ----------
    async function renderViewer(mat){
        if (!viewer || !materialTypeBadge || !materialTitle) return;
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

    function updateNavButtons(){
        if (prevBtn) prevBtn.disabled = (currentIndex <= 0);
        if (nextBtn) nextBtn.disabled = (currentIndex >= materials.length - 1);
    }
    function setActiveInList(){ if (!materialsListEl) return; materialsListEl.querySelectorAll('.materials-item').forEach((li,i)=>li.classList.toggle('active', i===currentIndex)); }
    async function loadMaterial(idx){
        if (!materials.length) return;
        revokeObjectUrl(materials[currentIndex]);
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
                var key = courseName + '::' + moduleName + '::' + Date.now() + '::' + f.name;
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
                const key = courseName + '::' + moduleName + '::demo::' + d.title + '::' + Date.now();
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
            for (const m of materials) { if (m.storeKey) { try { await idbDel(m.storeKey); } catch(e){} } revokeObjectUrl(m); }
            materials = [];
            saveMaterials();
            rebuildList();
            window.__viz_uploaded_count = 0;
            resetUploadCount();
            renderStats();
            if (viewer) viewer.innerHTML = '<div class="pptx-panel"><p class="muted">No materials yet.</p></div>';
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

            Object.keys(panes).forEach(function(key){
                panes[key]?.classList.toggle('hidden', key !== pane);
            });

            materialsNav?.classList.toggle('hidden', pane !== 'materials');
            assignmentsNav?.classList.toggle('hidden', pane !== 'assignments');

            if (pane === 'assignments') {
                rebuildAssignmentsList();
                if (assignments.length && currentAsmtIndex < 0) { selectAssignment(0); }
            }
        });
    });

    // ---------- Prev/Next ----------
    prevBtn && prevBtn.addEventListener('click', function(){ if (currentIndex > 0) loadMaterial(currentIndex - 1); });
    nextBtn && nextBtn.addEventListener('click', function(){ if (currentIndex < materials.length - 1) loadMaterial(currentIndex + 1); });

    // ---------- init ----------
    rebuildList();
    renderStats();
    if (materials.length) { loadMaterial(0); } else { updateNavButtons(); }

    // Assignments init
    rebuildAssignmentsList();
    if (assignments.length) { selectAssignment(0); }

    // ------- Demo PDF generator (minimal, valid PDF) -------
    function tinyPdfBlob(text){
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

    // Composer controls
    document.getElementById('asmtNewBtn')?.addEventListener('click', openComposer);
    document.getElementById('asmtCancel')?.addEventListener('click', closeComposer);

    document.getElementById('asmtSave')?.addEventListener('click', async function(){
        var title = (document.getElementById('asmtTitle')?.value || '').trim();
        var due   = document.getElementById('asmtDue')?.value || '';
        var desc  = (document.getElementById('asmtDesc')?.value || '').trim();
        var pdfEl = document.getElementById('asmtPdf');
        var pdf   = (pdfEl && pdfEl.files || [])[0];

        if (!pdf) { alert('Attach the assignment PDF.'); return; }
        if (!title) title = pdf.name.replace(/\.pdf$/i,'');

        var id = makeAsmtId();
        var briefK = asmtBriefKey(id, pdf.name);
        await idbPut(briefK, pdf);

        var rec = { id, title, due, desc, created: Date.now(), briefKey: briefK, submissionsCount: 0 };
        assignments.push(rec);
        saveAssignments(assignments);

        closeComposer();
        rebuildAssignmentsList();
        updateAsmtSummary();           // keep header in sync
        selectAssignment(assignments.length - 1);
    });

    function openComposer() {
        if (!asmtComposer) return;
        if (asmtTitleInput) asmtTitleInput.value = '';
        if (asmtDueInput) asmtDueInput.value = '';
        if (asmtPdfInput) asmtPdfInput.value = '';
        if (asmtDescInput) asmtDescInput.value = '';
        asmtComposer.classList.remove('hidden');
        asmtTitleInput?.focus();
    }
    function closeComposer() {
        asmtComposer?.classList.add('hidden');
    }
})();
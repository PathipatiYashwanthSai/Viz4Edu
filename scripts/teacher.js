(function(){
  var grid = document.getElementById('courseGrid');
  var addBtn = document.getElementById('addCourseBtn');

  var overlay = document.getElementById('addCourseDialog');
  var titleInput = document.getElementById('courseTitle');
  var imageInput = document.getElementById('courseImage');
  var cancelBtn = document.getElementById('dlgCancel');
  var addCourseBtn = document.getElementById('dlgAdd');

  function openDialog(){
    overlay.classList.remove('hidden');
    titleInput.value = '';
    imageInput.value = '';
    setTimeout(function(){ titleInput.focus(); }, 10);
  }
  function closeDialog(){ overlay.classList.add('hidden'); }

  function makeCard(title, imgUrl){
    var article = document.createElement('article');
    article.className = 'course-card course-card--teacher';
    article.tabIndex = 0;
    article.setAttribute('data-status', 'new');

    // delete button
    var del = document.createElement('button');
    del.className = 'icon-trash';
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete course');
    del.title = 'Delete';
    del.addEventListener('click', function(){ article.remove(); });
    article.appendChild(del);

    // image
    var img = document.createElement('img');
    img.className = 'course-image';
    img.alt = title + ' cover';
    img.src = imgUrl || defaultSVG();
    article.appendChild(img);

    // body
    var body = document.createElement('div');
    body.className = 'course-body';
    body.innerHTML =
      '<h3 class="course-title"></h3>' +
      '<div class="course-meta">' +
        '<span class="meta-left">Just created</span>' +
        '<span class="badge badge-new">New</span>' +
      '</div>' +
      '<div class="progress"><div class="bar" style="width:0%"></div></div>';
    body.querySelector('.course-title').textContent = title;
    article.appendChild(body);

    return article;
  }

  function defaultSVG(){
    // purple gradient placeholder
    return "data:image/svg+xml;utf8," + encodeURIComponent(
      "<?xml version='1.0'?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#4f46e5'/><stop offset='100%' stop-color='#a78bfa'/></linearGradient></defs>" +
      "<rect width='1600' height='900' fill='url(#g)'/>" +
      "<g fill='#ffffff' fill-opacity='.9'><rect x='320' y='520' width='100' height='120' rx='10'/>" +
      "<rect x='460' y='460' width='100' height='180' rx='10'/>" +
      "<rect x='600' y='400' width='100' height='240' rx='10'/>" +
      "<rect x='740' y='350' width='100' height='290' rx='10'/></g></svg>"
    );
  }

  function attachDeleteHandlers(scope){
    (scope || document).querySelectorAll('.icon-trash').forEach(function(btn){
      if (!btn._wired){
        btn.addEventListener('click', function(e){
          var card = e.currentTarget.closest('.course-card');
          if (card) card.remove();
        });
        btn._wired = true;
      }
    });
  }

  if (addBtn){
    addBtn.addEventListener('click', openDialog);
  }
  if (cancelBtn){
    cancelBtn.addEventListener('click', closeDialog);
  }
  if (overlay){
    overlay.addEventListener('click', function(e){
      if (e.target === overlay) closeDialog();
    });
  }
  if (addCourseBtn){
    addCourseBtn.addEventListener('click', function(){
      var title = (titleInput.value || '').trim();
      if (!title){ titleInput.focus(); return; }
      var imgUrl = (imageInput.value || '').trim();
      var card = makeCard(title, imgUrl || undefined);
      grid.prepend(card);
      attachDeleteHandlers(card);
      closeDialog();
    });
  }

  // wire delete on initial seeded cards
  attachDeleteHandlers(document);
})();

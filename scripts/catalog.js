// Shared search + filter wiring for dashboards
(function(){
  var grid = document.getElementById('courseGrid');
  var empty = document.getElementById('emptyState');
  var search = document.getElementById('courseSearch');
  var filter = document.getElementById('courseFilter');

  if (!grid) return;

  function apply() {
    var q = (search && search.value || '').trim().toLowerCase();
    var f = filter ? filter.value : 'all';
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.course-card'));
    var visible = 0;

    cards.forEach(function(card){
      var titleEl = card.querySelector('.course-title');
      var title = titleEl ? titleEl.textContent.toLowerCase() : '';
      var status = (card.getAttribute('data-status') || '').toLowerCase() || 'all';

      var matchQ = !q || title.indexOf(q) !== -1;
      var matchF = f === 'all' || status === f;

      var show = matchQ && matchF;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (empty) empty.classList.toggle('hidden', visible !== 0);
  }

  if (search) search.addEventListener('input', apply);
  if (filter) filter.addEventListener('change', apply);

  // Initial run
  apply();
})();

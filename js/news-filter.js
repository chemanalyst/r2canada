document.addEventListener('DOMContentLoaded', function () {
  var chips = document.querySelectorAll('.chip');
  var cards = document.querySelectorAll('#news-grid .card');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      var filter = chip.getAttribute('data-filter');

      cards.forEach(function (card) {
        var cats = card.getAttribute('data-cat').split(' ');
        card.style.display = (filter === 'all' || cats.indexOf(filter) !== -1) ? '' : 'none';
      });
    });
  });
});

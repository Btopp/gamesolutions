// Cursor-Spotlight auf der ganzen Seite
(function(){
  var spot = document.getElementById('spot');
  if(!spot) return;
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce) return;
  window.addEventListener('pointermove', function(e){
    spot.style.setProperty('--mx', e.clientX + 'px');
    spot.style.setProperty('--my', e.clientY + 'px');
  });
})();

// Scroll-Reveal
(function(){
  var els = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){ els.forEach(function(el){el.classList.add('in')}); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:0.15});
  els.forEach(function(el){io.observe(el)});
})();

// Kontakt-Panels auf Klick öffnen/schließen (ganze Karte ist das Klick-Ziel)
(function(){
  function setCard(card, open){
    var panel = document.getElementById(card.getAttribute('aria-controls'));
    card.setAttribute('aria-expanded', String(open));
    if(panel){ panel.hidden = !open; }
    card.classList.toggle('open', open);
  }
  function toggleCard(card){
    setCard(card, card.getAttribute('aria-expanded') !== 'true');
  }
  // Von game.js aufgerufen, wenn der Charakter über eine Kachel fährt/sie verlässt — bleibt bewusst generisch/lose gekoppelt.
  // .char-hover löst dieselbe optische Hervorhebung wie :hover aus (siehe styles.css), da der Charakter kein echtes :hover triggert.
  // Getrennt von expandCard/collapseCard, da .pillar kein Akkordeon-Panel hat, aber trotzdem highlighten soll.
  window.setTileHover = function(el, hovered){
    if(!el || !el.matches('.pillar, .ref, .player, .btn')) return;
    el.classList.toggle('char-hover', hovered);
  };
  window.expandCard = function(card){
    if(!card || !card.matches('.player, .ref')) return;
    if(card.getAttribute('aria-expanded') !== 'true') setCard(card, true);
  };
  window.collapseCard = function(card){
    if(!card || !card.matches('.player, .ref')) return;
    if(card.getAttribute('aria-expanded') === 'true') setCard(card, false);
  };
  document.querySelectorAll('.player, .ref').forEach(function(card){
    card.addEventListener('click', function(e){
      if(e.target.closest('a')) return;
      toggleCard(card);
    });
    card.addEventListener('keydown', function(e){
      if(e.target.closest('a')) return;
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        toggleCard(card);
      }
    });
    card.addEventListener('mouseenter', function(){
      if(!document.body.classList.contains('game-active')) return;
      window.setTileHover(card, true);
      window.expandCard(card);
    });
    card.addEventListener('mouseleave', function(){
      if(!document.body.classList.contains('game-active')) return;
      window.setTileHover(card, false);
      window.collapseCard(card);
    });
  });
})();

// Kontakt-Kachel: Klick irgendwo auf der Kachel löst den Mail-Link aus
(function(){
  var contact = document.querySelector('.contact');
  var link = contact && contact.querySelector('a[href^="mailto:"]');
  if(!contact || !link) return;
  contact.addEventListener('click', function(e){
    if(e.target.closest('a')) return;
    window.location.href = link.href;
  });
})();

// Burger-Menü: Hover öffnet per CSS, hier Klick/Tap, Esc und Klick-daneben
(function(){
  var menu = document.getElementById('menu');
  var trigger = menu && menu.querySelector('.menu-trigger');
  if(!menu || !trigger) return;
  function setOpen(state){
    menu.classList.toggle('open', state);
    trigger.setAttribute('aria-expanded', String(state));
    trigger.setAttribute('aria-label', state ? 'Menü schließen' : 'Menü öffnen');
  }
  trigger.addEventListener('click', function(e){
    e.stopPropagation();
    setOpen(!menu.classList.contains('open'));
  });
  menu.querySelectorAll('.menu-panel a').forEach(function(a){
    a.addEventListener('click', function(){ setOpen(false); });
  });
  document.addEventListener('click', function(e){ if(!menu.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') setOpen(false); });
})();

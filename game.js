// ============================================================
// SPIEL-MODUL — vollständig getrennt vom restlichen Seiten-Code.
// Auf false setzen, um Spiel + Start-Button komplett zu entfernen.
// ============================================================
var GAME_ENABLED = true;

// Wenn deaktiviert: Spiel-Elemente aus dem DOM entfernen.
(function(){
  if(GAME_ENABLED) return;
  ['gameToggle', 'collectBadge', 'gameTrack', 'gameTrail', 'gameSprite'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.remove();
  });
})();

// Rennstrecke: kurviger Pfad durch die Themenbereiche + Sammelobjekte
(function(){
  if(!GAME_ENABLED) return;
  var svg = document.getElementById('gameTrack');
  var path = svg && svg.querySelector('.track-path');
  var edgeA = svg && svg.querySelector('.track-edge-a');
  var edgeB = svg && svg.querySelector('.track-edge-b');
  var collectiblesGroup = svg && svg.querySelector('.track-collectibles');
  var countEl = document.getElementById('collectCount');
  if(!svg || !path) return;

  var SECTION_IDS = ['#start', '#machen', '#referenzen', '#team', '#kontakt'];
  var ACCENTS = ['--pink', '--cyan', '--gold'];
  var rootStyle = getComputedStyle(document.documentElement);
  var POINTS_PER_SECTION = 4;
  var LANE_HALF = 42; // Abstand jeder Begrenzungslinie von der Mittelachse (volle Breite bei aufgeklappter Strecke)
  var COLLECTIBLES_PER_SECTION = 2;
  var foldWidth = 0; // aktueller Begrenzungs-Abstand; 0 = eingeklappt (nur Mittellinie), animiert via unfold()/fold()
  var foldRaf = null;

  window.GameTrack = {
    collectibles: [], total: 0, collected: 0,
    unfold: function(){ animateFold(LANE_HALF, 550); },
    fold: function(){ animateFold(0, 350); }
  };

  function accentColor(i){
    return rootStyle.getPropertyValue(ACCENTS[i % ACCENTS.length]).trim();
  }

  // Glatte, durchgängig stetige Kurve durch eine Punktfolge (Catmull-Rom -> kubische Bezier)
  function smoothPathD(points){
    if(points.length < 2) return '';
    if(points.length === 2){
      return 'M' + points[0].x + ',' + points[0].y + ' L' + points[1].x + ',' + points[1].y;
    }
    var pts = [points[0]].concat(points, [points[points.length - 1]]);
    var d = 'M' + points[0].x + ',' + points[0].y;
    for(var i = 1; i < pts.length - 2; i++){
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
      var b1x = p1.x + (p2.x - p0.x) / 6, b1y = p1.y + (p2.y - p0.y) / 6;
      var b2x = p2.x - (p3.x - p1.x) / 6, b2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + b1x + ',' + b1y + ' ' + b2x + ',' + b2y + ' ' + p2.x + ',' + p2.y;
    }
    return d;
  }

  function buildTrack(){
    var sections = SECTION_IDS.map(function(id){ return document.querySelector(id); }).filter(Boolean);
    if(sections.length < 2) return;

    var docWidth = window.innerWidth;
    var center = docWidth / 2;
    var amp = Math.min(90, docWidth * 0.18); // Schlängel-Amplitude, auf schmale Viewports geklemmt

    // Pro Abschnitt mehrere Punkte über dessen Höhe verteilt, X folgt einer Sinuswelle, plus gelegentlicher
    // kurzer horizontaler Schlenker: erzeugt eine verspieltere Schlängelung mit mehr "Streckenlänge" genau
    // an jedem Themenbereich statt eines rein monotonen Auf-und-Ab.
    var points = [];
    sections.forEach(function(section, i){
      var r = section.getBoundingClientRect();
      var top = r.top + window.scrollY;
      var usableHeight = Math.max(r.height - 120, 40);
      var side = i % 2 === 0 ? -1 : 1;
      var sectionAmp = amp * (0.75 + (i % 3) * 0.15); // Schwungstärke variiert leicht pro Abschnitt
      var sectionPoints = [];
      for(var k = 0; k < POINTS_PER_SECTION; k++){
        var f = k / (POINTS_PER_SECTION - 1);
        var y = top + 60 + f * usableHeight;
        var wiggle = Math.sin(f * Math.PI * 1.4) * sectionAmp;
        sectionPoints.push({x: center + side * wiggle, y: y});
      }
      if(i % 2 === 1){
        var base = sectionPoints[1];
        sectionPoints.splice(2, 0, {x: base.x - side * sectionAmp * 1.3, y: base.y + 22});
      }
      points = points.concat(sectionPoints);
    });

    path.setAttribute('d', smoothPathD(points));

    svg.style.height = '0px'; // vor der Messung zurücksetzen, sonst zählt die SVG bei scrollHeight sich selbst mit (Rückkopplung: könnte nur wachsen, nie schrumpfen)
    var docHeight = document.documentElement.scrollHeight;
    svg.style.height = docHeight + 'px';
    svg.setAttribute('viewBox', '0 0 ' + docWidth + ' ' + docHeight);

    buildEdges(foldWidth);

    buildCollectibles(sections.length);
  }

  function buildEdges(halfWidth){
    if(!edgeA || !edgeB) return;
    if(halfWidth === undefined) halfWidth = LANE_HALF;
    var totalLength = path.getTotalLength();
    var samples = Math.max(40, Math.round(totalLength / 40));
    var eps = 2;
    var ptsA = [], ptsB = [];
    for(var i = 0; i <= samples; i++){
      var len = (i / samples) * totalLength;
      var p = path.getPointAtLength(len);
      var p2 = path.getPointAtLength(Math.min(totalLength, len + eps));
      var dx = p2.x - p.x, dy = p2.y - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / dist, ny = dx / dist; // Einheits-Normalenvektor senkrecht zur Kurvenrichtung
      ptsA.push({x: p.x + nx * halfWidth, y: p.y + ny * halfWidth});
      ptsB.push({x: p.x - nx * halfWidth, y: p.y - ny * halfWidth});
    }
    edgeA.setAttribute('d', smoothPathD(ptsA));
    edgeB.setAttribute('d', smoothPathD(ptsB));
  }

  // Animiert die Begrenzungslinien von der aktuellen Breite auf toWidth (0 = eingeklappt/Mittellinie, LANE_HALF = voll aufgeklappt)
  function animateFold(toWidth, duration){
    if(foldRaf) cancelAnimationFrame(foldRaf);
    var from = foldWidth;
    var startTime = performance.now();
    function step(now){
      var t = Math.min(1, (now - startTime) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      foldWidth = from + (toWidth - from) * eased;
      buildEdges(foldWidth);
      if(t < 1){
        foldRaf = requestAnimationFrame(step);
      } else {
        foldRaf = null;
      }
    }
    foldRaf = requestAnimationFrame(step);
  }

  function buildCollectibles(sectionCount){
    collectiblesGroup.innerHTML = '';
    var totalLength = path.getTotalLength();
    var total = sectionCount * COLLECTIBLES_PER_SECTION;
    var collectibles = [];

    // Kachel-Bounding-Boxen (mit Puffer), damit Objekte nicht unter einer Kachel landen, wo sie kaum sichtbar wären
    var cardRects = Array.prototype.map.call(document.querySelectorAll('.pillar, .ref, .player, .contact'), function(el){
      var r = el.getBoundingClientRect();
      return {left: r.left + window.scrollX - 10, top: r.top + window.scrollY - 10, right: r.right + window.scrollX + 10, bottom: r.bottom + window.scrollY + 10};
    });
    function underCard(x, y){
      return cardRects.some(function(r){ return x > r.left && x < r.right && y > r.top && y < r.bottom; });
    }
    function clearPoint(t0){
      var pt = path.getPointAtLength(t0 * totalLength);
      if(!underCard(pt.x, pt.y)) return pt;
      var step = 0.003;
      for(var k = 1; k <= 60; k++){
        var dir = k % 2 ? 1 : -1;
        var t = t0 + dir * Math.ceil(k / 2) * step;
        if(t < 0 || t > 1) continue;
        pt = path.getPointAtLength(t * totalLength);
        if(!underCard(pt.x, pt.y)) return pt;
      }
      return path.getPointAtLength(t0 * totalLength); // kein freier Punkt in der Nähe gefunden, ursprüngliche Position als Fallback
    }

    for(var i = 0; i < total; i++){
      var t = (i + 0.5) / total;
      var pt = clearPoint(t);
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'collectible');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', 6);
      circle.setAttribute('fill', accentColor(i));
      circle.style.setProperty('--glow', accentColor(i));
      collectiblesGroup.appendChild(circle);
      collectibles.push({x: pt.x, y: pt.y, el: circle, collected: false});
    }
    window.GameTrack.collectibles = collectibles;
    window.GameTrack.total = collectibles.length;
    window.GameTrack.collected = 0;
    if(countEl) countEl.textContent = '0 / ' + collectibles.length;
  }

  buildTrack();
  window.addEventListener('load', buildTrack);
  var resizeTimer;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildTrack, 200);
  });
})();

// Spielfigur-Modus
(function(){
  if(!GAME_ENABLED) return;
  var toggle = document.getElementById('gameToggle');
  var icon = document.getElementById('gameIcon');
  var sprite = document.getElementById('gameSprite');
  var trailCanvas = document.getElementById('gameTrail');
  var trailCtx = trailCanvas && trailCanvas.getContext('2d');
  if(!toggle || !sprite) return;

  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var EASE = 0.16;
  var KEY_SPEED = 6; // px pro Frame
  var EDGE_MARGIN = 70;
  var SCROLL_SPEED = 8; // px pro Frame beim Auto-Scroll
  var MAX_PARTICLES = 60; // Puffer für Trail + gelegentliche Einsammel-Bursts (14 Partikel auf einmal)
  var SCREEN_MARGIN = 20; // Figur darf nie näher als das an den Viewport-Rand
  // Sprite besteht aus 3 versetzten 20px-Quadraten (Basis + 2x box-shadow) -> Gesamtbreite 40px, Höhe 20px
  var SPRITE_CENTER_X = 20;
  var SPRITE_CENTER_Y = 10;

  var style = getComputedStyle(document.documentElement);
  var BRAND_COLORS = [
    style.getPropertyValue('--pink').trim(),
    style.getPropertyValue('--cyan').trim(),
    style.getPropertyValue('--gold').trim()
  ];

  var active = false;
  var pos = {x:0,y:0};
  var target = {x:0,y:0};
  var keys = {ArrowUp:false,ArrowDown:false,ArrowLeft:false,ArrowRight:false};
  var raf = null;
  var focusedEl = null;
  var hoveredTile = null; // gröber als focusedEl: die ganze .pillar/.ref/.player, ändert sich nur beim echten Verlassen der Kachel
  var particles = [];
  var lastInputType = null; // 'mouse' | 'keyboard' | 'touch' | 'jump'
  var lastMouseClient = {x:0, y:0};
  var autoScrolling = false; // true während tick() in diesem Frame selbst gescrollt hat

  function clampTarget(){
    var maxX = document.documentElement.scrollWidth;
    var maxY = document.documentElement.scrollHeight;
    target.x = Math.max(0, Math.min(maxX, target.x));
    target.y = Math.max(0, Math.min(maxY, target.y));
  }

  function clampToScreen(){
    var screenX = pos.x - window.scrollX;
    var screenY = pos.y - window.scrollY;
    screenX = Math.max(SCREEN_MARGIN, Math.min(window.innerWidth - SCREEN_MARGIN, screenX));
    screenY = Math.max(SCREEN_MARGIN, Math.min(window.innerHeight - SCREEN_MARGIN, screenY));
    pos.x = screenX + window.scrollX;
    pos.y = screenY + window.scrollY;
  }

  function resizeTrail(){
    if(!trailCanvas) return;
    trailCanvas.width = window.innerWidth;
    trailCanvas.height = window.innerHeight;
  }

  function updateFocus(screenX, screenY){
    var hit = document.elementFromPoint(screenX, screenY);

    // Leertasten-Ziel: das genaueste a/button/[tabindex] unter dem Charakter
    var interactive = hit && hit.closest('a, button, [tabindex]');
    if(interactive !== focusedEl){
      if(focusedEl) focusedEl.blur();
      focusedEl = interactive || null;
      if(focusedEl) focusedEl.focus({preventScroll:true});
    }

    // Kachel-Highlight: gröbere Grenze, damit ein innerer Link (z.B. in aufgeklappten Panels) das Highlight nicht unterbricht
    var tile = hit && hit.closest('.pillar, .ref, .player, .btn');
    if(tile !== hoveredTile){
      if(hoveredTile){
        if(window.setTileHover) window.setTileHover(hoveredTile, false);
        if(window.collapseCard) window.collapseCard(hoveredTile);
      }
      hoveredTile = tile || null;
      if(hoveredTile){
        if(window.setTileHover) window.setTileHover(hoveredTile, true);
        if(window.expandCard) window.expandCard(hoveredTile);
      }
    }
  }

  function drawTrail(screenX, screenY){
    if(!trailCtx) return;
    particles.push({
      x:screenX, y:screenY, r:5,
      life:1,
      color:BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]
    });
    if(particles.length > MAX_PARTICLES) particles.shift();

    trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    particles.forEach(function(p){
      p.life -= 0.045;
      if(p.vx || p.vy){ // Burst-Partikel (z.B. beim Einsammeln) fliegen nach außen und bremsen ab
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.92; p.vy *= 0.92;
      }
      trailCtx.globalAlpha = Math.max(p.life, 0);
      trailCtx.fillStyle = p.color;
      trailCtx.beginPath();
      trailCtx.arc(p.x, p.y, p.r * Math.max(p.life, 0), 0, Math.PI * 2);
      trailCtx.fill();
    });
    trailCtx.globalAlpha = 1;
    particles = particles.filter(function(p){ return p.life > 0; });
  }

  // Einmaliger Partikel-"Explosions"-Effekt beim Einsammeln, gleiche Partikel wie der Bewegungs-Trail
  function spawnBurst(screenX, screenY){
    if(!trailCtx || reduce) return;
    var count = 14;
    for(var i = 0; i < count; i++){
      var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      var speed = 2 + Math.random() * 3;
      particles.push({
        x:screenX, y:screenY, r:5,
        vx:Math.cos(angle) * speed, vy:Math.sin(angle) * speed,
        life:1,
        color:BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]
      });
    }
    while(particles.length > MAX_PARTICLES) particles.shift();
  }

  // Sieg-Effekt im Header, sobald alle Objekte eingesammelt sind
  function triggerWin(){
    var icon = document.getElementById('collectIcon');
    if(icon) icon.classList.add('win');
    var badge = document.getElementById('collectBadge');
    if(badge){
      var r = badge.getBoundingClientRect();
      spawnBurst(r.left + r.width / 2, r.top + r.height / 2);
    }
  }

  function render(){
    var screenX = pos.x - window.scrollX;
    var screenY = pos.y - window.scrollY;
    sprite.style.transform = 'translate(' + screenX + 'px,' + screenY + 'px)';
    updateFocus(screenX + SPRITE_CENTER_X, screenY + SPRITE_CENTER_Y);
    if(!reduce) drawTrail(screenX + SPRITE_CENTER_X, screenY + SPRITE_CENTER_Y);
  }

  function checkCollectibles(){
    var track = window.GameTrack;
    if(!track || !track.collectibles.length) return;
    var centerX = pos.x + SPRITE_CENTER_X, centerY = pos.y + SPRITE_CENTER_Y;
    track.collectibles.forEach(function(c){
      if(c.collected) return;
      var dx = c.x - centerX, dy = c.y - centerY;
      if(Math.sqrt(dx * dx + dy * dy) < 26){
        c.collected = true;
        c.el.classList.add('collected');
        track.collected++;
        var countEl = document.getElementById('collectCount');
        if(countEl){
          countEl.textContent = track.collected + ' / ' + track.total;
          countEl.classList.remove('count-pop');
          void countEl.offsetWidth; // Reflow erzwingen, damit die Animation bei schnell aufeinanderfolgenden Treffern jedes Mal neu startet
          countEl.classList.add('count-pop');
        }
        spawnBurst(c.x - window.scrollX, c.y - window.scrollY);
        if(track.collected === track.total) triggerWin();
      }
    });
  }

  function tick(){
    if(!active) return;
    autoScrolling = false;

    if(keys.ArrowUp) target.y -= KEY_SPEED;
    if(keys.ArrowDown) target.y += KEY_SPEED;
    if(keys.ArrowLeft) target.x -= KEY_SPEED;
    if(keys.ArrowRight) target.x += KEY_SPEED;
    clampTarget();

    if(reduce){
      pos.x = target.x; pos.y = target.y;
    } else {
      pos.x += (target.x - pos.x) * EASE;
      pos.y += (target.y - pos.y) * EASE;
    }

    var screenY = pos.y - window.scrollY;
    if(screenY < EDGE_MARGIN && target.y < pos.y){
      window.scrollBy({top: -SCROLL_SPEED, left: 0, behavior: 'instant'}); // 'instant' umgeht html{scroll-behavior:smooth}, sonst überlagern sich pro Frame gestartete Smooth-Scrolls und bremsen das Auto-Scrollen stark aus
      pos.y -= SCROLL_SPEED; // synchron im selben Frame mitverschieben, sonst ein Frame Wackeln bis das 'scroll'-Event nachzieht
      autoScrolling = true; // target NICHT mitverschieben: nur echte Eingaben (Mausbewegung/Taste) sollen target weiter vorantreiben, sonst holt pos target ein und das Scrollen stoppt von selbst
    } else if(screenY > window.innerHeight - EDGE_MARGIN && target.y > pos.y){
      window.scrollBy({top: SCROLL_SPEED, left: 0, behavior: 'instant'});
      pos.y += SCROLL_SPEED;
      autoScrolling = true;
    }

    clampToScreen();
    render();
    checkCollectibles();
    raf = requestAnimationFrame(tick);
  }

  function start(e){
    active = true;
    document.body.classList.add('game-active');
    if(window.GameTrack) window.GameTrack.unfold();
    toggle.lastChild.textContent = 'Spiel beenden';
    toggle.setAttribute('aria-pressed','true');
    if(icon) icon.classList.add('is-playing');
    resizeTrail();
    particles = [];

    if(e && typeof e.clientX === 'number'){
      lastInputType = 'mouse';
      lastMouseClient.x = e.clientX;
      lastMouseClient.y = e.clientY;
    }

    var track = window.GameTrack;
    if(track){
      track.collected = 0;
      track.collectibles.forEach(function(c){
        c.collected = false;
        c.el.classList.remove('collected');
      });
      var countEl = document.getElementById('collectCount');
      if(countEl) countEl.textContent = '0 / ' + track.total;
      var winIcon = document.getElementById('collectIcon');
      if(winIcon) winIcon.classList.remove('win');
    }

    var r = toggle.getBoundingClientRect();
    pos.x = target.x = r.left + window.scrollX + r.width / 2;
    pos.y = target.y = r.top + window.scrollY + r.height / 2;
    render();

    raf = requestAnimationFrame(tick);
  }

  function stop(){
    active = false;
    document.body.classList.remove('game-active');
    if(window.GameTrack) window.GameTrack.fold();
    toggle.lastChild.textContent = 'Los geht\'s';
    toggle.setAttribute('aria-pressed','false');
    if(icon) icon.classList.remove('is-playing');
    keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    if(raf) cancelAnimationFrame(raf);
    if(focusedEl){ focusedEl.blur(); focusedEl = null; }
    if(hoveredTile){
      if(window.setTileHover) window.setTileHover(hoveredTile, false);
      if(window.collapseCard) window.collapseCard(hoveredTile);
      hoveredTile = null;
    }
    particles = [];
    if(trailCtx) trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
  }

  window.addEventListener('resize', resizeTrail);

  toggle.addEventListener('click', function(e){
    active ? stop() : start(e);
  });

  window.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && active){ stop(); return; }
    if(!active) return;
    if(e.code === 'Space'){
      e.preventDefault();
      if(focusedEl && (focusedEl.tagName === 'A' || focusedEl.tagName === 'BUTTON')) focusedEl.click();
      return;
    }
    if(e.key in keys){ keys[e.key] = true; lastInputType = 'keyboard'; e.preventDefault(); }
  });
  window.addEventListener('keyup', function(e){
    if(!active) return;
    if(e.key in keys){ keys[e.key] = false; }
  });

  window.addEventListener('pointermove', function(e){
    if(!active || e.pointerType !== 'mouse') return;
    lastInputType = 'mouse';
    lastMouseClient.x = e.clientX;
    lastMouseClient.y = e.clientY;
    target.x = e.pageX; target.y = e.pageY;
    clampTarget();
  });
  window.addEventListener('pointerdown', function(e){
    if(!active || e.pointerType === 'mouse') return;
    lastInputType = 'touch';
    target.x = e.pageX; target.y = e.pageY;
    clampTarget();
  });

  // Bildschirmfeste Maus während des Scrollens nachführen (z.B. Touchpad/Mausrad ohne Mausbewegung):
  // ein echter Cursor bleibt beim Scrollen auf dem Bildschirm stehen, nur der Inhalt bewegt sich darunter.
  window.addEventListener('scroll', function(){
    if(!active || lastInputType !== 'mouse' || autoScrolling) return; // eigene Auto-Scroll-Schritte werden schon synchron in tick() behandelt
    pos.x = target.x = lastMouseClient.x + window.scrollX;
    pos.y = target.y = lastMouseClient.y + window.scrollY;
    clampTarget();
  }, {passive:true});

  document.querySelectorAll('.menu-panel a').forEach(function(link){
    link.addEventListener('click', function(){
      if(!active) return;
      lastInputType = 'jump';
      var section = document.querySelector(link.getAttribute('href'));
      if(!section) return;
      var r = section.getBoundingClientRect();
      target.x = pos.x = r.left + window.scrollX + Math.min(r.width, window.innerWidth) / 2;
      target.y = pos.y = r.top + window.scrollY + 120;
      clampTarget();
    });
  });
})();

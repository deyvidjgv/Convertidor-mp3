/* Fondo cósmico con notas fugaces — Convertidor MP3
   Pareja: css/notas-cosmicas.css

   Uso:
     <script src="js/notas-cosmicas.js"
             data-shooters="28" data-speed="5" data-trail="300" data-stars="150" defer></script>

   Opciones (todas opcionales):
     data-shooters  nº de notas fugaces        (por defecto 28)
     data-speed     1 = muy lenta … 10 = rápida (por defecto 5)
     data-trail     largo de la estela en px    (por defecto 300)
     data-stars     nº de estrellas             (por defecto 150)  */

(function () {
  var script = document.currentScript;
  var num = function (name, fallback) {
    var v = script && parseFloat(script.getAttribute('data-' + name));
    return isFinite(v) ? v : fallback;
  };

  var SHOOTERS = Math.max(2, Math.round(num('shooters', 28)));
  var SPEED = Math.min(10, Math.max(1, num('speed', 5)));
  var TRAIL = Math.max(40, num('trail', 300));
  var STARS = Math.max(0, Math.round(num('stars', 150)));

  var GLYPHS = ['\u266A', '\u266B', '\u2669', '\u266C', '\u266D', '\u266F'];
  var COLORS = ['#6EE7FF', '#A78BFA', '#F472D0', '#FDE68A', '#7CFFB2', '#FF8A5B', '#C8B6FE'];
  var STAVES = [
    { top: 11, angle: -7 }, { top: 33, angle: 4 },
    { top: 56, angle: -3 }, { top: 76, angle: 6 }, { top: 92, angle: -5 }
  ];
  var GAP = 11;

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function build() {
    var layer = document.createElement('div');
    layer.className = 'sky-layer';
    layer.setAttribute('aria-hidden', 'true');

    var neb = document.createElement('div');
    neb.className = 'nebula';
    layer.appendChild(neb);

    for (var s = 0; s < STARS; s++) {
      var d = 1 + Math.random() * 2.2;
      var star = document.createElement('span');
      star.className = 'star';
      star.style.left = (Math.random() * 100).toFixed(2) + '%';
      star.style.top = (Math.random() * 100).toFixed(2) + '%';
      star.style.width = d.toFixed(1) + 'px';
      star.style.height = d.toFixed(1) + 'px';
      star.style.boxShadow = '0 0 ' + (d * 3).toFixed(1) + 'px rgba(255,255,255,0.75)';
      star.style.animationDuration = (2.2 + Math.random() * 4).toFixed(2) + 's';
      star.style.animationDelay = (-Math.random() * 5).toFixed(2) + 's';
      var tint = Math.random();
      if (tint > 0.85) star.style.background = '#9BEBFF';
      else if (tint > 0.7) star.style.background = '#F9C6EC';
      layer.appendChild(star);
    }

    var base = 20 - SPEED * 1.5; // speed 5 -> 12.5 s de travesía
    var per = Math.max(1, Math.round(SHOOTERS / STAVES.length));

    STAVES.forEach(function (st, si) {
      var stave = document.createElement('div');
      stave.className = 'stave';
      stave.style.top = st.top + '%';
      stave.style.height = (GAP * 4) + 'px';
      stave.style.transform = 'rotate(' + st.angle + 'deg)';

      for (var li = 0; li < 5; li++) {
        var line = document.createElement('div');
        line.className = 'stave-line';
        line.style.top = (li * GAP) + 'px';
        stave.appendChild(line);
      }

      for (var i = 0; i < per; i++) {
        var color = COLORS[(((Math.random() * COLORS.length) | 0) + si) % COLORS.length];
        var size = 17 + Math.random() * 20;
        var dur = base * (0.7 + Math.random() * 0.8);
        var tl = TRAIL * (0.6 + Math.random() * 0.8);

        var wrap = document.createElement('div');
        wrap.className = 'shooter';
        wrap.style.top = ((((Math.random() * 5) | 0) * GAP) - size * 0.62).toFixed(1) + 'px';
        wrap.style.animationDuration = dur.toFixed(2) + 's';
        wrap.style.animationDelay = (-Math.random() * dur).toFixed(2) + 's';
        wrap.style.setProperty('--c-note', color);
        wrap.style.setProperty('--c-trail-mid', color + '99');
        wrap.style.setProperty('--c-dust-mid', color + '26');
        wrap.style.setProperty('--c-dust-end', color + '4d');
        wrap.style.setProperty('--note-size', size.toFixed(1) + 'px');

        var dust = document.createElement('div');
        dust.className = 'shooter-dust';
        dust.style.width = (tl * 1.5).toFixed(0) + 'px';
        dust.style.height = (size * 1.5).toFixed(0) + 'px';

        var trail = document.createElement('div');
        trail.className = 'shooter-trail';
        trail.style.width = tl.toFixed(0) + 'px';

        var note = document.createElement('span');
        note.className = 'shooter-note';
        note.style.fontSize = size.toFixed(1) + 'px';
        note.textContent = pick(GLYPHS);

        wrap.appendChild(dust);
        wrap.appendChild(trail);
        wrap.appendChild(note);
        stave.appendChild(wrap);
      }

      layer.appendChild(stave);
    });

    document.body.insertBefore(layer, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();

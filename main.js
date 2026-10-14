/* Total Solución · landing v2
 * 1) Video del hero controlado por el scroll (escritorio) o en loop (móvil).
 * 2) Etiquetas de capas sincronizadas al avance del video.
 * 3) Formulario que arma un mensaje de WhatsApp y de correo. No hay servidor.
 * 4) Tarjeta digital: descarga de un archivo .vcf.
 */
(function () {
  'use strict';

  var WHATSAPP = '56975716108'; // [POR CONFIRMAR] número que recibe las cotizaciones
  var MAIL = 'ventas@totalsolucion.cl';

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Modo: scroll-scrub o loop ---------- */
  var body = document.body;
  var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches || window.innerWidth < 760;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isTouch) body.classList.add('is-touch');
  if (reduced && !isTouch) body.classList.add('no-scrub');

  var hero = document.getElementById('hero');
  var video = document.getElementById('hero-video');
  var mobileVideo = document.getElementById('hero-video-mobile');
  var labels = Array.prototype.slice.call(document.querySelectorAll('.layer-label'));

  function setLabels(p) {
    labels.forEach(function (el) {
      var from = parseFloat(el.dataset.from), to = parseFloat(el.dataset.to);
      el.classList.toggle('is-on', p >= from && p <= to);
    });
  }

  if (isTouch) {
    // Loop móvil: el video de escritorio no se carga (sin fuentes y con preload="none").
    video.querySelectorAll('source').forEach(function (s) { s.remove(); });
    video.load();
    setLabels(1);
    mobileVideo.preload = 'auto';
    var play = mobileVideo.play();
    if (play && play.catch) play.catch(function () { /* autoplay bloqueado: queda el poster */ });
  } else if (reduced) {
    // Sin animación: cuadro final y etiquetas visibles. El video no se precarga (preload="none"): se pide aquí.
    // Un poco antes del final: algunos navegadores no pintan el cuadro si currentTime es exactamente duration.
    video.addEventListener('loadedmetadata', function () { video.currentTime = Math.max(0, video.duration - 0.05); });
    video.preload = 'metadata'; video.load();
    setLabels(1);
  } else {
    mobileVideo.remove();
    scrub(video, hero);
  }

  /* Escritorio: secuencia de cuadros dibujada en canvas. Es más fluida que buscar
   * dentro de un <video> (que depende de rangos HTTP y de la velocidad de seek del
   * navegador). Los MP4/WebM de assets/video/ quedan como respaldo si los cuadros fallan. */
  function scrub(v, container) {
    var FRAMES = 78, DIR = 'assets/frames/', frames = new Array(FRAMES), loaded = 0, failed = 0;
    var canvas = document.getElementById('hero-canvas');
    var ctx = canvas.getContext('2d');
    var target = 0, current = 0, shown = -1, raf = null, usingVideo = false;

    function src(i) { return DIR + 'f_' + ('00' + i).slice(-3) + '.webp'; }

    function draw(i) {
      if (usingVideo) { v.currentTime = (i / (FRAMES - 1)) * (v.duration || 1.3); return; }
      var img = frames[i];
      if (!img || !img.complete || !img.naturalWidth) {
        // Busca el cuadro cargado más cercano hacia atrás.
        for (var k = i; k >= 0; k--) { if (frames[k] && frames[k].complete && frames[k].naturalWidth) { img = frames[k]; break; } }
        if (!img) return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      shown = i;
    }

    function fallbackToVideo() {
      usingVideo = true; canvas.hidden = true; v.hidden = false; v.preload = 'auto'; v.load();
    }

    function load(i) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { loaded++; if (shown < 0 || Math.round(current * (FRAMES - 1)) === i) draw(i); };
      img.onerror = function () { failed++; if (failed > 3) fallbackToVideo(); };
      img.src = src(i); frames[i] = img;
    }

    v.hidden = true; canvas.hidden = false;
    load(0);
    // Carga el resto por tramos para no bloquear el primer cuadro.
    var order = []; for (var step = 8; step >= 1; step = step / 2) { for (var i = 0; i < FRAMES; i += step) { if (order.indexOf(i) < 0 && i !== 0) order.push(i); } }
    var idx = 0;
    (function next() { if (idx >= order.length) return; load(order[idx++]); setTimeout(next, 12); })();

    function progress() {
      var rect = container.getBoundingClientRect();
      var total = container.offsetHeight - window.innerHeight;
      if (total <= 0) return 1;
      return Math.min(1, Math.max(0, -rect.top / total));
    }

    var last = 0;
    function tick(now) {
      raf = null;
      // Suavizado en función del tiempo real: converge en ~0,4 s aunque el navegador
      // entregue pocos cuadros por segundo.
      var dt = last ? Math.min(500, now - last) : 16; last = now;
      current += (target - current) * (1 - Math.exp(-dt / 110));
      if (Math.abs(target - current) < 0.001) { current = target; last = 0; }
      var i = Math.round(current * (FRAMES - 1));
      if (i !== shown) draw(i);
      setLabels(current);
      if (current !== target) raf = requestAnimationFrame(tick);
    }

    function onScroll() { target = progress(); if (!raf) raf = requestAnimationFrame(tick); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---------- Video del taller: se carga y reproduce solo cuando se ve ---------- */
  var tallerVideos = document.querySelectorAll('.gallery-video');
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else { v.pause(); }
      });
    }, { rootMargin: '200px 0px' });
    tallerVideos.forEach(function (v) { io.observe(v); });
  }

  /* ---------- Formulario ---------- */
  var form = document.getElementById('quote-form');
  var status = document.getElementById('form-status');
  var previewText = document.getElementById('preview-text');
  var preview = document.getElementById('preview');
  var mailLink = document.getElementById('mail-link');

  function val(id) { return (document.getElementById(id).value || '').trim(); }

  function buildMessage() {
    var lines = [
      'Hola, solicito cotización de colchones navieros a medida.',
      'Empresa o armador: ' + val('f-empresa'),
      'Contacto: ' + val('f-nombre') + (val('f-fono') ? ' · ' + val('f-fono') : ''),
      'Tipo de embarcación: ' + val('f-tipo'),
      'Número de literas: ' + val('f-literas'),
      'Medidas (largo × ancho × alto, cm): ' + val('f-medidas'),
      'Comuna de entrega: ' + val('f-comuna')
    ];
    return lines.join('\n');
  }

  function refreshPreview() {
    var msg = buildMessage();
    previewText.textContent = msg;
    mailLink.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Cotización colchones navieros') + '&body=' + encodeURIComponent(msg);
  }

  form.addEventListener('input', refreshPreview);
  refreshPreview();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = form.querySelectorAll('[required]');
    var ok = true;
    fields.forEach(function (f) { f.classList.add('touched'); if (!f.checkValidity()) ok = false; });
    if (!ok) {
      status.textContent = 'Faltan datos: complete los campos marcados.';
      var first = form.querySelector(':invalid');
      if (first) first.focus();
      return;
    }
    refreshPreview();
    preview.open = true;
    var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(buildMessage());
    status.textContent = 'Se abrió WhatsApp con el mensaje listo. Si no se abrió, use el texto de abajo.';
    window.open(url, '_blank', 'noopener');
  });

  document.getElementById('copy-btn').addEventListener('click', function () {
    var msg = buildMessage();
    var done = function () { status.textContent = 'Texto copiado. Péguelo en WhatsApp o en un correo a ' + MAIL + '.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(done, function () { fallbackCopy(msg); done(); });
    } else { fallbackCopy(msg); done(); }
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (err) { /* sin soporte */ }
    document.body.removeChild(ta);
  }

  /* ---------- Tarjeta digital (.vcf) ---------- */
  document.getElementById('vcard-btn').addEventListener('click', function () {
    var vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Total Solución · Colchones navieros',
      'ORG:Total Solución',
      'TITLE:Colchones navieros a medida',
      'TEL;TYPE=CELL,VOICE:+56975716108',
      'TEL;TYPE=CELL,VOICE:+56957621643',
      'EMAIL;TYPE=WORK:' + MAIL,
      'URL:https://www.totalsolucion.cl',
      'ADR;TYPE=WORK:;;;Puerto Montt;Los Lagos;;Chile',
      'NOTE:Colchón Naviero Orión. Fabricación a medida para camarotes de embarcaciones.',
      'END:VCARD'
    ].join('\r\n');
    var blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'total-solucion.vcf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
})();

/* RETREATS DIRECT — restrained interaction layer.
   Nothing here should announce itself. */
(function () {
  'use strict';
  var quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav: gains a ground as you leave the hero ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var overPhoto = nav.classList.contains('over-photo');
    var trigger = function () {
      var h = document.querySelector('.hero');
      return h ? h.offsetHeight - 90 : 60;
    };
    var onScroll = function () {
      var pinned = window.scrollY > trigger();
      nav.classList.toggle('pinned', pinned);
      if (overPhoto) nav.classList.toggle('over-photo', !pinned);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- mobile menu ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.menu');
  if (toggle && menu) {
    var setMenu = function (open) {
      menu.classList.toggle('open', open);
      toggle.classList.toggle('x', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    toggle.addEventListener('click', function () {
      setMenu(!menu.classList.contains('open'));
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false);
    });
  }

  /* ---------- reveals ---------- */
  var animated = document.querySelectorAll('.rise, .draw, .settle, .kenburns, .bar');
  if (quiet || !('IntersectionObserver' in window)) {
    animated.forEach(function (el) { el.classList.add('seen'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('seen');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    animated.forEach(function (el) { io.observe(el); });
    // hero art is above the fold: let it settle immediately
    document.querySelectorAll('.hero .kenburns, .hero .settle, .hero .rise')
      .forEach(function (el) { requestAnimationFrame(function () { el.classList.add('seen'); }); });
  }

  /* ---------- reviews: fold ---------- */
  var fold = document.querySelector('[data-fold]');
  if (fold) {
    var list = document.querySelector('.reviews');
    var total = list ? list.children.length : 0;
    fold.addEventListener('click', function () {
      var folded = list.classList.toggle('folded');
      fold.textContent = folded ? 'Read all ' + total + ' reviews' : 'Show fewer';
      if (!folded) {
        list.querySelectorAll('.rise').forEach(function (el) { el.classList.add('seen'); });
      }
    });
  }

  /* ---------- lightbox ---------- */
  var lb = document.querySelector('.lb');
  if (lb) {
    var shots = Array.prototype.slice.call(document.querySelectorAll('.shot'));
    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('figcaption');
    var lbNum = lb.querySelector('.lb-count');
    var at = 0, opener = null;

    var show = function (i) {
      at = (i + shots.length) % shots.length;
      var s = shots[at];
      var src = s.getAttribute('data-full');
      var cap = s.getAttribute('data-caption') || '';
      lbImg.src = src;
      lbImg.alt = cap || 'Photograph';
      lbCap.textContent = cap;
      if (lbNum) lbNum.textContent = (at + 1) + ' / ' + shots.length;
      // quietly warm the neighbours
      [at + 1, at - 1].forEach(function (n) {
        var nb = shots[(n + shots.length) % shots.length];
        if (nb) { var p = new Image(); p.src = nb.getAttribute('data-full'); }
      });
    };
    var open = function (i, from) {
      opener = from || null;
      show(i);
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      var c = lb.querySelector('.lb-close');
      if (c) c.focus();
    };
    var close = function () {
      lb.classList.remove('open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };

    shots.forEach(function (s, i) {
      s.addEventListener('click', function () { open(i, s); });
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function () { show(at - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { show(at + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(at + 1);
      else if (e.key === 'ArrowLeft') show(at - 1);
      else if (e.key === 'Tab') {
        // keep focus inside the lightbox
        var f = lb.querySelectorAll('button');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- availability calendar ----------
     Reads assets/availability.json, which refresh-availability.py writes.
     Never invents a date: anything not explicitly listed as free is shown as taken. */
  var cal = document.querySelector('[data-calendar]');
  if (cal) {
    var key = cal.getAttribute('data-calendar');
    var iso = function (d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
             '-' + String(d.getDate()).padStart(2, '0');
    };
    var MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    var DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    var pretty = function (s) {
      var p = s.split('-');
      return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
    };

    var free = Object.create(null), minN = Object.create(null);
    var cursor = new Date(); cursor.setDate(1);
    var todayIso = iso(new Date());
    var from = null, to = null, horizon = null;

    var wrap   = cal.querySelector('.cal-months');
    var prev   = cal.querySelector('[data-cal-prev]');
    var next   = cal.querySelector('[data-cal-next]');
    var picked = cal.querySelector('.cal-picked');
    var stamp  = cal.querySelector('.cal-stamp');

    var spanIsFree = function (a, b) {
      // every night from a up to (not including) b must be free
      var d = new Date(a + 'T00:00:00'), end = new Date(b + 'T00:00:00');
      while (d < end) { if (!free[iso(d)]) return false; d.setDate(d.getDate() + 1); }
      return true;
    };

    var say = function (html) { picked.innerHTML = html; };

    var describe = function () {
      if (!from) { say('<span class="cal-msg">Choose an arrival date.</span>'); return; }
      if (!to)   { say('<b>' + pretty(from) + '</b> <span class="cal-msg">— now choose a departure date.</span>'); return; }
      var nights = Math.round(
        (new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000);
      say('<b>' + pretty(from) + '</b> to <b>' + pretty(to) + '</b>' +
          '<span class="cal-msg">' + nights + ' night' + (nights === 1 ? '' : 's') + '</span>' +
          '<button type="button" class="cal-clear">Clear</button>');
      picked.querySelector('.cal-clear').addEventListener('click', function () {
        from = to = null; draw(); describe();
        var a = document.querySelector('#arrive'), b = document.querySelector('#depart');
        if (a) a.value = ''; if (b) b.value = '';
      });
      // hand the dates to the enquiry form
      var a = document.querySelector('#arrive'), b = document.querySelector('#depart');
      if (a) a.value = from;
      if (b) { b.min = from; b.value = to; }
    };

    var choose = function (date) {
      if (!from || to) { from = date; to = null; }
      else if (date === from) { from = null; }
      else if (date < from) { from = date; }
      else if (!spanIsFree(from, date)) {
        from = date; to = null;
        say('<span class="cal-msg">Those nights aren\'t all free — starting again from ' +
            pretty(date) + '.</span>');
        draw();
        return;
      } else {
        to = date;
        var need = minN[from] || 1;
        var nights = Math.round(
          (new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000);
        if (nights < need) {
          to = null; draw();
          say('<span class="cal-msg">' + pretty(from) + ' has a ' + need +
              '-night minimum. Please choose a later departure.</span>');
          return;
        }
      }
      draw(); describe();
    };

    var month = function (year, m) {
      var first = new Date(year, m, 1), lead = first.getDay();
      var days = new Date(year, m + 1, 0).getDate();
      var el = document.createElement('div');
      el.className = 'cal-month';
      var h = '<h4>' + MONTHS[m] + ' ' + year + '</h4><div class="cal-dow" aria-hidden="true">' +
              DOW.map(function (d) { return '<span>' + d + '</span>'; }).join('') +
              '</div><div class="cal-grid" role="grid">';
      for (var i = 0; i < lead; i++) h += '<button class="cal-day blank" tabindex="-1" aria-hidden="true"></button>';
      for (var d = 1; d <= days; d++) {
        var date = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var past = date < todayIso;
        var open = !!free[date] && !past;
        var cls = 'cal-day' + (past ? ' past' : '');
        if (from && date === from) cls += ' edge';
        if (to && date === to) cls += ' edge';
        if (from && to && date > from && date < to) cls += ' between';
        var label = pretty(date) + ', ' + (past ? 'in the past' : open ? 'available' : 'not available');
        h += '<button class="' + cls + '" data-d="' + date + '"' +
             (open ? '' : ' disabled') +
             ' aria-label="' + label + '"' +
             (from === date || to === date ? ' aria-pressed="true"' : '') +
             '>' + d + '</button>';
      }
      return (el.innerHTML = h + '</div>'), el;
    };

    var draw = function () {
      wrap.innerHTML = '';
      var wide = window.matchMedia('(min-width:1081px)').matches;
      for (var i = 0; i < (wide ? 2 : 1); i++) {
        var d = new Date(cursor.getFullYear(), cursor.getMonth() + i, 1);
        wrap.appendChild(month(d.getFullYear(), d.getMonth()));
      }
      var start = new Date(); start.setDate(1);
      prev.disabled = cursor <= start;
      if (horizon) {
        var last = new Date(cursor.getFullYear(), cursor.getMonth() + (wide ? 1 : 0), 1);
        next.disabled = last >= horizon;
      }
      wrap.querySelectorAll('.cal-day[data-d]:not([disabled])').forEach(function (b) {
        b.addEventListener('click', function () { choose(b.getAttribute('data-d')); });
      });
    };

    var step = function (n) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
      draw();
    };
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    window.addEventListener('resize', draw, { passive: true });

    // arrow keys move between days
    wrap.addEventListener('keydown', function (e) {
      var offs = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
      if (!offs || !e.target.dataset.d) return;
      e.preventDefault();
      var d = new Date(e.target.dataset.d + 'T00:00:00');
      d.setDate(d.getDate() + offs);
      var el = wrap.querySelector('[data-d="' + iso(d) + '"]');
      if (el) el.focus();
      else { step(offs > 0 ? 1 : -1); var t = wrap.querySelector('[data-d="' + iso(d) + '"]'); if (t) t.focus(); }
    });

    fetch('assets/availability.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var p = data.properties && data.properties[key];
        if (!p) throw new Error('no data for ' + key);
        p.available.forEach(function (d) { free[d] = true; });
        Object.keys(p.minNights || {}).forEach(function (d) { minN[d] = p.minNights[d]; });
        var last = p.available[p.available.length - 1];
        if (last) horizon = new Date(last.slice(0, 7) + '-01T00:00:00');
        stamp.textContent =
          'Availability as of ' + pretty(data.fetched) +
          '. Dates are confirmed by reply — a night marked free here may have gone since.';
        draw(); describe();
      })
      .catch(function () {
        cal.querySelector('.cal-body').innerHTML =
          '<p class="prose">The calendar could not be loaded just now. ' +
          'Send your dates using the form below and Paul will confirm what is free.</p>';
      });
  }

  /* ---------- forms ----------
     A mailto: hand-off only works if the visitor's device has a mail app
     registered. On a desktop running webmail it does nothing at all — so we
     never claim the message was sent. We attempt the hand-off, then put the
     composed text on screen with the phone number and a copy button, so the
     enquiry is never lost just because the browser stayed silent. */
  var TO = 'pavly.samuel@gmail.com';
  var TEL = '519 505 5443';
  var TEL_HREF = '+15195055443';
  var val = function (fd, k) { return (fd.get(k) || '').toString().trim(); };

  function fallbackPanel(form, subject, body) {
    var box = form.querySelector('.sent-fallback');
    if (!box) {
      box = document.createElement('div');
      box.className = 'sent-fallback';
      box.setAttribute('role', 'status');
      box.innerHTML =
        '<p class="sf-head">If your mail app didn\'t open, nothing has been sent yet.</p>' +
        '<p class="sf-sub">Copy the message below and email it, or just call — either reaches Paul directly.</p>' +
        '<textarea class="sf-text" readonly rows="7"></textarea>' +
        '<div class="sf-row">' +
          '<button type="button" class="btn sf-copy">Copy message</button>' +
          '<a class="btn sf-mail">Email ' + TO + '</a>' +
          '<a class="btn sf-tel" href="tel:' + TEL_HREF + '">Call or text ' + TEL + '</a>' +
        '</div>';
      form.appendChild(box);
      box.querySelector('.sf-copy').addEventListener('click', function () {
        var ta = box.querySelector('.sf-text');
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(ta.value).then(function () {
            box.querySelector('.sf-copy').textContent = 'Copied';
          }, function () {});
        } else if (ok) {
          box.querySelector('.sf-copy').textContent = 'Copied';
        }
      });
    }
    box.querySelector('.sf-text').value = body;
    box.querySelector('.sf-mail').href =
      'mailto:' + TO + '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    box.classList.add('show');
    box.scrollIntoView({ block: 'nearest' });
  }

  function wire(form, buildSubject, buildBody) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var f = new FormData(form);
      var subject = buildSubject(f), body = buildBody(f);
      // try the hand-off, but never assume it worked
      try {
        window.location.href = 'mailto:' + TO +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body);
      } catch (err) { /* ignore — the panel below covers it */ }
      var b = form.querySelector('[type=submit]');
      if (b) b.textContent = 'Send again';
      fallbackPanel(form, subject, body);
    });
  }

  wire(document.querySelector('#enquiry'),
    function (f) { return 'Enquiry — ' + (val(f, 'property') || 'a stay'); },
    function (f) {
      return 'Name: ' + val(f, 'name') +
        '\nEmail: ' + val(f, 'email') +
        '\nProperty: ' + (val(f, 'property') || 'a stay') +
        '\nArrive: ' + val(f, 'arrive') +
        '\nDepart: ' + val(f, 'depart') +
        '\nGuests: ' + val(f, 'guests') +
        '\n\n' + (val(f, 'message') || '(no message)');
    });

  wire(document.querySelector('#leave-word'),
    function (f) { return 'Guest review — ' + val(f, 'property'); },
    function (f) {
      return 'Name: ' + val(f, 'name') +
        '\nProperty: ' + val(f, 'property') +
        '\nRating: ' + (val(f, 'rating') || '—') + ' / 5' +
        '\n\nReview:\n' + val(f, 'review') +
        '\n\nPrivate suggestion:\n' + (val(f, 'suggestion') || '(none)');
    });

  /* ---------- dates: depart cannot precede arrive ---------- */
  var arrive = document.querySelector('#arrive');
  var depart = document.querySelector('#depart');
  if (arrive && depart) {
    var today = new Date().toISOString().slice(0, 10);
    arrive.min = today; depart.min = today;
    arrive.addEventListener('change', function () {
      depart.min = arrive.value || today;
      if (depart.value && depart.value < depart.min) depart.value = '';
    });
  }
})();

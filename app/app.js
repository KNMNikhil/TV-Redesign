// Home screen for LG webOS: a big list of favourites over a wallpaper, three icons top right.
// Layout, wallpapers, favourites and hidden apps are saved on the TV (localStorage) and can be reset from the menu.
(function () {
  'use strict';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESC: 27 };
  var CFG = window.CONFIG || {};
  var MAX_FAVS = 12, VISIBLE = 6, ROW_H = 124;
  var COLS = 7, TILE_H = 232, APP_ROWS = 3, LONG_PRESS_MS = 600;
  var IDLE_MS = (CFG.idleSeconds || 90) * 1000;
  var PREF_KEY = 'tvhome2';
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

  var titleOf = function (app) { return (CFG.names && CFG.names[app.id]) || app.title; };
  var $ = function (id) { return document.getElementById(id); };
  var allApps = (window.TV_APPS && TV_APPS.apps) || [];
  var inputs = (window.TV_APPS && TV_APPS.inputs) || [];
  var byId = {};
  allApps.forEach(function (a) { byId[a.id] = a; });

  // ---- saved preferences ---------------------------------------------------------------------

  var prefs = { fav: null, hidden: [], shown: [], wp: null, showHidden: false, ver: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(PREF_KEY));
    if (saved && typeof saved === 'object') Object.keys(prefs).forEach(function (k) { if (k in saved) prefs[k] = saved[k]; });
  } catch (e) { /* no storage: defaults every time */ }

  if (prefs.ver < 3) { prefs.fav = null; prefs.ver = 3; }

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  var cfgHidden = CFG.hiddenApps || [];
  function isHidden(id) {
    return (cfgHidden.indexOf(id) >= 0 || prefs.hidden.indexOf(id) >= 0) && prefs.shown.indexOf(id) < 0;
  }
  function favIds() {
    var base = prefs.fav || CFG.dockApps || [];
    return base.filter(function (id) { return byId[id] && !isHidden(id); }).slice(0, MAX_FAVS);
  }

  // ---- luna bus ------------------------------------------------------------------------------

  var bridges = [];   // keep a reference: a collected bridge drops its callback

  function luna(uri, params, cb) {
    try {
      var b = new PalmServiceBridge();
      b.onservicecallback = function (msg) {
        var res;
        try { res = JSON.parse(msg); } catch (e) { res = { returnValue: false }; }
        if (cb) cb(res);
        if (!params || !params.subscribe) bridges.splice(bridges.indexOf(b), 1);
      };
      bridges.push(b);
      b.call(uri, JSON.stringify(params || {}));
    } catch (e) {
      if (cb) cb({ returnValue: false, errorText: String(e) });   // not on a TV (desktop preview)
    }
  }

  function launch(id, title, params) {
    luna('luna://com.webos.applicationManager/launch', { id: id, params: params || {} }, function (res) {
      if (res.returnValue === false) toast("Can't open " + (title || id));
    });
  }
  function openTvSettings(target) { launch('com.palm.app.settings', 'Settings', target ? { target: target } : {}); }

  var toastTimer;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---- state ---------------------------------------------------------------------------------

  // Hover only counts when the pointer really moved: sliding rows under a resting pointer must not steal focus.
  var pointerActive = false, lastX = -1, lastY = -1;

  var zone = 'list';      // 'list' | 'top' | 'apps' | 'wall' | 'menu' | 'ambient'
  var favFocus = 0, topFocus = 1;
  var favEls = [], tis = [$('tiWall'), $('tiApps'), $('tiSettings')];

  // ---- wallpapers ----------------------------------------------------------------------------

  var wallpapers = [];
  (CFG.photos || []).forEach(function (p) {
    var file = typeof p === 'string' ? p : p.file;
    wallpapers.push({ id: 'photo:' + file, name: (p && p.name) || file, file: file, thumb: (p && p.thumb) || file, blur: p && p.blur });
  });
  if (!wallpapers.length) wallpapers.push({ id: 'black', name: 'Black', file: '', thumb: '', blur: '' });
  function cssUrl(f) { return f ? 'url("' + f + '")' : 'none'; }
  var wpLayers = [$('wpA'), $('wpB')], wpFront = -1, wpIndex = 0;

  function wpById(id) {
    for (var i = 0; i < wallpapers.length; i++) if (wallpapers[i].id === id) return i;
    return 0;
  }
  function showWallpaper(i) {
    var next = wpFront === 0 ? 1 : 0, el = wpLayers[next];
    el.style.backgroundImage = cssUrl(wallpapers[i].file);
    $('appsBlur').style.backgroundImage = cssUrl(wallpapers[i].blur);
    el.classList.add('front');
    if (wpFront >= 0) wpLayers[wpFront].classList.remove('front');
    wpFront = next;
  }

  // ---- favourites list -----------------------------------------------------------------------

  // Simple white marks for the big streaming apps; anything else shows its own icon.
  var GLYPHS = {
    netflix: '<svg viewBox="0 0 24 32"><path d="M3 0h5.6l9 17.5V0H23v32h-5.4L8.4 14.4V32H3z"/></svg>',
    youtube: '<svg viewBox="0 0 28 20"><path fill-rule="evenodd" d="M5 0h18a5 5 0 015 5v10a5 5 0 01-5 5H5a5 5 0 01-5-5V5a5 5 0 015-5zm6 5v10l9-5z"/></svg>',
    amazon: '<svg class="stroke" viewBox="0 0 28 14"><path d="M2 3c7 7 17 7 24 0"/><path d="M22 1l4 2.2-1.8 4"/></svg>',
    hotstar: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z"/></svg>',
    spotify: '<svg class="stroke" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M6.5 9.2c3.6-1 7.6-.7 11 1.2M7.2 12.6c3-.8 6-.5 8.6 1M7.8 15.7c2.4-.6 4.6-.3 6.6.8"/></svg>',
    appletv: '<span class="txt">tv</span>',
    sunnxt: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.6"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    zee5: '<span class="txt">Z5</span>',
    aha: '<span class="txt">aha</span>',
    sonyliv: '<span class="txt">S</span>'
  };
  function glyphFor(app) {
    var id = app.id;
    if (id === 'netflix') return GLYPHS.netflix;
    if (id.indexOf('youtube') === 0) return GLYPHS.youtube;
    if (id === 'amazon') return GLYPHS.amazon;
    if (id === 'hotstar') return GLYPHS.hotstar;
    if (id.indexOf('spotify') === 0) return GLYPHS.spotify;
    if (id === 'com.apple.appletv') return GLYPHS.appletv;
    if (id === 'com.sun.sunnxt') return GLYPHS.sunnxt;
    if (id === 'com.zee5.app') return GLYPHS.zee5;
    if (id === 'aha') return GLYPHS.aha;
    if (id === 'com.sonyliv2.tvapp') return GLYPHS.sonyliv;
    return null;
  }

  function buildFavs() {
    var ul = $('favs');
    ul.innerHTML = '';
    favEls = [];
    favIds().forEach(function (id, i) {
      var app = byId[id], li = document.createElement('li');
      li.className = 'fav';
      var g = document.createElement('span');
      g.className = 'glyph';
      var mark = glyphFor(app);
      if (mark) g.innerHTML = mark;   // constant strings above, never TV data
      else { var im = document.createElement('img'); im.src = app.icon; g.appendChild(im); }
      var name = document.createElement('span');
      name.textContent = titleOf(app);
      li.appendChild(g);
      li.appendChild(name);
      li.addEventListener('mouseover', function () { if (pointerActive && (zone === 'list' || zone === 'top')) { setZone('list'); focusFav(i); } });
      li.addEventListener('click', function () { launch(app.id, app.title); });
      ul.appendChild(li);
      favEls.push(li);
    });
    favFocus = Math.min(favFocus, Math.max(0, favEls.length - 1));
    paintFavs();
  }

  var favTop = 0;   // index of the first visible row

  function paintFavs() {
    if (favFocus < favTop) favTop = favFocus;
    if (favFocus > favTop + VISIBLE - 1) favTop = favFocus - VISIBLE + 1;
    favTop = Math.max(0, Math.min(favTop, Math.max(0, favEls.length - VISIBLE)));
    var moreTop = favTop > 0, moreBottom = favTop + VISIBLE < favEls.length;
    favEls.forEach(function (el, i) {
      var rel = i - favTop, out = rel < 0 || rel >= VISIBLE;
      el.classList.toggle('focused', zone === 'list' && i === favFocus);
      el.classList.toggle('out', out);
      el.classList.toggle('edge', !out && ((rel === 0 && moreTop) || (rel === VISIBLE - 1 && moreBottom)));
    });
    $('favs').style.transform = 'translate3d(0,' + (-favTop * ROW_H) + 'px,0)';
  }
  function focusFav(i) {
    favFocus = Math.max(0, Math.min(i, favEls.length - 1));
    paintFavs();
  }

  function paintTop() {
    tis.forEach(function (el, i) { el.classList.toggle('focused', zone === 'top' && i === topFocus); });
  }

  function setZone(z) {
    zone = z;
    paintCal();
    document.body.classList.toggle('hideCal', z === 'menu' || z === 'apps' || z === 'ambient');
    paintFavs();
    paintTop();
  }

  // ---- clock ---------------------------------------------------------------------------------

  function updateClock() {
    renderCalendar();
    var now = new Date(), h = now.getHours(), m = now.getMinutes();
    var t = ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m;
    $('clock').textContent = t + ' ' + (h < 12 ? 'AM' : 'PM') + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
    $('ambClock').textContent = t;
    $('ambDate').textContent = DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  }

  // ---- calendar ------------------------------------------------------------------------------
  // Month view you can move around with the remote: dates, and a header with previous/next month.

  var calDayKey = '', calView = null, calHead = -1, calFocusDay = 1, dayEls = [];

  /** Rebuilds only when the day changes (midnight), snapping back to the current month. */
  function renderCalendar() {
    var now = new Date(), key = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate();
    if (key === calDayKey) return;
    calDayKey = key;
    calView = { y: now.getFullYear(), m: now.getMonth() };
    buildCalendar();
  }

  function buildCalendar() {
    var now = new Date(), first = CFG.weekStartsOn === 1 ? 1 : 0, y = calView.y, m = calView.m;
    $('calMonth').textContent = MONTHS[m];
    $('calYear').textContent = y;
    var dow = $('calDow'), grid = $('calGrid'), letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dow.innerHTML = '';
    grid.innerHTML = '';
    dayEls = [];
    for (var d = 0; d < 7; d++) {
      var l = document.createElement('span');
      l.textContent = letters[(d + first) % 7];
      dow.appendChild(l);
    }
    var lead = (new Date(y, m, 1).getDay() - first + 7) % 7, days = new Date(y, m + 1, 0).getDate();
    var isNow = y === now.getFullYear() && m === now.getMonth();
    for (var b = 0; b < lead; b++) grid.appendChild(document.createElement('span'));
    for (var n = 1; n <= days; n++) {
      (function (n) {
        var c = document.createElement('span');
        c.textContent = n;
        if (isNow && n === now.getDate()) c.className = 'today';
        c.addEventListener('mouseover', function () {
          if (!pointerActive) return;
          calHead = -1; calFocusDay = n; setZone('cal'); paintCal();
        });
        c.addEventListener('click', function () { calHead = -1; calFocusDay = n; setZone('cal'); paintCal(); });
        grid.appendChild(c);
        dayEls[n] = c;
      })(n);
    }
    calFocusDay = Math.max(1, Math.min(calFocusDay, days));
    paintCal();
  }

  function daysInView() { return new Date(calView.y, calView.m + 1, 0).getDate(); }
  function colOf(n) {
    var first = CFG.weekStartsOn === 1 ? 1 : 0;
    return ((new Date(calView.y, calView.m, 1).getDay() - first + 7) % 7 + n - 1) % 7;
  }

  function paintCal() {
    if (!calView) return;
    var on = zone === 'cal';
    dayEls.forEach(function (el, n) { if (el) el.classList.toggle('focus', on && calHead < 0 && n === calFocusDay); });
    $('calPrev').classList.toggle('focus', on && calHead === 0);
    $('calNext').classList.toggle('focus', on && calHead === 1);
    var now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var dateEl = $('calFootDate'), relEl = $('calFootRel');
    if (on && calHead < 0) {
      var d = new Date(calView.y, calView.m, calFocusDay), diff = Math.round((d - t0) / 86400000);
      dateEl.textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      relEl.textContent = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' :
        diff > 0 ? 'In ' + diff + ' days' : (-diff) + ' days ago';
    } else {
      dateEl.textContent = DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
      relEl.textContent = 'Today';
    }
  }

  function shiftMonth(delta) {
    var d = new Date(calView.y, calView.m + delta, 1);
    calView = { y: d.getFullYear(), m: d.getMonth() };
    buildCalendar();
  }

  function enterCal() {
    var now = new Date();
    calHead = -1;
    calFocusDay = (calView.y === now.getFullYear() && calView.m === now.getMonth()) ? now.getDate() : 1;
    setZone('cal');
    paintCal();
  }

  function calKey(k) {
    var days = daysInView();
    if (calHead >= 0) {   // header: previous / next month
      if (k === KEY.LEFT) { if (calHead === 0) setZone('list'); else { calHead = 0; paintCal(); } }
      else if (k === KEY.RIGHT) { calHead = 1; paintCal(); }
      else if (k === KEY.OK) shiftMonth(calHead === 0 ? -1 : 1);
      else if (k === KEY.DOWN) { calHead = -1; calFocusDay = 1; paintCal(); }
      else if (k === KEY.UP) { topFocus = 2; setZone('top'); }
      else if (k === KEY.BACK || k === KEY.ESC) setZone('list');
      else return false;
      return true;
    }
    var col = colOf(calFocusDay);
    if (k === KEY.LEFT) { if (col === 0) setZone('list'); else calFocusDay--; }
    else if (k === KEY.RIGHT) { if (col < 6 && calFocusDay < days) calFocusDay++; }
    else if (k === KEY.UP) { if (calFocusDay > 7) calFocusDay -= 7; else { calHead = 1; } }
    else if (k === KEY.DOWN) {
      if (calFocusDay + 7 <= days) calFocusDay += 7;
      else if (Math.floor((colOf(1) + calFocusDay - 1) / 7) < Math.floor((colOf(1) + days - 1) / 7)) calFocusDay = days;
    }
    else if (k === KEY.BACK || k === KEY.ESC) setZone('list');
    else if (k !== KEY.OK) return false;
    paintCal();
    return true;
  }
  $('calPrev').addEventListener('click', function () { calHead = 0; setZone('cal'); shiftMonth(-1); paintCal(); });
  $('calNext').addEventListener('click', function () { calHead = 1; setZone('cal'); shiftMonth(1); paintCal(); });

  var netLabel = 'Wi-Fi';
  function watchNetwork() {
    luna('luna://com.palm.connectionmanager/getStatus', { subscribe: true }, function (res) {
      if (res.returnValue === false && !res.wifi && !res.wired) return;
      if (res.wired && res.wired.state === 'connected') netLabel = 'Ethernet';
      else if (res.wifi && res.wifi.state === 'connected') netLabel = res.wifi.ssid || 'Connected';
      else netLabel = 'Not connected';
    });
  }

  // ---- menus (settings, Wi-Fi, inputs, app options) ------------------------------------------

  var menuEl = $('menu');
  var menu = null;          // {rows: [{spec, el}], statusEl, focus, token}
  var menuStack = [];       // specs of the menus we came from
  var menuReturn = 'list';
  var menuToken = 0;

  function paintMenu() {
    if (!menu) return;
    menu.rows.forEach(function (r, i) { r.el.classList.toggle('focused', i === menu.focus); });
  }
  function focusMenu(i) {
    if (!menu || !menu.rows.length) return;
    menu.focus = Math.max(0, Math.min(i, menu.rows.length - 1));
    paintMenu();
  }

  function makeRow(spec, index) {
    var el = document.createElement('div');
    el.className = 'mrow';
    var l = document.createElement('span');
    l.className = 'ml';
    l.textContent = spec.label;
    el.appendChild(l);
    if (spec.sub !== undefined && spec.sub !== '') {
      var s = document.createElement('span');
      s.className = 'ms';
      s.textContent = spec.sub;
      el.appendChild(s);
      spec.subEl = s;
    }
    el.addEventListener('mouseover', function () {
      if (!pointerActive) return;
      var i = menu.rows.findIndex(function (r) { return r.el === el; });
      if (i >= 0) focusMenu(i);
    });
    el.addEventListener('click', function () { activateMenuRow(spec); });
    return el;
  }

  /** spec = {status, rows: [{label, sub, action, keep}], center}; a row marked keep leaves the menu open. */
  function renderMenu(spec) {
    menuEl.innerHTML = '';
    menuEl.classList.toggle('center', !!spec.center);
    menu = { rows: [], statusEl: null, focus: 0, token: ++menuToken, spec: spec };
    if (spec.status) {
      var st = document.createElement('div');
      st.className = 'mstatus';
      st.textContent = spec.status;
      menuEl.appendChild(st);
      menu.statusEl = st;
    }
    spec.rows.forEach(function (rs) {
      if (rs.sep) { menuEl.appendChild(Object.assign(document.createElement('div'), { className: 'msep' })); return; }
      var el = makeRow(rs);
      menuEl.appendChild(el);
      menu.rows.push({ spec: rs, el: el });
    });
    paintMenu();
  }

  function openMenu(spec, returnTo) {
    menuStack = [];
    menuReturn = returnTo || zone;
    renderMenu(spec);
    menuEl.classList.remove('hidden');
    setZone('menu');
    focusMenu(0);
  }
  function pushMenu(spec) {
    menuStack.push(menu.spec);
    spec.rows.unshift({ label: '‹  Back', keep: true, action: popMenu }, { sep: true });
    renderMenu(spec);
    focusMenu(0);
  }
  function popMenu() {
    var prev = menuStack.pop();
    if (prev) { renderMenu(prev); focusMenu(0); } else closeMenu();
  }
  function closeMenu() {
    menuEl.classList.add('hidden');
    menu = null;
    menuToken++;
    menuStack = [];
    setZone(menuReturn);
    if (menuReturn === 'apps') paintApps();
  }
  function activateMenuRow(spec) {
    if (!spec.action) return;
    if (spec.keep) spec.action(); else { closeMenu(); spec.action(); }
  }
  /** Adds rows to the open menu at `at` (used when a network scan answers late). */
  function menuInsert(token, at, specs) {
    if (!menu || menu.token !== token) return;
    var refEl = menu.rows[at] ? menu.rows[at].el : null;
    specs.forEach(function (rs, k) {
      var el = makeRow(rs);
      menuEl.insertBefore(el, refEl);
      menu.rows.splice(at + k, 0, { spec: rs, el: el });
    });
    paintMenu();
  }

  function settingsMenu() {
    var hiddenRow = { label: 'Show hidden apps', sub: prefs.showHidden ? 'On' : 'Off', keep: true, action: function () {
      prefs.showHidden = !prefs.showHidden;
      appsDirty = true;
      savePrefs();
      hiddenRow.subEl.textContent = prefs.showHidden ? 'On' : 'Off';
    } };
    return {
      status: 'Network: ' + netLabel,
      rows: [
        { label: 'Wi-Fi', sub: netLabel, keep: true, action: wifiMenu },
        { label: 'Inputs', keep: true, action: inputsMenu },
        { label: 'TV settings', action: function () { openTvSettings(); } },
        { sep: true },
        hiddenRow,
        { label: 'Reset my layout', action: function () {
          prefs.fav = null; prefs.hidden = []; prefs.shown = []; appsDirty = true;
          savePrefs(); favFocus = 0; buildFavs(); toast('Layout reset');
        } }
      ]
    };
  }

  function inputsMenu() {
    var rows = inputs.map(function (inp) { return { label: inp.label, action: function () { launch(inp.appId, inp.label); } }; });
    if (CFG.liveTvApp) rows.push({ label: 'Live TV', action: function () { launch(CFG.liveTvApp, 'Live TV'); } });
    if (!rows.length) rows.push({ label: 'No inputs found', keep: true, action: function () {} });
    pushMenu({ rows: rows });
  }

  function bars(n) { return ['', '▂', '▂▄', '▂▄▆', '▂▄▆█'][Math.max(0, Math.min(4, n | 0))]; }

  function wifiMenu() {
    pushMenu({
      status: 'Checking connection…',
      rows: [{ sep: true }, { label: 'Network settings', action: function () { openTvSettings('network'); } }]
    });
    var token = menu.token;

    luna('luna://com.palm.connectionmanager/getStatus', {}, function (res) {
      if (!menu || menu.token !== token || !menu.statusEl) return;
      var w = res.wifi || {}, t;
      if (res.wired && res.wired.state === 'connected') t = 'Ethernet connected' + (res.wired.ipAddress ? '  ·  ' + res.wired.ipAddress : '');
      else if (w.state === 'connected') t = 'Connected to ' + (w.ssid || 'Wi-Fi') + (w.ipAddress ? '  ·  ' + w.ipAddress : '');
      else t = 'Not connected';
      if (res.isInternetConnectionAvailable === false && t !== 'Not connected') t += '  ·  no internet';
      menu.statusEl.textContent = t;
    });

    luna('luna://com.webos.service.wifi/findnetworks', {}, function (res) {
      if (!menu || menu.token !== token) return;
      var found = res.foundNetworks;
      if (res.returnValue === false || !found) {
        var note = document.createElement('div');
        note.className = 'mstatus dim';
        note.textContent = 'Nearby networks are not available to apps on this TV';
        menuEl.insertBefore(note, menu.rows[1] ? menu.rows[1].el : null);
        return;
      }
      var seen = {}, nets = [];
      found.forEach(function (n) {
        var ni = n.networkInfo || n;
        if (!ni.ssid || seen[ni.ssid]) return;
        seen[ni.ssid] = 1;
        nets.push(ni);
      });
      nets.sort(function (a, b) { return (b.signalBars || 0) - (a.signalBars || 0); });
      menuInsert(token, 1, nets.slice(0, 8).map(function (ni) {
        var secured = ni.availableSecurityTypes && ni.availableSecurityTypes.length;
        return {
          label: ni.ssid,
          sub: bars(ni.signalBars) + (secured ? '  🔒' : '') + (ni.connectState === 'connected' ? '  ✓' : ''),
          action: function () { joinNetwork(ni.ssid); }
        };
      }));
    });
  }

  /** Saved networks connect straight away; anything needing a password is handed to the TV's own screen. */
  function joinNetwork(ssid) {
    toast('Connecting to ' + ssid + '…');
    luna('luna://com.webos.service.wifi/connect', { ssid: ssid }, function (res) {
      if (res.returnValue === false) { toast('Needs a password: opening network settings'); setTimeout(function () { openTvSettings('network'); }, 800); }
    });
  }

  // ---- all apps ------------------------------------------------------------------------------

  var appList = [], appFocus = 0, appEls = [], appsDirty = true, ringShown = false;
  var ring = document.createElement('div');
  ring.id = 'appsFocus';

  function buildApps() {
    var grid = $('appsGrid');
    appsDirty = false;
    grid.innerHTML = '';
    grid.appendChild(ring);
    appEls = [];
    var favs = favIds();
    appList = allApps.filter(function (a) { return prefs.showHidden || !isHidden(a.id); })
      .sort(function (a, b) { return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; });
    appList.forEach(function (app, i) {
      var t = document.createElement('div');
      t.className = 'atile' + (isHidden(app.id) ? ' isHidden' : '');
      var im = document.createElement('img');
      im.src = app.icon;
      var nm = document.createElement('div');
      nm.className = 'aname';
      nm.textContent = titleOf(app);
      t.appendChild(im);
      t.appendChild(nm);
      if (favs.indexOf(app.id) >= 0) {
        var pin = document.createElement('span');
        pin.className = 'pinbadge';
        pin.textContent = '\u2605';
        t.appendChild(pin);
      }
      t.addEventListener('mouseover', function () { if (pointerActive && zone === 'apps') focusApp(i); });
      t.addEventListener('click', function () { launch(app.id, app.title); });
      grid.appendChild(t);
      appEls.push(t);
    });
    appFocus = Math.min(appFocus, Math.max(0, appList.length - 1));
    paintApps();
  }

  function paintApps() {
    var on = zone === 'apps' && appEls[appFocus];
    var row = Math.floor(appFocus / COLS), totalRows = Math.ceil(appList.length / COLS);
    var shift = Math.max(0, Math.min(row - 1, totalRows - APP_ROWS));
    appEls.forEach(function (el, i) {
      var r = Math.floor(i / COLS);
      el.classList.toggle('focused', !!on && i === appFocus);
      el.classList.toggle('gone', r < shift);                  // scrolled off the top
      el.classList.toggle('peek', r === shift + APP_ROWS);     // hint of the next row, faded
    });
    $('appsGrid').style.transform = 'translate3d(0,' + (-shift * TILE_H) + 'px,0)';
    if (!on) { ring.classList.remove('on'); return; }
    var t = appEls[appFocus];
    if (!ringShown) ring.classList.add('snap');   // first placement jumps, later ones glide
    ring.style.transform = 'translate3d(' + (t.offsetLeft - 6) + 'px,' + (t.offsetTop - 6) + 'px,0)';
    ring.classList.add('on');
    if (!ringShown) { void ring.offsetWidth; ring.classList.remove('snap'); ringShown = true; }
  }
  function focusApp(i) {
    appFocus = Math.max(0, Math.min(i, appList.length - 1));
    paintApps();
  }

  function openApps() {
    if (appsDirty) buildApps();
    ringShown = false;
    $('apps').classList.remove('hidden');
    setZone('apps');
    paintApps();
  }
  function closeApps() {
    $('apps').classList.add('hidden');
    setZone('top');
  }

  function appOptions() {
    var app = appList[appFocus];
    if (!app) return;
    var favs = favIds(), pos = favs.indexOf(app.id), hidden = isHidden(app.id);
    function setFavs(list) { prefs.fav = list; savePrefs(); buildFavs(); buildApps(); }
    var rows = [];
    if (pos >= 0) {
      rows.push({ label: 'Remove from home', action: function () { favs.splice(pos, 1); setFavs(favs); } });
      if (pos > 0) rows.push({ label: 'Move up on home', action: function () { favs.splice(pos - 1, 0, favs.splice(pos, 1)[0]); setFavs(favs); } });
      if (pos < favs.length - 1) rows.push({ label: 'Move down on home', action: function () { favs.splice(pos + 1, 0, favs.splice(pos, 1)[0]); setFavs(favs); } });
    } else if (!hidden) {
      rows.push({ label: 'Add to home', action: function () {
        if (favs.length >= MAX_FAVS) { toast('Home holds ' + MAX_FAVS + ' apps: remove one first'); return; }
        favs.push(app.id); setFavs(favs);
      } });
    }
    if (hidden) {
      rows.push({ label: 'Unhide app', action: function () {
        prefs.hidden = prefs.hidden.filter(function (x) { return x !== app.id; });
        if (cfgHidden.indexOf(app.id) >= 0 && prefs.shown.indexOf(app.id) < 0) prefs.shown.push(app.id);
        savePrefs(); buildFavs(); buildApps();
      } });
    } else {
      rows.push({ label: 'Hide app', action: function () {
        prefs.shown = prefs.shown.filter(function (x) { return x !== app.id; });
        if (prefs.hidden.indexOf(app.id) < 0) prefs.hidden.push(app.id);
        if (pos >= 0) { favs.splice(pos, 1); prefs.fav = favs; }
        savePrefs(); buildFavs(); buildApps();
      } });
    }
    rows.push({ label: 'Cancel', action: function () {} });
    openMenu({ status: app.title, rows: rows, center: true }, 'apps');
  }

  // ---- wallpaper picker ----------------------------------------------------------------------

  var wallFocus = 0, wallBefore = 0, thumbEls = [];

  function buildWall() {
    var box = $('wallThumbs');
    box.innerHTML = '';
    thumbEls = wallpapers.map(function (w, i) {
      var t = document.createElement('div');
      t.className = 'wthumb' + (i === wpIndex ? ' current' : '');
      t.style.backgroundImage = cssUrl(w.thumb);
      t.addEventListener('mouseover', function () { if (pointerActive && zone === 'wall') previewWall(i); });
      t.addEventListener('click', function () { previewWall(i); chooseWall(); });
      box.appendChild(t);
      return t;
    });
  }
  function previewWall(i) {
    wallFocus = Math.max(0, Math.min(i, wallpapers.length - 1));
    thumbEls.forEach(function (t, k) { t.classList.toggle('focused', k === wallFocus); });
    $('wallName').textContent = wallpapers[wallFocus].name;
    showWallpaper(wallFocus);
  }
  function openWall() {
    wallBefore = wpIndex;
    buildWall();
    $('wallPicker').classList.remove('hidden');
    setZone('wall');
    previewWall(wpIndex);
  }
  function chooseWall() {
    wpIndex = wallFocus;
    prefs.wp = wallpapers[wpIndex].id;
    savePrefs();
    $('wallPicker').classList.add('hidden');
    setZone('top');
  }
  function cancelWall() {
    if (wallFocus !== wallBefore) { wpIndex = wallBefore; showWallpaper(wpIndex); }
    $('wallPicker').classList.add('hidden');
    setZone('top');
  }

  // ---- idle screen ---------------------------------------------------------------------------

  var idleTimer = null, ambTimer = null, ambSpot = 0;
  var SPOTS = [[160, 300], [240, 180], [140, 520], [300, 420], [200, 140]];   // [px from right edge, px from top]: moves every minute, no burn-in

  var lastBump = 0;
  function bump(force) {
    var now = Date.now();
    if (!force && now - lastBump < 400) return;   // plenty precise for a 90 second timer
    lastBump = now;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(goIdle, IDLE_MS);
  }
  function goIdle() {
    if (menu) closeMenu();
    $('apps').classList.add('hidden');
    $('wallPicker').classList.add('hidden');
    updateClock();
    placeAmbient();
    $('ambient').classList.remove('hidden');
    setZone('ambient');
    clearInterval(ambTimer);
    ambTimer = setInterval(function () { ambSpot = (ambSpot + 1) % SPOTS.length; updateClock(); placeAmbient(); }, 60000);
  }
  function placeAmbient() {
    var p = SPOTS[ambSpot];
    $('ambClock').style.right = p[0] + 'px';
    $('ambClock').style.top = p[1] + 'px';
    $('ambDate').style.right = (p[0] + 8) + 'px';
    $('ambDate').style.top = (p[1] + 260) + 'px';
  }
  function wake() {
    clearInterval(ambTimer);
    $('ambient').classList.add('hidden');
    setZone('list');
    bump(true);
  }

  // ---- keys ----------------------------------------------------------------------------------

  var okDown = false, okTimer = null;

  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== KEY.OK) return;
    okDown = false;
    if (!okTimer) return;
    clearTimeout(okTimer);
    okTimer = null;
    if (zone === 'apps' && appList[appFocus]) launch(appList[appFocus].id, appList[appFocus].title);
  });

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (zone === 'ambient') { wake(); e.preventDefault(); return; }   // first key only wakes the screen
    bump();
    pointerActive = false;
    if (k === KEY.OK && okDown) { e.preventDefault(); return; }       // key repeat while held
    if (k === KEY.OK) okDown = true;

    if (zone === 'menu') {
      if (k === KEY.UP) focusMenu(menu.focus - 1);
      else if (k === KEY.DOWN) focusMenu(menu.focus + 1);
      else if (k === KEY.OK) { if (menu.rows[menu.focus]) activateMenuRow(menu.rows[menu.focus].spec); }
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.LEFT) { if (menuStack.length) popMenu(); else closeMenu(); }
      else if (k === KEY.RIGHT) { /* stay */ }
      else return;
    } else if (zone === 'wall') {
      if (k === KEY.LEFT) previewWall(wallFocus - 1);
      else if (k === KEY.RIGHT) previewWall(wallFocus + 1);
      else if (k === KEY.OK) chooseWall();
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.UP || k === KEY.DOWN) cancelWall();
      else return;
    } else if (zone === 'apps') {
      var col = appFocus % COLS, last = appList.length - 1;
      if (k === KEY.LEFT) { if (col > 0) focusApp(appFocus - 1); }
      else if (k === KEY.RIGHT) { if (col < COLS - 1 && appFocus < last) focusApp(appFocus + 1); }
      else if (k === KEY.UP) { if (appFocus >= COLS) focusApp(appFocus - COLS); else closeApps(); }
      else if (k === KEY.DOWN) { if (appFocus + COLS <= last) focusApp(appFocus + COLS); else if (Math.floor(appFocus / COLS) < Math.floor(last / COLS)) focusApp(last); }
      else if (k === KEY.OK) okTimer = setTimeout(function () { okTimer = null; appOptions(); }, LONG_PRESS_MS);
      else if (k === KEY.BACK || k === KEY.ESC) closeApps();
      else return;
    } else if (zone === 'cal') {
      if (!calKey(k)) return;
    } else if (zone === 'top') {
      if (k === KEY.LEFT) { if (topFocus === 0) setZone('list'); else { topFocus--; paintTop(); } }
      else if (k === KEY.RIGHT) { topFocus = Math.min(tis.length - 1, topFocus + 1); paintTop(); }
      else if (k === KEY.DOWN) enterCal();
      else if (k === KEY.OK) activateTop(topFocus);
      else if (k === KEY.BACK) { setZone('list'); }
      else return;
    } else {   // list
      if (k === KEY.DOWN) focusFav(favFocus + 1);
      else if (k === KEY.UP) { if (favFocus > 0) focusFav(favFocus - 1); else setZone('top'); }
      else if (k === KEY.RIGHT) enterCal();
      else if (k === KEY.OK) { var app = byId[favIds()[favFocus]]; if (app) launch(app.id, app.title); }
      else if (k === KEY.BACK || k === KEY.LEFT || k === KEY.ESC) { /* home screen: nothing behind it */ }
      else return;
    }
    e.preventDefault();
  });

  function activateTop(i) {
    if (i === 0) openWall();
    else if (i === 1) openApps();
    else openMenu(settingsMenu(), 'top');
  }
  tis.forEach(function (el, i) {
    el.addEventListener('mouseover', function () { if (pointerActive && (zone === 'top' || zone === 'list')) { topFocus = i; setZone('top'); } });
    el.addEventListener('click', function () { topFocus = i; activateTop(i); });
  });
  document.addEventListener('mousemove', function (e) {
    if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 4) pointerActive = true;
    lastX = e.clientX; lastY = e.clientY;
    if (!pointerActive) return;
    if (zone === 'ambient') wake(); else bump();
  });

  // ---- lifecycle -----------------------------------------------------------------------------

  /** Back from another app, or opened again from the shortcut: replay the entrance on the favourites. */
  function resume() {
    okDown = false;
    clearTimeout(okTimer);
    okTimer = null;
    if (menu) closeMenu();
    $('apps').classList.add('hidden');
    $('wallPicker').classList.add('hidden');
    clearInterval(ambTimer);
    $('ambient').classList.add('hidden');
    calDayKey = '';
    updateClock();
    buildFavs();
    setZone('list');
    document.body.classList.remove('enter');
    void document.body.offsetWidth;
    document.body.classList.add('enter');
    bump();
  }
  document.addEventListener('webOSRelaunch', resume);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resume(); });

  // ---- start ---------------------------------------------------------------------------------

  wpIndex = wpById(prefs.wp || CFG.defaultWallpaper || '');
  showWallpaper(wpIndex);
  buildFavs();
  updateClock();
  setInterval(updateClock, 10000);
  watchNetwork();
  document.body.classList.add('enter');
  setZone('list');
  bump();
})();

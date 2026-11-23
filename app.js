/* Meu Treino. Usa EX e DAYS definidos em data.js. Os registros ficam no localStorage do aparelho. */
(function () {
  "use strict";
  var KEY = "meutreino:v1";
  var SKEY = "meutreino:session";
  var JS_DAY_TO_ID = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  var DEFAULTS = { rest: 120, wake: true, lock: true };

  /* ---------- utilidades ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmt(iso) { var p = String(iso).split("-"); return p[2] + "/" + p[1]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(s) { var m = String(s || "").replace(",", ".").match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
  function setsOf(str) { return parseInt(str, 10) || 0; }
  function topReps(str) { var m = /x(\d+)(?:-(\d+))?/.exec(str); return m ? parseInt(m[2] || m[1], 10) : 0; }
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
  }
  function $(id) { return document.getElementById(id); }

  /* ---------- estado ---------- */
  function persist(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function seed() {
    var s = { logs: {}, sessions: [], settings: {} };
    DAYS.forEach(function (day) {
      day.items.forEach(function (it) {
        if (it[2]) {
          s.logs[day.id + ":" + it[0]] = [{ d: "2026-11-23", w: it[2].w, r: it[2].r || "", n: it[2].n || "" }];
        }
      });
    });
    persist(s);
    return s;
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.logs && typeof s.logs === "object") return s;
    } catch (e) {}
    return seed();
  }
  var state = load();
  function fixState() {
    state.sessions = Array.isArray(state.sessions) ? state.sessions : [];
    state.settings = Object.assign({}, DEFAULTS, state.settings || {});
  }
  fixState();
  var current;

  function entries(key) { return state.logs[key] || []; }
  function todayEntry(key) { var t = todayISO(), a = entries(key); for (var i = 0; i < a.length; i++) if (a[i].d === t) return a[i]; return null; }
  function prevEntry(key) { var t = todayISO(), a = entries(key); for (var i = a.length - 1; i >= 0; i--) if (a[i].d !== t) return a[i]; return null; }
  function findDay(id) { return DAYS.filter(function (x) { return x.id === id; })[0]; }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------- sessão de treino (cronômetro + descanso) ---------- */
  var sess = (function () {
    try { var s = JSON.parse(localStorage.getItem(SKEY)); if (s && s.startedAt) return s; } catch (e) {}
    return null;
  })();
  function saveSess() {
    try { if (sess) localStorage.setItem(SKEY, JSON.stringify(sess)); else localStorage.removeItem(SKEY); } catch (e) {}
  }

  var ticker = null, keep = null, wl = null, ac = null;

  function ensureAudio() {
    try {
      if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
      if (ac && ac.state === "suspended") ac.resume();
    } catch (e) {}
  }
  function beep() {
    if (!ac) return;
    try {
      [0, 0.35, 0.7].forEach(function (t) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 880; g.gain.value = 0.2;
        o.connect(g); g.connect(ac.destination);
        var s = ac.currentTime + t;
        o.start(s); o.stop(s + 0.2);
      });
    } catch (e) {}
  }

  /* Áudio silencioso em loop: mantém a página ativa com a tela apagada e mostra o timer na tela de bloqueio. */
  function silentWav() {
    var rate = 8000, n = rate * 10, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    function ws(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    ws(0, "RIFF"); v.setUint32(4, 36 + n, true); ws(8, "WAVE"); ws(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    ws(36, "data"); v.setUint32(40, n, true);
    for (var i = 0; i < n; i++) v.setUint8(44 + i, i % 4000 === 0 ? 129 : 128);
    return new Blob([buf], { type: "audio/wav" });
  }
  function startKeepAlive() {
    if (!state.settings.lock || keep) return;
    try {
      keep = new Audio(URL.createObjectURL(silentWav()));
      keep.loop = true;
      var p = keep.play();
      if (p && p.catch) p.catch(function () { keep = null; });
      if ("mediaSession" in navigator) {
        var hook = function (a, fn) {
          try {
            navigator.mediaSession.setActionHandler(a, function () {
              if (keep) { var q = keep.play(); if (q && q.catch) q.catch(function () {}); }
              fn();
            });
          } catch (e) {}
        };
        /* Botões da notificação: pausar/retomar o treino, concluir a próxima série, desfazer a última. */
        hook("pause", pauseSession);
        hook("play", resumeSession);
        hook("nexttrack", completeNextSet);
        hook("previoustrack", undoLastSet);
      }
    } catch (e) { keep = null; }
  }
  function stopKeepAlive() {
    try { if (keep) keep.pause(); } catch (e) {}
    keep = null;
    try { if ("mediaSession" in navigator) navigator.mediaSession.metadata = null; } catch (e) {}
  }
  function acquireWake() {
    if (!sess || !state.settings.wake || wl || !("wakeLock" in navigator)) return;
    try {
      navigator.wakeLock.request("screen").then(function (l) {
        wl = l;
        l.addEventListener("release", function () { wl = null; });
      }).catch(function () {});
    } catch (e) {}
  }
  function releaseWake() { try { if (wl) wl.release(); } catch (e) {} wl = null; }

  function requestNotif() {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        var p = Notification.requestPermission();
        if (p && p.then) p.then(renderSettings);
      }
    } catch (e) {}
  }
  function notify(title, body) {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      var opts = { body: body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "rest", renotify: true, vibrate: [300, 120, 300] };
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification(title, opts); }).catch(function () {});
      } else {
        new Notification(title, opts);
      }
    } catch (e) {}
  }
  function closeNotifs() {
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then(function (reg) {
          return reg.getNotifications({ tag: "rest" }).then(function (list) { list.forEach(function (n) { n.close(); }); });
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function alertRest(sec) {
    try { if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]); } catch (e) {}
    beep();
    toast("Descanso completo (" + clock(sec) + ")");
    notify("Descanso completo", "Passaram " + clock(state.settings.rest) + ". Hora da próxima série.");
  }

  function nextPending() {
    var d = findDay(sess.dayId);
    for (var i = 0; i < d.items.length; i++) {
      var it = d.items[i], key = d.id + ":" + it[0], total = setsOf(it[1]), n = sess.sets[key] || 0;
      if (n < total) return { key: key, name: EX[it[0]].n, n: n, total: total };
    }
    return null;
  }

  function updateMedia(el, rest) {
    if (!state.settings.lock || !keep || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    var target = state.settings.rest, paused = !!sess.pausedAt;
    var title = paused ? "Treino pausado" : rest == null ? "Treino em andamento" : (rest >= target ? "Descanso completo " : "Descanso ") + clock(rest) + " / " + clock(target);
    try {
      var d = findDay(sess.dayId), p = nextPending();
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: "Treino " + clock(el),
        album: (d ? d.title.split("·")[1].trim() : "Meu Treino") + (p ? " · " + p.name + " (série " + (p.n + 1) + "/" + p.total + ")" : " · todas as séries feitas"),
        artwork: [
          { src: new URL("icons/icon-192.png", location.href).href, sizes: "192x192", type: "image/png" },
          { src: new URL("icons/icon-512.png", location.href).href, sizes: "512x512", type: "image/png" }
        ]
      });
      navigator.mediaSession.playbackState = paused ? "paused" : "playing";
      if (navigator.mediaSession.setPositionState) {
        if (rest != null && !paused) navigator.mediaSession.setPositionState({ duration: target, position: Math.min(rest, target), playbackRate: 1 });
        else navigator.mediaSession.setPositionState();
      }
    } catch (e) {}
  }

  function pauseSession() {
    if (!sess || sess.pausedAt) return;
    sess.pausedAt = Date.now();
    saveSess();
    tick();
  }
  function resumeSession() {
    if (!sess || !sess.pausedAt) return;
    var gap = Date.now() - sess.pausedAt;
    sess.startedAt += gap;
    if (sess.restStart) sess.restStart += gap;
    sess.pausedAt = null;
    saveSess();
    tick();
  }
  function refreshSetRows() {
    if (!sess) return;
    var day = findDay(current);
    if (!day || day.id !== sess.dayId) return;
    Array.prototype.forEach.call(document.querySelectorAll("#day .ex"), function (card) {
      var key = card.getAttribute("data-key");
      var it = day.items.filter(function (x) { return day.id + ":" + x[0] === key; })[0];
      if (it) card.querySelector(".sets-row").innerHTML = setsRow(day, it);
    });
  }
  function completeNextSet() {
    if (!sess || sess.pausedAt) return;
    var p = nextPending();
    if (!p) { toast("Todas as séries já foram marcadas"); return; }
    sess.sets[p.key] = p.n + 1;
    sess.order = sess.order || [];
    sess.order.push(p.key);
    sess.restStart = Date.now();
    sess.restAlerted = false;
    saveSess();
    refreshSetRows();
    tick();
  }
  function undoLastSet() {
    if (!sess || !sess.order || !sess.order.length) return;
    var k = sess.order.pop();
    sess.sets[k] = Math.max(0, (sess.sets[k] || 1) - 1);
    saveSess();
    refreshSetRows();
    tick();
  }

  function renderBar(el, rest) {
    var bar = $("bar");
    if (!sess) { bar.hidden = true; document.body.classList.remove("has-bar"); return; }
    var target = state.settings.rest, d = findDay(sess.dayId);
    bar.hidden = false;
    document.body.classList.add("has-bar");
    bar.className = "bar " + (d ? d.c : "");
    $("bar-day").textContent = d ? d.title.split("·")[1].trim() : "";
    $("bar-el").textContent = clock(el);
    $("bar-rest").textContent = rest == null ? "--:--" : clock(rest);
    $("bar-target").textContent = rest == null ? "Marque uma série para começar" : "meta " + clock(target);
    $("prog").style.width = (rest == null ? 0 : Math.min(100, rest / target * 100)) + "%";
    bar.classList.toggle("ready", rest != null && rest >= target && !sess.pausedAt);
    bar.classList.toggle("paused", !!sess.pausedAt);
    $("bar-pause").textContent = sess.pausedAt ? "Retomar" : "Pausar";
    if (sess.pausedAt) $("bar-target").textContent = "treino pausado";
    $("bar-reset").hidden = rest == null;
  }

  function tick() {
    if (!sess) return;
    var now = sess.pausedAt || Date.now();
    var el = (now - sess.startedAt) / 1000;
    var rest = sess.restStart ? (now - sess.restStart) / 1000 : null;
    if (rest != null && !sess.restAlerted && !sess.pausedAt && rest >= state.settings.rest) {
      sess.restAlerted = true;
      saveSess();
      alertRest(Math.floor(rest));
    }
    renderBar(el, rest);
    updateMedia(el, rest);
  }
  function startTicker() {
    if (ticker) return;
    ticker = setInterval(tick, 1000);
  }
  function stopTicker() { clearInterval(ticker); ticker = null; }

  function startSession(dayId) {
    sess = { startedAt: Date.now(), dayId: dayId, sets: {}, order: [], pausedAt: null, restStart: null, restAlerted: false };
    saveSess();
    ensureAudio();
    requestNotif();
    startKeepAlive();
    acquireWake();
    startTicker();
    tick();
    renderDay();
  }

  function endSession() {
    if (!sess) return;
    if (!confirm("Finalizar o treino?")) return;
    var secs = Math.floor((Date.now() - sess.startedAt) / 1000), sets = 0;
    Object.keys(sess.sets).forEach(function (k) { sets += sess.sets[k]; });
    state.sessions.push({ d: todayISO(), day: sess.dayId, secs: secs, sets: sets });
    persist(state);
    sess = null;
    saveSess();
    stopTicker();
    stopKeepAlive();
    releaseWake();
    closeNotifs();
    renderBar();
    renderDay();
    toast("Treino finalizado em " + clock(secs));
  }

  function setsRow(day, it) {
    var key = day.id + ":" + it[0], total = setsOf(it[1]);
    var n = (sess && sess.dayId === day.id && sess.sets[key]) || 0;
    var h = '<span class="sets-label">Séries</span>';
    for (var i = 0; i < total; i++) {
      h += '<button class="set' + (i < n ? " done" : "") + '" data-set="' + key + '" data-i="' + i + '" aria-pressed="' + (i < n) +
        '" aria-label="Série ' + (i + 1) + '">' + (i < n ? "✓" : (i + 1)) + "</button>";
    }
    return h;
  }

  function tapSet(btn) {
    var key = btn.getAttribute("data-set"), i = parseInt(btn.getAttribute("data-i"), 10);
    var day = findDay(current), it = day.items.filter(function (x) { return day.id + ":" + x[0] === key; })[0];
    if (!sess) startSession(day.id);
    else if (sess.dayId !== day.id) { toast("Finalize o treino de " + findDay(sess.dayId).d + " antes"); return; }
    if (sess.pausedAt) { toast("Treino pausado. Toque em Retomar"); return; }
    var n = sess.sets[key] || 0;
    sess.order = sess.order || [];
    if (i === n) {
      sess.sets[key] = n + 1;
      sess.order.push(key);
      sess.restStart = Date.now();
      sess.restAlerted = false;
      ensureAudio();
    } else if (i === n - 1) {
      sess.sets[key] = n - 1;
      var idx = sess.order.lastIndexOf(key);
      if (idx >= 0) sess.order.splice(idx, 1);
    } else {
      return;
    }
    saveSess();
    var row = btn.closest(".sets-row");
    row.innerHTML = setsRow(day, it);
    tick();
  }

  /* ---------- treino ---------- */
  function renderWeek() {
    var html = "";
    DAYS.forEach(function (day) {
      html += '<button class="day-tab ' + day.c + '" role="tab" data-id="' + day.id + '" aria-selected="' + (day.id === current) + '">' +
        '<span class="d">' + day.d + '</span><span class="t">' + day.t + '</span><span class="l">' + day.l + '</span></button>';
    });
    $("week").innerHTML = html;
  }

  function exHTML(day, it) {
    var ex = EX[it[0]], key = day.id + ":" + it[0];
    var te = todayEntry(key), pe = prevEntry(key), topR = topReps(it[1]);
    var steps = ex.s.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    var h = '<article class="ex" data-key="' + key + '" data-done="' + (!!te) + '">';
    h += '<div class="ex-top"><div class="ex-main"><div class="ex-name">' + esc(ex.n) + (te ? '<span class="badge">Salvo hoje</span>' : "") +
      '</div><div class="ex-muscle">' + esc(ex.m) + '</div></div><div class="ex-sets">' + esc(it[1]) + '</div></div>';
    h += '<div class="sets-row">' + setsRow(day, it) + "</div>";
    h += '<div class="log">';
    if (pe) {
      h += '<div class="last">Última vez (' + fmt(pe.d) + "): " + esc(pe.w) + (pe.r ? " · " + esc(pe.r) : "") + (pe.n ? " · " + esc(pe.n) : "") + "</div>";
      if (topR && num(pe.r) >= topR) h += '<div class="goal">Você chegou a ' + topR + " reps. Tente subir a carga hoje.</div>";
      else if (topR) h += '<div class="goal">Meta: ' + topR + " reps em todas as séries. Ao conseguir, suba a carga.</div>";
    }
    var w = te ? te.w : (pe ? pe.w : "");
    var r = te ? te.r : "";
    var drop = te ? /drop/i.test(te.n || "") : false;
    h += '<div class="log-in">' +
      '<label>Carga <input type="text" data-f="w" value="' + esc(w) + '" placeholder="kg ou placas" autocomplete="off"></label>' +
      '<label>Reps <input type="text" inputmode="numeric" data-f="r" value="' + esc(r) + '" placeholder="' + esc(pe && pe.r ? pe.r : "reps") + '" autocomplete="off"></label>' +
      '<label><input type="checkbox" data-f="n"' + (drop ? " checked" : "") + '> Drop na última</label>' +
      '<button class="btn primary small" data-save="' + key + '">' + (te ? "Atualizar" : "Salvar") + "</button>" +
      "</div></div>";
    h += '<details><summary>Como executar</summary><div class="guide">' +
      '<div><h3>Passo a passo</h3><ol>' + steps + "</ol></div>" +
      '<div><h3>Exemplo</h3><p class="example">' + esc(ex.e) + "</p></div>" +
      '<div><h3>Erro comum</h3><p class="mistake">' + esc(ex.x) + "</p></div>" +
      "</div></details></article>";
    return h;
  }

  function doneCount(day) {
    var c = 0;
    day.items.forEach(function (it) { if (todayEntry(day.id + ":" + it[0])) c++; });
    return c;
  }
  function updateChip(day) {
    var el = $("chip-done");
    if (el) el.textContent = doneCount(day) + "/" + day.items.length + " salvos hoje";
  }

  function renderDay() {
    var day = findDay(current), el = $("day");
    if (!day.items.length) {
      el.innerHTML = '<div class="' + day.c + '"><div class="day-head"><div><h2>' + day.title + '</h2></div></div>' +
        '<p class="note" style="margin-top:12px">Sem treino de força. Se quiser, faça uma caminhada leve de 20 a 30 minutos. Segunda começa o ciclo de novo com o Push A.</p></div>';
      return;
    }
    var total = 0;
    day.items.forEach(function (it) { total += setsOf(it[1]); });
    var html = '<div class="' + day.c + '">' +
      '<div class="day-head"><div><h2>' + day.title + '</h2><div class="sub">' + day.sub + "</div></div>" +
      '<div class="chips"><span class="chip">' + total + ' séries</span><span class="chip">~' + Math.round(total * 3.2) + ' min</span>' +
      '<span class="chip on" id="chip-done"></span></div></div>';
    if (!sess) html += '<div style="margin-top:12px"><button class="btn primary" id="start">Iniciar treino</button></div>';
    html += '<div class="list">';
    day.items.forEach(function (it) { html += exHTML(day, it); });
    html += "</div></div>";
    el.innerHTML = html;
    updateChip(day);
  }

  function selectDay(id) {
    current = id;
    renderWeek();
    renderDay();
  }

  function saveEntry(card, key) {
    var w = card.querySelector('[data-f="w"]').value.trim();
    var r = card.querySelector('[data-f="r"]').value.trim();
    var drop = card.querySelector('[data-f="n"]').checked;
    if (!w && !r) { toast("Preencha a carga e as reps"); return; }
    var list = state.logs[key] || [];
    var t = todayISO(), entry = { d: t, w: w, r: r, n: drop ? "drop na última" : "" }, found = false;
    for (var i = 0; i < list.length; i++) if (list[i].d === t) { list[i] = entry; found = true; }
    if (!found) list.push(entry);
    list.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    state.logs[key] = list;
    persist(state);
    var day = findDay(current), it = day.items.filter(function (x) { return day.id + ":" + x[0] === key; })[0];
    var wasOpen = card.querySelector("details").open;
    var tmp = document.createElement("div");
    tmp.innerHTML = exHTML(day, it);
    var fresh = tmp.firstChild;
    fresh.querySelector("details").open = wasOpen;
    card.parentNode.replaceChild(fresh, card);
    updateChip(day);
    toast("Salvo");
  }

  /* ---------- histórico ---------- */
  function spark(list) {
    var v = list.map(function (e) { return num(e.w); }).filter(function (x) { return !isNaN(x); });
    if (v.length < 2) return "";
    var W = 84, H = 28, min = Math.min.apply(null, v), max = Math.max.apply(null, v), span = max - min || 1;
    var pts = v.map(function (y, i) { return (2 + i * (W - 4) / (v.length - 1)).toFixed(1) + "," + (H - 3 - (y - min) / span * (H - 6)).toFixed(1); });
    var last = pts[pts.length - 1].split(",");
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Evolução da carga">' +
      '<polyline points="' + pts.join(" ") + '" fill="none" style="stroke:var(--c)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" style="fill:var(--c)"/></svg>';
  }

  function renderHist() {
    var html = "";
    if (state.sessions.length) {
      html += '<h2 class="sec">Treinos concluídos</h2><div class="slot"><table><thead><tr><th>Data</th><th>Treino</th><th>Duração</th><th>Séries</th></tr></thead><tbody>';
      state.sessions.slice(-20).reverse().forEach(function (s) {
        var d = findDay(s.day);
        html += "<tr><td>" + fmt(s.d) + "</td><td>" + esc(d ? d.title.split("·")[1].trim() : s.day) + "</td><td>" + clock(s.secs) + "</td><td>" + (s.sets || 0) + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }
    DAYS.forEach(function (day) {
      if (!day.items.length) return;
      html += '<div class="hist-group ' + day.c + '"><h2>' + day.title + "</h2>";
      day.items.forEach(function (it) {
        var key = day.id + ":" + it[0], list = entries(key), ex = EX[it[0]];
        var last = list.length ? list[list.length - 1] : null;
        html += '<details class="slot"><summary><span class="nm">' + esc(ex.n) +
          '<span class="meta">' + (last ? fmt(last.d) + ": " + esc(last.w) + (last.r ? " · " + esc(last.r) : "") : "Sem registros ainda") + "</span></span>" + spark(list) + "</summary>";
        if (list.length) {
          html += "<table><thead><tr><th>Data</th><th>Carga</th><th>Reps</th><th>Obs.</th></tr></thead><tbody>";
          list.slice().reverse().forEach(function (e) {
            html += "<tr><td>" + fmt(e.d) + "</td><td>" + esc(e.w) + "</td><td>" + esc(e.r) + "</td><td>" + esc(e.n) + "</td></tr>";
          });
          html += "</tbody></table>";
        } else {
          html += '<div class="empty">Salve a carga na aba Treino para ver a evolução aqui.</div>';
        }
        html += "</details>";
      });
      html += "</div>";
    });
    $("hist-body").innerHTML = html;
  }

  function showView(v) {
    $("treino").hidden = v !== "treino";
    $("hist").hidden = v !== "hist";
    $("v-treino").setAttribute("aria-selected", v === "treino");
    $("v-hist").setAttribute("aria-selected", v === "hist");
    if (v === "hist") renderHist(); else renderDay();
  }

  /* ---------- ajustes do cronômetro ---------- */
  function renderSettings() {
    $("set-rest").value = String(state.settings.rest);
    $("set-wake").checked = !!state.settings.wake;
    $("set-lock").checked = !!state.settings.lock;
    var p = ("Notification" in window) ? Notification.permission : "unsupported";
    $("notif-state").textContent = p === "granted" ? "Notificações ativadas" : p === "denied" ? "Notificações bloqueadas nas configurações do navegador" : p === "default" ? "Notificações desativadas" : "Este navegador não suporta notificações";
    $("set-notif").hidden = p !== "default";
  }
  $("set-rest").addEventListener("change", function (e) {
    state.settings.rest = parseInt(e.target.value, 10) || 120;
    persist(state);
    if (sess) { sess.restAlerted = false; saveSess(); tick(); }
  });
  $("set-wake").addEventListener("change", function (e) {
    state.settings.wake = e.target.checked;
    persist(state);
    if (e.target.checked) acquireWake(); else releaseWake();
  });
  $("set-lock").addEventListener("change", function (e) {
    state.settings.lock = e.target.checked;
    persist(state);
    if (e.target.checked) { if (sess) { startKeepAlive(); tick(); } } else stopKeepAlive();
  });
  $("set-notif").addEventListener("click", function () { requestNotif(); });

  /* ---------- eventos ---------- */
  $("week").addEventListener("click", function (e) {
    var b = e.target.closest(".day-tab");
    if (b) selectDay(b.getAttribute("data-id"));
  });
  $("day").addEventListener("click", function (e) {
    var s = e.target.closest("[data-save]");
    if (s) { saveEntry(s.closest(".ex"), s.getAttribute("data-save")); return; }
    var c = e.target.closest("[data-set]");
    if (c) { tapSet(c); return; }
    if (e.target.id === "start") startSession(current);
  });
  document.querySelector(".seg").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-view]");
    if (b) showView(b.getAttribute("data-view"));
  });
  $("bar-end").addEventListener("click", endSession);
  $("bar-pause").addEventListener("click", function () { if (sess && sess.pausedAt) resumeSession(); else pauseSession(); });
  $("bar-reset").addEventListener("click", function () {
    if (!sess) return;
    sess.restStart = null;
    sess.restAlerted = false;
    saveSess();
    tick();
  });

  $("export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "meu-treino-backup-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("Backup exportado");
  });
  $("import").addEventListener("click", function () { $("file").click(); });
  $("file").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var o = JSON.parse(rd.result);
        if (!o || typeof o.logs !== "object") throw new Error("formato");
        if (!confirm("Substituir os registros atuais pelos do backup?")) return;
        state = { logs: o.logs, sessions: o.sessions, settings: o.settings };
        fixState();
        persist(state);
        renderSettings();
        showView($("hist").hidden ? "treino" : "hist");
        toast("Backup importado");
      } catch (err) {
        toast("Arquivo de backup inválido");
      }
    };
    rd.readAsText(f);
    e.target.value = "";
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && sess) { acquireWake(); tick(); }
  });
  /* Reabrir o app com treino em andamento: o primeiro toque religa o áudio que mantém o timer na tela de bloqueio. */
  document.addEventListener("click", function () {
    if (sess && !keep) { ensureAudio(); startKeepAlive(); }
  });

  /* ---------- instalação e offline ---------- */
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    $("install").hidden = false;
  });
  $("install").addEventListener("click", function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; $("install").hidden = true; });
  });
  window.addEventListener("appinstalled", function () { $("install").hidden = true; });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  renderSettings();
  selectDay(sess ? sess.dayId : JS_DAY_TO_ID[new Date().getDay()]);
  if (sess) { startTicker(); startKeepAlive(); acquireWake(); tick(); }
})();

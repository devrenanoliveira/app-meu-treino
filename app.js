/* Meu Treino. Usa EX e DAYS definidos em data.js. Os registros ficam no localStorage do aparelho. */
(function () {
  "use strict";
  var KEY = "meutreino:v1";
  var SKEY = "meutreino:session";
  var JS_DAY_TO_ID = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  var DEFAULTS = { rest: 120, wake: true, lock: true, restMode: "auto", restMain: 150, restAcc: 90 };

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
    state.body = Array.isArray(state.body) ? state.body : [];
    var digits = function (v) { var m = String(v == null ? "" : v).match(/\d+/); return m ? m[0] : ""; };
    Object.keys(state.logs).forEach(function (k) {
      (state.logs[k] || []).forEach(function (e) {
        if (e.r && !/^\d+(\/\d+)*$/.test(String(e.r))) e.r = String(e.r).split("/").map(digits).filter(Boolean).join("/");
        (e.s || []).forEach(function (x) { if (x.r && !/^\d+$/.test(String(x.r))) x.r = digits(x.r); });
        if (e.dr && e.dr.r) e.dr.r = digits(e.dr.r);
        if (e.bs && e.bs.r) e.bs.r = digits(e.bs.r);
        if (e.bs && e.bs.s) e.bs.s.forEach(function (x) { if (x.r && !/^\d+$/.test(String(x.r))) x.r = digits(x.r); });
      });
    });
    if (!state.swaps || typeof state.swaps !== "object") state.swaps = { d: "", map: {} };
  }
  fixState();
  /* PLAN é uma cópia do plano (DAYS) onde as trocas de exercício de hoje são aplicadas. */
  var PLAN = DAYS.map(function (d) { return Object.assign({}, d, { items: d.items.map(function (it) { return it.slice(); }) }); });
  function applySwaps() {
    PLAN.forEach(function (p, i) { p.items = DAYS[i].items.map(function (it) { return it.slice(); }); });
    if (state.swaps.d !== todayISO()) return;
    Object.keys(state.swaps.map).forEach(function (k) {
      var parts = k.split(":"), p = PLAN.filter(function (x) { return x.id === parts[0]; })[0];
      if (!p) return;
      p.items.forEach(function (it) { if (it[0] === parts[1] && EX[state.swaps.map[k]]) { it[0] = state.swaps.map[k]; it.length = 2; } });
    });
  }
  applySwaps();
  var current;
  var drafts = {}, focus = {}, guideOpen = false, pip = null, swapKey = null;

  function entries(key) { return state.logs[key] || []; }
  function todayEntry(key) { var t = todayISO(), a = entries(key); for (var i = 0; i < a.length; i++) if (a[i].d === t) return a[i]; return null; }
  function prevEntry(key) { var t = todayISO(), a = entries(key); for (var i = a.length - 1; i >= 0; i--) if (a[i].d !== t) return a[i]; return null; }
  function findDay(id) { return PLAN.filter(function (x) { return x.id === id; })[0]; }

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

  var ticker = null, keep = null, keepUrl = null, keepErr = null, wl = null, ac = null;

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
    for (var i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return new Blob([buf], { type: "audio/wav" });
  }
  function startKeepAlive() {
    if (!state.settings.lock || keep) return;
    try {
      keepUrl = URL.createObjectURL(silentWav());
      keep = new Audio(keepUrl);
      keep.loop = true;
      keepErr = null;
      var p = keep.play();
      if (p && p.catch) p.catch(function (err) { keep = null; keepErr = (err && err.name) || "erro"; });
      if ("mediaSession" in navigator) {
        var hook = function (a, fn) {
          try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) {}
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
    /* Libera o áudio por completo, senão o Android mantém o cartão de mídia na bandeja. */
    try { if (keep) { keep.pause(); keep.removeAttribute("src"); keep.load(); } } catch (e) {}
    keep = null;
    try { if (keepUrl) URL.revokeObjectURL(keepUrl); } catch (e) {}
    keepUrl = null;
    try {
      if ("mediaSession" in navigator) {
        ["play", "pause", "nexttrack", "previoustrack"].forEach(function (a) {
          try { navigator.mediaSession.setActionHandler(a, null); } catch (e) {}
        });
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    } catch (e) {}
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
    notify("Descanso completo", "Passaram " + clock(restTarget()) + ". Hora da próxima série.");
  }

  function isMain(dayId, exId) {
    var d = findDay(dayId);
    return !!d && d.items.slice(0, 2).some(function (it) { return it[0] === exId; });
  }
  function restTarget() {
    var st = state.settings;
    if (st.restMode !== "auto" || !sess || !sess.restKey) return st.rest;
    var p = sess.restKey.split(":");
    return isMain(p[0], p[1]) ? st.restMain : st.restAcc;
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
    var target = restTarget(), paused = !!sess.pausedAt;
    var title = paused ? "Treino pausado" : rest == null ? "Treino em andamento" : (rest >= target ? "Descanso completo " : "Descanso ") + clock(rest) + " / " + clock(target);
    try {
      var d = findDay(sess.dayId), p = nextPending();
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: "Treino " + clock(el) + (p ? " · " + p.name + " " + (p.n + 1) + "/" + p.total : ""),
        album: (d ? d.title.split("·")[1].trim() : "Meu Treino") + (p ? " · " + p.name + " (série " + (p.n + 1) + "/" + p.total + ")" : " · todas as séries feitas"),
        artwork: [
          { src: new URL("icons/icon-192.png", location.href).href, sizes: "192x192", type: "image/png" },
          { src: new URL("icons/icon-512.png", location.href).href, sizes: "512x512", type: "image/png" }
        ]
      });
      navigator.mediaSession.playbackState = paused ? "paused" : "playing";
      /* A barra mostra o descanso (0 até a meta). Parada ou sem descanso, fica congelada, para não exibir o loop do áudio. */
      if (navigator.mediaSession.setPositionState) {
        var running = rest != null && !paused && rest < target;
        navigator.mediaSession.setPositionState({
          duration: target,
          position: rest == null ? 0 : Math.min(rest, target),
          playbackRate: running ? 1 : 0.000001
        });
      }
    } catch (e) {}
  }

  function pauseSession() {
    if (!sess || sess.pausedAt) return;
    sess.pausedAt = Date.now();
    saveSess();
    /* Pausa também o áudio silencioso, para o botão da notificação virar "play". */
    try { if (keep) keep.pause(); } catch (e) {}
    tick();
  }
  function resumeSession() {
    if (!sess || !sess.pausedAt) return;
    var gap = Date.now() - sess.pausedAt;
    sess.startedAt += gap;
    if (sess.restStart) sess.restStart += gap;
    sess.pausedAt = null;
    saveSess();
    if (keep) { var q = keep.play(); if (q && q.catch) q.catch(function () {}); } else startKeepAlive();
    tick();
  }
  function dayItem(day, key) { return day.items.filter(function (x) { return day.id + ":" + x[0] === key; })[0]; }
  function focusIdx(day) { var i = focus[day.id] || 0; return Math.max(0, Math.min(day.items.length - 1, i)); }
  function stepDone(day, it) {
    var key = day.id + ":" + it[0], n = (sess && sess.dayId === day.id && sess.sets[key]) || 0;
    return !!todayEntry(key) || (n > 0 && n >= setsOf(it[1]));
  }
  function renderStepper(day) {
    var el = $("stepper");
    if (!el) return;
    var h = "", cur = focusIdx(day);
    day.items.forEach(function (it, i) {
      h += '<button class="step' + (i === cur ? " cur" : "") + (stepDone(day, it) ? " done" : "") + '" data-go="' + i + '" aria-label="Exercício ' + (i + 1) + '">' + (stepDone(day, it) ? "✓" : i + 1) + "</button>";
    });
    el.innerHTML = h;
  }
  function refreshSetRows() {
    var day = findDay(current);
    if (!day || !day.items.length) return;
    renderStepper(day);
    var card = document.querySelector("#day .ex");
    if (!card) return;
    var it = dayItem(day, card.getAttribute("data-key"));
    if (it) card.querySelector(".sets-row").innerHTML = setsRow(day, it);
    var nx = document.querySelector("#day [data-nav='1']");
    if (nx) nx.classList.toggle("go", stepDone(day, day.items[focusIdx(day)]));
  }
  /* Marca mais uma série do exercício e começa o descanso. */
  function markSet(key) {
    var d = findDay(sess.dayId), it = dayItem(d, key), total = setsOf(it[1]), n = sess.sets[key] || 0;
    if (n >= total) return false;
    sess.sets[key] = n + 1;
    sess.order = sess.order || [];
    sess.order.push(key);
    sess.restStart = Date.now();
    sess.restAlerted = false;
    sess.restKey = key;
    saveSess();
    if (n + 1 >= total) toast("Exercício concluído. Deslize ou toque em Próximo");
    return true;
  }
  function completeNextSet() {
    if (!sess || sess.pausedAt) return;
    var p = nextPending();
    if (!p) { toast("Todas as séries já foram marcadas"); return; }
    markSet(p.key);
    refreshSetRows();
    tick();
  }
  /* Botão grande "Série feita": usa o exercício em foco; se já terminou, pula para o próximo pendente. */
  function hudDone() {
    if (!sess || sess.pausedAt) return;
    ensureAudio();
    if (current !== sess.dayId) selectDay(sess.dayId);
    var day = findDay(sess.dayId), it = day.items[focusIdx(day)], key = day.id + ":" + it[0];
    if ((sess.sets[key] || 0) >= setsOf(it[1])) {
      var p = nextPending();
      if (!p) { toast("Todas as séries feitas. Toque em Finalizar"); return; }
      key = p.key;
      day.items.forEach(function (x, i) { if (day.id + ":" + x[0] === key) focus[day.id] = i; });
      renderDay();
    }
    markSet(key);
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

  function nowText() {
    var d = findDay(sess.dayId), it = d.items[focus[d.id] || 0], key = it && d.id + ":" + it[0];
    var n = it ? (sess.sets[key] || 0) : 0, total = it ? setsOf(it[1]) : 0;
    if (it && n < total) return EX[it[0]].n + " · série " + (n + 1) + " de " + total;
    var p = nextPending();
    return p ? "Próximo: " + p.name + " · série " + (p.n + 1) + " de " + p.total : "Todas as séries feitas";
  }
  function renderBar(el, rest) {
    var bar = $("hud");
    if (!sess) {
      bar.hidden = true;
      document.title = "Meu Treino";
      return;
    }
    var target = restTarget(), d = findDay(sess.dayId), paused = !!sess.pausedAt;
    bar.hidden = false;
    bar.className = "hud " + (d ? d.c : "");
    $("hud-day").textContent = d ? "· " + d.title.split("·")[1].trim() : "";
    $("hud-el").textContent = clock(el);
    $("hud-rest").textContent = rest == null ? "--:--" : clock(rest);
    $("hud-target").textContent = paused ? "treino pausado" : rest == null ? "toque em Série feita" : "meta " + clock(target);
    $("hud-prog").style.width = (rest == null ? 0 : Math.min(100, rest / target * 100)) + "%";
    bar.classList.toggle("ready", rest != null && rest >= target && !paused);
    bar.classList.toggle("paused", paused);
    $("hud-now").textContent = nowText();
    $("hud-pause").textContent = paused ? "Retomar" : "Pausar";
    $("hud-reset").textContent = rest == null ? "Descanso" : "Parar";
    $("hud-reset").disabled = paused;
    $("hud-done").disabled = paused;
    var needTray = state.settings.lock && !keep && !paused;
    $("hud-tray").hidden = !needTray;
    if (needTray) $("hud-tray-msg").textContent = "Timer da bandeja inativo" + (keepErr ? " (" + keepErr + ")" : "");
    document.title = paused ? "Pausado · Meu Treino" : (rest == null ? clock(el) : (rest >= target ? "Descansou! " : "Descanso ") + clock(rest)) + " · Meu Treino";
    drawPip(el, rest);
  }

  /* ---------- timer flutuante (Picture-in-Picture, experimental) ---------- */
  function pipSupported() {
    return !!(document.pictureInPictureEnabled && window.HTMLVideoElement && HTMLVideoElement.prototype.requestPictureInPicture &&
      window.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream);
  }
  function drawPip(el, rest) {
    if (!pip || !sess) return;
    var c = pip.canvas, g = c.getContext("2d"), target = restTarget(), paused = !!sess.pausedAt;
    var ready = rest != null && rest >= target && !paused;
    g.fillStyle = ready ? "#1f8a5b" : "#18212a";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#e8edf2";
    g.textAlign = "center";
    g.font = "20px sans-serif";
    g.fillText(paused ? "Treino pausado" : ready ? "Descanso completo" : "Descanso", c.width / 2, 34);
    g.font = "bold 84px sans-serif";
    g.fillText(rest == null ? "--:--" : clock(rest), c.width / 2, 120);
    g.font = "20px sans-serif";
    g.fillText("Treino " + clock(el), c.width / 2, 156);
  }
  function startPip() {
    if (!pipSupported()) { toast("Seu navegador não suporta o timer flutuante"); return; }
    if (!sess) { toast("Inicie o treino primeiro"); return; }
    if (document.pictureInPictureElement) { try { document.exitPictureInPicture(); } catch (e) {} return; }
    try {
      var canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 180;
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true;
      v.style.cssText = "position:fixed;width:2px;height:2px;opacity:.01;pointer-events:none;left:0;top:0";
      v.srcObject = canvas.captureStream(5);
      document.body.appendChild(v);
      pip = { canvas: canvas, video: v };
      tick();
      v.play().then(function () { return v.requestPictureInPicture(); }).then(function () {
        v.addEventListener("leavepictureinpicture", stopPip);
      }).catch(function () { stopPip(); toast("Não foi possível abrir o timer flutuante"); });
    } catch (e) { stopPip(); toast("Não foi possível abrir o timer flutuante"); }
  }
  function stopPip() {
    if (!pip) return;
    try { pip.video.pause(); pip.video.srcObject = null; pip.video.remove(); } catch (e) {}
    pip = null;
  }

  function tick() {
    if (!sess) return;
    var now = sess.pausedAt || Date.now();
    var el = (now - sess.startedAt) / 1000;
    var rest = sess.restStart ? (now - sess.restStart) / 1000 : null;
    if (rest != null && !sess.restAlerted && !sess.pausedAt && rest >= restTarget()) {
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
    var by = {};
    Object.keys(sess.sets).forEach(function (k) { if (sess.sets[k]) by[k.split(":")[1]] = sess.sets[k]; });
    state.sessions.push({ d: todayISO(), day: sess.dayId, secs: secs, sets: sets, by: by });
    persist(state);
    sess = null;
    saveSess();
    stopTicker();
    stopKeepAlive();
    releaseWake();
    closeNotifs();
    try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch (e) {}
    stopPip();
    renderBar();
    renderDay();
    toast("Treino finalizado em " + clock(secs));
  }

  function setsRow(day, it) {
    var key = day.id + ":" + it[0], total = setsOf(it[1]);
    var n = (sess && sess.dayId === day.id && sess.sets[key]) || 0;
    var h = '<span class="sets-label">' + (sess && sess.dayId === day.id ? "Toque ao terminar a série" : "Séries") + "</span>";
    for (var i = 0; i < total; i++) {
      h += '<button class="set' + (i < n ? " done" : "") + '" data-set="' + key + '" data-i="' + i + '" aria-pressed="' + (i < n) +
        '" aria-label="Série ' + (i + 1) + '">' + (i < n ? "✓" : (i + 1)) + "</button>";
    }
    return h;
  }

  function tapSet(btn) {
    var key = btn.getAttribute("data-set"), i = parseInt(btn.getAttribute("data-i"), 10);
    var day = findDay(current);
    if (!sess) startSession(day.id);
    else if (sess.dayId !== day.id) { toast("Finalize o treino de " + findDay(sess.dayId).d + " antes"); return; }
    if (sess.pausedAt) { toast("Treino pausado. Toque em Retomar"); return; }
    var n = sess.sets[key] || 0;
    sess.order = sess.order || [];
    if (i === n) {
      ensureAudio();
      markSet(key);
    } else if (i === n - 1) {
      sess.sets[key] = n - 1;
      var idx = sess.order.lastIndexOf(key);
      if (idx >= 0) sess.order.splice(idx, 1);
      saveSess();
    } else {
      return;
    }
    refreshSetRows();
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

  /* ----- registro por série, sugestão de carga e aquecimento ----- */
  var GROUPS = [
    ["peito", /peitoral/i, "Peito"], ["ombros", /ombro|deltoide/i, "Ombros"], ["triceps", /^tríceps/i, "Tríceps"],
    ["biceps", /^(bíceps|braquial)/i, "Bíceps"], ["costas", /dorsal|costas/i, "Costas"], ["quad", /quadríceps/i, "Quadríceps"],
    ["post", /posteriores/i, "Posteriores"], ["gluteo", /glúteo/i, "Glúteos"], ["pant", /panturrilha/i, "Panturrilha"],
    ["abd", /abdominal/i, "Abdômen"], ["aduc", /adutor/i, "Adutores"]
  ];
  function groupOf(exId) {
    var m = (EX[exId] && EX[exId].m || "").split(",")[0];
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][1].test(m)) return GROUPS[i];
    return ["outros", null, "Outros"];
  }
  function fmtNum(n) { return (Math.round(n * 10) / 10).toString().replace(".", ","); }
  function fmtSets(e) {
    var t;
    if (e.s && e.s.some(function (x) { return x.w || x.r; })) {
      t = e.s.map(function (x) { return (x.w || "?") + " × " + (x.r || "?"); }).join(" · ");
    } else t = (e.w || "") + (e.r ? " × " + e.r : "");
    if (e.dr && (e.dr.w || e.dr.r)) t += " ↓ drop " + (e.dr.w || "?") + " × " + (e.dr.r || "?");
    if (e.bs) {
      var bl = e.bs.s ? e.bs.s.filter(function (x) { return x.w || x.r; }).map(function (x) { return (x.w || "?") + " × " + (x.r || "?"); }).join(" · ") : (e.bs.w || e.bs.r ? (e.bs.w || "?") + " × " + (e.bs.r || "?") : "");
      if (bl || e.bs.x) t += " + bi-set " + (e.bs.x ? e.bs.x + ": " : "") + bl;
    }
    return t;
  }
  function bestReps(e) { return e.rm || num(e.r) || 0; }
  function allReached(e, topR) {
    if (e.s && e.s.length) {
      var f = e.s.filter(function (x) { return x.r; });
      return f.length === e.s.length && f.every(function (x) { return num(x.r) >= topR; });
    }
    return num(e.r) >= topR;
  }
  function suggestion(pe, topR) {
    if (!pe || !topR) return null;
    var w = pe.w || "", n = num(w);
    if (allReached(pe, topR) && !isNaN(n)) {
      var inc = /placa/i.test(w) ? 1 : /lado/i.test(w) ? 2.5 : 2;
      return { up: true, w: w.replace(/\d+([.,]\d+)?/, fmtNum(n + inc)) };
    }
    return { up: false, w: w };
  }
  function warmupHTML(wtext, idx) {
    var n = num(wtext);
    if (isNaN(n) || !n) return '<p class="note-s">Preencha a carga da série 1 para calcular o aquecimento.</p>';
    var unit = String(wtext).replace(/^\s*\d+([.,]\d+)?\s*/, "");
    var steps = idx < 2 ? [[0.4, "12 reps"], [0.6, "8 reps"], [0.8, "4 reps"]] : [[0.5, "12 reps"]];
    var h = '<ol class="warm">';
    steps.forEach(function (st) {
      var v = n * st[0];
      v = /placa/i.test(wtext) ? Math.max(1, Math.round(v)) : Math.round(v * 2) / 2;
      h += "<li><b>" + esc(fmtNum(v) + (unit ? " " + unit : "")) + "</b> × " + st[1] + "</li>";
    });
    return h + '</ol><p class="note-s">Descanse 30 a 60 s entre as séries de aquecimento. Depois comece as séries valendo.</p>';
  }
  function initialFields(total, te, pe) {
    var arr = [], i;
    for (i = 0; i < total; i++) arr.push({ w: "", r: "" });
    if (te) {
      for (i = 0; i < total; i++) {
        if (te.s) { if (te.s[i]) arr[i] = { w: te.s[i].w || "", r: te.s[i].r || "" }; }
        else arr[i] = { w: te.w || "", r: i === 0 ? (te.r || "") : "" };
      }
    } else if (pe) {
      for (i = 0; i < total; i++) arr[i].w = (pe.s && pe.s[i] && pe.s[i].w) || pe.w || "";
    }
    return arr;
  }
  /* Monta os campos do exercício a partir de um registro anterior: cargas, reps, técnica, drop e bi-set. */
  function draftFrom(e, total) {
    var s = [], b = [], i, bs = e.bs || {};
    for (i = 0; i < total; i++) {
      var x = e.s && e.s[i];
      s.push({ w: (x && x.w) || e.w || "", r: x ? (x.r || "") : (e.s ? "" : (e.r || "")) });
      var y = bs.s ? bs.s[i] : (i === total - 1 && (bs.w || bs.r) ? { w: bs.w, r: bs.r } : null);
      b.push({ w: (y && y.w) || "", r: (y && y.r) || "" });
    }
    var n = e.n || "";
    return { s: s, b: b, t: /drop/i.test(n) ? "drop" : /todas/i.test(n) ? "biall" : /bi/i.test(n) ? "bi" : "",
      dw: e.dr ? e.dr.w || "" : "", dr: e.dr ? e.dr.r || "" : "", bx: bs.x || "" };
  }
  function collect(card) {
    var ws = card.querySelectorAll('[data-f="w"]'), rs = card.querySelectorAll('[data-f="r"]'), s = [];
    for (var i = 0; i < ws.length; i++) s.push({ w: ws[i].value, r: rs[i].value });
    var g = function (f) { return card.querySelector('[data-f="' + f + '"]').value; };
    var bws = card.querySelectorAll('[data-f="bw"]'), brs = card.querySelectorAll('[data-f="br"]'), b = [];
    for (var j = 0; j < bws.length; j++) b.push({ w: bws[j].value, r: brs[j].value });
    return { s: s, t: g("t"), dw: g("dw"), dr: g("dr"), bx: g("bx"), b: b };
  }

  function exHTML(day, it) {
    var ex = EX[it[0]], key = day.id + ":" + it[0], idx = day.items.indexOf(it);
    var te = todayEntry(key), pe = prevEntry(key), topR = topReps(it[1]), total = setsOf(it[1]);
    var dr = drafts[key] || (!te && pe ? draftFrom(pe, total) : null);
    var fields = dr ? dr.s : initialFields(total, te, pe);
    var tech = dr ? dr.t : te ? (/drop/i.test(te.n || "") ? "drop" : /todas/i.test(te.n || "") ? "biall" : /bi/i.test(te.n || "") ? "bi" : "") : "";
    var dw = dr ? dr.dw : te && te.dr ? te.dr.w || "" : "", drr = dr ? dr.dr : te && te.dr ? te.dr.r || "" : "";
    var bs = te && te.bs ? te.bs : {}, bfields = [];
    for (var q = 0; q < total; q++) bfields.push({ w: "", r: "" });
    if (dr) bfields = dr.b; else if (bs.s) bs.s.forEach(function (x, q2) { if (bfields[q2]) bfields[q2] = x; }); else if (bs.w || bs.r) bfields[total - 1] = { w: bs.w || "", r: bs.r || "" };
    var bx = dr ? dr.bx : bs.x || "";
    var steps = ex.s.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    var h = '<article class="ex" data-key="' + key + '" data-done="' + (!!te) + '">';
    h += '<div class="ex-top"><div class="ex-main"><div class="ex-name">' + esc(ex.n) + (te ? '<span class="badge">Salvo hoje</span>' : "") +
      '</div><div class="ex-muscle">' + esc(ex.m) + '</div></div><div class="ex-sets">' + esc(it[1]) + '</div></div>';
    h += '<div class="sets-row">' + setsRow(day, it) + "</div>";
    h += '<div class="log">';
    if (pe) {
      h += '<div class="last">Última vez (' + fmt(pe.d) + "): " + esc(fmtSets(pe)) + (pe.n ? " · " + esc(pe.n) : "") + "</div>";
      var sg = suggestion(pe, topR);
      if (sg && sg.up) h += '<div class="sug up">Você bateu ' + topR + ' reps em todas as séries. Sugestão: <b>' + esc(sg.w) + '</b> <button class="btn small" data-usesug="' + esc(sg.w) + '">Usar</button></div>';
      else if (sg && topR) h += '<div class="sug">Mantenha <b>' + esc(sg.w) + "</b> e busque " + topR + " reps em todas as séries.</div>";
    }
    h += '<div class="sin-h"><span></span><span>Carga</span><span>Reps</span></div>';
    for (var i = 0; i < total; i++) {
      var f = fields[i] || { w: "", r: "" };
      var ph = (pe && pe.s && pe.s[i] && pe.s[i].r) || (pe && pe.r) || "reps";
      h += '<div class="srow"><b>' + (i + 1) + '</b><input type="text" data-f="w" data-i="' + i + '" value="' + esc(f.w) + '" placeholder="kg ou placas" autocomplete="off">' +
        '<input type="text" inputmode="numeric" data-f="r" data-i="' + i + '" value="' + esc(f.r) + '" placeholder="' + esc(ph) + '" autocomplete="off"></div>';
      var bf = bfields[i] || { w: "", r: "" }, showB = tech === "biall" || (tech === "bi" && i === total - 1);
      h += '<div class="srow bi-r" data-bi="' + i + '"' + (showB ? "" : " hidden") + '><b>+</b><input type="text" data-f="bw" data-i="' + i + '" value="' + esc(bf.w) + '" placeholder="carga bi-set" autocomplete="off">' +
        '<input type="text" inputmode="numeric" data-f="br" data-i="' + i + '" value="' + esc(bf.r) + '" placeholder="reps bi-set" autocomplete="off"></div>';
    }
    h += '<label class="tech">Técnica<select data-f="t"><option value=""' + (tech === "" ? " selected" : "") + '>Nenhuma</option>' +
      '<option value="drop"' + (tech === "drop" ? " selected" : "") + '>Drop set na última série</option>' +
      '<option value="bi"' + (tech === "bi" ? " selected" : "") + '>Bi-set só na última série</option>' +
      '<option value="biall"' + (tech === "biall" ? " selected" : "") + '>Bi-set em todas as séries</option></select></label>';
    h += '<div class="srow drop" id="drop-row"' + (tech === "drop" ? "" : " hidden") + '><b>↓</b><input type="text" data-f="dw" value="' + esc(dw) + '" placeholder="carga do drop" autocomplete="off">' +
      '<input type="text" inputmode="numeric" data-f="dr" value="' + esc(drr) + '" placeholder="reps do drop" autocomplete="off"></div>';
    h += '<input type="text" class="bi-name" id="bi-name" data-f="bx" value="' + esc(bx) + '" placeholder="Exercício do bi-set (ex.: Tríceps francês na polia)" autocomplete="off"' + (tech === "bi" || tech === "biall" ? "" : " hidden") + '>';
    h += '<button class="btn primary big save" data-save="' + key + '">' + (te ? "Atualizar registro" : "Salvar séries") + "</button>";
    h += '<div class="row2">' + (pe ? '<button class="btn small" data-copyprev="' + key + '">Copiar última vez</button>' : "") +
      '<button class="btn small" data-swap="' + key + '">Trocar exercício</button>' +
      (swappedFrom(day.id, it[0]) ? '<button class="btn small" data-unswap="' + key + '">Desfazer troca</button>' : "") + "</div>";
    h += "</div>";
    h += '<details class="sub"><summary>Aquecimento</summary><div class="guide" id="warm-body">' + warmupHTML(fields[0] ? fields[0].w : "", idx) + "</div></details>";
    h += '<details' + (guideOpen ? " open" : "") + ' class="how"><summary>Como executar</summary><div class="guide">' +
      '<div><h3>Passo a passo</h3><ol>' + steps + "</ol></div>" +
      '<div><h3>Exemplo</h3><p class="example">' + esc(ex.e) + "</p></div>" +
      '<div><h3>Erro comum</h3><p class="mistake">' + esc(ex.x) + "</p></div>" +
      "</div></details></article>";
    return h;
  }

  /* ----- trocar exercício (vale só para hoje) ----- */
  function swappedFrom(dayId, exId) {
    if (state.swaps.d !== todayISO()) return null;
    var k = Object.keys(state.swaps.map).filter(function (x) { return x.indexOf(dayId + ":") === 0 && state.swaps.map[x] === exId; })[0];
    return k || null;
  }
  function alternatives(day, exId) {
    var g = groupOf(exId)[0];
    return Object.keys(EX).filter(function (id) {
      return id !== exId && groupOf(id)[0] === g && !day.items.some(function (x) { return x[0] === id; });
    });
  }
  function doSwap(key, newId) {
    var parts = key.split(":");
    if (state.swaps.d !== todayISO()) state.swaps = { d: todayISO(), map: {} };
    var orig = swappedFrom(parts[0], parts[1]);
    state.swaps.map[orig || key] = newId;
    persist(state);
    applySwaps();
    swapKey = null;
    var d = findDay(parts[0]);
    renderDay();
    if (sess) tick();
    toast("Trocado por " + EX[newId].n + " (só hoje)");
  }
  function undoSwap(key) {
    var orig = swappedFrom(key.split(":")[0], key.split(":")[1]);
    if (!orig) return;
    delete state.swaps.map[orig];
    persist(state);
    applySwaps();
    renderDay();
    if (sess) tick();
    toast("Exercício original de volta");
  }
  function swapPanel(day, it) {
    var alts = alternatives(day, it[0]), key = day.id + ":" + it[0];
    var h = '<div class="card"><h3 style="font-size:20px;margin-bottom:4px">Trocar ' + esc(EX[it[0]].n) + '</h3><p class="note-s" style="margin-bottom:10px">Vale só para hoje. O plano não muda.</p>';
    if (!alts.length) h += '<p class="note-s">Não há exercício parecido para trocar.</p>';
    alts.forEach(function (id) {
      h += '<button class="btn alt" data-pick="' + id + '" data-key="' + key + '"><b>' + esc(EX[id].n) + '</b><span>' + esc(EX[id].m) + "</span></button>";
    });
    return h + '<button class="btn" style="margin-top:8px;width:100%" data-swap-cancel="1">Cancelar</button></div>';
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
    var total = 0, idx = focusIdx(day), it = day.items[idx];
    day.items.forEach(function (x) { total += setsOf(x[1]); });
    var html = '<div class="' + day.c + '">' +
      '<div class="day-head"><div><h2>' + day.title + '</h2><div class="sub">' + day.sub + "</div></div>" +
      '<div class="chips"><span class="chip">' + total + ' séries</span><span class="chip">~' + Math.round(total * 3.2) + ' min</span>' +
      '<span class="chip on" id="chip-done"></span></div></div>';
    if (!sess) html += '<div style="margin-top:12px"><button class="btn primary big" id="start">Iniciar treino</button></div>';
    html += '<div class="stepper" id="stepper"></div>';
    html += '<div class="pos">Exercício ' + (idx + 1) + " de " + day.items.length + "</div>";
    html += swapKey === day.id + ":" + it[0] ? swapPanel(day, it) : exHTML(day, it);
    html += '<div class="nav2"><button class="btn" data-nav="-1"' + (idx === 0 ? " disabled" : "") + '>‹ Anterior</button>' +
      '<button class="btn' + (stepDone(day, it) ? " go" : "") + '" data-nav="1"' + (idx === day.items.length - 1 ? " disabled" : "") + '>Próximo ›</button></div>';
    html += "</div>";
    el.innerHTML = html;
    renderStepper(day);
    updateChip(day);
  }

  function goTo(i) {
    var day = findDay(current);
    if (!day.items.length) return;
    focus[day.id] = Math.max(0, Math.min(day.items.length - 1, i));
    swapKey = null;
    renderDay();
    if (sess) tick();
    window.scrollTo(0, 0);
  }

  function selectDay(id) {
    current = id;
    swapKey = null;
    var d = findDay(id);
    if (sess && sess.dayId === id && focus[id] == null) {
      var p = nextPending();
      if (p) d.items.forEach(function (x, i) { if (d.id + ":" + x[0] === p.key) focus[id] = i; });
    }
    renderWeek();
    renderDay();
    if (sess) tick();
  }

  function saveEntry(card, key) {
    var c = collect(card), sets = c.s.map(function (x) { return { w: x.w.trim(), r: x.r.trim() }; });
    if (!sets.some(function (x) { return x.w || x.r; })) { toast("Preencha a carga e as reps"); return; }
    var firstW = "", rs = [], rm = 0;
    sets.forEach(function (x) { if (!firstW && x.w) firstW = x.w; if (x.r) { rs.push(x.r); rm = Math.max(rm, num(x.r) || 0); } });
    var list = state.logs[key] || [];
    var t = todayISO(), entry = { d: t, w: firstW, r: rs.join("/"), rm: rm, n: c.t === "drop" ? "drop na última" : c.t === "bi" ? "bi-set na última" : c.t === "biall" ? "bi-set em todas as séries" : "", s: sets }, found = false;
    if (c.t === "drop" && (c.dw.trim() || c.dr.trim())) entry.dr = { w: c.dw.trim(), r: c.dr.trim() };
    if (c.t === "bi" || c.t === "biall") {
      var bsets = c.b.map(function (x, q) { var on = c.t === "biall" || q === c.b.length - 1; return on ? { w: x.w.trim(), r: x.r.trim() } : { w: "", r: "" }; });
      if (c.bx.trim() || bsets.some(function (x) { return x.w || x.r; })) entry.bs = { x: c.bx.trim(), s: bsets };
    }
    for (var i = 0; i < list.length; i++) if (list[i].d === t) { list[i] = entry; found = true; }
    if (!found) list.push(entry);
    list.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    state.logs[key] = list;
    persist(state);
    delete drafts[key];
    guideOpen = card.querySelector("details.how").open;
    renderDay();
    if (sess) tick();
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

  function lineChart(pts) {
    if (pts.length < 2) return "";
    var W = 320, H = 120, L = 34, R = 8, T = 10, B = 22;
    var vs = pts.map(function (p) { return p.v; }), min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    if (min === max) { min -= 1; max += 1; }
    var xy = pts.map(function (p, i) {
      return [L + i * (W - L - R) / (pts.length - 1), T + (H - T - B) * (1 - (p.v - min) / (max - min))];
    });
    var line = xy.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ");
    var dots = xy.map(function (q) { return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3" style="fill:var(--c,var(--pull))"/>'; }).join("");
    var lastX = xy[xy.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Gráfico de evolução">' +
      '<line x1="' + L + '" y1="' + T + '" x2="' + (W - R) + '" y2="' + T + '" stroke="var(--line)"/>' +
      '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" stroke="var(--line)"/>' +
      '<text x="' + (L - 4) + '" y="' + (T + 4) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + fmtNum(max) + "</text>" +
      '<text x="' + (L - 4) + '" y="' + (H - B + 4) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + fmtNum(min) + "</text>" +
      '<text x="' + L + '" y="' + (H - 6) + '" font-size="10" fill="var(--muted)">' + fmt(pts[0].d) + "</text>" +
      '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + fmt(pts[pts.length - 1].d) + "</text>" +
      '<polyline points="' + line + '" fill="none" style="stroke:var(--c,var(--pull))" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + dots +
      '<text x="' + lastX[0].toFixed(1) + '" y="' + Math.max(10, lastX[1] - 7).toFixed(1) + '" text-anchor="end" font-size="11" font-weight="700" fill="var(--ink)">' + fmtNum(pts[pts.length - 1].v) + "</text></svg>";
  }
  function evolution(list) {
    var pts = list.map(function (e) { return { d: e.d, v: num(e.w) }; }).filter(function (p) { return !isNaN(p.v); });
    var h = lineChart(pts);
    if (pts.length) {
      var rec = pts.reduce(function (a, b) { return b.v >= a.v ? b : a; });
      var br = 0, brd = "";
      list.forEach(function (e) { if (bestReps(e) >= br) { br = bestReps(e); brd = e.d; } });
      h += '<div class="rec">Recorde de carga: <b>' + fmtNum(rec.v) + "</b> (" + fmt(rec.d) + ")" + (br ? " · Mais reps: <b>" + br + "</b> (" + fmt(brd) + ")" : "") + "</div>";
    }
    return h;
  }

  function weekSummary() {
    var d = new Date(), dow = (d.getDay() + 6) % 7, m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    var monday = m.getFullYear() + "-" + pad(m.getMonth() + 1) + "-" + pad(m.getDate());
    var wk = state.sessions.filter(function (x) { return x.d >= monday; });
    var secs = 0, sets = 0, by = {};
    wk.forEach(function (x) {
      secs += x.secs || 0; sets += x.sets || 0;
      Object.keys(x.by || {}).forEach(function (id) { var g = groupOf(id)[2]; by[g] = (by[g] || 0) + x.by[id]; });
    });
    var days = {};
    state.sessions.forEach(function (x) { days[x.d] = 1; });
    var cur = new Date(d.getFullYear(), d.getMonth(), d.getDate()), streak = 0, iso = function (z) { return z.getFullYear() + "-" + pad(z.getMonth() + 1) + "-" + pad(z.getDate()); };
    if (!days[iso(cur)]) cur.setDate(cur.getDate() - 1);
    for (var guard = 0; guard < 400; guard++) {
      if (cur.getDay() !== 0) { if (days[iso(cur)]) streak++; else break; }
      cur.setDate(cur.getDate() - 1);
    }
    var groups = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    var h = '<h2 class="sec">Resumo da semana</h2><div class="card"><div class="kpis">' +
      '<div><b>' + wk.length + '/6</b><span>treinos</span></div><div><b>' + sets + '</b><span>séries</span></div>' +
      '<div><b>' + clock(secs) + '</b><span>tempo</span></div><div><b>' + streak + '</b><span>dias seguidos</span></div></div>';
    if (groups.length) {
      var top = by[groups[0]];
      h += '<div class="bars">' + groups.map(function (g) {
        return '<div class="bar-r"><span>' + esc(g) + '</span><i style="width:' + Math.round(by[g] / top * 100) + '%"></i><em>' + by[g] + "</em></div>";
      }).join("") + "</div>";
    } else h += '<p class="note-s" style="margin-top:8px">Séries por grupo muscular aparecem aqui depois de finalizar um treino.</p>';
    return h + "</div>";
  }

  function histItem(key, label) {
    var list = entries(key), ex = EX[key.split(":")[1]];
    var last = list.length ? list[list.length - 1] : null;
    var html = '<details class="slot"><summary><span class="nm">' + esc(label || ex.n) +
      '<span class="meta">' + (last ? fmt(last.d) + ": " + esc(fmtSets(last)) : "Sem registros ainda") + "</span></span>" + spark(list) + "</summary>";
    if (list.length) {
      html += evolution(list) + "<table><thead><tr><th>Data</th><th>Séries</th><th>Obs.</th><th></th></tr></thead><tbody>";
      list.slice().reverse().forEach(function (e) {
        html += "<tr><td>" + fmt(e.d) + "</td><td>" + esc(fmtSets(e)) + "</td><td>" + esc(e.n) + '</td><td><button class="del" data-del-log="' + key + '" data-d="' + e.d + '" aria-label="Apagar registro">✕</button></td></tr>';
      });
      html += "</tbody></table>";
    } else {
      html += '<div class="empty">Salve a carga na aba Treino para ver a evolução aqui.</div>';
    }
    return html + "</details>";
  }

  function renderHist() {
    var html = weekSummary();
    if (state.sessions.length) {
      html += '<h2 class="sec">Treinos concluídos</h2><div class="slot"><table><thead><tr><th>Data</th><th>Treino</th><th>Duração</th><th>Séries</th><th></th></tr></thead><tbody>';
      var base = Math.max(0, state.sessions.length - 20);
      state.sessions.slice(-20).reverse().forEach(function (s, ri, arr) {
        var si = base + arr.length - 1 - ri;
        var d = findDay(s.day);
        html += "<tr><td>" + fmt(s.d) + "</td><td>" + esc(d ? d.title.split("·")[1].trim() : s.day) + "</td><td>" + clock(s.secs) + "</td><td>" + (s.sets || 0) + '</td><td><button class="del" data-del-sess="' + si + '" aria-label="Apagar treino">✕</button></td></tr>';
      });
      html += "</tbody></table></div>";
    }
    var planKeys = {};
    DAYS.forEach(function (day) {
      if (!day.items.length) return;
      html += '<div class="hist-group ' + day.c + '"><h2>' + day.title + "</h2>";
      day.items.forEach(function (it) { planKeys[day.id + ":" + it[0]] = 1; html += histItem(day.id + ":" + it[0]); });
      html += "</div>";
    });
    var extra = Object.keys(state.logs).filter(function (k) { return !planKeys[k] && EX[k.split(":")[1]] && state.logs[k].length; });
    if (extra.length) {
      html += '<div class="hist-group"><h2>Exercícios trocados</h2>';
      extra.forEach(function (k) { var dd = DAYS.filter(function (x) { return x.id === k.split(":")[0]; })[0]; html += histItem(k, EX[k.split(":")[1]].n + (dd ? " (" + dd.d + ")" : "")); });
      html += "</div>";
    }
    html += '<h2 class="sec">Limpar histórico</h2><div class="card"><div class="data-box">' +
      '<button class="btn" id="clr-sess">Apagar treinos concluídos</button>' +
      '<button class="btn" id="clr-all">Apagar tudo</button></div>' +
      '<p class="note-s" style="margin-top:8px">Você também pode apagar linhas soltas com o ✕. "Apagar tudo" remove todas as cargas e treinos salvos.</p></div>';
    $("hist-body").innerHTML = html;
  }

  /* ---------- corpo: peso e medidas ---------- */
  var BODY_F = [["kg", "Peso (kg)"], ["cin", "Cintura (cm)"], ["pei", "Peito (cm)"], ["bra", "Braço (cm)"], ["cox", "Coxa (cm)"]];
  function renderBody() {
    var last = state.body.length ? state.body[state.body.length - 1] : {};
    var h = '<h2 class="sec">Peso e medidas</h2><div class="card"><div class="body-in">';
    BODY_F.forEach(function (f) {
      h += '<label>' + f[1] + '<input type="text" inputmode="decimal" data-b="' + f[0] + '" value="" placeholder="' + esc(last[f[0]] || "") + '" autocomplete="off"></label>';
    });
    h += '</div><button class="btn primary big" id="body-save" style="margin-top:12px">Salvar medidas de hoje</button></div>';
    var pts = state.body.map(function (b) { return { d: b.d, v: num(b.kg) }; }).filter(function (p) { return !isNaN(p.v); });
    if (pts.length) {
      var diff = pts[pts.length - 1].v - pts[0].v;
      h += '<h2 class="sec">Peso</h2><div class="card">' + lineChart(pts) +
        '<div class="rec">Atual: <b>' + fmtNum(pts[pts.length - 1].v) + " kg</b>" + (pts.length > 1 ? " · Variação: <b>" + (diff > 0 ? "+" : "") + fmtNum(diff) + " kg</b> desde " + fmt(pts[0].d) : "") + "</div></div>";
    }
    if (state.body.length) {
      h += '<h2 class="sec">Registros</h2><div class="slot"><table><thead><tr><th>Data</th><th>Peso</th><th>Cint.</th><th>Peito</th><th>Braço</th><th>Coxa</th><th></th></tr></thead><tbody>';
      state.body.slice().reverse().forEach(function (b, ri) {
        var bi = state.body.length - 1 - ri;
        h += "<tr><td>" + fmt(b.d) + "</td><td>" + esc(b.kg || "-") + "</td><td>" + esc(b.cin || "-") + "</td><td>" + esc(b.pei || "-") + "</td><td>" + esc(b.bra || "-") + "</td><td>" + esc(b.cox || "-") + '</td><td><button class="del" data-del-body="' + bi + '" aria-label="Apagar">✕</button></td></tr>';
      });
      h += "</tbody></table></div>";
    }
    $("corpo-body").innerHTML = h;
  }

  function showView(v) {
    ["treino", "hist", "corpo", "ajustes"].forEach(function (id) { $(id).hidden = id !== v; });
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-view") === v);
    });
    if (v === "hist") renderHist(); else if (v === "treino") renderDay(); else if (v === "corpo") renderBody(); else renderSettings();
    window.scrollTo(0, 0);
  }

  /* ---------- ajustes do cronômetro ---------- */
  function fillRest(id, val) {
    var sel = $(id), h = "";
    if (!sel.options.length) {
      [60, 90, 120, 150, 180, 210, 240].forEach(function (v) { h += '<option value="' + v + '">' + clock(v) + "</option>"; });
      sel.innerHTML = h;
    }
    sel.value = String(val);
  }
  function renderSettings() {
    fillRest("set-rest", state.settings.rest);
    fillRest("set-main", state.settings.restMain);
    fillRest("set-acc", state.settings.restAcc);
    $("set-mode").value = state.settings.restMode;
    $("rest-auto").hidden = state.settings.restMode !== "auto";
    $("rest-fixed").hidden = state.settings.restMode === "auto";
    $("set-wake").checked = !!state.settings.wake;
    $("set-lock").checked = !!state.settings.lock;
    var p = ("Notification" in window) ? Notification.permission : "unsupported";
    $("notif-state").textContent = p === "granted" ? "Notificações ativadas" : p === "denied" ? "Notificações bloqueadas nas configurações do navegador" : p === "default" ? "Notificações desativadas" : "Este navegador não suporta notificações";
    $("set-notif").hidden = p !== "default";
    $("pip-row").hidden = !pipSupported();
    $("fit-note").hidden = !fitActive;
  }
  [["set-rest", "rest", 120], ["set-main", "restMain", 150], ["set-acc", "restAcc", 90]].forEach(function (c) {
    $(c[0]).addEventListener("change", function (e) {
      state.settings[c[1]] = parseInt(e.target.value, 10) || c[2];
      persist(state);
      if (sess) { sess.restAlerted = false; saveSess(); tick(); }
    });
  });
  $("set-mode").addEventListener("change", function (e) {
    state.settings.restMode = e.target.value === "fixed" ? "fixed" : "auto";
    persist(state);
    renderSettings();
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
  $("set-pip").addEventListener("click", startPip);
  $("refresh").addEventListener("click", function () {
    toast("Atualizando...");
    var done = function () { location.reload(); };
    var jobs = [];
    try {
      if ("serviceWorker" in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
      if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    } catch (e) {}
    Promise.all(jobs).then(done, done);
  });

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
    var us = e.target.closest("[data-usesug]");
    if (us) {
      var card = us.closest(".ex");
      Array.prototype.forEach.call(card.querySelectorAll('[data-f="w"]'), function (i) { i.value = us.getAttribute("data-usesug"); });
      drafts[card.getAttribute("data-key")] = collect(card);
      $("warm-body").innerHTML = warmupHTML(us.getAttribute("data-usesug"), focusIdx(findDay(current)));
      toast("Carga sugerida aplicada");
      return;
    }
    var cp = e.target.closest("[data-copyprev]");
    if (cp) { var k0 = cp.getAttribute("data-copyprev"); drafts[k0] = draftFrom(prevEntry(k0), setsOf(dayItem(findDay(current), k0)[1])); renderDay(); toast("Treino da última vez copiado"); return; }
    var sw = e.target.closest("[data-swap]");
    if (sw) {
      var kk = sw.getAttribute("data-swap");
      if (sess && (sess.sets[kk] || 0) > 0) { toast("Não dá para trocar depois de marcar séries"); return; }
      swapKey = kk; renderDay(); return;
    }
    var us2 = e.target.closest("[data-unswap]");
    if (us2) { undoSwap(us2.getAttribute("data-unswap")); return; }
    var pk = e.target.closest("[data-pick]");
    if (pk) { doSwap(pk.getAttribute("data-key"), pk.getAttribute("data-pick")); return; }
    if (e.target.closest("[data-swap-cancel]")) { swapKey = null; renderDay(); return; }
    var g = e.target.closest("[data-go]");
    if (g) { goTo(parseInt(g.getAttribute("data-go"), 10)); return; }
    var nv = e.target.closest("[data-nav]");
    if (nv) { goTo(focusIdx(findDay(current)) + parseInt(nv.getAttribute("data-nav"), 10)); return; }
    if (e.target.id === "start") startSession(current);
  });
  /* Guarda o que foi digitado (carga/reps) ao trocar de exercício, para não perder. */
  $("day").addEventListener("input", function (e) {
    var f = e.target.getAttribute && e.target.getAttribute("data-f");
    var card = e.target.closest && e.target.closest(".ex");
    if (!f || !card) return;
    if ((f === "r" || f === "dr" || f === "br") && /\D/.test(e.target.value)) e.target.value = e.target.value.replace(/\D/g, "");
    drafts[card.getAttribute("data-key")] = collect(card);
    if (f === "w" && e.target.getAttribute("data-i") === "0") {
      var day = findDay(current), wb = $("warm-body");
      if (wb) wb.innerHTML = warmupHTML(e.target.value, focusIdx(day));
    }
  });
  $("day").addEventListener("change", function (e) {
    if (e.target.getAttribute && e.target.getAttribute("data-f") === "t") {
      var card = e.target.closest(".ex"), v = e.target.value, rows = card.querySelectorAll("[data-bi]");
      $("drop-row").hidden = v !== "drop";
      $("bi-name").hidden = v !== "bi" && v !== "biall";
      Array.prototype.forEach.call(rows, function (r, i) { r.hidden = !(v === "biall" || (v === "bi" && i === rows.length - 1)); });
      drafts[card.getAttribute("data-key")] = collect(card);
    }
  });
  $("day").addEventListener("toggle", function (e) { if (e.target.classList && e.target.classList.contains("how")) guideOpen = e.target.open; }, true);
  /* Deslizar para o lado troca de exercício. */
  (function () {
    var x0 = 0, y0 = 0;
    $("day").addEventListener("touchstart", function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    $("day").addEventListener("touchend", function (e) {
      if (e.target.closest && e.target.closest("input, details")) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 45) goTo(focusIdx(findDay(current)) + (dx < 0 ? 1 : -1));
    }, { passive: true });
  })();
  $("hist-body").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-del-sess")) {
      if (!confirm("Apagar este treino do histórico?")) return;
      state.sessions.splice(parseInt(t.getAttribute("data-del-sess"), 10), 1);
    } else if (t.hasAttribute("data-del-log")) {
      if (!confirm("Apagar este registro?")) return;
      var k = t.getAttribute("data-del-log"), dd = t.getAttribute("data-d");
      state.logs[k] = (state.logs[k] || []).filter(function (x) { return x.d !== dd; });
      if (!state.logs[k].length) delete state.logs[k];
    } else if (t.id === "clr-sess") {
      if (!state.sessions.length || !confirm("Apagar todos os treinos concluídos? As cargas continuam salvas.")) return;
      state.sessions = [];
    } else if (t.id === "clr-all") {
      if (!confirm("Apagar TODAS as cargas e treinos salvos? Não dá para desfazer.")) return;
      state.logs = {}; state.sessions = []; drafts = {};
    } else return;
    persist(state);
    renderHist();
    toast("Apagado");
  });
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-view]");
    if (b) showView(b.getAttribute("data-view"));
  });
  $("hud-end").addEventListener("click", endSession);
  $("hud-done").addEventListener("click", hudDone);
  $("hud-pause").addEventListener("click", function () { if (sess && sess.pausedAt) resumeSession(); else pauseSession(); });
  $("hud-reset").addEventListener("click", function () {
    if (!sess || sess.pausedAt) return;
    if (sess.restStart) sess.restStart = null;
    else { sess.restStart = Date.now(); ensureAudio(); }
    sess.restAlerted = false;
    saveSess();
    tick();
  });
  $("hud-tray-btn").addEventListener("click", function () {
    ensureAudio();
    startKeepAlive();
    tick();
  });

  /* ---------- corpo ---------- */
  $("corpo").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.id === "body-save") {
      var entry = { d: todayISO() }, any = false;
      Array.prototype.forEach.call(document.querySelectorAll("#corpo [data-b]"), function (i) {
        var v = i.value.trim().replace(",", ".");
        if (v) { if (isNaN(parseFloat(v))) return; entry[i.getAttribute("data-b")] = v.replace(".", ","); any = true; }
      });
      if (!any) { toast("Preencha pelo menos uma medida"); return; }
      var prev = state.body.filter(function (b) { return b.d === entry.d; })[0];
      if (prev) { Object.assign(prev, entry); } else state.body.push(entry);
      state.body.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
      persist(state);
      renderBody();
      toast("Medidas salvas");
    } else if (t.hasAttribute("data-del-body")) {
      if (!confirm("Apagar este registro?")) return;
      state.body.splice(parseInt(t.getAttribute("data-del-body"), 10), 1);
      persist(state);
      renderBody();
    }
  });

  /* ---------- exportar CSV e lembretes no calendário ---------- */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV() {
    var rows = [["data", "treino", "exercicio", "serie", "carga", "reps", "obs"]];
    Object.keys(state.logs).forEach(function (k) {
      var p = k.split(":"), day = DAYS.filter(function (x) { return x.id === p[0]; })[0], ex = EX[p[1]];
      state.logs[k].forEach(function (e) {
        var base = [e.d, day ? day.title : p[0], ex ? ex.n : p[1]];
        if (e.s && e.s.length) e.s.forEach(function (x, i) { rows.push(base.concat([i + 1, x.w, x.r, i === e.s.length - 1 ? e.n : ""])); });
        if (e.dr) rows.push(base.concat(["drop", e.dr.w, e.dr.r, ""]));
        if (e.bs && e.bs.s) e.bs.s.forEach(function (x, i) { if (x.w || x.r) rows.push(base.concat(["bi-set " + (i + 1), x.w, x.r, e.bs.x])); });
        else if (e.bs) rows.push(base.concat(["bi-set", e.bs.w, e.bs.r, e.bs.x]));
        else rows.push(base.concat(["", e.w, e.r, e.n]));
      });
    });
    rows.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    var csv = rows.map(function (r) { return r.map(csvCell).join(";"); }).join("\r\n");
    if (state.body.length) {
      csv += "\r\n\r\ndata;peso;cintura;peito;braco;coxa\r\n" + state.body.map(function (b) {
        return [b.d, b.kg, b.cin, b.pei, b.bra, b.cox].map(csvCell).join(";");
      }).join("\r\n");
    }
    download("meu-treino-" + todayISO() + ".csv", "\ufeff" + csv, "text/csv;charset=utf-8");
    toast("CSV exportado");
  }
  function exportICS() {
    var t = ($("rem-time").value || "18:00").split(":"), hh = pad(parseInt(t[0], 10) || 0), mm = pad(parseInt(t[1], 10) || 0);
    var endH = pad(((parseInt(t[0], 10) || 0) + 1) % 24);
    var codes = { seg: ["MO", 1], ter: ["TU", 2], qua: ["WE", 3], qui: ["TH", 4], sex: ["FR", 5], sab: ["SA", 6] };
    var stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meu Treino//PT", "CALSCALE:GREGORIAN"];
    DAYS.forEach(function (day) {
      var c = codes[day.id];
      if (!c) return;
      var d = new Date();
      d.setDate(d.getDate() + ((c[1] - d.getDay() + 7) % 7));
      var ymd = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
      L.push("BEGIN:VEVENT", "UID:meutreino-" + day.id + "@devrenanoliveira.github.io", "DTSTAMP:" + stamp,
        "DTSTART:" + ymd + "T" + hh + mm + "00", "DTEND:" + ymd + "T" + endH + mm + "00",
        "RRULE:FREQ=WEEKLY;BYDAY=" + c[0], "SUMMARY:Treino: " + day.title.split("·")[1].trim(),
        "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:Hora do treino", "END:VALARM", "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    download("meu-treino-lembretes.ics", L.join("\r\n"), "text/calendar;charset=utf-8");
    toast("Abra o arquivo para adicionar ao calendário");
  }
  $("export-csv").addEventListener("click", exportCSV);
  $("rem-ics").addEventListener("click", exportICS);

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
        state = { logs: o.logs, sessions: o.sessions, settings: o.settings, body: o.body, swaps: o.swaps };
        fixState();
        applySwaps();
        persist(state);
        renderSettings();
        showView(!$("hist").hidden ? "hist" : !$("ajustes").hidden ? "ajustes" : !$("corpo").hidden ? "corpo" : "treino");
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
    if (sess && !keep && !sess.pausedAt) { ensureAudio(); startKeepAlive(); }
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

  /* Chrome em "Site para computador" ignora o viewport e usa ~980px: amplia a página para caber na tela. */
  var fitActive = false;
  function fit() {
    var root = document.documentElement;
    try {
      root.style.zoom = "";
      var sw = screen.width, iw = window.innerWidth;
      var touch = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || (navigator.maxTouchPoints || 0) > 0;
      if (touch && sw > 0 && sw < 700 && iw / sw > 1.25) { root.style.zoom = (iw / sw).toFixed(3); fitActive = true; }
      else fitActive = false;
    } catch (e) { fitActive = false; }
  }
  fit();
  window.addEventListener("resize", function () { fit(); });
  window.addEventListener("orientationchange", function () { setTimeout(fit, 300); });

  renderSettings();
  selectDay(sess ? sess.dayId : JS_DAY_TO_ID[new Date().getDay()]);
  if (sess) { startTicker(); if (!sess.pausedAt) startKeepAlive(); acquireWake(); tick(); }
})();

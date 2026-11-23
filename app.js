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
  var drafts = {}, focus = {}, guideOpen = false, pip = null;

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
    for (var i = 0; i < n; i++) v.setUint8(44 + i, i % 4000 === 0 ? 129 : 128);
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
    var target = state.settings.rest, d = findDay(sess.dayId), paused = !!sess.pausedAt;
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
    var c = pip.canvas, g = c.getContext("2d"), target = state.settings.rest, paused = !!sess.pausedAt;
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

  function exHTML(day, it) {
    var ex = EX[it[0]], key = day.id + ":" + it[0];
    var te = todayEntry(key), pe = prevEntry(key), topR = topReps(it[1]), dr = drafts[key];
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
    var w = dr ? dr.w : te ? te.w : (pe ? pe.w : "");
    var r = dr ? dr.r : te ? te.r : "";
    var drop = dr ? dr.n : te ? /drop/i.test(te.n || "") : false;
    h += '<div class="log-in">' +
      '<label>Carga <input type="text" data-f="w" value="' + esc(w) + '" placeholder="kg ou placas" autocomplete="off"></label>' +
      '<label>Reps <input type="text" inputmode="numeric" data-f="r" value="' + esc(r) + '" placeholder="' + esc(pe && pe.r ? pe.r : "reps") + '" autocomplete="off"></label>' +
      '<label class="check"><input type="checkbox" data-f="n"' + (drop ? " checked" : "") + '> Drop na última série</label>' +
      '<button class="btn primary big save" data-save="' + key + '">' + (te ? "Atualizar registro" : "Salvar carga e reps") + "</button>" +
      "</div></div>";
    h += '<details' + (guideOpen ? " open" : "") + '><summary>Como executar</summary><div class="guide">' +
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
    var total = 0, idx = focusIdx(day), it = day.items[idx];
    day.items.forEach(function (x) { total += setsOf(x[1]); });
    var html = '<div class="' + day.c + '">' +
      '<div class="day-head"><div><h2>' + day.title + '</h2><div class="sub">' + day.sub + "</div></div>" +
      '<div class="chips"><span class="chip">' + total + ' séries</span><span class="chip">~' + Math.round(total * 3.2) + ' min</span>' +
      '<span class="chip on" id="chip-done"></span></div></div>';
    if (!sess) html += '<div style="margin-top:12px"><button class="btn primary big" id="start">Iniciar treino</button></div>';
    html += '<div class="stepper" id="stepper"></div>';
    html += '<div class="pos">Exercício ' + (idx + 1) + " de " + day.items.length + "</div>";
    html += exHTML(day, it);
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
    renderDay();
    if (sess) tick();
    window.scrollTo(0, 0);
  }

  function selectDay(id) {
    current = id;
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
    delete drafts[key];
    guideOpen = card.querySelector("details").open;
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
    ["treino", "hist", "ajustes"].forEach(function (id) { $(id).hidden = id !== v; });
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-view") === v);
    });
    if (v === "hist") renderHist(); else if (v === "treino") renderDay(); else renderSettings();
    window.scrollTo(0, 0);
  }

  /* ---------- ajustes do cronômetro ---------- */
  function renderSettings() {
    $("set-rest").value = String(state.settings.rest);
    $("set-wake").checked = !!state.settings.wake;
    $("set-lock").checked = !!state.settings.lock;
    var p = ("Notification" in window) ? Notification.permission : "unsupported";
    $("notif-state").textContent = p === "granted" ? "Notificações ativadas" : p === "denied" ? "Notificações bloqueadas nas configurações do navegador" : p === "default" ? "Notificações desativadas" : "Este navegador não suporta notificações";
    $("set-notif").hidden = p !== "default";
    $("pip-row").hidden = !pipSupported();
    $("fit-note").hidden = !fitActive;
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
  $("set-pip").addEventListener("click", startPip);

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
    var key = card.getAttribute("data-key"), d = drafts[key] || (drafts[key] = {
      w: card.querySelector('[data-f="w"]').value, r: card.querySelector('[data-f="r"]').value, n: card.querySelector('[data-f="n"]').checked
    });
    d.w = card.querySelector('[data-f="w"]').value;
    d.r = card.querySelector('[data-f="r"]').value;
    d.n = card.querySelector('[data-f="n"]').checked;
  });
  $("day").addEventListener("toggle", function (e) { if (e.target.tagName === "DETAILS") guideOpen = e.target.open; }, true);
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
        showView(!$("hist").hidden ? "hist" : !$("ajustes").hidden ? "ajustes" : "treino");
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

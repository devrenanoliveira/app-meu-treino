/* Meu Treino. Usa EX e DAYS definidos em data.js. Os registros ficam no localStorage do aparelho. */
(function () {
  "use strict";
  var KEY = "meutreino:v1";
  var JS_DAY_TO_ID = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

  /* ---------- utilidades ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmt(iso) { var p = String(iso).split("-"); return p[2] + "/" + p[1]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(s) { var m = String(s || "").replace(",", ".").match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
  function setsOf(str) { return parseInt(str, 10) || 0; }
  function topReps(str) { var m = /x(\d+)(?:-(\d+))?/.exec(str); return m ? parseInt(m[2] || m[1], 10) : 0; }
  function $(id) { return document.getElementById(id); }

  /* ---------- estado ---------- */
  function persist(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function seed() {
    var s = { logs: {} };
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
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1600);
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
      '<span class="chip on" id="chip-done"></span></div></div><div class="list">';
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

  /* ---------- eventos ---------- */
  $("week").addEventListener("click", function (e) {
    var b = e.target.closest(".day-tab");
    if (b) selectDay(b.getAttribute("data-id"));
  });
  $("day").addEventListener("click", function (e) {
    var b = e.target.closest("[data-save]");
    if (b) saveEntry(b.closest(".ex"), b.getAttribute("data-save"));
  });
  document.querySelector(".seg").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-view]");
    if (b) showView(b.getAttribute("data-view"));
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
        state = { logs: o.logs };
        persist(state);
        showView($("hist").hidden ? "treino" : "hist");
        toast("Backup importado");
      } catch (err) {
        toast("Arquivo de backup inválido");
      }
    };
    rd.readAsText(f);
    e.target.value = "";
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

  selectDay(JS_DAY_TO_ID[new Date().getDay()]);
})();

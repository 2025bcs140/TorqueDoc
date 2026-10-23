/**
 * Server-rendered operations dashboard.
 *
 * The mobile app is the primary client, but opening the API URL in a browser
 * should not dump raw JSON at a non-developer. This page is a small, dependency
 * free client for the same public API: garage CRUD, the deterministic symptom
 * checklist, ranked causes, repair guides, and saved history.
 *
 * It intentionally reuses the deployment's shared API key. Like the APK, this
 * page is a demo/owner tool, not a multi-user authenticated product.
 */
export function renderDashboard(apiAccessToken: string): string {
  const token = JSON.stringify(apiAccessToken).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#15181c">
<title>TorqueDoc — Garage dashboard</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #101317;
    --panel: #171b20;
    --panel-2: #1e242b;
    --line: #303842;
    --text: #f2f5f7;
    --muted: #9aa6b2;
    --accent: #ff8a3d;
    --accent-soft: rgba(255, 138, 61, 0.14);
    --good: #4fd1a1;
    --high: #ffb020;
    --urgent: #ff5d5d;
    --radius: 16px;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { min-height: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(900px 500px at 90% -10%, rgba(255, 138, 61, 0.12), transparent 60%),
      radial-gradient(700px 500px at -10% 110%, rgba(79, 209, 161, 0.07), transparent 60%),
      var(--bg);
    color: var(--text);
    font-family: var(--font);
  }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  .topbar {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    padding: 16px 28px;
    background: rgba(16, 19, 23, 0.88);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(14px);
  }
  .brand { display: flex; align-items: center; gap: 13px; }
  .logo {
    display: grid; place-items: center; width: 42px; height: 42px;
    border-radius: 12px; background: var(--accent); color: #17120e;
    font-weight: 900; letter-spacing: -1px;
  }
  .brand h1 { margin: 0; font-size: 19px; letter-spacing: -0.4px; }
  .brand p { margin: 2px 0 0; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; }
  .top-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
  .pill {
    display: inline-flex; align-items: center; gap: 7px;
    border: 1px solid var(--line); border-radius: 999px;
    background: var(--panel); color: var(--muted);
    padding: 7px 11px; font-size: 12px; white-space: nowrap;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
  .dot.on { background: var(--good); box-shadow: 0 0 0 4px rgba(79, 209, 161, 0.12); }
  .dot.off { background: var(--urgent); }
  .top-actions a { color: var(--text); text-decoration: none; }
  .top-actions a:hover { color: var(--accent); }
  .layout {
    display: grid; grid-template-columns: 330px minmax(0, 1fr);
    gap: 22px; max-width: 1440px; margin: 0 auto; padding: 24px 28px 44px;
  }
  .garage, .workspace {
    border: 1px solid var(--line); border-radius: var(--radius);
    background: linear-gradient(180deg, rgba(255,255,255,0.018), transparent 30%), var(--panel);
  }
  .garage { padding: 18px; align-self: start; position: sticky; top: 92px; }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .section-head h2 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.4px; color: var(--muted); }
  .btn {
    border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2);
    color: var(--text); padding: 9px 12px; transition: 0.15s ease;
  }
  .btn:hover { border-color: #4a5663; transform: translateY(-1px); }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #1c130d; font-weight: 750; }
  .btn.primary:hover { filter: brightness(1.06); }
  .btn.ghost { background: transparent; }
  .btn.danger { color: #ff9b9b; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  .btn.small { padding: 6px 9px; font-size: 12px; border-radius: 8px; }
  .vehicle-list { display: grid; gap: 10px; }
  .vehicle-card {
    width: 100%; text-align: left; border: 1px solid var(--line); border-radius: 13px;
    background: var(--panel-2); color: var(--text); padding: 13px; transition: 0.15s ease;
  }
  .vehicle-card:hover { border-color: #53606d; }
  .vehicle-card.active { border-color: var(--accent); background: var(--accent-soft); }
  .vehicle-top { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
  .vehicle-name { font-weight: 750; line-height: 1.25; }
  .vehicle-meta { color: var(--muted); font-size: 12px; margin-top: 5px; }
  .type-tag { font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); }
  .empty-garage { color: var(--muted); font-size: 13px; line-height: 1.5; padding: 10px 0; }
  form.vehicle-form { display: grid; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
  .field { display: grid; gap: 5px; }
  .field label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; }
  .field input, .field select {
    width: 100%; border: 1px solid var(--line); border-radius: 9px;
    background: #11151a; color: var(--text); padding: 9px 10px; outline: none;
  }
  .field input:focus, .field select:focus { border-color: var(--accent); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .workspace { min-height: 560px; padding: 22px; }
  .workspace-empty { display: grid; place-items: center; min-height: 480px; text-align: center; color: var(--muted); }
  .workspace-empty strong { display: block; color: var(--text); font-size: 20px; margin-bottom: 7px; }
  .vehicle-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .vehicle-head h2 { margin: 0; font-size: clamp(24px, 3vw, 34px); letter-spacing: -1px; }
  .vehicle-head .sub { color: var(--muted); margin-top: 6px; }
  .stat-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .tabs { display: flex; gap: 8px; margin: 18px 0; border-bottom: 1px solid var(--line); }
  .tab { border: 0; background: transparent; color: var(--muted); padding: 10px 3px 12px; margin-right: 16px; border-bottom: 2px solid transparent; }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); }
  .panel-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 4px 0 14px; }
  .panel-title h3 { margin: 0; font-size: 18px; }
  .panel-title span { color: var(--muted); font-size: 12px; }
  .checklist { display: grid; gap: 14px; }
  .symptom-group { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .symptom-group h4 {
    margin: 0; padding: 9px 12px; background: #13171c; color: var(--muted);
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
  }
  .symptom-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .symptom {
    display: flex; align-items: flex-start; gap: 9px; padding: 10px 12px;
    border-top: 1px solid rgba(48, 56, 66, 0.55); color: #dfe6eb; font-size: 13px; line-height: 1.35;
    cursor: pointer;
  }
  .symptom:nth-child(odd) { border-right: 1px solid rgba(48, 56, 66, 0.55); }
  .symptom:hover { background: rgba(255,255,255,0.025); }
  .symptom input { accent-color: var(--accent); margin-top: 2px; }
  .diagnose-bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 18px 0 6px; }
  .diagnose-bar .hint { color: var(--muted); font-size: 12px; }
  .results { display: grid; gap: 12px; margin-top: 16px; }
  .result {
    border: 1px solid var(--line); border-radius: 13px; background: var(--panel-2); padding: 15px;
  }
  .result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .result h4 { margin: 0; font-size: 16px; }
  .severity { font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 4px 7px; border-radius: 999px; background: #252c34; color: var(--muted); white-space: nowrap; }
  .severity.high { color: #ffd18a; background: rgba(255, 176, 32, 0.14); }
  .severity.urgent { color: #ffb0b0; background: rgba(255, 93, 93, 0.14); }
  .severity.low { color: #9de7cb; background: rgba(79, 209, 161, 0.12); }
  .confidence { display: flex; align-items: center; gap: 10px; margin: 11px 0 8px; color: var(--muted); font-size: 12px; }
  .bar { flex: 1; height: 6px; border-radius: 99px; background: #0e1115; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), #ffbf7a); }
  .matched { color: var(--muted); font-size: 12px; line-height: 1.5; }
  .result-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .history-list { display: grid; gap: 10px; }
  .history-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); padding: 13px; }
  .history-row .when { color: var(--muted); font-size: 11px; margin-top: 4px; }
  .history-row .top-cause { font-weight: 650; font-size: 13px; }
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 20px;
    background: rgba(0, 0, 0, 0.72); backdrop-filter: blur(5px);
  }
  .modal {
    width: min(720px, 100%); max-height: min(82vh, 780px); overflow: auto;
    border: 1px solid #46515e; border-radius: 18px; background: var(--panel); padding: 22px;
    box-shadow: 0 30px 90px rgba(0,0,0,0.55);
  }
  .modal-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
  .modal h3 { margin: 0; font-size: 21px; }
  .modal .meta { color: var(--muted); font-size: 12px; margin-top: 7px; }
  .modal h4 { margin: 20px 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
  .modal ul, .modal ol { margin: 0; padding-left: 21px; color: #dce4ea; line-height: 1.65; }
  .modal li + li { margin-top: 7px; }
  .empty-note { color: var(--muted); font-size: 13px; line-height: 1.55; border: 1px dashed var(--line); border-radius: 12px; padding: 18px; }
  .toast {
    position: fixed; right: 22px; bottom: 22px; z-index: 80; max-width: 360px;
    background: #252d36; border: 1px solid #46515e; border-radius: 11px;
    padding: 12px 14px; color: var(--text); box-shadow: 0 18px 50px rgba(0,0,0,0.4);
    opacity: 0; transform: translateY(8px); pointer-events: none; transition: 0.2s ease;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.error { border-color: #7f3b3b; background: #3a2020; }
  .loading { color: var(--muted); font-size: 13px; padding: 8px 0; }
  footer { max-width: 1440px; margin: 0 auto; padding: 0 28px 30px; color: #707c88; font-size: 11px; line-height: 1.6; }
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; padding: 16px; }
    .garage { position: static; }
    .symptom-options { grid-template-columns: 1fr; }
    .symptom:nth-child(odd) { border-right: 0; }
    .topbar { padding: 13px 16px; }
    .workspace { padding: 16px; }
    .vehicle-head { flex-direction: column; }
    footer { padding: 0 16px 24px; }
  }
</style>
</head>
<body>
<header class="topbar">
  <div class="brand">
    <div class="logo">TD</div>
    <div>
      <h1>TorqueDoc</h1>
      <p>Garage dashboard</p>
    </div>
  </div>
  <div class="top-actions">
    <span class="pill"><span class="dot" id="apiDot"></span><span id="apiStatus">Connecting…</span></span>
    <span class="pill" id="aiPill">AI checking…</span>
    <a class="pill" href="/app" target="_blank" rel="noreferrer">Open full app ↗</a>
    <a class="pill" href="https://github.com/2025bcs140/TorqueDoc" target="_blank" rel="noreferrer">GitHub ↗</a>
  </div>
</header>

<main class="layout">
  <aside class="garage">
    <div class="section-head">
      <h2>Garage</h2>
      <button class="btn primary small" id="addBtn" type="button">+ Add vehicle</button>
    </div>
    <div class="vehicle-list" id="vehicleList"><div class="loading">Loading garage…</div></div>
    <form class="vehicle-form" id="vehicleForm" hidden>
      <div class="form-row">
        <div class="field">
          <label for="vType">Type</label>
          <select id="vType" required>
            <option value="car">Car</option>
            <option value="motorcycle">Motorcycle</option>
          </select>
        </div>
        <div class="field">
          <label for="vYear">Year</label>
          <input id="vYear" type="number" min="1900" max="2100" required placeholder="2018">
        </div>
      </div>
      <div class="field">
        <label for="vNickname">Nickname (optional)</label>
        <input id="vNickname" maxlength="60" placeholder="Daily driver">
      </div>
      <div class="form-row">
        <div class="field">
          <label for="vMake">Make</label>
          <input id="vMake" required maxlength="60" placeholder="Toyota">
        </div>
        <div class="field">
          <label for="vModel">Model</label>
          <input id="vModel" required maxlength="60" placeholder="Corolla">
        </div>
      </div>
      <div class="field">
        <label for="vMileage">Mileage</label>
        <input id="vMileage" type="number" min="0" max="2000000" required placeholder="85000">
      </div>
      <div class="form-row">
        <button class="btn primary" type="submit" id="saveVehicleBtn">Save vehicle</button>
        <button class="btn ghost" type="button" id="cancelVehicleBtn">Cancel</button>
      </div>
    </form>
  </aside>

  <section class="workspace">
    <div class="workspace-empty" id="workspaceEmpty">
      <div>
        <strong>Select a vehicle to start.</strong>
        Add a car or motorcycle in the garage, then run the symptom checklist.
      </div>
    </div>

    <div id="vehicleWorkspace" hidden>
      <div class="vehicle-head">
        <div>
          <h2 id="vehicleTitle">Vehicle</h2>
          <div class="sub" id="vehicleSub"></div>
          <div class="stat-row">
            <span class="pill" id="mileagePill"></span>
            <span class="pill" id="typePill"></span>
            <span class="pill" id="historyPill"></span>
          </div>
        </div>
        <button class="btn danger small" id="deleteVehicleBtn" type="button">Delete vehicle</button>
      </div>

      <div class="tabs" role="tablist">
        <button class="tab active" id="diagnoseTab" type="button">Symptom checklist</button>
        <button class="tab" id="historyTab" type="button">History</button>
      </div>

      <div id="diagnosePanel">
        <div class="panel-title">
          <h3>What is it doing?</h3>
          <span id="selectedCount">0 selected</span>
        </div>
        <div class="checklist" id="checklist"><div class="loading">Loading symptoms…</div></div>
        <div class="diagnose-bar">
          <span class="hint">Coverage shows how many known signs of a cause you reported — it is not a probability.</span>
          <button class="btn primary" id="diagnoseBtn" type="button" disabled>Diagnose selected signs</button>
        </div>
        <div class="results" id="results"></div>
      </div>

      <div id="historyPanel" hidden>
        <div class="panel-title">
          <h3>Saved diagnoses</h3>
          <span id="historyCount"></span>
        </div>
        <div class="history-list" id="historyList"><div class="loading">Loading history…</div></div>
      </div>
    </div>
  </section>
</main>

<footer>
  TorqueDoc demo dashboard. The mobile app is the primary interface. Cars and motorcycles only.
  Free-hosted data can reset when the API service restarts.
</footer>

<div id="modalRoot"></div>
<div class="toast" id="toast" role="status"></div>

<script>
(function () {
  "use strict";
  var API_TOKEN = ${token};
  var state = {
    vehicles: [],
    selectedId: null,
    symptoms: [],
    guides: {},
    selected: Object.create(null),
    matches: [],
    history: [],
    health: null
  };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var categoryNames = {
    engine: "Engine",
    starting_charging: "Starting & charging",
    brakes: "Brakes",
    cooling: "Cooling",
    exhaust: "Exhaust",
    drive_chain_clutch: "Drive, chain & clutch"
  };

  function toast(message, isError) {
    var el = $("toast");
    el.textContent = message;
    el.className = "toast show" + (isError ? " error" : "");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () { el.className = "toast"; }, 4200);
  }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ "Accept": "application/json" }, options.headers || {});
    if (API_TOKEN) headers["X-TorqueDoc-Key"] = API_TOKEN;
    if (options.body) headers["Content-Type"] = "application/json";
    var response = await fetch(path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    var data = null;
    if (response.status !== 204) {
      var text = await response.text();
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    }
    if (!response.ok) {
      var message = data && data.error ? data.error : "Request failed (" + response.status + ")";
      throw new Error(message);
    }
    return data;
  }

  function selectedVehicle() {
    return state.vehicles.find(function (v) { return v.id === state.selectedId; }) || null;
  }

  function vehicleLabel(v) {
    if (!v) return "Vehicle";
    return v.nickname ? v.nickname : (v.make + " " + v.model);
  }

  function renderVehicles() {
    var box = $("vehicleList");
    if (!state.vehicles.length) {
      box.innerHTML = '<div class="empty-garage">No vehicles yet. Add a car or motorcycle to begin.</div>';
      return;
    }
    box.innerHTML = state.vehicles.map(function (v) {
      var title = v.nickname ? v.nickname : (v.make + " " + v.model);
      var sub = v.nickname ? (v.make + " " + v.model) : (v.year + " · " + Number(v.mileage).toLocaleString() + " mi");
      return '<button type="button" class="vehicle-card' + (v.id === state.selectedId ? ' active' : '') + '" data-vehicle="' + esc(v.id) + '">' +
        '<div class="vehicle-top"><div><div class="vehicle-name">' + esc(title) + '</div>' +
        '<div class="vehicle-meta">' + esc(sub) + '</div></div>' +
        '<span class="type-tag">' + esc(v.type === "motorcycle" ? "moto" : "car") + '</span></div></button>';
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-vehicle]"), function (button) {
      button.addEventListener("click", function () { selectVehicle(button.getAttribute("data-vehicle")); });
    });
  }

  function renderWorkspace() {
    var v = selectedVehicle();
    $("workspaceEmpty").hidden = Boolean(v);
    $("vehicleWorkspace").hidden = !v;
    if (!v) return;
    $("vehicleTitle").textContent = v.nickname || (v.make + " " + v.model);
    $("vehicleSub").textContent = v.nickname ? (v.make + " " + v.model) : (v.year + " model year");
    $("mileagePill").textContent = Number(v.mileage).toLocaleString() + " miles";
    $("typePill").textContent = v.type === "motorcycle" ? "Motorcycle" : "Car";
    $("historyPill").textContent = state.history.length + (state.history.length === 1 ? " saved diagnosis" : " saved diagnoses");
    $("historyCount").textContent = state.history.length + " saved";
  }

  function renderChecklist() {
    var box = $("checklist");
    if (!state.symptoms.length) {
      box.innerHTML = '<div class="empty-note">No symptoms are available for this vehicle type.</div>';
      updateSelectedCount();
      return;
    }
    var groups = {};
    state.symptoms.forEach(function (s) { (groups[s.category] = groups[s.category] || []).push(s); });
    var html = Object.keys(groups).map(function (key) {
      return '<section class="symptom-group"><h4>' + esc(categoryNames[key] || key) + '</h4><div class="symptom-options">' +
        groups[key].map(function (s) {
          return '<label class="symptom"><input type="checkbox" value="' + esc(s.id) + '"' + (state.selected[s.id] ? ' checked' : '') + '>' +
            '<span>' + esc(s.label) + '</span></label>';
        }).join("") +
        '</div></section>';
    }).join("");
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('input[type="checkbox"]'), function (input) {
      input.addEventListener("change", function () {
        if (input.checked) state.selected[input.value] = true;
        else delete state.selected[input.value];
        updateSelectedCount();
      });
    });
    updateSelectedCount();
  }

  function selectedIds() {
    return Object.keys(state.selected);
  }

  function updateSelectedCount() {
    var count = selectedIds().length;
    $("selectedCount").textContent = count + " selected";
    $("diagnoseBtn").disabled = count === 0;
  }

  function severityClass(severity) {
    return "severity " + (severity || "medium");
  }

  function renderResults() {
    var box = $("results");
    if (!state.matches.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = state.matches.map(function (match) {
      var pct = Math.round((match.confidence || 0) * 100);
      var matched = (match.matchedSymptoms || []).map(function (s) { return s.label; });
      var total = match.totalLinkedSymptoms;
      var coverage = total ? (match.matchedSymptomIds ? match.matchedSymptomIds.length : matched.length) + " of " + total + " known signs" : "";
      return '<article class="result">' +
        '<div class="result-head"><h4>' + esc(match.cause.label) + '</h4><span class="' + severityClass(match.cause.severity) + '">' + esc(match.cause.severity) + '</span></div>' +
        '<div class="confidence"><div class="bar"><i style="width:' + Math.max(2, pct) + '%"></i></div><strong>' + pct + '%</strong><span>' + esc(coverage) + '</span></div>' +
        '<div class="matched"><strong>Matched:</strong> ' + (matched.length ? esc(matched.join(" · ")) : "No symptom labels on this older record") + '</div>' +
        '<div class="result-actions"><button class="btn small" type="button" data-guide="' + esc(match.cause.repairGuideId) + '">View repair guide</button></div>' +
        '</article>';
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-guide]"), function (button) {
      button.addEventListener("click", function () { showGuide(button.getAttribute("data-guide")); });
    });
  }

  function renderHistory() {
    var box = $("historyList");
    if (!state.history.length) {
      box.innerHTML = '<div class="empty-note">No saved diagnoses yet. Run the checklist to create the first one.</div>';
      return;
    }
    box.innerHTML = state.history.map(function (record) {
      var top = record.matches && record.matches[0];
      var date = new Date(record.createdAt);
      var when = isNaN(date.getTime()) ? record.createdAt : date.toLocaleString();
      var count = (record.matches || []).length;
      return '<button class="history-row" type="button" data-history="' + esc(record.id) + '">' +
        '<span><span class="top-cause">' + esc(top ? top.cause.label : "No matches") + '</span>' +
        '<span class="when">' + esc(when) + ' · ' + count + (count === 1 ? " possible cause" : " possible causes") + '</span></span>' +
        '<span class="type-tag">Open</span></button>';
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-history]"), function (button) {
      button.addEventListener("click", function () {
        var record = state.history.find(function (r) { return r.id === button.getAttribute("data-history"); });
        if (record) showHistory(record);
      });
    });
  }

  function showModal(html) {
    $("modalRoot").innerHTML = '<div class="modal-backdrop" id="modalBackdrop"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    $("modalBackdrop").addEventListener("click", function (event) {
      if (event.target === $("modalBackdrop")) closeModal();
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-close-modal]"), function (button) {
      button.addEventListener("click", closeModal);
    });
  }

  function closeModal() { $("modalRoot").innerHTML = ""; }

  function guideMarkup(guide) {
    var tools = (guide.toolsNeeded || []).map(function (tool) { return "<li>" + esc(tool) + "</li>"; }).join("");
    var steps = (guide.steps || []).map(function (step) { return "<li>" + esc(step) + "</li>"; }).join("");
    return '<div class="modal-head"><div><h3>' + esc(guide.title) + '</h3>' +
      '<div class="meta">' + esc(guide.difficulty) + ' · about ' + esc(guide.estimatedMinutes) + ' min · ' + esc(guide.category) + '</div></div>' +
      '<button class="btn small ghost" type="button" data-close-modal="true">Close</button></div>' +
      '<h4>Tools</h4><ul>' + (tools || "<li>No special tools listed.</li>") + '</ul>' +
      '<h4>Steps</h4><ol>' + steps + '</ol>';
  }

  async function showGuide(id) {
    try {
      var guide = state.guides[id];
      if (!guide) {
        var data = await api("/repair-guides/" + encodeURIComponent(id));
        guide = data.repairGuide;
        state.guides[id] = guide;
      }
      showModal(guideMarkup(guide));
    } catch (error) { toast(error.message, true); }
  }

  function showHistory(record) {
    var matches = (record.matches || []).map(function (match) {
      var pct = Math.round((match.confidence || 0) * 100);
      var names = (match.matchedSymptoms || []).map(function (s) { return s.label; }).join(" · ");
      return '<article class="result"><div class="result-head"><h4>' + esc(match.cause.label) + '</h4>' +
        '<span class="' + severityClass(match.cause.severity) + '">' + esc(match.cause.severity) + '</span></div>' +
        '<div class="confidence"><div class="bar"><i style="width:' + Math.max(2, pct) + '%"></i></div><strong>' + pct + '%</strong></div>' +
        '<div class="matched"><strong>Matched:</strong> ' + esc(names || "—") + '</div>' +
        '<div class="result-actions"><button class="btn small" type="button" data-guide="' + esc(match.cause.repairGuideId) + '">View repair guide</button></div></article>';
    }).join("");
    var date = new Date(record.createdAt);
    showModal('<div class="modal-head"><div><h3>Saved diagnosis</h3>' +
      '<div class="meta">' + esc(isNaN(date.getTime()) ? record.createdAt : date.toLocaleString()) + ' · ' + esc(record.source) + '</div></div>' +
      '<button class="btn small ghost" type="button" data-close-modal="true">Close</button></div>' +
      '<div class="results">' + (matches || '<div class="empty-note">This record has no matches.</div>') + '</div>');
    Array.prototype.forEach.call(document.querySelectorAll("[data-guide]"), function (button) {
      button.addEventListener("click", function () { showGuide(button.getAttribute("data-guide")); });
    });
  }

  async function selectVehicle(id) {
    state.selectedId = id;
    state.selected = Object.create(null);
    state.matches = [];
    state.symptoms = [];
    state.guides = {};
    state.history = [];
    renderVehicles();
    renderWorkspace();
    $("checklist").innerHTML = '<div class="loading">Loading symptoms…</div>';
    $("results").innerHTML = "";
    $("historyList").innerHTML = '<div class="loading">Loading history…</div>';
    updateSelectedCount();
    var vehicle = selectedVehicle();
    if (!vehicle) return;
    try {
      var results = await Promise.all([
        api("/symptoms?vehicleType=" + encodeURIComponent(vehicle.type)),
        api("/repair-guides?vehicleType=" + encodeURIComponent(vehicle.type)),
        api("/vehicles/" + encodeURIComponent(vehicle.id) + "/history?limit=100")
      ]);
      state.symptoms = results[0].symptoms || [];
      (results[1].repairGuides || []).forEach(function (g) { state.guides[g.id] = g; });
      state.history = results[2].history || [];
      renderChecklist();
      renderHistory();
      renderWorkspace();
    } catch (error) {
      $("checklist").innerHTML = '<div class="empty-note">Could not load symptoms: ' + esc(error.message) + '</div>';
      $("historyList").innerHTML = '<div class="empty-note">Could not load history: ' + esc(error.message) + '</div>';
      toast(error.message, true);
    }
  }

  async function loadVehicles() {
    try {
      var data = await api("/vehicles");
      state.vehicles = data.vehicles || [];
      if (state.selectedId && !state.vehicles.some(function (v) { return v.id === state.selectedId; })) {
        state.selectedId = null;
      }
      renderVehicles();
      if (!state.vehicles.length) {
        state.selectedId = null;
        renderWorkspace();
        return;
      }
      if (!state.selectedId) state.selectedId = state.vehicles[0].id;
      await selectVehicle(state.selectedId);
    } catch (error) {
      $("vehicleList").innerHTML = '<div class="empty-note">Could not load garage: ' + esc(error.message) + '</div>';
      toast(error.message, true);
    }
  }

  async function runDiagnosis() {
    var vehicle = selectedVehicle();
    var ids = selectedIds();
    if (!vehicle || !ids.length) return;
    var button = $("diagnoseBtn");
    button.disabled = true;
    button.textContent = "Diagnosing…";
    try {
      var data = await api("/diagnose", {
        method: "POST",
        body: { vehicleType: vehicle.type, vehicleId: vehicle.id, symptomIds: ids, source: "checklist" }
      });
      state.matches = data.matches || [];
      renderResults();
      if (state.matches.length) {
        toast("Found " + state.matches.length + " possible " + (state.matches.length === 1 ? "cause" : "causes") + ".");
      } else {
        toast("No matching causes for that combination.", true);
      }
      var historyData = await api("/vehicles/" + encodeURIComponent(vehicle.id) + "/history?limit=100");
      state.history = historyData.history || [];
      renderHistory();
      renderWorkspace();
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.textContent = "Diagnose selected signs";
      updateSelectedCount();
    }
  }

  async function addVehicle(event) {
    event.preventDefault();
    var button = $("saveVehicleBtn");
    button.disabled = true;
    button.textContent = "Saving…";
    var body = {
      type: $("vType").value,
      nickname: $("vNickname").value.trim() || null,
      make: $("vMake").value.trim(),
      model: $("vModel").value.trim(),
      year: Number($("vYear").value),
      mileage: Number($("vMileage").value)
    };
    try {
      var data = await api("/vehicles", { method: "POST", body: body });
      state.selectedId = data.vehicle.id;
      $("vehicleForm").reset();
      $("vehicleForm").hidden = true;
      await loadVehicles();
      toast("Vehicle added.");
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "Save vehicle";
    }
  }

  async function deleteVehicle() {
    var vehicle = selectedVehicle();
    if (!vehicle) return;
    if (!window.confirm("Delete " + vehicleLabel(vehicle) + " and all of its saved history?")) return;
    try {
      await api("/vehicles/" + encodeURIComponent(vehicle.id), { method: "DELETE" });
      state.selectedId = null;
      await loadVehicles();
      toast("Vehicle deleted.");
    } catch (error) { toast(error.message, true); }
  }

  function switchTab(tab) {
    var diagnose = tab === "diagnose";
    $("diagnoseTab").classList.toggle("active", diagnose);
    $("historyTab").classList.toggle("active", !diagnose);
    $("diagnosePanel").hidden = !diagnose;
    $("historyPanel").hidden = diagnose;
  }

  async function loadHealth() {
    try {
      var health = await api("/health");
      state.health = health;
      $("apiDot").className = "dot on";
      $("apiStatus").textContent = "API online";
      $("aiPill").textContent = health.ai && health.ai.configured
        ? "AI: " + (health.ai.provider ? health.ai.provider + " / " : "") + health.ai.model
        : "AI: not configured";
    } catch (error) {
      $("apiDot").className = "dot off";
      $("apiStatus").textContent = "API unreachable";
      $("aiPill").textContent = "AI: unknown";
    }
  }

  $("addBtn").addEventListener("click", function () {
    $("vehicleForm").hidden = false;
    $("vMake").focus();
  });
  $("cancelVehicleBtn").addEventListener("click", function () { $("vehicleForm").hidden = true; });
  $("vehicleForm").addEventListener("submit", addVehicle);
  $("diagnoseBtn").addEventListener("click", runDiagnosis);
  $("deleteVehicleBtn").addEventListener("click", deleteVehicle);
  $("diagnoseTab").addEventListener("click", function () { switchTab("diagnose"); });
  $("historyTab").addEventListener("click", function () { switchTab("history"); });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeModal(); });

  loadHealth();
  loadVehicles();
})();
</script>
</body>
</html>`;
}

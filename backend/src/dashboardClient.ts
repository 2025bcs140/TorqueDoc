/**
 * Browser behaviour for the service console.
 *
 * This is intentionally dependency-free and talks only to the same account
 * API the mobile app uses. Nothing is cached in localStorage except the
 * opaque session token; garage and history data always come from the account
 * scoped API for the active session.
 */
export function renderDashboardClient(apiAccessToken: string): string {
  const token = JSON.stringify(apiAccessToken).replace(/</g, '\\u003c');

  return `
(function () {
  "use strict";

  var API_TOKEN = ${token};
  var SESSION_KEY = "torquedoc.dashboard.session";
  var sessionToken = localStorage.getItem(SESSION_KEY) || "";
  var state = {
    user: null,
    vehicles: [],
    selectedId: null,
    symptoms: [],
    guides: {},
    selected: Object.create(null),
    matches: [],
    history: [],
    histories: Object.create(null),
    activity: [],
    health: null,
    hasDiagnosed: false,
    editingId: null
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
  var severityLabels = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

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
    if (sessionToken && !options.noSession) headers["Authorization"] = "Bearer " + sessionToken;
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

    if (response.status === 401 && sessionToken && !options.noSession) {
      sessionToken = "";
      localStorage.removeItem(SESSION_KEY);
      resetSessionState();
      showLoginGate();
    }

    if (!response.ok) {
      var message = data && data.error ? data.error : "Request failed (" + response.status + ")";
      throw new Error(message);
    }
    return data;
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\\s+/).filter(Boolean);
    if (!parts.length) return "TD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function renderAccount() {
    var name = state.user ? state.user.displayName : "Your account";
    var email = state.user ? state.user.email : "Private service console";
    var first = name.trim().split(/\\s+/)[0] || name;
    var hour = new Date().getHours();
    var greeting = hour < 12 ? "Good morning" : (hour < 18 ? "Good afternoon" : "Good evening");

    $("accountName").textContent = name;
    $("accountEmail").textContent = email;
    $("accountAvatar").textContent = initials(name);
    $("greeting").textContent = state.user ? greeting + ", " + first + "." : "Welcome back.";
  }

  function showLoginGate() {
    $("authGate").hidden = false;
    $("signOutBtn").hidden = true;
  }

  function hideLoginGate() {
    $("authGate").hidden = true;
    $("signOutBtn").hidden = false;
  }

  function resetSessionState() {
    state.user = null;
    state.vehicles = [];
    state.selectedId = null;
    state.symptoms = [];
    state.guides = {};
    state.selected = Object.create(null);
    state.matches = [];
    state.history = [];
    state.histories = Object.create(null);
    state.activity = [];
    state.hasDiagnosed = false;
    closeModal();
    closeVehicleForm();
    renderAccount();
    renderVehicles();
    renderWorkspace();
    renderHero();
    renderStats();
    renderActivity();
  }

  async function signIn(event) {
    event.preventDefault();
    var button = $("loginBtn");
    var errorBox = $("loginError");
    errorBox.textContent = "";
    button.disabled = true;
    button.textContent = "Signing in…";
    try {
      var data = await api("/auth/login", {
        method: "POST",
        noSession: true,
        body: { email: $("loginEmail").value.trim(), password: $("loginPassword").value }
      });
      sessionToken = data.token;
      localStorage.setItem(SESSION_KEY, sessionToken);
      state.user = data.user || null;
      $("loginPassword").value = "";
      renderAccount();
      hideLoginGate();
      await loadVehicles();
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Sign in to service console";
    }
  }

  function signOut() {
    var token = sessionToken;
    sessionToken = "";
    localStorage.removeItem(SESSION_KEY);
    resetSessionState();
    showLoginGate();
    if (token) {
      var headers = { "Authorization": "Bearer " + token };
      if (API_TOKEN) headers["X-TorqueDoc-Key"] = API_TOKEN;
      fetch("/auth/logout", { method: "POST", headers: headers }).catch(function () {});
    }
  }

  function selectedVehicle() {
    return state.vehicles.find(function (v) { return v.id === state.selectedId; }) || null;
  }

  function vehicleLabel(v) {
    if (!v) return "Vehicle";
    return v.nickname ? v.nickname : (v.make + " " + v.model);
  }

  function vehicleSub(v) {
    if (!v) return "";
    var name = v.nickname ? (v.make + " " + v.model) : (v.year + " " + v.make + " " + v.model);
    return name + " · " + Number(v.mileage || 0).toLocaleString() + " mi";
  }

  function formatMiles(value) {
    return Number(value || 0).toLocaleString() + " miles";
  }

  function formatWhen(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return value || "Unknown date";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function dateParts(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return { day: "—", time: value || "" };
    return {
      day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    };
  }

  function latestRecord(v) {
    return (state.histories[v.id] || [])[0] || null;
  }

  function vehicleStatus(v) {
    var record = latestRecord(v);
    if (!record) return { label: "Ready for check", cls: "ready" };
    var top = record.matches && record.matches[0];
    var severity = top && top.cause ? top.cause.severity : "medium";
    if (severity === "urgent") return { label: "Urgent attention", cls: "urgent" };
    if (severity === "high") return { label: "Needs attention", cls: "high" };
    if (!top) return { label: "Check complete", cls: "good" };
    return { label: "Recently checked", cls: "good" };
  }

  function renderVehicles() {
    var box = $("vehicleList");
    if (!state.vehicles.length) {
      box.innerHTML =
        '<div class="empty-garage">' +
          '<div class="empty-icon">+</div>' +
          '<strong>Your service bay is empty</strong>' +
          '<p>Add a car or motorcycle to start a private service record.</p>' +
          '<button type="button" class="btn primary small" id="emptyAddBtn">Add your first vehicle</button>' +
        '</div>';
      $("emptyAddBtn").addEventListener("click", openAddForm);
      return;
    }

    box.innerHTML = state.vehicles.map(function (v) {
      var status = vehicleStatus(v);
      var typeLabel = v.type === "motorcycle" ? "Motorcycle" : "Car";
      return '<button type="button" class="vehicle-card' + (v.id === state.selectedId ? ' active' : '') + '" data-vehicle="' + esc(v.id) + '" data-type="' + esc(v.type) + '">' +
        '<span class="vehicle-card-top">' +
          '<span class="vehicle-avatar" title="' + esc(typeLabel) + '">' + (v.type === "motorcycle" ? "M" : "C") + '</span>' +
          '<span class="status-chip ' + esc(status.cls) + '"><i></i>' + esc(status.label) + '</span>' +
        '</span>' +
        '<span class="vehicle-name">' + esc(vehicleLabel(v)) + '</span>' +
        '<span class="vehicle-meta">' + esc(vehicleSub(v)) + '</span>' +
        '<span class="vehicle-foot"><span class="miles">' + esc(formatMiles(v.mileage)) + '</span><span class="open-link">Open service →</span></span>' +
      '</button>';
    }).join("");

    Array.prototype.forEach.call(box.querySelectorAll("[data-vehicle]"), function (button) {
      button.addEventListener("click", function () {
        selectVehicle(button.getAttribute("data-vehicle"));
      });
    });
  }

  function renderHero() {
    var v = selectedVehicle();
    if (v) {
      $("heroCopy").textContent = "A guided check for " + vehicleLabel(v) + " takes about a minute. Select the signs you notice, review ranked causes, and open repair guidance.";
      $("heroVehicle").textContent = vehicleLabel(v);
      $("heroVehicleMeta").textContent = v.year + " " + v.make + " " + v.model + " · " + formatMiles(v.mileage);
      $("heroDiagnoseBtn").textContent = "Run a health check";
      $("heroHistoryBtn").hidden = false;
    } else {
      $("heroCopy").textContent = "Add your first car or motorcycle to start a private service record, run guided checks, and keep every diagnosis in one place.";
      $("heroVehicle").textContent = "No vehicle selected";
      $("heroVehicleMeta").textContent = "Add a vehicle to begin";
      $("heroDiagnoseBtn").textContent = "Add your first vehicle";
      $("heroHistoryBtn").hidden = true;
    }
  }

  function renderStats() {
    var checks = 0;
    var attention = 0;
    state.vehicles.forEach(function (v) {
      checks += (state.histories[v.id] || []).length;
      var status = vehicleStatus(v);
      if (status.cls === "high" || status.cls === "urgent") attention += 1;
    });

    $("statVehicles").textContent = String(state.vehicles.length);
    $("statVehiclesMeta").textContent = state.vehicles.length === 1 ? "vehicle in your care" : "vehicles in your care";
    $("statChecks").textContent = String(checks);
    $("statChecksMeta").textContent = checks === 1 ? "saved service check" : "saved service checks";
    $("statAttention").textContent = String(attention);
    $("statAttentionMeta").textContent = attention ? "needs a closer look" : "all caught up";

    var aiOnline = Boolean(state.health && state.health.ai && state.health.ai.configured);
    $("statAI").textContent = state.health ? (aiOnline ? "Online" : "Offline") : "Checking";
    $("statAIMeta").textContent = state.health
      ? (aiOnline ? "Free Cloudflare AI" : "Text checks available")
      : "Checking provider status";
  }

  function rebuildActivity() {
    state.activity = [];
    state.vehicles.forEach(function (v) {
      (state.histories[v.id] || []).forEach(function (record) {
        state.activity.push({ vehicle: v, record: record });
      });
    });
    state.activity.sort(function (a, b) {
      var left = new Date(a.record.createdAt).getTime();
      var right = new Date(b.record.createdAt).getTime();
      return (isNaN(right) ? 0 : right) - (isNaN(left) ? 0 : left);
    });
    renderVehicles();
    renderActivity();
    renderStats();
  }

  function renderActivity() {
    var box = $("activityList");
    if (!state.activity.length) {
      box.innerHTML = '<div class="activity-empty">No service activity yet. Run a guided check to start the record for this account.</div>';
      return;
    }

    box.innerHTML = state.activity.slice(0, 6).map(function (item) {
      var record = item.record;
      var vehicle = item.vehicle;
      var top = record.matches && record.matches[0];
      var severity = top && top.cause ? top.cause.severity : "medium";
      var pct = top ? Math.round((top.confidence || 0) * 100) : 0;
      return '<button class="activity-item" type="button" data-history="' + esc(record.id) + '">' +
        '<span class="activity-icon ' + esc(severity) + '">' + (top ? pct + "%" : "—") + '</span>' +
        '<span class="activity-main">' +
          '<span class="activity-title">' + esc(top ? top.cause.label : "No matching causes") + '</span>' +
          '<span class="activity-meta">' + esc(vehicleLabel(vehicle)) + ' · ' + esc(formatWhen(record.createdAt)) + '</span>' +
        '</span>' +
        '<span class="activity-sev ' + esc(severity) + '">' + esc(severityLabels[severity] || severity) + '</span>' +
      '</button>';
    }).join("");

    Array.prototype.forEach.call(box.querySelectorAll("[data-history]"), function (button) {
      button.addEventListener("click", function () {
        var record = state.activity.find(function (item) {
          return item.record.id === button.getAttribute("data-history");
        });
        if (record) showHistory(record.record);
      });
    });
  }

  function renderWorkspace() {
    var v = selectedVehicle();
    $("workspaceEmpty").hidden = Boolean(v);
    $("vehicleWorkspace").hidden = !v;

    if (!v) {
      $("summaryVehicle").textContent = "No vehicle selected";
      $("summaryChecks").textContent = "0";
      $("summaryLatest").textContent = "—";
      $("diagnoseBtn").disabled = true;
      return;
    }

    var status = vehicleStatus(v);
    $("vehicleTitle").textContent = vehicleLabel(v);
    $("vehicleSub").textContent = v.year + " " + v.make + " " + v.model + " · " + (v.type === "motorcycle" ? "Motorcycle" : "Car");
    $("mileagePill").textContent = formatMiles(v.mileage);
    $("typePill").textContent = v.type === "motorcycle" ? "Motorcycle" : "Car";
    $("historyPill").textContent = state.history.length + (state.history.length === 1 ? " saved check" : " saved checks");
    $("vehicleStatusPill").textContent = status.label;
    $("vehicleStatusPill").className = "pill status " + status.cls;
    $("historyCount").textContent = state.history.length + " saved";
    $("summaryVehicle").textContent = vehicleLabel(v);
    $("summaryChecks").textContent = String(state.history.length);

    var top = state.history[0] && state.history[0].matches && state.history[0].matches[0];
    $("summaryLatest").textContent = top
      ? top.cause.label + " · " + Math.round((top.confidence || 0) * 100) + "%"
      : "No checks yet";
    $("diagnoseBtn").textContent = "Run symptom check";
    $("diagnoseBtn").disabled = selectedIds().length === 0;
  }

  function renderChecklist() {
    var box = $("checklist");
    if (!state.symptoms.length) {
      box.innerHTML = '<div class="empty-note">No symptoms are available for this vehicle type.</div>';
      updateSelectedCount();
      return;
    }

    var groups = {};
    state.symptoms.forEach(function (s) {
      (groups[s.category] = groups[s.category] || []).push(s);
    });

    var html = '<div class="checklist-toolbar"><span>Select all that apply</span>' +
      '<button type="button" class="link-btn" id="clearSymptomsBtn">Clear all</button></div>';

    html += Object.keys(groups).map(function (key) {
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

    $("clearSymptomsBtn").addEventListener("click", function () {
      state.selected = Object.create(null);
      renderChecklist();
    });

    updateSelectedCount();
  }

  function selectedIds() {
    return Object.keys(state.selected);
  }

  function updateSelectedCount() {
    var count = selectedIds().length;
    $("selectedCount").textContent = count + (count === 1 ? " sign selected" : " signs selected");
    $("diagnoseBtn").disabled = count === 0 || !selectedVehicle();
  }

  function severityClass(severity) {
    return "severity " + (severity || "medium");
  }

  function renderResults() {
    var box = $("results");
    if (!state.matches.length) {
      box.innerHTML = state.hasDiagnosed
        ? '<div class="result-empty"><strong>No matching causes</strong><p>Try adding another sign you notice, or review the repair library for general guidance.</p></div>'
        : "";
      return;
    }

    box.innerHTML = state.matches.map(function (match) {
      var pct = Math.round((match.confidence || 0) * 100);
      var matched = (match.matchedSymptoms || []).map(function (s) { return s.label; });
      var total = match.totalLinkedSymptoms;
      var matchedCount = match.matchedSymptomIds ? match.matchedSymptomIds.length : matched.length;
      var coverage = total ? matchedCount + " of " + total + " known signs" : "";
      var severity = match.cause.severity || "medium";
      return '<article class="result">' +
        '<div class="result-head"><h4>' + esc(match.cause.label) + '</h4><span class="' + severityClass(severity) + '">' + esc(severityLabels[severity] || severity) + '</span></div>' +
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
      box.innerHTML = '<div class="history-empty">No saved checks for this vehicle yet. Run the symptom checklist to create the first service record.</div>';
      return;
    }

    box.innerHTML = state.history.map(function (record) {
      var top = record.matches && record.matches[0];
      var parts = dateParts(record.createdAt);
      var severity = top ? top.cause.severity : "medium";
      var count = (record.matches || []).length;
      return '<button class="history-row" type="button" data-history="' + esc(record.id) + '">' +
        '<span class="history-date"><strong>' + esc(parts.day) + '</strong><span>' + esc(parts.time) + '</span></span>' +
        '<span class="history-main">' +
          '<span class="history-cause">' + esc(top ? top.cause.label : "No matching causes") + '</span>' +
          '<span class="history-meta">' + count + (count === 1 ? " possible cause" : " possible causes") + ' · ' + esc(record.source || "checklist") + '</span>' +
        '</span>' +
        '<span class="history-severity ' + esc(severity) + '">' + esc(severityLabels[severity] || severity) + '</span>' +
        '<span class="history-open">Open →</span>' +
      '</button>';
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
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("modalRoot").innerHTML = "";
    document.body.style.overflow = "";
  }

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
    var vehicle = state.vehicles.find(function (v) { return v.id === record.vehicleId; });
    var matches = (record.matches || []).map(function (match) {
      var pct = Math.round((match.confidence || 0) * 100);
      var names = (match.matchedSymptoms || []).map(function (s) { return s.label; }).join(" · ");
      var severity = match.cause.severity || "medium";
      return '<article class="result"><div class="result-head"><h4>' + esc(match.cause.label) + '</h4>' +
        '<span class="' + severityClass(severity) + '">' + esc(severityLabels[severity] || severity) + '</span></div>' +
        '<div class="confidence"><div class="bar"><i style="width:' + Math.max(2, pct) + '%"></i></div><strong>' + pct + '%</strong></div>' +
        '<div class="matched"><strong>Matched:</strong> ' + esc(names || "—") + '</div>' +
        '<div class="result-actions"><button class="btn small" type="button" data-guide="' + esc(match.cause.repairGuideId) + '">View repair guide</button></div></article>';
    }).join("");

    showModal('<div class="modal-head"><div><h3>Saved diagnosis</h3>' +
      '<div class="meta">' + esc(formatWhen(record.createdAt)) + ' · ' + esc(vehicle ? vehicleLabel(vehicle) : "Vehicle") + ' · ' + esc(record.source || "checklist") + '</div></div>' +
      '<button class="btn small ghost" type="button" data-close-modal="true">Close</button></div>' +
      '<div class="results">' + (matches || '<div class="empty-note">This record has no matches.</div>') + '</div>');

    Array.prototype.forEach.call(document.querySelectorAll("[data-guide]"), function (button) {
      button.addEventListener("click", function () { showGuide(button.getAttribute("data-guide")); });
    });
  }

  async function selectVehicle(id) {
    closeVehicleForm();
    state.selectedId = id;
    state.selected = Object.create(null);
    state.matches = [];
    state.symptoms = [];
    state.history = state.histories[id] || [];
    state.hasDiagnosed = false;

    renderVehicles();
    renderWorkspace();
    renderHero();
    switchTab("diagnose");
    $("checklist").innerHTML = '<div class="loading">Loading symptoms…</div>';
    $("results").innerHTML = "";
    $("historyList").innerHTML = state.history.length ? "" : '<div class="loading">Loading history…</div>';
    if (state.history.length) renderHistory();
    updateSelectedCount();

    var vehicle = selectedVehicle();
    if (!vehicle) return;

    try {
      var results = await Promise.all([
        api("/symptoms?vehicleType=" + encodeURIComponent(vehicle.type)),
        api("/repair-guides?vehicleType=" + encodeURIComponent(vehicle.type)),
        api("/vehicles/" + encodeURIComponent(vehicle.id) + "/history?limit=100")
      ]);

      if (state.selectedId !== id) return;

      state.symptoms = results[0].symptoms || [];
      (results[1].repairGuides || []).forEach(function (guide) { state.guides[guide.id] = guide; });
      state.history = results[2].history || [];
      state.histories[id] = state.history;

      renderChecklist();
      renderHistory();
      renderWorkspace();
      rebuildActivity();
    } catch (error) {
      if (state.selectedId !== id) return;
      $("checklist").innerHTML = '<div class="empty-note">Could not load symptoms: ' + esc(error.message) + '</div>';
      $("historyList").innerHTML = '<div class="empty-note">Could not load history: ' + esc(error.message) + '</div>';
      toast(error.message, true);
    }
  }

  async function loadAllHistories() {
    var next = Object.create(null);
    var vehicles = state.vehicles.slice();

    await Promise.all(vehicles.map(async function (v) {
      try {
        var data = await api("/vehicles/" + encodeURIComponent(v.id) + "/history?limit=100");
        next[v.id] = data.history || [];
      } catch (error) {
        next[v.id] = state.histories[v.id] || [];
      }
    }));

    if (!sessionToken) return;
    state.histories = next;
    rebuildActivity();
  }

  async function loadVehicles() {
    try {
      var data = await api("/vehicles");
      state.vehicles = data.vehicles || [];

      if (state.selectedId && !state.vehicles.some(function (v) { return v.id === state.selectedId; })) {
        state.selectedId = null;
      }

      renderVehicles();
      renderHero();
      await loadAllHistories();
      if (!sessionToken) return;

      if (!state.vehicles.length) {
        state.selectedId = null;
        state.history = [];
        renderWorkspace();
        renderHero();
        renderStats();
        return;
      }

      if (!state.selectedId) state.selectedId = state.vehicles[0].id;
      await selectVehicle(state.selectedId);
    } catch (error) {
      if (!sessionToken) return;
      $("vehicleList").innerHTML = '<div class="empty-garage">Could not load this private garage: ' + esc(error.message) + '</div>';
      toast(error.message, true);
    }
  }

  async function loadSession() {
    try {
      var data = await api("/auth/me");
      state.user = data.user;
      renderAccount();
      hideLoginGate();
      await loadVehicles();
    } catch (error) {
      if (sessionToken) toast(error.message, true);
    }
  }

  async function runDiagnosis() {
    var vehicle = selectedVehicle();
    var ids = selectedIds();
    if (!vehicle || !ids.length) return;

    var button = $("diagnoseBtn");
    button.disabled = true;
    button.textContent = "Checking…";
    try {
      var data = await api("/diagnose", {
        method: "POST",
        body: {
          vehicleType: vehicle.type,
          vehicleId: vehicle.id,
          symptomIds: ids,
          source: "checklist"
        }
      });

      state.matches = data.matches || [];
      state.hasDiagnosed = true;
      renderResults();

      if (state.matches.length) {
        toast("Found " + state.matches.length + " possible " + (state.matches.length === 1 ? "cause" : "causes") + " for " + vehicleLabel(vehicle) + ".");
      } else {
        toast("No matching causes for that combination. Try adding another sign.", true);
      }

      var historyData = await api("/vehicles/" + encodeURIComponent(vehicle.id) + "/history?limit=100");
      state.history = historyData.history || [];
      state.histories[vehicle.id] = state.history;
      renderHistory();
      renderWorkspace();
      rebuildActivity();
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.textContent = "Run symptom check";
      updateSelectedCount();
    }
  }

  function closeVehicleForm() {
    state.editingId = null;
    $("vehicleForm").reset();
    $("vehicleForm").hidden = true;
    $("saveVehicleBtn").textContent = "Save vehicle";
  }

  function openAddForm() {
    closeVehicleForm();
    $("vehicleForm").hidden = false;
    $("vehicleForm").scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(function () { $("vMake").focus(); }, 220);
  }

  function openEditForm() {
    var vehicle = selectedVehicle();
    if (!vehicle) return;
    closeVehicleForm();
    state.editingId = vehicle.id;
    $("vType").value = vehicle.type;
    $("vYear").value = String(vehicle.year);
    $("vNickname").value = vehicle.nickname || "";
    $("vMake").value = vehicle.make;
    $("vModel").value = vehicle.model;
    $("vMileage").value = String(vehicle.mileage);
    $("saveVehicleBtn").textContent = "Save changes";
    $("vehicleForm").hidden = false;
    $("vehicleForm").scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(function () { $("vMake").focus(); }, 220);
  }

  async function addVehicle(event) {
    event.preventDefault();
    var button = $("saveVehicleBtn");
    var editingId = state.editingId;
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
      var data = editingId
        ? await api("/vehicles/" + encodeURIComponent(editingId), { method: "PATCH", body: body })
        : await api("/vehicles", { method: "POST", body: body });
      state.selectedId = data.vehicle.id;
      state.editingId = null;
      $("vehicleForm").reset();
      $("vehicleForm").hidden = true;
      await loadVehicles();
      toast(editingId ? "Vehicle details updated." : "Vehicle added to your private garage.");
      scrollToSection("service-workspace");
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = state.editingId ? "Save changes" : "Save vehicle";
    }
  }

  async function deleteVehicle() {
    var vehicle = selectedVehicle();
    if (!vehicle) return;
    if (!window.confirm("Delete " + vehicleLabel(vehicle) + " and all of its saved history?")) return;
    try {
      await api("/vehicles/" + encodeURIComponent(vehicle.id), { method: "DELETE" });
      delete state.histories[vehicle.id];
      state.selectedId = null;
      state.history = [];
      await loadVehicles();
      toast("Vehicle deleted.");
    } catch (error) {
      toast(error.message, true);
    }
  }

  function switchTab(tab) {
    var diagnose = tab === "diagnose";
    $("diagnoseTab").classList.toggle("active", diagnose);
    $("historyTab").classList.toggle("active", !diagnose);
    $("diagnoseTab").setAttribute("aria-selected", diagnose ? "true" : "false");
    $("historyTab").setAttribute("aria-selected", diagnose ? "false" : "true");
    $("diagnosePanel").hidden = !diagnose;
    $("historyPanel").hidden = diagnose;
  }

  function scrollToSection(id) {
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    var target = $(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadHealth() {
    try {
      var health = await api("/health");
      state.health = health;
      $("apiDot").className = "dot on";
      $("apiStatus").textContent = "API online";
      var aiOnline = Boolean(health.ai && health.ai.configured);
      $("aiDot").className = "dot " + (aiOnline ? "on" : "off");
      $("aiStatus").textContent = aiOnline ? "AI ready" : "AI not configured";
      $("aiPill").className = "side-status-row " + (aiOnline ? "is-good" : "is-muted");
      renderStats();
    } catch (error) {
      $("apiDot").className = "dot off";
      $("apiStatus").textContent = "API unreachable";
      $("aiDot").className = "dot off";
      $("aiStatus").textContent = "AI unknown";
      $("aiPill").className = "side-status-row is-muted";
      $("statAI").textContent = "Unknown";
      $("statAIMeta").textContent = "Health check failed";
    }
  }

  $("addBtn").addEventListener("click", openAddForm);
  $("cancelVehicleBtn").addEventListener("click", closeVehicleForm);
  $("vehicleForm").addEventListener("submit", addVehicle);
  $("editVehicleBtn").addEventListener("click", openEditForm);
  $("diagnoseBtn").addEventListener("click", runDiagnosis);
  $("deleteVehicleBtn").addEventListener("click", deleteVehicle);
  $("diagnoseTab").addEventListener("click", function () { switchTab("diagnose"); });
  $("historyTab").addEventListener("click", function () { switchTab("history"); });
  $("loginForm").addEventListener("submit", signIn);
  $("signOutBtn").addEventListener("click", signOut);

  $("heroDiagnoseBtn").addEventListener("click", function () {
    if (!selectedVehicle()) { openAddForm(); return; }
    scrollToSection("service-workspace");
    switchTab("diagnose");
  });

  $("heroHistoryBtn").addEventListener("click", function () {
    if (!selectedVehicle()) { scrollToSection("activity-card"); return; }
    scrollToSection("service-workspace");
    switchTab("history");
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-jump]"), function (button) {
    button.addEventListener("click", function () {
      var target = button.getAttribute("data-jump");
      var navItems = document.querySelectorAll("[data-jump]");
      Array.prototype.forEach.call(navItems, function (item) { item.classList.remove("active"); });
      button.classList.add("active");

      if (target === "diagnostics") {
        if (selectedVehicle()) {
          scrollToSection("service-workspace");
          switchTab("diagnose");
        } else {
          scrollToSection("service-bay");
        }
        return;
      }
      if (target === "history") {
        if (selectedVehicle()) {
          scrollToSection("service-workspace");
          switchTab("history");
        } else {
          scrollToSection("activity-card");
        }
        return;
      }
      scrollToSection(target);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && sessionToken) loadHealth();
  });

  renderAccount();
  renderHero();
  renderWorkspace();
  loadHealth();

  if (sessionToken) {
    hideLoginGate();
    loadSession();
  } else {
    showLoginGate();
  }
})();
`;
}

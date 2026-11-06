import { DASHBOARD_STYLES } from './dashboardStyles';
import { renderDashboardClient } from './dashboardClient';

/**
 * Server-rendered service console.
 *
 * The mobile app is the primary client, but opening the API URL in a browser
 * should not dump raw JSON at a non-developer. This page is a small,
 * dependency-free client for the same public API: private garage CRUD, the
 * deterministic symptom checklist, ranked causes, repair guides, and saved
 * history.
 *
 * It signs in with the same email/password accounts as the app and keeps the
 * account session in localStorage. The shared API key, when configured, is
 * injected by the server as an abuse gate; it is not account authentication.
 */
export function renderDashboard(apiAccessToken: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a1b26">
<title>TorqueDoc — Service dashboard</title>
<style>${DASHBOARD_STYLES}</style>
</head>
<body>

<div class="app-shell" id="appShell">
  <aside class="sidebar" aria-label="Service console navigation">
    <a class="brand" href="/dashboard" aria-label="TorqueDoc service console">
      <span class="brand-mark">TD</span>
      <span class="brand-text"><strong>TorqueDoc</strong><span>Service console</span></span>
    </a>

    <nav class="side-nav" aria-label="Dashboard sections">
      <button class="nav-item active" type="button" data-jump="top"><span class="nav-bullet"></span>Overview</button>
      <button class="nav-item" type="button" data-jump="service-bay"><span class="nav-bullet"></span>Service bay</button>
      <button class="nav-item" type="button" data-jump="diagnostics"><span class="nav-bullet"></span>Diagnostics</button>
      <button class="nav-item" type="button" data-jump="activity-card"><span class="nav-bullet"></span>Activity</button>
    </nav>

    <div class="side-status" aria-label="Service status">
      <div class="side-status-row"><span class="dot" id="apiDot"></span><span id="apiStatus">Connecting…</span></div>
      <div class="side-status-row" id="aiPill"><span class="dot" id="aiDot"></span><span id="aiStatus">AI checking…</span></div>
      <div class="side-status-row subtle">Private garage · Cars &amp; motorcycles</div>
    </div>

    <div class="side-account">
      <div class="avatar" id="accountAvatar" aria-hidden="true">TD</div>
      <div class="account-text"><strong id="accountName">Your account</strong><span id="accountEmail">Private service console</span></div>
      <button class="signout" id="signOutBtn" type="button" hidden>Sign out</button>
    </div>
  </aside>

  <main class="main" id="top">
    <header class="page-header">
      <div>
        <div class="eyebrow">Service dashboard</div>
        <h1 id="greeting">Welcome back.</h1>
        <p>Your private garage, guided diagnostics, and service history in one calm place.</p>
      </div>
      <div class="header-actions">
        <a class="btn secondary" href="/app" target="_blank" rel="noreferrer">Open app <span aria-hidden="true">↗</span></a>
        <button class="btn primary" id="addBtn" type="button">+ New vehicle</button>
      </div>
    </header>

    <section class="hero" aria-labelledby="heroTitle">
      <div class="hero-copy">
        <span class="hero-kicker">On-demand vehicle care</span>
        <h2 id="heroTitle">Your garage, running smoothly.</h2>
        <p id="heroCopy">Add your first car or motorcycle to start a private service record, run guided checks, and keep every diagnosis in one place.</p>
        <div class="hero-actions">
          <button class="btn primary" id="heroDiagnoseBtn" type="button">Add your first vehicle</button>
          <button class="btn ghost" id="heroHistoryBtn" type="button" hidden>View service history</button>
        </div>
      </div>
      <div class="hero-plate">
        <div class="plate-top"><span class="plate-label">Selected vehicle</span><span class="plate-badge">Private</span></div>
        <strong id="heroVehicle">No vehicle selected</strong>
        <span id="heroVehicleMeta">Add a vehicle to begin</span>
        <div class="plate-rule"></div>
        <div class="plate-status"><span class="dot on"></span> Account-scoped garage</div>
      </div>
    </section>

    <section class="stats-grid" aria-label="Garage overview">
      <article class="stat-card">
        <span class="stat-icon mint" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l2-5h12l2 5v3H4z"/><path d="M5 18h14"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">Vehicles in care</span><span class="stat-value" id="statVehicles">—</span><span class="stat-meta" id="statVehiclesMeta">Private garage</span></span>
      </article>
      <article class="stat-card">
        <span class="stat-icon blue" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v16H7z"/><path d="M9 8h6M9 12h4"/><path d="M5 7H3v13h14v-2"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">Service checks</span><span class="stat-value" id="statChecks">—</span><span class="stat-meta" id="statChecksMeta">Saved diagnoses</span></span>
      </article>
      <article class="stat-card">
        <span class="stat-icon amber" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l8 15H4z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">Needs attention</span><span class="stat-value" id="statAttention">—</span><span class="stat-meta" id="statAttentionMeta">Across your garage</span></span>
      </article>
      <article class="stat-card">
        <span class="stat-icon violet" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">AI diagnostics</span><span class="stat-value" id="statAI">Checking</span><span class="stat-meta" id="statAIMeta">Provider status</span></span>
      </article>
    </section>

    <div class="dashboard-grid">
      <section class="card" id="service-bay" aria-labelledby="serviceBayTitle">
        <header class="card-head">
          <div>
            <div class="eyebrow">Private garage</div>
            <h3 id="serviceBayTitle">Your service bay</h3>
            <p class="card-sub">Only vehicles owned by this account appear here.</p>
          </div>
          <span class="mini-chip">Account only</span>
        </header>

        <div class="vehicle-grid" id="vehicleList"><div class="loading">Loading your garage…</div></div>

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
          <div class="form-actions">
            <button class="btn primary" type="submit" id="saveVehicleBtn">Save vehicle</button>
            <button class="btn ghost" type="button" id="cancelVehicleBtn">Cancel</button>
          </div>
        </form>
      </section>

      <aside class="right-stack">
        <section class="card" id="activity-card" aria-labelledby="activityTitle">
          <header class="card-head">
            <div>
              <div class="eyebrow">Live feed</div>
              <h3 id="activityTitle">Recent service activity</h3>
              <p class="card-sub">Every check is private to this account.</p>
            </div>
            <span class="mini-chip">Latest</span>
          </header>
          <div class="activity-list" id="activityList"><div class="loading">Loading activity…</div></div>
        </section>

        <section class="card care-card" aria-labelledby="careTitle">
          <div class="eyebrow">Good to know</div>
          <h3 id="careTitle">Service, made simple.</h3>
          <ul class="care-list">
            <li><strong>Private by design.</strong> Your garage and diagnosis history are scoped to the signed-in account.</li>
            <li><strong>Ranked, explainable.</strong> See the signs that matched and how confident the result is.</li>
            <li><strong>Free AI diagnostics.</strong> Photo, video, and sound analysis use Cloudflare Workers AI only.</li>
          </ul>
          <div class="care-footer"><a href="/app" target="_blank" rel="noreferrer">Open the full TorqueDoc app →</a></div>
        </section>
      </aside>
    </div>

    <section class="card workspace-card" id="service-workspace" aria-labelledby="workspaceTitle">
      <div class="workspace-empty" id="workspaceEmpty">
        <div class="empty-icon">TD</div>
        <h3 id="workspaceTitle">Select a vehicle to begin</h3>
        <p>Choose a vehicle from your service bay, then run a guided symptom check or review its private service history.</p>
      </div>

      <div id="vehicleWorkspace" hidden>
        <div class="workspace-inner">
          <div class="service-head">
            <div>
              <div class="eyebrow">Active service</div>
              <h2 id="vehicleTitle">Vehicle</h2>
              <div class="sub" id="vehicleSub"></div>
              <div class="pill-row">
                <span class="pill" id="mileagePill"></span>
                <span class="pill" id="typePill"></span>
                <span class="pill status ready" id="vehicleStatusPill">Ready for check</span>
                <span class="pill" id="historyPill"></span>
              </div>
            </div>
            <div class="service-actions">
              <button class="btn secondary small" id="editVehicleBtn" type="button">Edit vehicle</button>
              <button class="btn danger small" id="deleteVehicleBtn" type="button">Delete vehicle</button>
            </div>
          </div>

          <div class="tabs" role="tablist" aria-label="Vehicle service views">
            <button class="tab active" id="diagnoseTab" type="button" role="tab" aria-selected="true">Symptom check</button>
            <button class="tab" id="historyTab" type="button" role="tab" aria-selected="false">Service history</button>
          </div>

          <div class="workspace-grid" id="diagnosePanel">
            <div>
              <div class="panel-head">
                <div>
                  <div class="eyebrow">Step 1</div>
                  <h3>What is your vehicle doing?</h3>
                  <p>Select every sign you notice. The more context you add, the more specific the ranked causes can be.</p>
                </div>
              </div>
              <div class="checklist" id="checklist"><div class="loading">Loading symptoms…</div></div>
              <div class="results" id="results"></div>
            </div>

            <aside class="summary-card" aria-label="Service summary">
              <div class="summary-top"><span class="eyebrow">Service summary</span><span class="summary-badge">Guided</span></div>
              <h3 id="summaryVehicle">No vehicle selected</h3>
              <p class="summary-copy">We compare your selected signs with the TorqueDoc catalog and rank the likely causes.</p>
              <div class="summary-row"><span>Selected signs</span><strong id="selectedCount">0 signs selected</strong></div>
              <div class="summary-row"><span>Saved checks</span><strong id="summaryChecks">0</strong></div>
              <div class="summary-row"><span>Latest result</span><strong id="summaryLatest">—</strong></div>
              <button class="btn primary wide" id="diagnoseBtn" type="button" disabled>Run symptom check</button>
              <p class="summary-note">Free · No provider key needed. Only this account can see this vehicle and its history.</p>
            </aside>
          </div>

          <div id="historyPanel" hidden>
            <div class="panel-head">
              <div>
                <div class="eyebrow">Service record</div>
                <h3>Saved diagnosis history</h3>
                <p>Every check is stored privately against this vehicle. Open a record to review its ranked causes.</p>
              </div>
              <span class="mini-chip" id="historyCount">0 saved</span>
            </div>
            <div class="history-list" id="historyList"><div class="loading">Loading history…</div></div>
          </div>
        </div>
      </div>
    </section>

    <footer class="page-footer">
      <span>TorqueDoc Service Console · Private, account-scoped vehicle care.</span>
      <span>Hosted demo data can reset on redeploy. <a href="/app" target="_blank" rel="noreferrer">Open app</a></span>
    </footer>
  </main>
</div>

<div class="auth-gate" id="authGate">
  <div class="auth-shell">
    <section class="auth-visual" aria-label="About TorqueDoc">
      <div class="auth-brand">
        <span class="brand-mark">TD</span>
        <span class="auth-brand-copy"><strong>TorqueDoc</strong><span>Vehicle care service</span></span>
      </div>

      <div class="auth-copy">
        <div class="eyebrow">Service-grade vehicle care</div>
        <h2>Know what your vehicle is telling you.</h2>
        <p>TorqueDoc turns the signs you notice into ranked, explainable causes, repair guidance, and a private service record for every vehicle you own.</p>
      </div>

      <div class="auth-points">
        <div class="auth-point"><span class="auth-check">✓</span><span><strong>A private garage.</strong> Vehicles and diagnosis history are scoped to your account.</span></div>
        <div class="auth-point"><span class="auth-check">✓</span><span><strong>Guided checks.</strong> Select the signs you notice and get a ranked result in under a minute.</span></div>
        <div class="auth-point"><span class="auth-check">✓</span><span><strong>Repair guidance.</strong> Open steps and tools for the causes that match.</span></div>
        <div class="auth-point"><span class="auth-check">✓</span><span><strong>Free AI diagnostics.</strong> Photo, video, and sound analysis with zero-retention Cloudflare models.</span></div>
      </div>

      <div class="auth-visual-footer">Cars &amp; motorcycles · No trailers. Built for a clean, private service record.</div>
    </section>

    <section class="auth-panel">
      <div>
        <div class="eyebrow">Welcome back</div>
        <h1>Sign in to your service console</h1>
        <p>Use the same account you use in the TorqueDoc app.</p>
      </div>

      <form class="auth-form" id="loginForm">
        <div class="field">
          <label for="loginEmail">Email address</label>
          <input id="loginEmail" type="email" autocomplete="email" required placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="loginPassword">Password</label>
          <input id="loginPassword" type="password" autocomplete="current-password" required minlength="8" placeholder="At least 8 characters">
        </div>
        <div class="auth-error" id="loginError" role="alert"></div>
        <button class="btn primary" type="submit" id="loginBtn">Sign in to service console</button>
      </form>

      <div class="auth-note"><span aria-hidden="true">◈</span><span><strong>Your garage is private.</strong> This console only loads vehicles and diagnosis records owned by the account you sign in with.</span></div>

      <div class="auth-foot">New to TorqueDoc? Create an account in the <a href="/app" target="_blank" rel="noreferrer">hosted app</a>, then return here to see your service console.</div>
    </section>
  </div>
</div>

<div id="modalRoot"></div>
<div class="toast" id="toast" role="status"></div>

<script>${renderDashboardClient(apiAccessToken)}</script>
</body>
</html>`;
}

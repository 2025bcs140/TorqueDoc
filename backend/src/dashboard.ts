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
<meta name="theme-color" content="#223a67">
<title>TorqueDoc - Service dashboard</title>
<style>${DASHBOARD_STYLES}</style>
</head>
<body>

<div class="app-shell" id="appShell">
  <aside class="sidebar" aria-label="Service console navigation">
    <a class="brand" href="/dashboard" aria-label="TorqueDoc service console">
      <span class="brand-mark">TD</span>
      <span class="brand-text"><strong>TorqueDoc</strong><span>Service dashboard</span></span>
    </a>

    <div class="sidebar-label">Workspace</div>
    <nav class="side-nav" aria-label="Dashboard sections">
      <button class="nav-item active" type="button" data-jump="top">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></svg>
        Dashboard
      </button>
      <button class="nav-item" type="button" data-jump="service-bay">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15l2-5h12l2 5v4H4z"/><path d="M6 19v2M18 19v2"/><circle cx="7.5" cy="17" r="1"/><circle cx="16.5" cy="17" r="1"/></svg>
        Garage
      </button>
      <button class="nav-item" type="button" data-jump="diagnostics">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>
        Diagnose
      </button>
      <button class="nav-item" type="button" data-jump="history">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>
        History
      </button>
      <button class="nav-item" type="button" data-jump="activity-card">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
        Activity
      </button>
    </nav>

    <div class="sidebar-spacer"></div>

    <div class="side-status" aria-label="Service status" hidden>
      <div class="side-status-row"><span class="dot" id="apiDot"></span><span id="apiStatus">Connecting...</span></div>
      <div class="side-status-row" id="aiPill"><span class="dot" id="aiDot"></span><span id="aiStatus">AI checking...</span></div>
    </div>

    <button class="signout" id="signOutBtn" type="button" hidden>Logout</button>
  </aside>

  <main class="main" id="top">
    <header class="page-header">
      <div class="header-title">
        <div class="eyebrow">Dashboard</div>
        <h1 id="greeting">Welcome back.</h1>
        <p>Your private garage, guided diagnostics, and service history in one place.</p>
      </div>
      <div class="header-side">
        <div class="header-user">
          <div class="avatar" id="accountAvatar" aria-hidden="true">TD</div>
          <div class="account-text"><strong id="accountName">Your account</strong><span id="accountEmail">Private service console</span></div>
        </div>
        <div class="header-actions">
          <a class="btn secondary" href="/app" target="_blank" rel="noreferrer">Open app</a>
          <button class="btn primary" id="addBtn" type="button">+ New asset</button>
        </div>
      </div>
    </header>

    <section class="hero" aria-labelledby="heroTitle">
      <div class="hero-copy">
        <span class="hero-kicker">On-demand vehicle &amp; machine care</span>
        <h2 id="heroTitle">Your garage, running smoothly.</h2>
        <p id="heroCopy">Add your first car, motorcycle or workshop machine to start a private service record, run guided checks, and keep every diagnosis in one place.</p>
        <div class="hero-actions">
          <button class="btn primary" id="heroDiagnoseBtn" type="button">Add your first asset</button>
          <button class="btn ghost" id="heroHistoryBtn" type="button" hidden>View service history</button>
        </div>
      </div>
      <div class="hero-plate">
        <div class="plate-top"><span class="plate-label">Selected asset</span><span class="plate-badge">Private</span></div>
        <strong id="heroVehicle">No asset selected</strong>
        <span id="heroVehicleMeta">Add an asset to begin</span>
        <div class="plate-rule"></div>
        <div class="plate-status"><span class="dot on"></span> Account-scoped garage</div>
      </div>
    </section>

    <section class="stats-grid" aria-label="Garage overview">
      <article class="stat-card">
        <span class="stat-icon blue" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 15l2-5h12l2 5v3H4z"/><path d="M5 18h14"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">Assets in care</span><span class="stat-value" id="statVehicles">-</span><span class="stat-meta" id="statVehiclesMeta">Private garage</span></span>
      </article>
      <article class="stat-card">
        <span class="stat-icon teal" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M7 4h10v16H7z"/><path d="M9 8h6M9 12h4"/><path d="M5 7H3v13h14v-2"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">Service checks</span><span class="stat-value" id="statChecks">-</span><span class="stat-meta" id="statChecksMeta">Saved diagnoses</span></span>
      </article>
      <article class="stat-card">
        <span class="stat-icon amber" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 4l8 15H4z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">Needs attention</span><span class="stat-value" id="statAttention">-</span><span class="stat-meta" id="statAttentionMeta">Across your garage</span></span>
      </article>
      <article class="stat-card">
        <span class="stat-icon violet" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>
        </span>
        <span class="stat-body"><span class="stat-label">AI diagnostics</span><span class="stat-value" id="statAI">Checking</span><span class="stat-meta" id="statAIMeta">Provider status</span></span>
      </article>
    </section>

    <div class="dashboard-grid">
      <section class="card" id="service-bay" aria-labelledby="serviceBayTitle">
        <header class="card-head">
          <div>
            <div class="eyebrow">Private garage</div>
            <h3 id="serviceBayTitle">Your garage</h3>
            <p class="card-sub">Only assets owned by this account appear here.</p>
          </div>
          <span class="mini-chip">Account only</span>
        </header>

        <div class="vehicle-grid" id="vehicleList"><div class="loading">Loading your garage...</div></div>

        <form class="vehicle-form" id="vehicleForm" hidden>
          <div class="form-row">
            <div class="field">
              <label for="vType">Asset type</label>
              <select id="vType" required>
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="drilling_machine">Drilling machine</option>
                <option value="milling_machine">Milling machine</option>
                <option value="lifting_machine">Lifting machine</option>
              </select>
            </div>
            <div class="field">
              <label for="vYear">Year</label>
              <input id="vYear" type="number" min="1886" max="2100" required placeholder="2018">
            </div>
          </div>
          <div class="field">
            <label for="vNickname">Nickname (optional)</label>
            <input id="vNickname" maxlength="60" placeholder="Daily driver or Bridgeport #2">
          </div>
          <div class="form-row">
            <div class="field">
              <label for="vMake">Make</label>
              <input id="vMake" required maxlength="60" placeholder="Toyota or Haas">
            </div>
            <div class="field">
              <label for="vModel">Model</label>
              <input id="vModel" required maxlength="60" placeholder="Corolla or VF-2">
            </div>
          </div>
          <div class="field">
            <label for="vMileage" id="vUsageLabel">Mileage</label>
            <input id="vMileage" type="number" min="0" max="2000000" required placeholder="85000">
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit" id="saveVehicleBtn">Save asset</button>
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
          <div class="activity-list" id="activityList"><div class="loading">Loading activity...</div></div>
        </section>

        <section class="card care-card" aria-labelledby="careTitle">
          <div class="eyebrow">Good to know</div>
          <h3 id="careTitle">Service, made simple.</h3>
          <ul class="care-list">
            <li><strong>Private by design.</strong> Your garage and diagnosis history are scoped to the signed-in account.</li>
            <li><strong>Ranked, explainable.</strong> See the signs that matched and how much of the cause is covered.</li>
            <li><strong>Free AI diagnostics.</strong> Photo, video, and sound analysis use Cloudflare Workers AI only.</li>
          </ul>
          <div class="care-footer"><a href="/app" target="_blank" rel="noreferrer">Open the full TorqueDoc app</a></div>
        </section>
      </aside>
    </div>

    <section class="card workspace-card" id="service-workspace" aria-labelledby="workspaceTitle">
      <div class="workspace-empty" id="workspaceEmpty">
        <div class="empty-icon">TD</div>
        <h3 id="workspaceTitle">Select an asset to begin</h3>
        <p>Choose a car, motorcycle or machine from your garage, then run a guided symptom check or review its private service history.</p>
      </div>

      <div id="vehicleWorkspace" hidden>
        <div class="workspace-inner">
          <div class="service-head">
            <div>
              <div class="eyebrow">Active service</div>
              <h2 id="vehicleTitle">Asset</h2>
              <div class="sub" id="vehicleSub"></div>
              <div class="pill-row">
                <span class="pill" id="mileagePill"></span>
                <span class="pill" id="typePill"></span>
                <span class="pill status ready" id="vehicleStatusPill">Ready for check</span>
                <span class="pill" id="historyPill"></span>
              </div>
            </div>
            <div class="service-actions">
              <button class="btn secondary small" id="editVehicleBtn" type="button">Edit asset</button>
              <button class="btn danger small" id="deleteVehicleBtn" type="button">Delete asset</button>
            </div>
          </div>

          <div class="tabs" role="tablist" aria-label="Asset service views">
            <button class="tab active" id="diagnoseTab" type="button" role="tab" aria-selected="true">Symptom check</button>
            <button class="tab" id="historyTab" type="button" role="tab" aria-selected="false">Service history</button>
          </div>

          <div class="workspace-grid" id="diagnosePanel">
            <div>
              <div class="panel-head">
                <div>
                  <div class="eyebrow">Step 1</div>
                  <h3>What is your asset doing?</h3>
                  <p>Select every sign you notice. The more context you add, the more specific the ranked causes can be.</p>
                </div>
              </div>
              <div class="checklist" id="checklist"><div class="loading">Loading symptoms...</div></div>
              <div class="results" id="results"></div>
            </div>

            <aside class="summary-card" aria-label="Service summary">
              <div class="summary-top"><span class="eyebrow">Service summary</span><span class="summary-badge">Guided</span></div>
              <h3 id="summaryVehicle">No asset selected</h3>
              <p class="summary-copy">We compare your selected signs with the TorqueDoc catalog and rank the likely causes.</p>
              <div class="summary-row"><span>Selected signs</span><strong id="selectedCount">0 signs selected</strong></div>
              <div class="summary-row"><span>Saved checks</span><strong id="summaryChecks">0</strong></div>
              <div class="summary-row"><span>Latest result</span><strong id="summaryLatest">-</strong></div>
              <button class="btn primary wide" id="diagnoseBtn" type="button" disabled>Run symptom check</button>
              <p class="summary-note">Free / no provider key needed. Only this account can see this asset and its history.</p>
            </aside>
          </div>

          <div id="historyPanel" hidden>
            <div class="panel-head">
              <div>
                <div class="eyebrow">Service record</div>
                <h3>Saved diagnosis history</h3>
                <p>Every check is stored privately against this asset. Open a record to review its ranked causes.</p>
              </div>
              <span class="mini-chip" id="historyCount">0 saved</span>
            </div>
            <div class="history-list" id="historyList"><div class="loading">Loading history...</div></div>
          </div>
        </div>
      </div>
    </section>

    <footer class="page-footer">
      <span>TorqueDoc Service Console / Private, account-scoped vehicle and machine care.</span>
      <span>Hosted data uses the configured database; production stores it in Neon Postgres.</span>
    </footer>
  </main>
</div>

<div class="auth-gate" id="authGate" hidden>
  <div class="auth-wrap">
    <section class="auth-card" aria-labelledby="authTitle">
      <h1 id="authTitle">TorqueDoc</h1>
      <p class="auth-hint" id="authHint">Please sign in to continue.</p>

      <form class="auth-form" id="loginForm">
        <div class="auth-error" id="loginError" role="alert"></div>
        <div class="field">
          <label for="loginEmail">Email</label>
          <input id="loginEmail" type="email" autocomplete="email" required placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="loginPassword">Password</label>
          <input id="loginPassword" type="password" autocomplete="current-password" required minlength="8" placeholder="Enter your password">
        </div>
        <button class="btn primary wide" type="submit" id="loginBtn">Sign In</button>
      </form>

      <form class="auth-form" id="registerForm" hidden>
        <div class="auth-error" id="registerError" role="alert"></div>
        <div class="field">
          <label for="registerName">Your name</label>
          <input id="registerName" type="text" autocomplete="name" required minlength="2" maxlength="80" placeholder="Alex Miller">
        </div>
        <div class="field">
          <label for="registerEmail">Email</label>
          <input id="registerEmail" type="email" autocomplete="email" required placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="registerPassword">Password</label>
          <input id="registerPassword" type="password" autocomplete="new-password" required minlength="8" placeholder="At least 8 characters">
        </div>
        <button class="btn primary wide" type="submit" id="registerBtn">Create Account</button>
      </form>

      <div class="auth-note">
        <strong id="authSwitchPrompt">New to TorqueDoc?</strong>
        <button class="auth-switch-link" id="authSwitchBtn" type="button">Create an account</button>
        <span class="auth-note-detail">Your garage, service checks and repair history stay private to your account.</span>
      </div>
    </section>
  </div>
</div>

<div id="modalRoot"></div>
<div class="toast" id="toast" role="status"></div>

<script>${renderDashboardClient(apiAccessToken)}</script>
</body>
</html>`;
}

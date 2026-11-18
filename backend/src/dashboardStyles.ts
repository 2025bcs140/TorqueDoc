/**
 * Styles for the server-rendered service console.
 *
 * A calm administrative layout: deep navy navigation, a light content canvas,
 * white cards, and one centered sign-in card on solid blue. Kept separate from
 * the markup and browser behaviour so the dashboard stays dependency-free.
 */
export const DASHBOARD_STYLES = `
  :root {
    color-scheme: light;
    --content: #f4f6fa;
    --surface: #ffffff;
    --surface-soft: #f8fafc;
    --ink: #1f2937;
    --ink-strong: #111827;
    --muted: #64748b;
    --line: #e2e8f0;
    --navy: #223a67;
    --navy-deep: #1b2f55;
    --navy-soft: #2c4a7d;
    --blue: #2456a6;
    --blue-dark: #1c468d;
    --blue-soft: #eef4ff;
    --teal: #0f766e;
    --teal-soft: #ecfdf5;
    --amber: #b45309;
    --amber-soft: #fffbeb;
    --violet: #6d28d9;
    --violet-soft: #f5f3ff;
    --danger: #b91c1c;
    --danger-soft: #fef2f2;
    --good: #15803d;
    --good-soft: #f0fdf4;
    --radius: 10px;
    --radius-sm: 7px;
    --shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    --font: "Segoe UI", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    min-width: 320px;
    background: var(--content);
    color: var(--ink);
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: 0.58; }
  a { color: var(--blue); text-decoration: none; }
  a:hover { text-decoration: underline; }
  [hidden] { display: none !important; }
  :focus-visible { outline: 3px solid rgba(36, 86, 166, 0.25); outline-offset: 2px; }

  /* ---------- App shell and sidebar ---------- */
  .app-shell {
    display: grid;
    grid-template-columns: 248px minmax(0, 1fr);
    min-height: 100vh;
  }
  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, var(--navy) 0%, var(--navy-deep) 100%);
    color: #ffffff;
    padding: 24px 16px 18px;
    overflow-y: auto;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    color: #ffffff;
    padding: 0 8px 22px;
    text-decoration: none;
  }
  .brand:hover { text-decoration: none; }
  .brand-mark {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    color: var(--navy);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }
  .brand-text { display: flex; flex-direction: column; line-height: 1.25; }
  .brand-text strong { font-size: 17px; letter-spacing: 0.2px; }
  .brand-text span { color: #b9c9e3; font-size: 11px; margin-top: 2px; }
  .sidebar-label {
    padding: 4px 12px 8px;
    color: #8fa8ca;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
  .side-nav { display: flex; flex-direction: column; gap: 3px; }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #d7e2f3;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .nav-item svg { width: 18px; height: 18px; flex: 0 0 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .nav-item:hover { background: rgba(255, 255, 255, 0.08); color: #ffffff; }
  .nav-item.active { background: #ffffff; color: var(--navy); font-weight: 600; }
  .sidebar-spacer { flex: 1; min-height: 24px; }
  .side-status {
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding: 14px 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .side-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #c5d4e9;
    font-size: 11px;
  }
  .side-status-row.subtle { color: #8fa8ca; line-height: 1.4; margin-top: 3px; font-size: 10px; }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #94a3b8;
    flex: 0 0 7px;
  }
  .dot.on { background: #34d399; box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.12); }
  .dot.off { background: #f87171; box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.12); }
  .side-account {
    display: flex;
    align-items: center;
    gap: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding: 14px 8px 8px;
  }
  .avatar {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e8eef8;
    color: var(--navy);
    font-size: 11px;
    font-weight: 800;
  }
  .account-text { min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .account-text strong { color: #ffffff; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .account-text span { color: #a9bdd8; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .signout {
    width: 100%;
    margin-top: 6px;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    background: transparent;
    color: #d7e2f3;
    font-size: 12px;
    text-align: left;
  }
  .signout:hover { background: rgba(255, 255, 255, 0.08); color: #ffffff; }

  /* ---------- Main content ---------- */
  .main {
    width: 100%;
    max-width: 1560px;
    margin: 0 auto;
    padding: 28px 32px 36px;
    min-width: 0;
  }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }
  .header-title { min-width: 0; }
  .eyebrow {
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .page-header h1 {
    margin: 0;
    color: var(--ink-strong);
    font-size: 25px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .page-header p { margin: 5px 0 0; color: var(--muted); font-size: 13px; }
  .header-actions { display: flex; gap: 9px; flex-wrap: wrap; padding-top: 4px; }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 38px;
    padding: 8px 15px;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    text-decoration: none;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .btn:hover { text-decoration: none; }
  .btn.primary { background: var(--blue); border-color: var(--blue); color: #ffffff; }
  .btn.primary:hover { background: var(--blue-dark); border-color: var(--blue-dark); }
  .btn.secondary { background: #ffffff; border-color: #cbd5e1; color: #334155; }
  .btn.secondary:hover { background: #f8fafc; border-color: #94a3b8; }
  .btn.ghost { background: transparent; border-color: transparent; color: var(--blue); }
  .btn.ghost:hover { background: var(--blue-soft); }
  .btn.danger { background: var(--danger-soft); border-color: #fecaca; color: var(--danger); }
  .btn.danger:hover { background: #fee2e2; }
  .btn.small { min-height: 32px; padding: 6px 11px; font-size: 12px; }
  .btn.wide { width: 100%; }
  .btn svg { width: 15px; height: 15px; }

  /* ---------- Hero ---------- */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(250px, 0.8fr);
    gap: 24px;
    align-items: stretch;
    padding: 24px;
    margin-bottom: 20px;
    border: 1px solid #d8e3f4;
    border-radius: var(--radius);
    background: linear-gradient(135deg, #f7faff 0%, #eef4ff 100%);
    color: var(--ink);
  }
  .hero-kicker {
    display: inline-block;
    color: var(--blue);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .hero h2 {
    margin: 0 0 7px;
    color: var(--navy);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .hero p { margin: 0; color: #52627a; font-size: 13px; max-width: 680px; line-height: 1.55; }
  .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
  .hero-plate {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 18px;
    border: 1px solid #cddcf2;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.82);
  }
  .plate-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .plate-label { color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .plate-badge { color: var(--blue); background: var(--blue-soft); border: 1px solid #d0def7; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 600; }
  .hero-plate strong { color: var(--ink-strong); font-size: 17px; line-height: 1.3; }
  .hero-plate > span { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .plate-rule { height: 1px; background: #dfe8f5; margin: 12px 0; }
  .plate-status { display: flex; align-items: center; gap: 7px; color: #52627a; font-size: 11px; }

  /* ---------- Stats ---------- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }
  .stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 15px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .stat-icon {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .stat-icon svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .stat-icon.blue { color: var(--blue); background: var(--blue-soft); }
  .stat-icon.teal { color: var(--teal); background: var(--teal-soft); }
  .stat-icon.amber { color: var(--amber); background: var(--amber-soft); }
  .stat-icon.violet { color: var(--violet); background: var(--violet-soft); }
  .stat-body { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
  .stat-label { color: var(--muted); font-size: 11px; }
  .stat-value { color: var(--ink-strong); font-size: 20px; font-weight: 700; margin: 2px 0; }
  .stat-meta { color: #94a3b8; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ---------- Cards and layout ---------- */
  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 18px;
    align-items: start;
  }
  .right-stack { display: flex; flex-direction: column; gap: 18px; }
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
    min-width: 0;
  }
  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 15px;
  }
  .card-head h3, .card h3, .card h2 {
    margin: 0;
    color: var(--ink-strong);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.1px;
  }
  .card-sub { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
  .mini-chip {
    flex: 0 0 auto;
    color: var(--muted);
    background: var(--surface-soft);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }
  .loading { color: var(--muted); font-size: 12px; padding: 16px 0; }
  .empty-note { color: var(--muted); font-size: 12px; padding: 12px 0; }

  /* ---------- Garage cards ---------- */
  .vehicle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 11px;
  }
  .empty-garage {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 28px 20px;
    background: #fbfcfe;
  }
  .empty-garage .empty-icon { margin-bottom: 9px; }
  .empty-garage strong { color: var(--ink-strong); font-size: 14px; }
  .empty-garage p { margin: 4px 0 13px; color: var(--muted); font-size: 12px; }
  .empty-icon {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--blue-soft);
    color: var(--blue);
    font-size: 12px;
    font-weight: 800;
  }
  .vehicle-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    min-width: 0;
    padding: 13px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #ffffff;
    color: var(--ink);
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }
  .vehicle-card:hover { border-color: #94b3e0; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06); }
  .vehicle-card.active { border-color: var(--blue); background: #f7faff; box-shadow: 0 0 0 2px rgba(36, 86, 166, 0.09); }
  .vehicle-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .vehicle-avatar {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--blue-soft);
    color: var(--blue);
    font-size: 12px;
    font-weight: 800;
  }
  .vehicle-card[data-type="drilling_machine"] .vehicle-avatar,
  .vehicle-card[data-type="milling_machine"] .vehicle-avatar,
  .vehicle-card[data-type="lifting_machine"] .vehicle-avatar {
    background: var(--amber-soft);
    color: var(--amber);
  }
  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 999px;
    padding: 2px 7px;
    font-size: 9px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--muted);
    background: var(--surface-soft);
  }
  .status-chip i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
  .status-chip.ready, .status-chip.good { color: var(--good); background: var(--good-soft); }
  .status-chip.high { color: var(--amber); background: var(--amber-soft); }
  .status-chip.urgent { color: var(--danger); background: var(--danger-soft); }
  .vehicle-name { color: var(--ink-strong); font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vehicle-meta { color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vehicle-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; padding-top: 8px; border-top: 1px solid #f1f5f9; }
  .miles { color: #475569; font-size: 10px; }
  .open-link { color: var(--blue); font-size: 10px; font-weight: 600; }

  /* ---------- Vehicle form ---------- */
  .vehicle-form {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; min-width: 0; }
  .field label { color: #475569; font-size: 11px; font-weight: 600; }
  .field input, .field select {
    width: 100%;
    min-height: 38px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
    color: var(--ink-strong);
    padding: 8px 10px;
    font-size: 13px;
  }
  .field input::placeholder { color: #94a3b8; }
  .field input:focus, .field select:focus { border-color: var(--blue); outline: 3px solid rgba(36, 86, 166, 0.13); outline-offset: 0; }
  .form-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  /* ---------- Activity ---------- */
  .activity-list { display: flex; flex-direction: column; }
  .activity-empty { color: var(--muted); font-size: 12px; line-height: 1.5; padding: 10px 0; }
  .activity-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 0;
    border: 0;
    border-bottom: 1px solid #f1f5f9;
    background: transparent;
    color: var(--ink);
    text-align: left;
  }
  .activity-item:last-child { border-bottom: 0; padding-bottom: 0; }
  .activity-item:hover .activity-title { color: var(--blue); }
  .activity-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-soft);
    color: var(--muted);
    font-size: 9px;
    font-weight: 700;
  }
  .activity-icon.low, .activity-icon.good { background: var(--good-soft); color: var(--good); }
  .activity-icon.medium { background: var(--amber-soft); color: var(--amber); }
  .activity-icon.high { background: #fff7ed; color: #c2410c; }
  .activity-icon.urgent { background: var(--danger-soft); color: var(--danger); }
  .activity-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .activity-title { color: var(--ink-strong); font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .activity-meta { color: var(--muted); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .activity-sev { flex: 0 0 auto; font-size: 9px; font-weight: 700; border-radius: 999px; padding: 2px 7px; }
  .activity-sev.low { color: var(--good); background: var(--good-soft); }
  .activity-sev.medium { color: var(--amber); background: var(--amber-soft); }
  .activity-sev.high { color: #c2410c; background: #fff7ed; }
  .activity-sev.urgent { color: var(--danger); background: var(--danger-soft); }

  .care-card .care-list { margin: 11px 0 0; padding: 0 0 0 16px; color: var(--muted); font-size: 12px; line-height: 1.55; }
  .care-list li { margin-bottom: 8px; }
  .care-list strong { color: #334155; }
  .care-footer { border-top: 1px solid #f1f5f9; margin-top: 12px; padding-top: 11px; font-size: 11px; font-weight: 600; }

  /* ---------- Workspace ---------- */
  .workspace-card { margin-top: 18px; }
  .workspace-empty { text-align: center; padding: 24px 16px 18px; }
  .workspace-empty .empty-icon { margin: 0 auto 10px; }
  .workspace-empty h3 { margin-bottom: 4px; }
  .workspace-empty p { color: var(--muted); font-size: 12px; max-width: 520px; margin: 0 auto; line-height: 1.55; }
  .service-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--line);
  }
  .service-head h2 { font-size: 19px; }
  .service-head .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .service-actions { display: flex; gap: 7px; flex-wrap: wrap; }
  .pill-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface-soft);
    color: #475569;
    padding: 3px 9px;
    font-size: 10px;
    font-weight: 500;
  }
  .pill.status.ready, .pill.status.good { color: var(--good); background: var(--good-soft); border-color: #bbf7d0; }
  .pill.status.high { color: var(--amber); background: var(--amber-soft); border-color: #fde68a; }
  .pill.status.urgent { color: var(--danger); background: var(--danger-soft); border-color: #fecaca; }
  .tabs { display: flex; gap: 0; margin: 16px 0 18px; border-bottom: 1px solid var(--line); }
  .tab {
    position: relative;
    border: 0;
    background: transparent;
    color: var(--muted);
    padding: 8px 14px 10px;
    font-size: 12px;
    font-weight: 600;
  }
  .tab::after { content: ""; position: absolute; height: 2px; left: 12px; right: 12px; bottom: -1px; background: transparent; }
  .tab:hover { color: var(--blue); }
  .tab.active { color: var(--blue); }
  .tab.active::after { background: var(--blue); }
  .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
  .panel-head { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 13px; }
  .panel-head h3 { margin-bottom: 4px; }
  .panel-head p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }

  /* ---------- Checklist and results ---------- */
  .checklist { min-width: 0; }
  .checklist-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; color: var(--muted); font-size: 11px; }
  .link-btn { border: 0; background: transparent; color: var(--blue); font-size: 11px; font-weight: 600; padding: 0; }
  .link-btn:hover { text-decoration: underline; }
  .symptom-group { margin-bottom: 15px; }
  .symptom-group h4 { margin: 0 0 7px; color: #475569; font-size: 10px; font-weight: 700; letter-spacing: 0.9px; text-transform: uppercase; }
  .symptom-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; }
  .symptom {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: #ffffff;
    padding: 8px 10px;
    color: #334155;
    font-size: 12px;
    line-height: 1.4;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .symptom:hover { border-color: #b8cce8; background: #fafcff; }
  .symptom input { width: 14px; height: 14px; margin: 1px 0 0; accent-color: var(--blue); flex: 0 0 14px; }
  .symptom:has(input:checked) { border-color: #9dbbe5; background: var(--blue-soft); color: var(--navy); }
  .results { margin-top: 18px; }
  .result { border: 1px solid var(--line); border-radius: 8px; background: #ffffff; padding: 13px; margin-bottom: 10px; }
  .result-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .result-head h4 { margin: 0; color: var(--ink-strong); font-size: 13px; font-weight: 700; }
  .severity { flex: 0 0 auto; border-radius: 999px; padding: 2px 7px; font-size: 9px; font-weight: 700; }
  .severity.low { color: var(--good); background: var(--good-soft); }
  .severity.medium { color: var(--amber); background: var(--amber-soft); }
  .severity.high { color: #c2410c; background: #fff7ed; }
  .severity.urgent { color: var(--danger); background: var(--danger-soft); }
  .confidence { display: flex; align-items: center; gap: 8px; margin: 9px 0 7px; color: var(--muted); font-size: 10px; }
  .confidence .bar { flex: 1; height: 5px; border-radius: 999px; background: #eef2f7; overflow: hidden; }
  .confidence .bar i { display: block; height: 5px; border-radius: 999px; background: var(--blue); }
  .confidence strong { color: var(--ink-strong); font-size: 11px; }
  .matched { color: var(--muted); font-size: 10px; line-height: 1.45; }
  .matched strong { color: #475569; }
  .result-actions { display: flex; gap: 7px; justify-content: flex-end; margin-top: 9px; }
  .result-empty { border: 1px dashed #cbd5e1; border-radius: 8px; background: #fbfcfe; padding: 14px; color: var(--muted); font-size: 12px; }
  .result-empty strong { color: var(--ink-strong); }
  .result-empty p { margin: 4px 0 0; }

  .summary-card {
    position: sticky;
    top: 18px;
    border: 1px solid #dbe5f3;
    border-radius: 8px;
    background: #f9fbff;
    padding: 15px;
  }
  .summary-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
  .summary-card h3 { font-size: 14px; }
  .summary-badge { color: var(--blue); background: #e7effc; border-radius: 999px; padding: 2px 8px; font-size: 9px; font-weight: 700; }
  .summary-copy { margin: 5px 0 12px; color: var(--muted); font-size: 11px; line-height: 1.5; }
  .summary-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-top: 1px solid #e7eef9; padding: 8px 0; color: var(--muted); font-size: 11px; }
  .summary-row strong { color: #334155; text-align: right; font-weight: 600; }
  .summary-card .btn { margin-top: 8px; }
  .summary-note { margin: 9px 0 0; color: #94a3b8; font-size: 9px; line-height: 1.45; }

  /* ---------- History ---------- */
  .history-list { display: flex; flex-direction: column; }
  .history-empty { color: var(--muted); font-size: 12px; padding: 6px 0 10px; }
  .history-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 0;
    border-bottom: 1px solid #f1f5f9;
    background: transparent;
    padding: 10px 0;
    text-align: left;
    color: var(--ink);
  }
  .history-row:last-child { border-bottom: 0; }
  .history-row:hover .history-cause { color: var(--blue); }
  .history-date { display: flex; flex-direction: column; width: 76px; flex: 0 0 76px; line-height: 1.3; }
  .history-date strong { color: #334155; font-size: 11px; }
  .history-date span { color: var(--muted); font-size: 9px; }
  .history-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.35; }
  .history-cause { color: var(--ink-strong); font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .history-meta { color: var(--muted); font-size: 10px; }
  .history-severity { flex: 0 0 auto; border-radius: 999px; padding: 2px 7px; font-size: 9px; font-weight: 700; }
  .history-severity.low { color: var(--good); background: var(--good-soft); }
  .history-severity.medium { color: var(--amber); background: var(--amber-soft); }
  .history-severity.high { color: #c2410c; background: #fff7ed; }
  .history-severity.urgent { color: var(--danger); background: var(--danger-soft); }
  .history-open { color: var(--muted); font-size: 10px; white-space: nowrap; }

  .page-footer {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 24px;
    color: #94a3b8;
    font-size: 10px;
    line-height: 1.5;
  }

  /* ---------- Modal and toast ---------- */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.48);
  }
  .modal {
    width: min(650px, 100%);
    max-height: min(85vh, 800px);
    overflow-y: auto;
    border-radius: 10px;
    background: #ffffff;
    padding: 22px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
  }
  .modal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 12px; }
  .modal-head h3 { margin: 0; color: var(--ink-strong); font-size: 17px; }
  .modal .meta { color: var(--muted); font-size: 11px; margin-top: 2px; }
  .modal h4 { margin: 16px 0 7px; color: #334155; font-size: 11px; letter-spacing: 0.8px; text-transform: uppercase; }
  .modal ul, .modal ol { margin: 0; padding-left: 20px; color: #475569; font-size: 12px; line-height: 1.6; }
  .modal li { margin-bottom: 4px; }
  .toast {
    position: fixed;
    right: 22px;
    bottom: 22px;
    z-index: 100;
    max-width: min(390px, calc(100vw - 44px));
    padding: 11px 14px;
    border-radius: 7px;
    background: #0f172a;
    color: #ffffff;
    font-size: 12px;
    line-height: 1.45;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.25);
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.error { background: var(--danger); }

  /* ---------- Auth gate ---------- */
  .auth-gate {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    padding: 28px 18px;
    background: #2d5189;
  }
  .auth-wrap { width: 100%; max-width: 424px; }
  .auth-card {
    background: #ffffff;
    border-radius: 8px;
    padding: 30px 32px 24px;
    box-shadow: 0 24px 70px rgba(9, 25, 51, 0.28);
  }
  .auth-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
  .auth-brand .brand-mark { background: var(--navy); color: #ffffff; width: 36px; height: 36px; flex-basis: 36px; }
  .auth-brand-copy { display: flex; flex-direction: column; line-height: 1.25; }
  .auth-brand-copy strong { color: var(--navy); font-size: 16px; }
  .auth-brand-copy span { color: var(--muted); font-size: 10px; }
  .auth-card h1 { margin: 0; color: var(--ink-strong); font-size: 23px; font-weight: 700; letter-spacing: -0.3px; }
  .auth-hint { margin: 5px 0 19px; color: var(--muted); font-size: 12px; line-height: 1.5; }
  .auth-tabs { display: flex; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
  .auth-tab {
    flex: 1;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--muted);
    padding: 8px 6px 9px;
    font-size: 12px;
    font-weight: 600;
  }
  .auth-tab.active { color: var(--blue); border-bottom-color: var(--blue); }
  .auth-tab:hover { color: var(--blue); }
  .auth-form .field { margin-bottom: 13px; }
  .auth-form .btn { margin-top: 3px; min-height: 41px; }
  .auth-error {
    display: none;
    margin: 0 0 13px;
    border: 1px solid #fecaca;
    border-radius: 6px;
    background: var(--danger-soft);
    color: var(--danger);
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.45;
  }
  .auth-error:not(:empty) { display: block; }
  .auth-note {
    margin-top: 17px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #f8fafc;
    color: var(--muted);
    padding: 10px 12px;
    font-size: 10px;
    line-height: 1.5;
  }
  .auth-note strong { color: #475569; }
  .auth-foot { margin-top: 16px; color: #94a3b8; font-size: 9px; text-align: center; }
  .auth-copyright { margin: 17px 0 0; color: #c9d8ef; font-size: 10px; text-align: center; }

  /* ---------- Responsive ---------- */
  @media (max-width: 1180px) {
    .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dashboard-grid { grid-template-columns: minmax(0, 1fr) 310px; }
  }
  @media (max-width: 980px) {
    .app-shell { grid-template-columns: 210px minmax(0, 1fr); }
    .main { padding: 22px 20px 28px; }
    .hero { grid-template-columns: 1fr; }
    .dashboard-grid { grid-template-columns: 1fr; }
    .right-stack { display: grid; grid-template-columns: 1fr 1fr; }
    .workspace-grid { grid-template-columns: 1fr; }
    .summary-card { position: static; }
  }
  @media (max-width: 760px) {
    .app-shell { display: block; }
    .sidebar { position: static; height: auto; padding: 16px; }
    .brand { padding: 0 2px 12px; }
    .sidebar-label, .side-status, .sidebar-spacer { display: none; }
    .side-nav { flex-direction: row; overflow-x: auto; gap: 5px; padding-bottom: 2px; }
    .nav-item { width: auto; white-space: nowrap; padding: 8px 11px; }
    .side-account { border-top: 0; padding: 12px 2px 0; }
    .signout { width: auto; margin: 0 0 0 auto; }
    .main { padding: 18px 14px 24px; }
    .page-header { flex-direction: column; gap: 12px; }
    .header-actions { width: 100%; }
    .hero { padding: 18px; }
    .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .stat-card { padding: 12px; }
    .right-stack { grid-template-columns: 1fr; }
    .service-head { flex-direction: column; }
    .history-open { display: none; }
    .page-footer { display: block; }
    .page-footer span { display: block; margin-bottom: 4px; }
  }
  @media (max-width: 520px) {
    .stats-grid { grid-template-columns: 1fr; }
    .form-row { grid-template-columns: 1fr; gap: 0; }
    .auth-card { padding: 24px 20px 19px; }
    .auth-gate { padding: 18px 12px; }
    .vehicle-grid { grid-template-columns: 1fr; }
    .symptom-options { grid-template-columns: 1fr; }
    .history-date { width: 62px; flex-basis: 62px; }
  }

  /* ---------- Library-style console refinements ---------- */
  .app-shell { grid-template-columns: 250px minmax(0, 1fr); }
  .sidebar {
    background: #1f3864;
    padding: 0;
    color: #ffffff;
  }
  .brand {
    gap: 0;
    padding: 25px 24px 23px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .brand-mark { display: none; }
  .brand-text strong {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.2px;
    line-height: 1.15;
  }
  .brand-text span { display: none; }
  .sidebar-label { display: none; }
  .side-nav { gap: 0; padding: 7px 0 0; }
  .nav-item {
    gap: 0;
    border-radius: 0;
    padding: 15px 24px;
    color: #f1f5fb;
    font-size: 14px;
    font-weight: 400;
  }
  .nav-item svg { display: none; }
  .nav-item:hover { background: #2a4f87; color: #ffffff; }
  .nav-item.active {
    background: #2e5ba4;
    color: #ffffff;
    font-weight: 500;
  }
  .sidebar-spacer { min-height: 26px; }
  .side-status { display: none !important; }
  .signout {
    width: 100%;
    margin: 0;
    padding: 16px 24px;
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 0;
    background: transparent;
    color: #f1f5fb;
    font-size: 14px;
    font-weight: 400;
    text-align: left;
  }
  .signout:hover { background: #2a4f87; color: #ffffff; }
  .main { padding: 26px 30px 34px; background: #f5f7fa; }
  .page-header { align-items: center; margin-bottom: 20px; }
  .page-header h1 { font-size: 26px; }
  .header-side {
    display: flex;
    align-items: center;
    gap: 18px;
    flex: 0 0 auto;
  }
  .header-user {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    padding-right: 18px;
    border-right: 1px solid #dbe3ee;
  }
  .header-user .avatar {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
    background: #1f3864;
    color: #ffffff;
  }
  .header-user .account-text strong { color: #1f2937; font-size: 12px; }
  .header-user .account-text span { color: #64748b; font-size: 10px; }
  .hero { background: #ffffff; border-color: #e2e8f0; }
  .hero h2 { color: #1f3864; }
  .hero-plate { background: #f8fafc; border-color: #e2e8f0; }
  .card, .stat-card { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035); }

  .auth-gate {
    background: #23477f;
    padding: 34px 18px;
  }
  .auth-wrap { max-width: 480px; }
  .auth-card {
    border-radius: 10px;
    padding: 37px 36px 30px;
    box-shadow: 0 18px 50px rgba(7, 24, 49, 0.28);
  }
  .auth-card h1 {
    text-align: center;
    color: #1f3864;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin: 0;
  }
  .auth-hint {
    text-align: center;
    margin: 8px 0 27px;
    color: #6b7280;
    font-size: 13px;
  }
  .auth-form .field { margin-bottom: 17px; gap: 6px; }
  .auth-form .field label {
    margin: 0;
    color: #111827;
    font-size: 14px;
    font-weight: 700;
  }
  .auth-form .field input {
    min-height: 44px;
    border-color: #cbd5e1;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 14px;
  }
  .auth-form .field input:focus {
    border-color: #111827;
    outline: 0;
    box-shadow: 0 0 0 1px #111827;
  }
  .auth-form .btn.primary {
    min-height: 48px;
    margin-top: 10px;
    border-radius: 6px;
    border-color: #1f3864;
    background: #1f3864;
    font-size: 15px;
    font-weight: 600;
  }
  .auth-form .btn.primary:hover {
    border-color: #172c50;
    background: #172c50;
  }
  .auth-error {
    margin: 0 0 17px;
    border-color: #f7d4d4;
    border-radius: 6px;
    background: #fdecec;
    color: #c53030;
    padding: 12px 14px;
    font-size: 13px;
    text-align: center;
  }
  .auth-note {
    margin-top: 22px;
    border-color: #dbeafd;
    border-radius: 6px;
    background: #eaf3ff;
    padding: 14px;
    text-align: center;
    color: #475569;
    font-size: 12px;
  }
  .auth-note strong {
    display: block;
    color: #111827;
    font-size: 13px;
    font-weight: 600;
  }
  .auth-switch-link {
    display: block;
    margin: 3px auto 5px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #1f3864;
    font-size: 13px;
    font-weight: 700;
    text-decoration: underline;
  }
  .auth-switch-link:hover { color: #2e5ba4; }
  .auth-note-detail { display: block; color: #64748b; font-size: 11px; line-height: 1.45; }
  .auth-copyright { display: none; }

  @media (max-width: 980px) {
    .app-shell { grid-template-columns: 218px minmax(0, 1fr); }
    .header-side { flex-direction: column; align-items: flex-end; gap: 10px; }
    .header-user { border-right: 0; padding-right: 0; }
  }
  @media (max-width: 760px) {
    .app-shell { display: block; }
    .sidebar { padding: 0; }
    .brand { padding: 17px 18px 15px; border-bottom: 0; }
    .brand-text strong { font-size: 21px; }
    .side-nav {
      flex-direction: row;
      gap: 0;
      overflow-x: auto;
      padding: 0;
      background: #1a3057;
    }
    .nav-item { width: auto; padding: 12px 15px; white-space: nowrap; }
    .sidebar-spacer { display: none; }
    .signout {
      display: block;
      width: 100%;
      padding: 11px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.09);
      background: #1a3057;
      font-size: 13px;
    }
    .main { padding: 18px 14px 24px; }
    .page-header { flex-direction: column; align-items: flex-start; gap: 13px; }
    .header-side { width: 100%; align-items: flex-start; }
    .header-user { display: flex; }
    .header-actions { width: 100%; }
    .hero { padding: 18px; }
  }
  @media (max-width: 520px) {
    .auth-card { padding: 30px 22px 24px; }
    .auth-gate { padding: 20px 11px; }
    .auth-card h1 { font-size: 25px; }
  }
`;

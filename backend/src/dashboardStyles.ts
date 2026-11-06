/**
 * Styles for the server-rendered service console.
 * Kept separate from markup and client behaviour so the dashboard stays
 * dependency-free without becoming one unmaintainable template literal.
 */
export const DASHBOARD_STYLES = `
  :root {
    color-scheme: light;
    --bg: #eef3f6;
    --surface: #ffffff;
    --surface-soft: #f7fafb;
    --ink: #102431;
    --muted: #6b808d;
    --line: #dce7ec;
    --navy: #0a1b26;
    --navy-2: #102c3b;
    --accent: #ff7a2f;
    --accent-deep: #e85f14;
    --accent-soft: #fff0e6;
    --cyan: #0e9caf;
    --good: #159b6c;
    --good-soft: #e8f8f1;
    --warn: #b97800;
    --warn-soft: #fff6df;
    --danger: #ce3f3f;
    --danger-soft: #fff0f0;
    --radius: 22px;
    --shadow: 0 18px 48px rgba(16, 42, 58, 0.08);
    --shadow-soft: 0 8px 24px rgba(16, 42, 58, 0.06);
    --font: "Segoe UI", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    min-width: 320px;
    color: var(--ink);
    background:
      radial-gradient(circle at 91% 2%, rgba(14, 156, 175, 0.10), transparent 28%),
      radial-gradient(circle at 5% 80%, rgba(255, 122, 47, 0.07), transparent 25%),
      var(--bg);
    font-family: var(--font);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  button, input, select { font: inherit; }
  button, a { -webkit-tap-highlight-color: transparent; }
  button { cursor: pointer; }
  a { color: inherit; }
  [hidden] { display: none !important; }
  ::selection { background: rgba(255, 122, 47, 0.22); }

  :focus-visible {
    outline: 3px solid rgba(255, 122, 47, 0.38);
    outline-offset: 2px;
  }

  .app-shell {
    display: grid;
    grid-template-columns: 252px minmax(0, 1fr);
    min-height: 100vh;
  }

  /* ---- sidebar ------------------------------------------------------- */
  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    padding: 26px 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 26px;
    overflow: hidden;
    color: #eaf4f8;
    background:
      radial-gradient(circle at 0 0, rgba(255, 138, 61, 0.13), transparent 30%),
      linear-gradient(180deg, #0a1b26 0%, #0d2331 62%, #102b3a 100%);
  }
  .sidebar::after {
    content: "";
    position: absolute;
    inset: auto -60px -80px;
    height: 220px;
    pointer-events: none;
    background: radial-gradient(circle, rgba(14, 156, 175, 0.18), transparent 65%);
  }
  .brand {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 11px;
    text-decoration: none;
    color: #fff;
  }
  .brand-mark {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    color: #2a180c;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, #ff8a3d, #ffc07b);
    box-shadow: 0 10px 24px rgba(255, 122, 47, 0.28);
  }
  .brand-text { display: flex; flex-direction: column; line-height: 1.15; }
  .brand-text strong { font-size: 18px; letter-spacing: -0.03em; }
  .brand-text span { margin-top: 4px; color: #88a6b4; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }

  .side-nav { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 5px; }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 11px 12px;
    border: 0;
    border-radius: 12px;
    color: #a9c0ca;
    background: transparent;
    font-size: 13px;
    font-weight: 650;
    text-align: left;
    transition: background 160ms ease, color 160ms ease, transform 160ms ease;
  }
  .nav-item:hover { color: #fff; background: rgba(255, 255, 255, 0.07); transform: translateX(2px); }
  .nav-item.active { color: #fff; background: rgba(255, 255, 255, 0.10); box-shadow: inset 3px 0 0 var(--accent); }
  .nav-bullet {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    border: 1.5px solid #5f7f8e;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .nav-item.active .nav-bullet { border-color: var(--accent); background: var(--accent); }

  .side-status {
    position: relative;
    z-index: 1;
    margin-top: auto;
    padding: 14px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.045);
    display: flex;
    flex-direction: column;
    gap: 9px;
    font-size: 11px;
  }
  .side-status-row { display: flex; align-items: center; gap: 8px; color: #aac1cb; }
  .side-status-row.is-good { color: #a9efd3; }
  .side-status-row.is-muted { color: #91a7b1; }
  .side-status-row.subtle { color: #6f8b99; line-height: 1.4; }
  .dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #78909c;
  }
  .dot.on { background: #3ee0a5; box-shadow: 0 0 0 4px rgba(62, 224, 165, 0.12); }
  .dot.off { background: #ff7272; box-shadow: 0 0 0 4px rgba(255, 114, 114, 0.10); }

  .side-account {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.09);
  }
  .avatar {
    flex: 0 0 auto;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: #102431;
    background: linear-gradient(135deg, #d8f4ee, #9be1d2);
    font-size: 12px;
    font-weight: 900;
  }
  .account-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .account-text strong { overflow: hidden; color: #f2f9fb; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  .account-text span { overflow: hidden; color: #7898a7; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .signout {
    flex: 0 0 auto;
    margin-left: auto;
    padding: 7px 9px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 9px;
    color: #b9ced7;
    background: transparent;
    font-size: 10px;
    font-weight: 700;
  }
  .signout:hover { color: #fff; border-color: rgba(255, 255, 255, 0.28); }

  /* ---- page shell ---------------------------------------------------- */
  .main {
    width: 100%;
    max-width: 1520px;
    margin: 0 auto;
    padding: 28px 32px 46px;
  }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }
  .eyebrow {
    color: var(--cyan);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .page-header h1 {
    margin: 7px 0 7px;
    font-size: clamp(29px, 3vw, 39px);
    line-height: 1.05;
    letter-spacing: -0.045em;
  }
  .page-header p { max-width: 650px; margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; }
  .header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 9px; flex-wrap: wrap; }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 15px;
    border: 1px solid transparent;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 750;
    line-height: 1.2;
    text-decoration: none;
    white-space: nowrap;
    transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease, border-color 150ms ease;
  }
  .btn:hover { transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .btn.primary {
    color: #fff;
    background: linear-gradient(135deg, var(--accent), #ffa25e);
    box-shadow: 0 9px 22px rgba(255, 122, 47, 0.22);
  }
  .btn.primary:hover { box-shadow: 0 12px 26px rgba(255, 122, 47, 0.28); }
  .btn.secondary {
    color: var(--ink);
    border-color: var(--line);
    background: #fff;
    box-shadow: var(--shadow-soft);
  }
  .btn.secondary:hover { border-color: #bdd4dd; }
  .btn.ghost { color: var(--ink); border-color: var(--line); background: transparent; }
  .btn.ghost:hover { background: rgba(255, 255, 255, 0.6); }
  .btn.danger { color: var(--danger); border-color: #f1cccc; background: #fff8f8; }
  .btn.danger:hover { background: var(--danger-soft); }
  .btn.small { padding: 8px 11px; border-radius: 10px; font-size: 11px; }
  .btn.wide { width: 100%; }
  .link-btn {
    padding: 0;
    border: 0;
    color: var(--accent-deep);
    background: transparent;
    font-size: 11px;
    font-weight: 750;
  }
  .link-btn:hover { text-decoration: underline; }

  /* ---- hero ---------------------------------------------------------- */
  .hero {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    padding: 32px 34px;
    border-radius: 26px;
    color: #fff;
    background: linear-gradient(118deg, #091c27 0%, #123849 58%, #0a2634 100%);
    box-shadow: 0 24px 60px rgba(8, 27, 38, 0.22);
  }
  .hero::before {
    content: "";
    position: absolute;
    top: -120px;
    right: 8%;
    width: 340px;
    height: 340px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 138, 61, 0.38), transparent 68%);
    pointer-events: none;
  }
  .hero::after {
    content: "";
    position: absolute;
    right: -80px;
    bottom: -150px;
    width: 380px;
    height: 380px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.10);
    box-shadow: 0 0 0 34px rgba(255, 255, 255, 0.025), 0 0 0 68px rgba(255, 255, 255, 0.018);
    pointer-events: none;
  }
  .hero-copy { position: relative; z-index: 1; max-width: 700px; }
  .hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #ffc493;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .hero-kicker::before {
    content: "";
    width: 20px;
    height: 1px;
    background: #ff9f5d;
  }
  .hero h2 {
    max-width: 680px;
    margin: 10px 0 12px;
    font-size: clamp(29px, 4vw, 45px);
    line-height: 1.02;
    letter-spacing: -0.055em;
  }
  .hero p { max-width: 590px; margin: 0; color: #b7cbd5; font-size: 13px; line-height: 1.6; }
  .hero-actions { display: flex; justify-content: flex-start; gap: 9px; margin-top: 22px; flex-wrap: wrap; }
  .hero .btn.primary { color: #2a160a; background: linear-gradient(135deg, #ff9b55, #ffc184); box-shadow: 0 12px 24px rgba(255, 122, 47, 0.20); }
  .hero .btn.ghost { color: #eaf5f8; border-color: rgba(255, 255, 255, 0.20); background: rgba(255, 255, 255, 0.065); }
  .hero .btn.ghost:hover { background: rgba(255, 255, 255, 0.12); }
  .hero-plate {
    position: relative;
    z-index: 1;
    flex: 0 0 250px;
    padding: 18px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.075);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
  }
  .plate-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .plate-label { color: #89aab8; font-size: 9px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
  .plate-badge {
    padding: 3px 7px;
    border: 1px solid rgba(147, 232, 201, 0.22);
    border-radius: 999px;
    color: #a8ecd5;
    background: rgba(62, 224, 165, 0.09);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .hero-plate strong { display: block; margin-top: 16px; color: #fff; font-size: 18px; line-height: 1.2; letter-spacing: -0.02em; }
  .hero-plate > span { display: block; margin-top: 5px; color: #91afbc; font-size: 11px; line-height: 1.4; }
  .plate-rule { height: 1px; margin: 16px 0 11px; background: rgba(255, 255, 255, 0.11); }
  .plate-status { display: flex; align-items: center; gap: 8px; color: #a8c1ca; font-size: 10px; }

  /* ---- stats --------------------------------------------------------- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 13px;
    margin: 18px 0;
  }
  .stat-card {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    min-width: 0;
    padding: 15px 16px;
    border: 1px solid var(--line);
    border-radius: 17px;
    background: #fff;
    box-shadow: var(--shadow-soft);
  }
  .stat-icon {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    display: grid;
    place-items: center;
  }
  .stat-icon svg { width: 18px; height: 18px; }
  .stat-icon.mint { color: #118b62; background: #e4f8f0; }
  .stat-icon.blue { color: #087f91; background: #e6f7fa; }
  .stat-icon.amber { color: #a76a00; background: #fff4dc; }
  .stat-icon.violet { color: #6d53b7; background: #f0edff; }
  .stat-body { min-width: 0; display: flex; flex-direction: column; }
  .stat-label { display: block; color: var(--muted); font-size: 9px; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase; }
  .stat-value { display: block; margin-top: 4px; overflow: hidden; font-size: 24px; font-weight: 850; line-height: 1.1; letter-spacing: -0.04em; text-overflow: ellipsis; white-space: nowrap; }
  .stat-meta { display: block; margin-top: 3px; overflow: hidden; color: #8a9ba5; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }

  /* ---- cards / grid -------------------------------------------------- */
  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(290px, 0.8fr);
    gap: 18px;
    align-items: start;
  }
  .card {
    min-width: 0;
    padding: 21px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
  .card-head h3, .card h3 { margin: 4px 0 0; font-size: 18px; letter-spacing: -0.035em; }
  .card-sub { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
  .mini-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    border: 1px solid #d8e9ee;
    border-radius: 999px;
    color: #4c7480;
    background: #f4fbfc;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .right-stack { display: flex; flex-direction: column; gap: 18px; }

  /* ---- service bay / vehicles --------------------------------------- */
  .vehicle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
  .vehicle-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 15px;
    color: var(--ink);
    background: linear-gradient(180deg, #fff, #fafdfe);
    text-align: left;
    transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
  }
  .vehicle-card:hover { transform: translateY(-2px); border-color: #bdd8e1; box-shadow: var(--shadow-soft); }
  .vehicle-card.active { border-color: rgba(255, 122, 47, 0.62); box-shadow: 0 0 0 3px rgba(255, 122, 47, 0.11), var(--shadow-soft); }
  .vehicle-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .vehicle-avatar {
    width: 31px;
    height: 31px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: #0f6f61;
    background: #e5f7f1;
    font-size: 11px;
    font-weight: 900;
  }
  .vehicle-card[data-type="motorcycle"] .vehicle-avatar { color: #8f5e0b; background: #fff4dc; }
  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 140px;
    padding: 4px 7px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.05em;
    line-height: 1.25;
    text-transform: uppercase;
  }
  .status-chip i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
  .status-chip.ready { color: #477886; background: #eef8fa; }
  .status-chip.good { color: #11835e; background: var(--good-soft); }
  .status-chip.high { color: #9a6500; background: var(--warn-soft); }
  .status-chip.urgent { color: #b63232; background: var(--danger-soft); }
  .vehicle-name { overflow: hidden; font-size: 14px; font-weight: 800; letter-spacing: -0.02em; text-overflow: ellipsis; white-space: nowrap; }
  .vehicle-meta { overflow: hidden; color: var(--muted); font-size: 10px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
  .vehicle-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 9px; border-top: 1px solid #edf3f5; }
  .vehicle-foot .miles { color: #7d929d; font-size: 9px; font-weight: 700; }
  .open-link { color: var(--accent-deep); font-size: 9px; font-weight: 850; letter-spacing: 0.02em; }
  .empty-garage {
    grid-column: 1 / -1;
    padding: 24px 18px;
    border: 1px dashed #c7dbe3;
    border-radius: 15px;
    color: var(--muted);
    background: #fbfdfe;
    text-align: center;
    font-size: 11px;
    line-height: 1.5;
  }
  .empty-garage strong { display: block; margin-bottom: 3px; color: var(--ink); font-size: 14px; }
  .empty-garage p { margin: 0 0 12px; }
  .empty-icon {
    width: 36px;
    height: 36px;
    margin: 0 auto 9px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    color: var(--accent-deep);
    background: var(--accent-soft);
    font-size: 18px;
    font-weight: 700;
  }

  .vehicle-form {
    margin-top: 14px;
    padding: 15px;
    border: 1px solid var(--line);
    border-radius: 15px;
    background: var(--surface-soft);
    scroll-margin-top: 20px;
  }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 9px; }
  .field label { color: #536c78; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .field input, .field select {
    width: 100%;
    padding: 9px 10px;
    border: 1px solid #cfdfe5;
    border-radius: 10px;
    color: var(--ink);
    background: #fff;
    font-size: 12px;
    outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
  .field input::placeholder { color: #a6b6bf; }
  .field input:focus, .field select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(255, 122, 47, 0.10); }
  .form-actions { display: flex; gap: 8px; margin-top: 4px; }

  /* ---- activity ------------------------------------------------------ */
  .activity-list { display: flex; flex-direction: column; }
  .activity-item {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 10px 0;
    border: 0;
    border-bottom: 1px solid #edf3f5;
    color: var(--ink);
    background: transparent;
    text-align: left;
  }
  .activity-item:last-child { border-bottom: 0; padding-bottom: 0; }
  .activity-item:hover .activity-title { color: var(--accent-deep); }
  .activity-icon {
    flex: 0 0 auto;
    width: 31px;
    height: 31px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: #14775b;
    background: #e8f8f2;
    font-size: 8px;
    font-weight: 900;
  }
  .activity-icon.high { color: #9a6500; background: var(--warn-soft); }
  .activity-icon.urgent { color: #b63232; background: var(--danger-soft); }
  .activity-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .activity-title { overflow: hidden; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; transition: color 150ms ease; }
  .activity-meta { overflow: hidden; color: #8b9da6; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .activity-sev { flex: 0 0 auto; padding: 3px 6px; border-radius: 6px; color: #687d87; background: #f1f6f8; font-size: 8px; font-weight: 850; text-transform: uppercase; }
  .activity-sev.high { color: #8f5e00; background: var(--warn-soft); }
  .activity-sev.urgent { color: #a82f2f; background: var(--danger-soft); }
  .activity-empty { padding: 10px 0 2px; color: var(--muted); font-size: 11px; line-height: 1.5; }

  .care-card { background: linear-gradient(165deg, #f8fcfd, #fff 72%); }
  .care-list { margin: 13px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 11px; }
  .care-list li { position: relative; padding-left: 20px; color: #627783; font-size: 11px; line-height: 1.5; }
  .care-list li::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 5px;
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  .care-list strong { color: var(--ink); }
  .care-footer { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 10px; }

  /* ---- workspace ----------------------------------------------------- */
  .workspace-card { margin-top: 18px; padding: 0; overflow: hidden; scroll-margin-top: 18px; }
  .workspace-empty { padding: 34px 24px; text-align: center; }
  .workspace-empty .empty-icon { width: 44px; height: 44px; border-radius: 14px; font-size: 12px; }
  .workspace-empty h3 { margin: 0; font-size: 20px; letter-spacing: -0.035em; }
  .workspace-empty p { max-width: 480px; margin: 7px auto 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
  .workspace-inner { padding: 22px; }
  .service-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  .service-head h2 { margin: 5px 0 4px; font-size: 25px; letter-spacing: -0.045em; }
  .service-head .sub { color: var(--muted); font-size: 11px; }
  .service-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
  .pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border: 1px solid #dce9ee;
    border-radius: 999px;
    color: #5f7884;
    background: #f8fbfc;
    font-size: 9px;
    font-weight: 750;
    white-space: nowrap;
  }
  .pill.status { border-color: transparent; background: #eff8fa; }
  .pill.status.good { color: #11835e; background: var(--good-soft); }
  .pill.status.high { color: #936000; background: var(--warn-soft); }
  .pill.status.urgent { color: #ae3030; background: var(--danger-soft); }
  .tabs { display: flex; gap: 7px; padding: 14px 0 0; }
  .tab {
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 9px;
    color: #617985;
    background: #fff;
    font-size: 11px;
    font-weight: 750;
  }
  .tab:hover { border-color: #bed4dc; }
  .tab.active { color: #fff; border-color: var(--navy); background: var(--navy); }
  .workspace-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(255px, 0.75fr); gap: 18px; align-items: start; padding-top: 16px; }
  .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .panel-head h3 { margin: 4px 0 0; font-size: 17px; letter-spacing: -0.03em; }
  .panel-head p { margin: 4px 0 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
  .checklist-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 7px 0 10px; color: #8799a3; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .checklist { display: flex; flex-direction: column; gap: 13px; }
  .symptom-group h4 { margin: 0 0 6px; color: #718792; font-size: 9px; font-weight: 850; letter-spacing: 0.11em; text-transform: uppercase; }
  .symptom-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .symptom {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 9px 10px;
    border: 1px solid #e0eaee;
    border-radius: 10px;
    color: #415a66;
    background: #fbfdfe;
    font-size: 10px;
    line-height: 1.4;
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease;
  }
  .symptom:hover { border-color: #bcd8e1; background: #f7fcfd; }
  .symptom:has(input:checked) { border-color: rgba(255, 122, 47, 0.50); color: #3b2a20; background: #fff8f3; }
  .symptom input { flex: 0 0 auto; margin: 2px 0 0; accent-color: var(--accent); }
  .summary-card {
    position: sticky;
    top: 18px;
    padding: 16px;
    border: 1px solid #d9e8ed;
    border-radius: 16px;
    background: linear-gradient(165deg, #f8fcfd, #fff 72%);
    box-shadow: var(--shadow-soft);
  }
  .summary-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .summary-badge { padding: 3px 6px; border-radius: 5px; color: #0e7d8e; background: #e6f7fa; font-size: 8px; font-weight: 850; letter-spacing: 0.08em; text-transform: uppercase; }
  .summary-card h3 { margin: 10px 0 5px; font-size: 17px; letter-spacing: -0.03em; }
  .summary-copy { margin: 0 0 12px; color: var(--muted); font-size: 10px; line-height: 1.5; }
  .summary-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid #e8f1f4; font-size: 10px; }
  .summary-row span { color: #718792; }
  .summary-row strong { max-width: 65%; color: var(--ink); font-weight: 800; text-align: right; }
  .summary-note { margin: 10px 0 0; color: #8a9ba5; font-size: 9px; line-height: 1.45; }
  .summary-card .btn { margin-top: 11px; }

  .results { display: flex; flex-direction: column; gap: 9px; margin-top: 16px; }
  .result { padding: 13px; border: 1px solid var(--line); border-radius: 13px; background: #fff; }
  .result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .result-head h4 { margin: 0; font-size: 13px; letter-spacing: -0.02em; }
  .severity {
    flex: 0 0 auto;
    padding: 3px 7px;
    border-radius: 999px;
    color: #6f828c;
    background: #f0f6f8;
    font-size: 8px;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .severity.low { color: #14775b; background: var(--good-soft); }
  .severity.medium { color: #5a6f7a; background: #eff5f7; }
  .severity.high { color: #8f5e00; background: var(--warn-soft); }
  .severity.urgent { color: #a82f2f; background: var(--danger-soft); }
  .confidence { display: flex; align-items: center; gap: 8px; margin: 9px 0; color: #78909c; font-size: 9px; }
  .bar { flex: 1; height: 7px; overflow: hidden; border-radius: 999px; background: #edf3f5; }
  .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), #ffb36b); }
  .confidence strong { color: var(--ink); font-size: 11px; }
  .matched { color: #718792; font-size: 9px; line-height: 1.5; }
  .matched strong { color: #4c6470; }
  .result-actions { display: flex; justify-content: flex-end; margin-top: 9px; }
  .result-empty { padding: 16px; border: 1px dashed #c9dce3; border-radius: 13px; background: #fbfdfe; text-align: center; }
  .result-empty strong { display: block; margin-bottom: 3px; font-size: 13px; }
  .result-empty p { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.5; }

  .history-list { display: flex; flex-direction: column; gap: 8px; }
  .history-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--ink);
    background: #fbfdfe;
    text-align: left;
    transition: border-color 140ms ease, background 140ms ease;
  }
  .history-row:hover { border-color: #bad7e0; background: #fff; }
  .history-date { flex: 0 0 66px; display: flex; flex-direction: column; gap: 1px; }
  .history-date strong { font-size: 10px; }
  .history-date span { color: #8b9da6; font-size: 8px; }
  .history-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .history-cause { overflow: hidden; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
  .history-meta { overflow: hidden; color: #8b9da6; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .history-severity { flex: 0 0 auto; padding: 3px 6px; border-radius: 5px; color: #687d87; background: #f0f5f7; font-size: 8px; font-weight: 850; text-transform: uppercase; }
  .history-severity.high { color: #8f5e00; background: var(--warn-soft); }
  .history-severity.urgent { color: #a82f2f; background: var(--danger-soft); }
  .history-open { flex: 0 0 auto; color: var(--accent-deep); font-size: 9px; font-weight: 850; }
  .history-empty { padding: 22px 16px; border: 1px dashed #c9dce3; border-radius: 13px; color: var(--muted); background: #fbfdfe; text-align: center; font-size: 11px; line-height: 1.5; }

  .loading { padding: 15px 4px; color: #8a9ba5; font-size: 11px; }
  .empty-note { padding: 12px 4px; color: var(--muted); font-size: 11px; line-height: 1.5; }

  /* ---- footer / toast / modal --------------------------------------- */
  .page-footer {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    margin-top: 22px;
    padding: 0 3px;
    color: #8a9ba5;
    font-size: 10px;
  }
  .page-footer a { color: #55727f; font-weight: 700; text-decoration: none; }
  .page-footer a:hover { color: var(--accent-deep); }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 400;
    max-width: min(92vw, 560px);
    padding: 11px 16px;
    border-radius: 11px;
    color: #f4fbfd;
    background: #0d2633;
    box-shadow: 0 14px 36px rgba(8, 27, 38, 0.22);
    font-size: 11px;
    line-height: 1.4;
    opacity: 0;
    pointer-events: none;
    transform: translateX(-50%) translateY(16px);
    transition: opacity 180ms ease, transform 180ms ease;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .toast.error { background: #8f2f2f; }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(6, 22, 31, 0.58);
    backdrop-filter: blur(4px);
  }
  .modal {
    width: min(720px, 100%);
    max-height: 86vh;
    overflow: auto;
    padding: 22px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 30px 80px rgba(4, 18, 26, 0.32);
  }
  .modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 15px; }
  .modal-head h3 { margin: 0; font-size: 20px; letter-spacing: -0.035em; }
  .modal .meta { margin-top: 4px; color: var(--muted); font-size: 10px; line-height: 1.5; }
  .modal h4 { margin: 17px 0 6px; color: #526b77; font-size: 9px; font-weight: 850; letter-spacing: 0.11em; text-transform: uppercase; }
  .modal ul, .modal ol { margin: 0; padding-left: 20px; color: #516873; font-size: 11px; line-height: 1.65; }
  .modal .results { margin-top: 4px; }
  .modal .result-actions { margin-top: 8px; }

  /* ---- auth ---------------------------------------------------------- */
  .auth-gate {
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
      radial-gradient(circle at 18% 14%, rgba(14, 156, 175, 0.16), transparent 28%),
      radial-gradient(circle at 86% 82%, rgba(255, 122, 47, 0.14), transparent 30%),
      #eaf1f4;
  }
  .auth-shell {
    display: grid;
    grid-template-columns: 1.02fr 0.98fr;
    width: min(1040px, 100%);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 30px;
    background: #fff;
    box-shadow: 0 32px 90px rgba(9, 31, 43, 0.18);
  }
  .auth-visual {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 580px;
    padding: 38px;
    color: #fff;
    background: linear-gradient(150deg, #081a25 0%, #113a4a 68%, #0d2936 100%);
  }
  .auth-visual::before {
    content: "";
    position: absolute;
    top: -120px;
    right: -90px;
    width: 360px;
    height: 360px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 138, 61, 0.42), transparent 66%);
  }
  .auth-visual::after {
    content: "";
    position: absolute;
    right: -110px;
    bottom: -140px;
    width: 340px;
    height: 340px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 0 32px rgba(255, 255, 255, 0.025), 0 0 0 64px rgba(255, 255, 255, 0.018);
  }
  .auth-brand { position: relative; z-index: 1; display: flex; align-items: center; gap: 11px; }
  .auth-brand .brand-mark { width: 42px; height: 42px; border-radius: 13px; font-size: 13px; }
  .auth-brand-copy { display: flex; flex-direction: column; gap: 3px; }
  .auth-brand-copy strong { font-size: 17px; letter-spacing: -0.03em; }
  .auth-brand-copy span { color: #8faab8; font-size: 9px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
  .auth-copy { position: relative; z-index: 1; margin: 44px 0; }
  .auth-copy .eyebrow { color: #ffc08b; }
  .auth-copy h2 { max-width: 420px; margin: 12px 0 13px; font-size: clamp(30px, 4vw, 45px); line-height: 1.02; letter-spacing: -0.055em; }
  .auth-copy p { max-width: 390px; margin: 0; color: #b5cbd6; font-size: 12px; line-height: 1.65; }
  .auth-points { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 11px; }
  .auth-point { display: flex; align-items: flex-start; gap: 9px; color: #bdd1db; font-size: 11px; line-height: 1.45; }
  .auth-check {
    flex: 0 0 auto;
    width: 15px;
    height: 15px;
    margin-top: 1px;
    border: 1px solid rgba(148, 231, 203, 0.36);
    border-radius: 5px;
    display: grid;
    place-items: center;
    color: #a9ecd6;
    background: rgba(62, 224, 165, 0.09);
    font-size: 8px;
    font-weight: 900;
  }
  .auth-point strong { color: #eaf7fa; }
  .auth-visual-footer { position: relative; z-index: 1; color: #6f8d9b; font-size: 9px; line-height: 1.5; }
  .auth-panel { display: flex; flex-direction: column; justify-content: center; gap: 18px; padding: 42px 40px; }
  .auth-panel h1 { margin: 0; font-size: 27px; letter-spacing: -0.045em; }
  .auth-panel > p { margin: -10px 0 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
  .auth-form { display: flex; flex-direction: column; gap: 12px; }
  .auth-form .field { margin: 0; }
  .auth-form .field input { padding: 11px 12px; font-size: 13px; }
  .auth-form .btn { margin-top: 2px; padding: 12px 15px; }
  .auth-error { min-height: 15px; color: var(--danger); font-size: 10px; line-height: 1.4; }
  .auth-foot { padding-top: 16px; border-top: 1px solid var(--line); color: #7d929d; font-size: 10px; line-height: 1.6; }
  .auth-foot a { color: var(--accent-deep); font-weight: 750; text-decoration: none; }
  .auth-foot a:hover { text-decoration: underline; }
  .auth-note { display: flex; align-items: flex-start; gap: 7px; padding: 9px 10px; border-radius: 9px; color: #557885; background: #f1f9fa; font-size: 9px; line-height: 1.5; }
  .auth-note strong { color: #2f6876; }

  /* ---- responsive ---------------------------------------------------- */
  @media (max-width: 1180px) {
    .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dashboard-grid { grid-template-columns: 1fr; }
    .right-stack { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .auth-visual { padding: 30px; }
    .auth-panel { padding: 34px 30px; }
  }
  @media (max-width: 1000px) {
    .app-shell { display: block; }
    .sidebar {
      position: static;
      height: auto;
      padding: 15px 18px;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 13px;
    }
    .brand-text span { display: none; }
    .side-nav { flex-direction: row; order: 3; width: 100%; overflow-x: auto; padding-bottom: 2px; }
    .nav-item { width: auto; flex: 0 0 auto; padding: 8px 10px; }
    .nav-item:hover { transform: none; }
    .side-status { display: none; }
    .side-account { margin-left: auto; padding-top: 0; border-top: 0; }
    .main { padding: 23px 18px 40px; }
  }
  @media (max-width: 760px) {
    .page-header { flex-direction: column; gap: 14px; }
    .header-actions { justify-content: flex-start; }
    .hero { flex-direction: column; align-items: flex-start; padding: 26px 23px; }
    .hero-plate { flex: 0 0 auto; width: 100%; }
    .vehicle-grid, .symptom-options, .workspace-grid { grid-template-columns: 1fr; }
    .right-stack { grid-template-columns: 1fr; }
    .service-head { flex-direction: column; }
    .service-head .btn { align-self: flex-start; }
    .service-actions { align-self: flex-start; }
    .summary-card { position: static; }
    .auth-shell { grid-template-columns: 1fr; width: min(520px, 100%); }
    .auth-visual { display: none; }
    .auth-panel { padding: 31px 24px; }
    .form-row { grid-template-columns: 1fr; gap: 0; }
    .modal { padding: 18px; }
    .page-footer { flex-direction: column; gap: 5px; }
  }
  @media (max-width: 430px) {
    .stats-grid { gap: 9px; }
    .stat-card { padding: 12px; gap: 9px; }
    .stat-icon { width: 30px; height: 30px; }
    .stat-value { font-size: 21px; }
    .card { padding: 17px; }
    .workspace-inner { padding: 17px; }
    .avatar { display: none; }
    .account-text span { display: none; }
    .account-text strong { max-width: 96px; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }
`;

import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const API = "http://localhost:5000/api";
const RESET_SECS = 30;

// ─── Country coordinates (lat/lng centre points) ──────────────────────────────
const GEO = {
  US: { lat: 37.09, lng: -95.71, name: "United States" }, UK: { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  DE: { lat: 51.17, lng: 10.45, name: "Germany" }, FR: { lat: 46.23, lng: 2.21, name: "France" },
  IN: { lat: 20.59, lng: 78.96, name: "India" }, CN: { lat: 35.86, lng: 104.19, name: "China" },
  RU: { lat: 61.52, lng: 105.32, name: "Russia" }, BR: { lat: -14.24, lng: -51.93, name: "Brazil" },
  NG: { lat: 9.08, lng: 8.68, name: "Nigeria" }, KP: { lat: 40.34, lng: 127.51, name: "N. Korea" },
  IR: { lat: 32.43, lng: 53.69, name: "Iran" }, AU: { lat: -25.27, lng: 133.78, name: "Australia" },
  CA: { lat: 56.13, lng: -106.35, name: "Canada" }, JP: { lat: 36.20, lng: 138.25, name: "Japan" },
  MX: { lat: 23.63, lng: -102.55, name: "Mexico" }, ZA: { lat: -30.56, lng: 22.94, name: "S. Africa" },
  PK: { lat: 30.38, lng: 69.35, name: "Pakistan" }, TR: { lat: 38.96, lng: 35.24, name: "Turkey" },
  UA: { lat: 48.38, lng: 31.17, name: "Ukraine" }, VN: { lat: 14.06, lng: 108.28, name: "Vietnam" },
  SG: { lat: 1.35, lng: 103.82, name: "Singapore" }, KR: { lat: 37.57, lng: 126.98, name: "South Korea" },
  SA: { lat: 23.89, lng: 45.08, name: "Saudi Arabia" }, EG: { lat: 26.82, lng: 30.80, name: "Egypt" },
};
const HIGH_RISK = new Set(["RU", "CN", "NG", "KP", "IR", "PK"]);
const SERVER_COORDS = { lat: 40.71, lng: -74.01 }; // "server" origin for arc lines

// ─── CSS ──────────────────────────────────────────────────────────────────────
// Inject Leaflet CSS as a <link> tag (not @import - unreliable inside style tags)
function injectLeafletCSS() {
  if (document.getElementById("__leaflet-css")) return;
  const link = document.createElement("link");
  link.id = "__leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}
injectLeafletCSS();

const injectCSS = css => {
  let el = document.getElementById("__tl5");
  if (!el) { el = document.createElement("style"); el.id = "__tl5"; document.head.appendChild(el); }
  el.textContent = css;
};
injectCSS(`
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html,body,#root{height:100%;min-height:100%}
  body{background:#060810;font-family:'Syne',sans-serif;color:#dde4f0;overflow:hidden}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#1c2d4a;border-radius:4px}

  @keyframes fadeUp       {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes blink        {0%,100%{opacity:1}50%{opacity:0.2}}
  @keyframes newRow       {from{background:rgba(0,210,200,0.14)}to{background:transparent}}
  @keyframes glowPulse    {0%,100%{box-shadow:0 0 4px rgba(0,210,200,0.4)}50%{box-shadow:0 0 16px rgba(0,210,200,0.7)}}
  @keyframes slideInRight {from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)}}
  @keyframes slideOutRight{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(110%)}}
  @keyframes pulseRing    {0%{transform:scale(1);opacity:0.9}100%{transform:scale(3);opacity:0}}
  @keyframes dashFlow     {to{stroke-dashoffset:-20}}
  @keyframes spin         {to{transform:rotate(360deg)}}
  @keyframes riskFlash    {0%,100%{opacity:1}50%{opacity:0.25}}
  @keyframes expandDown   {from{opacity:0;max-height:0}to{opacity:1;max-height:600px}}
  @keyframes slideUp      {from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

  .fade-up {animation:fadeUp  0.3s ease both}
  .slide-up{animation:slideUp 0.4s ease both}

  /* Leaflet dark overrides */
  .leaflet-container{background:#060e18!important;font-family:'IBM Plex Mono',monospace}
  .leaflet-tile{filter:brightness(0.55) saturate(0.3) hue-rotate(180deg)!important}
  .leaflet-control-zoom a{background:#0b1120!important;color:#4e6a8a!important;border-color:#162035!important}
  .leaflet-control-zoom a:hover{color:#00d2c8!important;background:#0f1928!important}
  .leaflet-popup-content-wrapper{background:#0b1120!important;border:1px solid rgba(0,210,200,0.3)!important;color:#dde4f0!important;border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,0.7)!important}
  .leaflet-popup-tip{background:#0b1120!important}
  .leaflet-popup-close-button{color:#4e6a8a!important}

  /* Nav */
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:9px;cursor:pointer;border:none;background:transparent;font-family:'Syne',sans-serif;font-size:12.5px;font-weight:500;color:#4e6a8a;width:100%;text-align:left;transition:all 0.18s;position:relative}
  .nav-item:hover{background:rgba(0,210,200,0.07);color:#dde4f0}
  .nav-item.active{background:rgba(0,210,200,0.1);color:#00d2c8;font-weight:700}
  .nav-item.active::before{content:'';position:absolute;left:0;top:20%;bottom:20%;width:3px;border-radius:0 3px 3px 0;background:#00d2c8}

  .panel{background:#0b1120;border:1px solid #162035;border-radius:10px;position:relative;overflow:hidden}
  .panel::after{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(0,210,200,0.18),transparent);pointer-events:none}
  .kpi-card{background:#0b1120;border:1px solid #162035;border-radius:10px;position:relative;overflow:hidden;transition:border-color 0.2s,transform 0.2s;cursor:pointer}
  .kpi-card:hover{border-color:rgba(0,210,200,0.4);transform:translateY(-2px)}
  .kpi-card:active{transform:translateY(0)}

  .btn{cursor:pointer;border:none;border-radius:7px;font-family:'IBM Plex Mono',monospace;font-weight:600;letter-spacing:0.5px;transition:all 0.18s}
  .btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
  .btn:active{transform:translateY(0)}
  .btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;filter:none}

  .trow{transition:background 0.15s;cursor:pointer}
  .trow:hover{background:rgba(0,210,200,0.05)!important}
  .trow.is-new{animation:newRow 2s ease forwards}

  input:focus,select:focus,textarea:focus{outline:none!important;border-color:#00d2c8!important;box-shadow:0 0 0 3px rgba(0,210,200,0.1)!important}

  .alert-toast{position:fixed;top:64px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .alert-toast-item{pointer-events:all;background:#0f1928;border:1px solid rgba(239,68,68,0.5);border-left:3px solid #ef4444;border-radius:9px;padding:12px 14px;min-width:280px;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.6);animation:slideInRight 0.3s ease both}
  .alert-toast-item.exiting{animation:slideOutRight 0.3s ease both}

  .drill-modal{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
  .drill-box{background:#080e1c;border:1px solid rgba(0,210,200,0.25);border-radius:14px;width:min(760px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.8),0 0 40px rgba(0,210,200,0.05)}

  .expand-row{animation:expandDown 0.28s ease both;overflow:hidden}

  .timeline-item{position:relative;padding-left:20px;padding-bottom:10px}
  .timeline-item::before{content:'';position:absolute;left:5px;top:8px;bottom:0;width:1px;background:#1c2d4a}
  .timeline-item:last-child::before{display:none}
  .timeline-dot{position:absolute;left:0;top:6px;width:11px;height:11px;border-radius:50%;border:2px solid}

  .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:40}
  .query-input::placeholder{color:#2a3f5f}


  /* ─────────────────────────────────────────────────────── */
  /* LIVE FEED — CRAZY IMPROVED UI                           */
  /* ─────────────────────────────────────────────────────── */

  /* Keyframes */
  @keyframes countUp    {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes kpiPop     {0%{transform:scale(1)}40%{transform:scale(1.06)}100%{transform:scale(1)}}
  @keyframes entrySlide {from{opacity:0;transform:translateY(-8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes scanLine   {0%{top:0%}100%{top:100%}}
  @keyframes pulseGlow  {0%,100%{opacity:0.5}50%{opacity:1}}
  @keyframes borderFlow {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  @keyframes blockedShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
  @keyframes blockedGlow {0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 24px 4px rgba(239,68,68,0.25)}}
  @keyframes threatPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:0.85}}
  @keyframes radarSweep {from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes shimmerSlide{0%{left:-100%}100%{left:200%}}
  @keyframes waveflow   {0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}
  @keyframes newEventIn {from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}

  /* Stats KPI cards */
  .count-up {animation:countUp 0.4s ease both}
  .kpi-pop  {animation:kpiPop  0.4s ease}

  /* Header chrome */
  .header-glass{
    background:linear-gradient(180deg,rgba(10,16,28,0.99) 0%,rgba(6,10,20,0.99) 100%);
    backdrop-filter:blur(20px);
    border-bottom:1px solid rgba(0,210,200,0.1)!important;
    box-shadow:0 1px 0 rgba(0,210,200,0.05),0 4px 20px rgba(0,0,0,0.4)!important;
  }
  /* Sidebar chrome */
  .sidebar-glass{
    background:linear-gradient(180deg,#080f1e 0%,#060810 100%);
    box-shadow:4px 0 32px rgba(0,0,0,0.5)!important;
  }

  /* ── Feed scrollbar ───────────────────────── */
  .feed-scroll::-webkit-scrollbar{width:2px}
  .feed-scroll::-webkit-scrollbar-track{background:transparent}
  .feed-scroll::-webkit-scrollbar-thumb{background:rgba(0,210,200,0.3);border-radius:2px}

  /* ── Feed header wrapper ──────────────────── */
  .feed-header{
    background:rgba(0,0,0,0.3);
    border-bottom:1px solid rgba(0,210,200,0.08);
    backdrop-filter:blur(8px);
  }

  /* ── Event card base ──────────────────────── */
  .ev-card{
    position:relative;border-radius:12px;
    transition:border-color 0.2s,box-shadow 0.2s,transform 0.15s;
    cursor:pointer;
    animation:entrySlide 0.3s ease both;
  }
  .ev-card.is-expanded{
    transform:none!important;
    box-shadow:0 8px 32px rgba(0,0,0,0.5)!important;
  }
  .ev-card:hover{transform:translateY(-1px)}
  .ev-card:hover .ev-shimmer{opacity:1}
  .ev-card:active{transform:scale(0.998)}

  /* Shimmer on hover — uses clip-path so parent doesn't need overflow:hidden */
  .ev-shimmer{
    position:absolute;inset:0;pointer-events:none;opacity:0;
    transition:opacity 0.3s;border-radius:12px;
    overflow:hidden;
  }
  .ev-shimmer::after{
    content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent);
  }
  .ev-card:hover .ev-shimmer{opacity:1}
  .ev-card:hover .ev-shimmer::after{animation:shimmerSlide 0.6s ease both}

  /* Verdict left stripe */
  .ev-stripe{position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:12px 0 0 12px}
  .ev-stripe.safe      {background:linear-gradient(180deg,#22c55e,#16a34a);border-radius:12px 0 0 12px}
  .ev-stripe.suspicious{background:linear-gradient(180deg,#eab308,#ca8a04);border-radius:12px 0 0 12px}
  .ev-stripe.blocked   {background:linear-gradient(180deg,#ef4444,#b91c1c);box-shadow:2px 0 12px rgba(239,68,68,0.5);border-radius:12px 0 0 12px}

  /* BLOCKED drama */
  .ev-card.blocked-card{animation:blockedGlow 2s ease 1}

  /* New event highlight */
  .ev-card.ev-new{animation:newEventIn 0.35s ease both,entrySlide 0.35s ease both}

  /* ── Verdict avatar ───────────────────────── */
  .ev-avatar{
    width:42px;height:42px;border-radius:11px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1px;
    position:relative;overflow:hidden;
  }
  .ev-avatar::after{
    content:'';position:absolute;inset:0;border-radius:11px;
    background:linear-gradient(135deg,rgba(255,255,255,0.08),transparent);
  }

  /* ── Risk bar ─────────────────────────────── */
  .risk-track{height:5px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,0.06)}
  .risk-fill {height:100%;border-radius:3px;transition:width 0.7s cubic-bezier(0.4,0,0.2,1)}

  /* ── Inline tags ──────────────────────────── */
  .ev-tag{
    display:inline-flex;align-items:center;gap:3px;
    padding:2px 8px;border-radius:4px;font-size:8px;
    font-weight:700;letter-spacing:0.8px;font-family:'IBM Plex Mono',monospace;
    border:1px solid;white-space:nowrap;
  }

  /* ── Expanded detail panel ────────────────── */
  .ev-expand{
    border-top:1px solid rgba(255,255,255,0.08);
    background:rgba(0,0,0,0.3);
    border-radius:0 0 12px 12px;
  }
  .ev-detail-chip{
    background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
    border-radius:8px;padding:10px 12px;
    transition:border-color 0.15s,background 0.15s;
  }
  .ev-detail-chip:hover{background:rgba(255,255,255,0.06);border-color:rgba(0,210,200,0.25)}

  /* ── Filter pills ─────────────────────────── */
  .feed-pill{
    padding:5px 14px;border-radius:20px;cursor:pointer;border:1px solid;
    transition:all 0.15s;font-family:'IBM Plex Mono',monospace;
    font-size:8.5px;font-weight:700;letter-spacing:0.8px;
  }
  .feed-pill:hover{transform:translateY(-1px)}

  /* ── Search bar ───────────────────────────── */
  .feed-search{
    background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);
    border-radius:20px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;
    color:#dde4f0;transition:border-color 0.2s,box-shadow 0.2s;
  }
  .feed-search:focus{
    border-color:rgba(0,210,200,0.4)!important;
    box-shadow:0 0 0 3px rgba(0,210,200,0.08)!important;
    outline:none!important;
  }

  /* ── Live pulse dot ───────────────────────── */
  .live-dot{
    width:8px;height:8px;border-radius:50%;position:relative;
  }
  .live-dot::after{
    content:'';position:absolute;inset:-3px;border-radius:50%;
    animation:pulseGlow 1.5s ease infinite;
  }
  .live-dot.streaming{background:#00d2c8}
  .live-dot.streaming::after{background:rgba(0,210,200,0.3)}
  .live-dot.paused{background:#4e6a8a}
  .live-dot.paused::after{display:none}

  /* ── Wave bars (live activity indicator) ─── */
  .wave-bar{
    width:3px;border-radius:2px;
    transform-origin:bottom;
  }
  .wave-bar:nth-child(1){animation:waveflow 0.8s ease infinite}
  .wave-bar:nth-child(2){animation:waveflow 0.8s ease 0.15s infinite}
  .wave-bar:nth-child(3){animation:waveflow 0.8s ease 0.3s infinite}
  .wave-bar:nth-child(4){animation:waveflow 0.8s ease 0.45s infinite}
  .wave-bar.paused{animation:none!important;transform:scaleY(0.3)}

  /* ── Footer bar ───────────────────────────── */
  .feed-footer{
    border-top:1px solid rgba(0,210,200,0.06);
    background:linear-gradient(180deg,rgba(0,0,0,0.3),rgba(0,0,0,0.5));
  }
  @media(max-width:768px){
    body{overflow:auto}
    .sidebar{position:fixed!important;left:0!important;top:0!important;bottom:0!important;z-index:50!important;transform:translateX(-100%);transition:transform 0.28s ease!important}
    .sidebar.open{transform:translateX(0)!important}
    .sidebar-overlay.open{display:block}
    .main-area{margin-left:0!important}
    .topbar-logo{display:flex!important}
    .hamburger{display:flex!important}
    .kpi-grid{grid-template-columns:repeat(2,1fr)!important}
    .chart-grid-2{grid-template-columns:1fr!important}
    .chart-grid-main{grid-template-columns:1fr!important}
    .predict-grid{grid-template-columns:1fr!important}
    .status-footer{display:none!important}
  }
`);

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#060810", surface: "#080e1c", panel: "#0b1120", border: "#162035",
  teal: "#00d2c8", orange: "#ff6b35", violet: "#8b5cf6",
  safe: "#22c55e", warn: "#eab308", danger: "#ef4444",
  text: "#dde4f0", muted: "#4e6a8a", dim: "#1c2d4a",
};
const mono = { fontFamily: "'IBM Plex Mono',monospace" };
const riskColor = l => l === "SAFE" ? C.safe : l === "SUSPICIOUS" ? C.warn : C.danger;
const fmtTime = t => t ? t.slice(11, 19) : "--";
const fmtPct = s => (s * 100).toFixed(1) + "%";

// ─── Load Leaflet once ────────────────────────────────────────────────────────
function loadLeaflet() {
  return new Promise(resolve => {
    if (window.L) { resolve(window.L); return; }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve(window.L);
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ label, size = 9 }) {
  const c = riskColor(label);
  return <span style={{ ...mono, fontSize: size, fontWeight: 700, letterSpacing: 1.5, padding: "3px 9px", borderRadius: 3, background: c + "18", color: c, border: `1px solid ${c}45` }}>{label}</span>;
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f1928", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 13px", ...mono, fontSize: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || C.teal }}>{p.name}: <b>{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</b></div>)}
    </div>
  );
};

function SLabel({ text, extra }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <span style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 3, textTransform: "uppercase" }}>{text}</span>
      {extra}
    </div>
  );
}

function CountdownRing({ secs, total, active, onClick, size = 40 }) {
  const r = size / 2 - 4, circ = 2 * Math.PI * r, offset = circ * (1 - secs / total), col = active ? C.teal : C.muted;
  return (
    <div onClick={onClick} style={{ position: "relative", width: size, height: size, cursor: "pointer", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.dim} strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: active ? "stroke-dashoffset 1s linear" : "none", filter: active ? `drop-shadow(0 0 4px ${C.teal})` : "none" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {active ? <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: C.teal }}>{secs}</span> : <span style={{ fontSize: 12 }}>↺</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT TOASTS
// ─────────────────────────────────────────────────────────────────────────────
function AlertToast({ alerts, onDismiss }) {
  return (
    <div className="alert-toast">
      {alerts.map(a => (
        <div key={a.id} className={`alert-toast-item${a.exiting ? " exiting" : ""}`}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 13 }}>🚨</span>
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: C.danger }}>BLOCKED</span>
              <span style={{ ...mono, fontSize: 9, color: C.warn, fontWeight: 600 }}>· {a.attack_type}</span>
            </div>
            <button onClick={() => onDismiss(a.id)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{a.username}</span>
            <span style={{ ...mono, fontSize: 9, color: C.muted }}>{a.ip_address}</span>
            <span style={{ ...mono, fontSize: 9, background: C.dim, padding: "1px 6px", borderRadius: 3, color: C.muted }}>{a.country}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: C.muted }}>{a.device?.split("/")[0]}</span>
            <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: C.danger }}>{(a.risk_score * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI DRILL-DOWN MODAL
// ─────────────────────────────────────────────────────────────────────────────
function DrillModal({ filter, events, onClose }) {
  if (!filter) return null;
  const filtered = filter === "ALL" ? events : events.filter(e => e.prediction === filter);
  const title = filter === "ALL" ? "All Events" : `${filter} Events`;
  const accent = filter === "BLOCKED" ? C.danger : filter === "SUSPICIOUS" ? C.warn : filter === "SAFE" ? C.safe : C.teal;

  return (
    <div className="drill-modal" onClick={onClose}>
      <div className="drill-box" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
            <div style={{ ...mono, fontSize: 9, color: C.muted, marginTop: 3 }}>{filtered.length} event{filtered.length !== 1 ? "s" : ""} · click row for full details</div>
          </div>
          <button onClick={onClose} className="btn" style={{ background: C.dim, color: C.muted, padding: "6px 14px", fontSize: 12 }}>✕ Close</button>
        </div>
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "#080e1c", zIndex: 2 }}>
              <tr style={{ borderBottom: `1px solid ${C.dim}` }}>
                {["User", "IP", "Country", "Device", "Risk", "Attack Type", "Time"].map(h => (
                  <th key={h} style={{ padding: "9px 12px", color: C.muted, textAlign: "left", ...mono, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const c = riskColor(e.prediction);
                return (
                  <tr key={e.id} className="trow" style={{ borderBottom: `1px solid ${C.dim}22`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700 }}>{e.username}</td>
                    <td style={{ padding: "9px 12px", ...mono, fontSize: 10, color: C.muted }}>{e.ip_address}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ ...mono, fontSize: 10, background: C.dim, padding: "2px 7px", borderRadius: 3 }}>{e.country}</span>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 10, color: C.muted, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.device}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ height: 3, width: 60, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${e.risk_score * 100}%`, height: "100%", background: `linear-gradient(90deg,${c}80,${c})`, borderRadius: 2 }} />
                        </div>
                        <span style={{ ...mono, fontSize: 9, color: c }}>{fmtPct(e.risk_score)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      {e.attack_type !== "None"
                        ? <span style={{ fontSize: 9, fontWeight: 700, color: C.warn, background: C.warn + "15", padding: "2px 8px", borderRadius: 3 }}>{e.attack_type}</span>
                        : <span style={{ color: C.dim }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 12px", ...mono, fontSize: 10, color: C.muted }}>{fmtTime(e.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 12 }}>No events in this category</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHAP CHART
// ─────────────────────────────────────────────────────────────────────────────
function ShapChart({ explanation }) {
  if (!explanation?.length) return null;
  const top = explanation.slice(0, 8);
  const maxAbs = Math.max(...top.map(e => Math.abs(e.contribution_pct)), 1);
  return (
    <div className="panel" style={{ padding: "18px 18px", marginTop: 14 }}>
      <SLabel text="Why this verdict? — SHAP Feature Contributions" />
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {top.map((e, i) => {
          const pos = e.contribution_pct > 0;
          const col = pos ? C.danger : C.safe;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "170px 1fr 54px", alignItems: "center", gap: 10 }}>
              <span style={{ ...mono, fontSize: 9, color: C.muted, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.feature}</span>
              <div style={{ background: C.dim, borderRadius: 3, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${(Math.abs(e.contribution_pct) / maxAbs) * 100}%`, height: "100%", borderRadius: 3, background: col, opacity: 0.85, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: col, textAlign: "right" }}>{pos ? "+" : ""}{e.contribution_pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 14 }}>
        {[[C.danger, "Raises risk"], [C.safe, "Lowers risk"]].map(([c, l]) => (
          <span key={l} style={{ fontSize: 9, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 6, borderRadius: 2, background: c, display: "inline-block" }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIOUR BASELINE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function BehaviourBaseline({ events }) {
  const [selected, setSelected] = useState("");

  // Build per-user profile from all events
  const profiles = useMemo(() => {
    const p = {};
    events.forEach(e => {
      if (!p[e.username]) p[e.username] = { hours: [], countries: new Set(), devices: new Set(), risks: [], events: [], failedAttempts: [] };
      const u = p[e.username];
      u.hours.push(e.hour_of_day);
      u.countries.add(e.country);
      u.devices.add(e.device);
      u.risks.push(e.risk_score);
      u.events.push(e);
      u.failedAttempts.push(e.failed_attempts);
    });
    // Compute baselines - safe version with null guards
    return Object.entries(p).map(([username, d]) => {
      try {
        const sortedHours = [...d.hours].sort((a, b) => a - b);
        const mid = Math.floor(sortedHours.length / 2);
        const typicalHour = sortedHours[mid] ?? 12;
        // Count occurrences of each country safely
        const countryCounts = {};
        d.events.forEach(e => { countryCounts[e.country] = (countryCounts[e.country] || 0) + 1; });
        const typicalCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
        const avgRisk = d.risks.length > 0 ? d.risks.reduce((a, b) => a + b, 0) / d.risks.length : 0;
        const latest = d.events[0] || null;
        const anomalyCountry = !!(latest && latest.country && latest.country !== typicalCountry);
        const anomalyHour = !!(latest && typeof latest.hour_of_day === "number" && Math.abs(latest.hour_of_day - typicalHour) > 6);
        const anomalyRisk = !!(latest && latest.risk_score > 0.4 && avgRisk < 0.3);
        const anomalyScore = (anomalyCountry ? 2 : 0) + (anomalyHour ? 1 : 0) + (anomalyRisk ? 2 : 0);
        return { username, typicalHour, typicalCountry, avgRisk, latest, anomalyCountry, anomalyHour, anomalyRisk, anomalyScore, totalEvents: d.events.length, countries: d.countries, devices: d.devices };
      } catch (err) {
        return null;
      }
    }).filter(p => p && p.totalEvents >= 2).sort((a, b) => b.anomalyScore - a.anomalyScore);
  }, [events]);

  const sel = (profiles.find(p => p.username === selected) || profiles[0]) || null;
  if (!profiles.length) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
      <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.1 }}>🧠</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>No baseline data yet</div>
      <div style={{ fontSize: 11, marginTop: 6 }}>Simulate at least 30 events to generate user behaviour profiles</div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, height: "100%" }}>
      {/* User list */}
      <div className="panel" style={{ padding: "16px 14px" }}>
        <SLabel text="User Profiles" />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 480, overflowY: "auto" }}>
          {profiles.map(p => {
            const ac = p.anomalyScore > 2 ? C.danger : p.anomalyScore > 0 ? C.warn : C.safe;
            const isActive = selected ? p.username === selected : p === profiles[0];
            return (
              <div key={p.username} onClick={() => setSelected(p.username)}
                style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${isActive ? ac + "60" : C.border}`, background: isActive ? ac + "10" : "transparent", transition: "all 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: ac + "20", border: `1px solid ${ac}40`, display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 9, color: ac, fontWeight: 700, flexShrink: 0 }}>
                      {p.username.slice(-2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{p.username}</div>
                      <div style={{ fontSize: 9, color: C.muted }}>{p.totalEvents} events</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    {p.anomalyScore > 0 && <span style={{ ...mono, fontSize: 8, color: ac, fontWeight: 700, letterSpacing: 1 }}>ANOMALY</span>}
                    <span style={{ ...mono, fontSize: 9, color: riskColor(p.avgRisk > 0.6 ? "BLOCKED" : p.avgRisk > 0.3 ? "SUSPICIOUS" : "SAFE") }}>{(p.avgRisk * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Baseline detail */}
      {sel && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Header */}
          <div className="panel" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{sel.username}</div>
                <div style={{ ...mono, fontSize: 9, color: C.muted, marginTop: 3 }}>{sel.totalEvents} total events · {sel.countries?.size || 0} countries · {sel.devices?.size || 0} devices</div>
              </div>
              {sel.anomalyScore > 0 && (
                <div style={{ background: sel.anomalyScore > 2 ? C.danger + "20" : C.warn + "20", border: `1px solid ${sel.anomalyScore > 2 ? C.danger + "60" : C.warn + "60"}`, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ ...mono, fontSize: 9, color: sel.anomalyScore > 2 ? C.danger : C.warn, fontWeight: 700 }}>⚠ ANOMALY DETECTED</div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Score: {sel.anomalyScore}/5</div>
                </div>
              )}
            </div>

            {/* Baseline vs Current */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Typical */}
              <div style={{ background: C.bg, borderRadius: 8, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                <div style={{ ...mono, fontSize: 8, color: C.safe, letterSpacing: 2, marginBottom: 10 }}>✓ TYPICAL BEHAVIOUR</div>
                {[
                  ["Login time", `~${sel.typicalHour}:00 ${sel.typicalHour < 12 ? "AM" : "PM"}`],
                  ["Home country", sel.typicalCountry || "Unknown"],
                  ["Avg risk score", `${(sel.avgRisk * 100).toFixed(1)}%`],
                  ["Known devices", sel.devices?.size > 0 ? [...sel.devices].slice(0, 2).join(", ").split("/")[0] || "—" : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: C.muted }}>{k}</span>
                    <span style={{ ...mono, fontSize: 11, fontWeight: 600, color: C.safe }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Current */}
              <div style={{ background: C.bg, borderRadius: 8, padding: "14px 16px", border: `1px solid ${sel.anomalyScore > 0 ? C.danger + "40" : C.border}` }}>
                <div style={{ ...mono, fontSize: 8, color: sel.anomalyScore > 0 ? C.danger : C.teal, letterSpacing: 2, marginBottom: 10 }}>
                  {sel.anomalyScore > 0 ? "⚠ CURRENT — ANOMALOUS" : "✓ CURRENT — NORMAL"}
                </div>
                {sel.latest && [
                  ["Login time", `${sel.latest.hour_of_day}:00 ${sel.latest.hour_of_day < 12 ? "AM" : "PM"}`, sel.anomalyHour],
                  ["Country", sel.latest.country, sel.anomalyCountry],
                  ["Risk score", `${(sel.latest.risk_score * 100).toFixed(1)}%`, sel.anomalyRisk],
                  ["Device", sel.latest.device?.split("/")[0] || "Unknown", false],
                ].map(([k, v, anom]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: C.muted }}>{k}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {anom && <span style={{ fontSize: 10 }}>⚠</span>}
                      <span style={{ ...mono, fontSize: 11, fontWeight: 600, color: anom ? C.danger : C.text }}>{v}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Anomaly flags */}
            {sel.anomalyScore > 0 && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>ANOMALY FLAGS</div>
                {[
                  [sel.anomalyCountry, `Login from ${sel.latest?.country} — typical country is ${sel.typicalCountry}`, C.danger],
                  [sel.anomalyHour, `Login at ${sel.latest?.hour_of_day}:00 — typical is ~${sel.typicalHour}:00`, C.warn],
                  [sel.anomalyRisk, `Risk score ${(sel.latest?.risk_score * 100).toFixed(0)}% — baseline is ${(sel.avgRisk * 100).toFixed(0)}%`, C.danger],
                ].filter(([flag]) => flag).map(([_, msg, col], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, background: col + "10", border: `1px solid ${col}30` }}>
                    <span style={{ fontSize: 14 }}>⚠</span>
                    <span style={{ fontSize: 11, color: C.text }}>{msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent event mini-timeline */}
          <div className="panel" style={{ padding: "16px 18px" }}>
            <SLabel text="Recent Activity Timeline" />
            <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: 200, overflowY: "auto" }}>
              {(sel.events || []).map((e, i) => {
                const c = riskColor(e.prediction);
                return (
                  <div key={e.id} className="timeline-item">
                    <div className="timeline-dot" style={{ background: c + "30", borderColor: c }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ ...mono, fontSize: 9, color: C.muted }}>{fmtTime(e.timestamp)}</span>
                        <span style={{ ...mono, fontSize: 9, background: C.dim, padding: "1px 6px", borderRadius: 3, color: C.muted }}>{e.country}</span>
                        {e.attack_type !== "None" && <span style={{ fontSize: 9, color: C.warn, fontWeight: 600 }}>⚠ {e.attack_type}</span>}
                      </div>
                      <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: c }}>{(e.risk_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAFLET THREAT MAP with arc lines
// ─────────────────────────────────────────────────────────────────────────────
function LeafletThreatMap({ flagged }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const layerG = useRef(null);
  const flagMapRef = useRef({});
  const maxCountRef = useRef(1);
  const drawMarkersRef = useRef(null);

  // Compute flagMap for display (not used in drawAll to avoid stale closure)
  const flagMap = useMemo(() => { const m = {}; flagged.forEach(f => { m[f.country] = f.count; }); return m; }, [flagged]);
  const maxCount = Math.max(...Object.values(flagMap), 1);

  // Keep refs in sync
  useEffect(() => {
    flagMapRef.current = flagMap;
    maxCountRef.current = maxCount;
  }, [flagMap, maxCount]);

  useEffect(() => {
    let destroyed = false;
    loadLeaflet().then(L => {
      if (destroyed || mapObj.current || !mapRef.current) return;
      try {
        mapObj.current = L.map(mapRef.current, {
          center: [20, 10], zoom: 2, minZoom: 1, maxZoom: 10,
          zoomControl: true, attributionControl: true,
          preferCanvas: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        }).addTo(mapObj.current);
        layerG.current = L.layerGroup().addTo(mapObj.current);
        setTimeout(() => { drawMarkersRef.current(L, flagMapRef.current, maxCountRef.current); }, 200);
      } catch (mapErr) { console.error("Map init error:", mapErr); }
    });
    return () => {
      destroyed = true;
      if (mapObj.current) {
        try { mapObj.current.remove(); } catch (e) { }
        mapObj.current = null;
        layerG.current = null;
      }
    };
  }, []);// eslint-disable-line

  useEffect(() => {
    flagMapRef.current = {};
    flagged.forEach(f => { flagMapRef.current[f.country] = f.count; });
    maxCountRef.current = Math.max(...Object.values(flagMapRef.current), 1);
    if (window.L && mapObj.current && layerG.current) {
      drawMarkersRef.current(window.L, flagMapRef.current, maxCountRef.current);
    }
  }, [flagged]);// eslint-disable-line

  // Store drawMarkers in ref so effects can always call the latest version
  drawMarkersRef.current = function drawMarkers(L, fm, mc) {
    if (!layerG.current || !L) return;
    try { layerG.current.clearLayers(); } catch (e) { return; }
    const safeFm = fm || {};
    const safeMc = mc || 1;

    // Draw arc lines from server to threat origins
    Object.entries(safeFm).forEach(([code, count]) => {
      try {
        const geo = GEO[code]; if (!geo) return;
        const intensity = count / safeMc;
        const isHR = HIGH_RISK.has(code);
        const col = isHR ? "#ef4444" : "#f59e0b";

        // Curved arc using polyline with intermediate points
        const pts = [];
        const steps = 20;
        const sx = SERVER_COORDS.lng, sy = SERVER_COORDS.lat;
        const ex = geo.lng, ey = geo.lat;
        const midLat = (sy + ey) / 2 + (ey - sy) * 0.15;
        const midLng = (sx + ex) / 2;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const lat = sy * (1 - t) * (1 - t) + midLat * 2 * (1 - t) * t + ey * t * t;
          const lng = sx * (1 - t) * (1 - t) + midLng * 2 * (1 - t) * t + ex * t * t;
          pts.push([lat, lng]);
        }
        const arc = L.polyline(pts, {
          color: col, weight: 1 + intensity * 2,
          opacity: 0.3 + intensity * 0.5,
          dashArray: "5,6",
        });
        arc.addTo(layerG.current);

        // Pulsing circle at origin
        const radius = 50000 + count * 60000;
        L.circle([geo.lat, geo.lng], {
          radius, color: col, fillColor: col,
          fillOpacity: 0.12 + intensity * 0.25,
          weight: 1.5, opacity: 0.7,
        }).addTo(layerG.current)
          .bindPopup(`
          <div style="font-family:monospace;padding:4px">
            <div style="font-size:13px;font-weight:700;color:${col};margin-bottom:6px">${code} — ${geo.name || code}</div>
            <div style="font-size:11px;color:#aaa">${count} flagged event${count !== 1 ? "s" : ""}</div>
            <div style="font-size:11px;color:#aaa">${isHR ? "⚠ High-risk country" : "Known threat origin"}</div>
          </div>
        `);

        // Dot marker
        L.circleMarker([geo.lat, geo.lng], {
          radius: 4 + intensity * 8, color: col,
          fillColor: col, fillOpacity: 0.9, weight: 1.5,
        }).addTo(layerG.current);
      } catch (markerErr) { /* skip bad marker */ }
    });

    // Safe country markers
    Object.entries(GEO).forEach(([code, geo]) => {
      if (safeFm[code]) return;
      try {
        L.circleMarker([geo.lat, geo.lng], {
          radius: 3, color: "#1c2d4a",
          fillColor: "#1c2d4a", fillOpacity: 0.8, weight: 1,
        }).addTo(layerG.current);
      } catch (e) { /* skip */ }
    });
  };

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SLabel text="Global Threat Map — Leaflet · Arc Attack Lines" />
        <div style={{ display: "flex", gap: 12 }}>
          {[[C.teal, "Safe"], [C.warn, "Threats"], [C.danger, "High-risk"]].map(([c, l]) => (
            <span key={l} style={{ fontSize: 9, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>
      <div ref={mapRef} style={{ width: "100%", height: 400 }} />
      {/* Threat strip */}
      {flagged.length > 0 && (
        <div style={{ padding: "10px 18px 14px", display: "flex", gap: 10, overflowX: "auto" }}>
          {flagged.map(f => {
            const intensity = f.count / maxCount;
            const isHR = HIGH_RISK.has(f.country);
            const col = isHR ? C.danger : C.warn;
            return (
              <div key={f.country} style={{ flexShrink: 0, background: C.dim, borderRadius: 8, padding: "8px 14px", border: `1px solid ${col}${Math.round(30 + intensity * 80).toString(16)}`, textAlign: "center", minWidth: 64 }}>
                <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: col }}>{f.country}</div>
                <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{f.count}</div>
                <div style={{ fontSize: 8, color: C.muted }}>threats</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE EVENT STREAM — Crazy Improved UI
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS = {
  US: "🇺🇸", UK: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", IN: "🇮🇳", CN: "🇨🇳", RU: "🇷🇺",
  BR: "🇧🇷", NG: "🇳🇬", KP: "🇰🇵", IR: "🇮🇷", AU: "🇦🇺", CA: "🇨🇦", JP: "🇯🇵",
  MX: "🇲🇽", ZA: "🇿🇦", PK: "🇵🇰", TR: "🇹🇷", UA: "🇺🇦", VN: "🇻🇳", SG: "🇸🇬",
  KR: "🇰🇷", SA: "🇸🇦", EG: "🇪🇬",
};
const ATTACK_META = {
  "Brute Force": { icon: "⚡", color: "#ef4444", short: "BF" },
  "Credential Stuffing": { icon: "🎭", color: "#f59e0b", short: "CS" },
  "Account Takeover": { icon: "🔓", color: "#8b5cf6", short: "ATO" },
  "Anomalous Login": { icon: "⚠", color: "#eab308", short: "ANO" },
};
const VERDICT_META = {
  SAFE: { icon: "✓", label: "SAFE", bg: "rgba(34,197,94,0.12)", ring: "rgba(34,197,94,0.35)" },
  SUSPICIOUS: { icon: "?", label: "SUSP", bg: "rgba(234,179,8,0.12)", ring: "rgba(234,179,8,0.35)" },
  BLOCKED: { icon: "✕", label: "BLKD", bg: "rgba(239,68,68,0.15)", ring: "rgba(239,68,68,0.45)" },
};

// Mini wave-bars animation (live activity indicator)
function WaveBars({ paused }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
      {[10, 16, 12, 18, 10].map((h, i) => (
        <div key={i} className={`wave-bar${paused ? " paused" : ""}`}
          style={{ height: h, background: paused ? "#4e6a8a" : "#00d2c8", opacity: paused ? 0.3 : 0.7 }} />
      ))}
    </div>
  );
}

// Circular risk dial
function RiskDial({ score, color, size = 44 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - score);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)",
            filter: `drop-shadow(0 0 4px ${color}80)`
          }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fontWeight: 700, color, lineHeight: 1 }}>
          {(score * 100).toFixed(0)}
        </span>
      </div>
    </div>
  );
}

// Individual event card
function FeedEventCard({ e, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const c = riskColor(e.prediction);
  const vm = VERDICT_META[e.prediction] || VERDICT_META.SAFE;
  const flag = COUNTRY_FLAGS[e.country] || "🌐";
  const atk = ATTACK_META[e.attack_type];
  const isHR = HIGH_RISK.has(e.country);
  const isBLK = e.prediction === "BLOCKED";
  const cls = e.prediction.toLowerCase();

  // Severity tier for background depth
  const cardBg = isBLK
    ? "linear-gradient(135deg,rgba(239,68,68,0.08),rgba(185,28,28,0.04))"
    : e.prediction === "SUSPICIOUS"
      ? "linear-gradient(135deg,rgba(234,179,8,0.06),rgba(6,10,16,0.5))"
      : "linear-gradient(135deg,rgba(34,197,94,0.04),rgba(6,10,16,0.4))";

  return (
    <div
      className={`ev-card${isBLK ? " blocked-card" : ""}${isNew ? " ev-new" : ""}${expanded ? " is-expanded" : ""}`}
      onClick={() => setExpanded(x => !x)}
      style={{
        background: cardBg,
        border: `1px solid ${expanded ? c + "50" : isNew ? c + "30" : "rgba(255,255,255,0.06)"}`,
        boxShadow: expanded ? `0 4px 24px rgba(0,0,0,0.4),inset 0 0 0 1px ${c}15` : "none",
      }}
    >
      {/* Verdict stripe */}
      <div className={`ev-stripe ${cls}`} />
      {/* Shimmer layer */}
      <div className="ev-shimmer" />

      {/* ── Main row ──────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr 120px",
        alignItems: "center", gap: 14,
        padding: "13px 16px 13px 20px",
      }}>

        {/* Avatar / verdict dial */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <RiskDial score={e.risk_score} color={c} size={44} />
          <span style={{
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 7, fontWeight: 800,
            letterSpacing: 1.5, color: c, textTransform: "uppercase",
          }}>{vm.label}</span>
        </div>

        {/* Content block */}
        <div style={{ overflow: "hidden", minWidth: 0 }}>
          {/* Row 1: user + IP + flag + country */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 13, fontWeight: 800, color: C.text,
              letterSpacing: 0.2, lineHeight: 1,
            }}>{e.username}</span>
            <span style={{
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5, color: C.muted,
              background: "rgba(255,255,255,0.04)", padding: "1px 7px", borderRadius: 5,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>{e.ip_address}</span>
            <span style={{ fontSize: 13, lineHeight: 1 }}>{flag}</span>
            <span className="ev-tag" style={{
              color: isHR ? C.danger : "#4e6a8a",
              background: isHR ? "rgba(239,68,68,0.12)" : "rgba(28,45,74,0.6)",
              borderColor: isHR ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.06)",
            }}>{e.country}{isHR ? " ⚠" : ""}</span>
          </div>

          {/* Row 2: device + attack badge + extra tags */}
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5, color: "#3a5570",
              background: "rgba(255,255,255,0.025)", padding: "1px 8px", borderRadius: 4,
            }}>
              {e.device?.split("/")?.[0] || "Unknown Device"}
            </span>

            {atk && (
              <span className="ev-tag" style={{
                color: atk.color, background: atk.color + "18",
                borderColor: atk.color + "40", fontSize: 8.5,
              }}>
                {atk.icon} {e.attack_type}
              </span>
            )}
            {e.vpn_proxy === 1 && (
              <span className="ev-tag" style={{ color: "#a78bfa", background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.35)" }}>
                🛡 VPN
              </span>
            )}
            {e.is_new_device === 1 && (
              <span className="ev-tag" style={{ color: C.warn, background: C.warn + "15", borderColor: C.warn + "35" }}>
                💻 NEW DEV
              </span>
            )}
            {e.is_new_ip === 1 && (
              <span className="ev-tag" style={{ color: C.orange, background: C.orange + "15", borderColor: C.orange + "35" }}>
                🌐 NEW IP
              </span>
            )}
            {e.failed_attempts > 3 && (
              <span className="ev-tag" style={{ color: C.danger, background: C.danger + "15", borderColor: C.danger + "40" }}>
                🔑 {e.failed_attempts}x fail
              </span>
            )}
          </div>
        </div>

        {/* Right block: risk bar + time + expand hint */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          {/* Gradient risk bar */}
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 7.5, color: "#3a5570", letterSpacing: 1 }}>RISK</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 800, color: c }}>{(e.risk_score * 100).toFixed(0)}%</span>
            </div>
            <div className="risk-track">
              <div className="risk-fill" style={{
                width: `${e.risk_score * 100}%`,
                background: e.risk_score > 0.6
                  ? `linear-gradient(90deg,${C.warn},${C.danger})`
                  : e.risk_score > 0.3
                    ? `linear-gradient(90deg,${C.safe}80,${C.warn})`
                    : `linear-gradient(90deg,${C.teal}80,${C.safe})`,
              }} />
            </div>
          </div>

          {/* Time */}
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#3a5570", letterSpacing: 0.5 }}>
            {fmtTime(e.timestamp)}
          </span>

          {/* Expand hint */}
          <span style={{
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 7,
            color: expanded ? "#00d2c8" : "#2a3f5a", letterSpacing: 0.5,
            transition: "color 0.2s",
          }}>
            {expanded ? "▲ close" : "▼ expand"}
          </span>
        </div>
      </div>

      {/* ── Expanded details ──────────────────────────────────────────── */}
      {expanded && (
        <div className="ev-expand">
          {/* Feature grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 10,
            padding: "16px 20px 12px 20px",
          }}>
            {[
              { label: "Hour", val: `${e.hour_of_day}:00`, col: C.teal, icon: "🕐" },
              { label: "Country Risk", val: `${e.country_risk?.toFixed(1) || "?"} / 5`, col: e.country_risk > 3 ? C.danger : C.warn, icon: "🌍" },
              { label: "IP Rep.", val: `${((1 - e.ip_reputation) * 100 || 0).toFixed(0)}% clean`, col: e.ip_reputation > 0.5 ? C.danger : C.safe, icon: "🔍" },
              { label: "Time Gap", val: `${e.time_since_last_login_hours?.toFixed(0) || "?"}h`, col: C.muted, icon: "⏱" },
              { label: "Failed", val: `${e.failed_attempts} attempt${e.failed_attempts !== 1 ? "s" : ""}`, col: e.failed_attempts > 3 ? C.danger : C.muted, icon: "🔑" },
              { label: "Freq. Dev.", val: `${e.login_frequency_deviation?.toFixed(1) || "?"}σ`, col: e.login_frequency_deviation > 5 ? C.danger : C.muted, icon: "📊" },
              { label: "Session", val: `${e.session_duration_prev?.toFixed(0) || "?"}s`, col: C.muted, icon: "🖥" },
              { label: "Day", val: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][e.day_of_week] || "—", col: C.teal, icon: "📅" },
            ].map(({ label, val, col, icon }) => (
              <div key={label} className="ev-detail-chip">
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <span style={{ fontSize: 10 }}>{icon}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: "#4a6a8a", letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 800, color: col, lineHeight: 1.2, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Threat summary strip */}
          <div style={{
            margin: "0 20px 16px",
            padding: "14px 18px",
            borderRadius: 10,
            background: isBLK ? "rgba(239,68,68,0.08)" : e.prediction === "SUSPICIOUS" ? "rgba(234,179,8,0.06)" : "rgba(34,197,94,0.06)",
            border: `1px solid ${c}25`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{isBLK ? "🚨" : e.prediction === "SUSPICIOUS" ? "⚠" : "✅"}</span>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 800, color: c, letterSpacing: 0.8 }}>
                  {e.prediction} — {atk ? e.attack_type : "No attack detected"}
                </div>
                <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 4, lineHeight: 1.5 }}>
                  {isBLK ? "This event was automatically blocked by the ML model" :
                    e.prediction === "SUSPICIOUS" ? "This event requires manual review" :
                      "This event passed all security checks"}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 800, color: c, lineHeight: 1 }}>{(e.risk_score * 100).toFixed(0)}%</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: "#4e6a8a" }}>risk score</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveFeed({ events, onSimulate, simLoading, simCount, setSimCount }) {
  const [items, setItems] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const [filter, setFilter] = useState("ALL");
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const prevIds = useRef(new Set());

  useEffect(() => {
    if (paused) return;
    const top = events.slice(0, 40);
    const fresh = top.filter(e => !prevIds.current.has(e.id));
    if (fresh.length) {
      setNewIds(new Set(fresh.map(e => e.id)));
      setTimeout(() => setNewIds(new Set()), 2800);
    }
    top.forEach(e => prevIds.current.add(e.id));
    setItems(top);
  }, [events, paused]);

  const displayed = useMemo(() => {
    let list = filter === "ALL" ? items : items.filter(e => e.prediction === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.username || "").toLowerCase().includes(q) ||
        (e.ip_address || "").includes(q) ||
        (e.country || "").toLowerCase().includes(q) ||
        (e.attack_type || "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "risk") list = [...list].sort((a, b) => b.risk_score - a.risk_score);
    if (sortBy === "blocked") list = [...list].sort((a, b) => (b.prediction === "BLOCKED" ? 1 : 0) - (a.prediction === "BLOCKED" ? 1 : 0));
    return list;
  }, [items, filter, search, sortBy]);

  const liveStats = useMemo(() => {
    const total = items.length;
    const blocked = items.filter(e => e.prediction === "BLOCKED").length;
    const suspicious = items.filter(e => e.prediction === "SUSPICIOUS").length;
    const safe = items.filter(e => e.prediction === "SAFE").length;
    const avgRisk = total ? items.reduce((a, e) => a + e.risk_score, 0) / total : 0;
    const highRisk = items.filter(e => HIGH_RISK.has(e.country)).length;
    const threatRate = total ? Math.round((blocked + suspicious) / total * 100) : 0;
    return { total, blocked, suspicious, safe, avgRisk, highRisk, threatRate };
  }, [items]);

  const FILTERS = [
    { f: "ALL", label: "All", c: C.teal, icon: "◈" },
    { f: "SAFE", label: "Safe", c: C.safe, icon: "✓" },
    { f: "SUSPICIOUS", label: "Suspicious", c: C.warn, icon: "?" },
    { f: "BLOCKED", label: "Blocked", c: C.danger, icon: "✕" },
  ];

  const avgCol = liveStats.avgRisk > 0.6 ? C.danger : liveStats.avgRisk > 0.3 ? C.warn : C.safe;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>

      {/* ── Top KPI strip ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
        {[
          { label: "Total", val: liveStats.total, col: C.teal, sub: "events" },
          { label: "Blocked", val: liveStats.blocked, col: C.danger, sub: "auto-blocked" },
          { label: "Suspicious", val: liveStats.suspicious, col: C.warn, sub: "review needed" },
          { label: "Safe", val: liveStats.safe, col: C.safe, sub: "cleared" },
          { label: "High-Risk", val: liveStats.highRisk, col: C.violet, sub: "from flagged countries" },
          { label: "Avg Risk", val: `${(liveStats.avgRisk * 100).toFixed(0)}%`, col: avgCol, sub: "mean score" },
          { label: "Threat Rate", val: `${liveStats.threatRate}%`, col: liveStats.threatRate > 50 ? C.danger : liveStats.threatRate > 25 ? C.warn : C.safe, sub: "of all logins" },
        ].map(({ label, val, col, sub }) => (
          <div key={label} className="kpi-card count-up" style={{ padding: "10px 12px", minWidth: 0 }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg,transparent,${col}bb,transparent)`
            }} />
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
              background: `linear-gradient(90deg,transparent,${col}22,transparent)`
            }} />
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 6.5, color: C.muted,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
            }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, fontWeight: 800, color: col, lineHeight: 1, marginBottom: 3 }}>{val}</div>
            <div style={{ fontSize: 8, color: "#2a3f5a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main feed panel ────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
        background: "rgba(8,14,28,0.9)", borderRadius: 14,
        border: "1px solid rgba(0,210,200,0.08)",
        boxShadow: "0 8px 48px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>

        {/* ── Feed header ────────────────────────────────────────────── */}
        <div className="feed-header" style={{ padding: "14px 18px", flexShrink: 0, borderRadius: "14px 14px 0 0" }}>

          {/* Row 1: title + live indicator + stats + controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>

            {/* Live indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className={`live-dot${paused ? " paused" : " streaming"}`} />
              <div>
                <div style={{
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 800,
                  color: paused ? "#4e6a8a" : "#00d2c8", letterSpacing: 2, lineHeight: 1
                }}>
                  {paused ? "PAUSED" : "LIVE"}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 7, color: "#2a3f5a", letterSpacing: 1, marginTop: 2 }}>
                  EVENT STREAM
                </div>
              </div>
            </div>

            {/* Wave activity bars */}
            <WaveBars paused={paused} />

            {/* Event count */}
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: "#3a5570",
              background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.05)"
            }}>
              {displayed.length} / {items.length} events
            </div>

            {/* Avg risk inline indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 7.5, color: "#3a5570", letterSpacing: 1 }}>AVG RISK</span>
              <div style={{ width: 44, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${liveStats.avgRisk * 100}%`, borderRadius: 3,
                  background: `linear-gradient(90deg,${C.teal},${avgCol})`, transition: "width 0.6s ease"
                }} />
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: avgCol }}>
                {(liveStats.avgRisk * 100).toFixed(0)}%
              </span>
            </div>

            {/* Pause button */}
            {/* Simulate more button */}
            {onSimulate && (
              <button onClick={onSimulate} disabled={simLoading}
                style={{
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fontWeight: 700,
                  padding: "6px 14px", borderRadius: 8, cursor: simLoading ? "not-allowed" : "pointer",
                  background: simLoading ? "rgba(0,0,0,0.3)" : "rgba(139,92,246,0.2)",
                  color: simLoading ? "#4e6a8a" : "#a78bfa",
                  border: "1px solid rgba(139,92,246,0.35)",
                  transition: "all 0.2s", letterSpacing: 0.5,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {simLoading
                  ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block", fontSize: 10 }}>◌</span> LOADING</>
                  : <><span>⚡</span> SIMULATE {simCount || 20}</>}
              </button>
            )}

            <button onClick={() => setPaused(p => !p)}
              style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fontWeight: 700,
                padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                background: paused ? "rgba(0,210,200,0.15)" : "rgba(255,255,255,0.05)",
                color: paused ? "#00d2c8" : "#4e6a8a",
                border: `1px solid ${paused ? "rgba(0,210,200,0.4)" : "rgba(255,255,255,0.08)"}`,
                transition: "all 0.2s", letterSpacing: 0.5,
              }}>
              {paused ? "▶ RESUME" : "⏸ PAUSE"}
            </button>
          </div>

          {/* Row 2: filter pills + sort + search */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>

            {/* Filter pills */}
            {FILTERS.map(({ f, label, c, icon }) => {
              const active = filter === f;
              const cnt = f === "ALL" ? items.length : items.filter(e => e.prediction === f).length;
              return (
                <button key={f} onClick={() => setFilter(f)} className="feed-pill"
                  style={{
                    background: active ? `${c}22` : "transparent",
                    color: active ? c : "#4e6a8a",
                    borderColor: active ? `${c}60` : "rgba(255,255,255,0.07)",
                  }}>
                  {icon} {label}
                  {cnt > 0 && <span style={{
                    marginLeft: 5,
                    background: active ? `${c}30` : "rgba(255,255,255,0.06)",
                    padding: "0px 6px", borderRadius: 10, fontSize: 8,
                  }}>{cnt}</span>}
                </button>
              );
            })}

            {/* Sort dropdown */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5,
                background: "rgba(0,0,0,0.4)", color: "#4e6a8a",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8, padding: "5px 10px", cursor: "pointer",
              }}>
              <option value="newest">↓ Newest</option>
              <option value="risk">↓ Risk Score</option>
              <option value="blocked">↓ Blocked first</option>
            </select>

            {/* Search */}
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Search user, IP, country, attack…"
              className="feed-search"
              style={{ flex: 1, minWidth: 160, padding: "6px 14px" }}
            />
          </div>
        </div>

        {/* ── Event cards ────────────────────────────────────────────── */}
        <div className="feed-scroll"
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>

          {!displayed.length && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 20, padding: "40px 20px"
            }}>

              {items.length === 0 ? (
                /* ── No events at all: full start panel ── */
                <div style={{
                  width: "100%", maxWidth: 480,
                  background: "linear-gradient(135deg,rgba(0,210,200,0.06),rgba(139,92,246,0.04))",
                  border: "1px solid rgba(0,210,200,0.18)",
                  borderRadius: 18, padding: "36px 32px", textAlign: "center",
                  boxShadow: "0 8px 48px rgba(0,0,0,0.4),inset 0 1px 0 rgba(0,210,200,0.08)",
                }}>
                  {/* Radar icon */}
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
                    background: "rgba(0,210,200,0.06)",
                    border: "1px solid rgba(0,210,200,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 30, position: "relative",
                    boxShadow: "0 0 0 12px rgba(0,210,200,0.04),0 0 0 24px rgba(0,210,200,0.02)",
                    animation: "pulseGlow 2.5s ease infinite",
                  }}>◉</div>

                  <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8, letterSpacing: 0.3 }}>
                    Stream is ready
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: "#3a5570",
                    lineHeight: 1.8, marginBottom: 28
                  }}>
                    No events in the database yet.<br />
                    Simulate login events to start the live stream.
                  </div>

                  {/* Count selector + Start button */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 16 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 0,
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(0,210,200,0.2)",
                      borderRadius: 10, overflow: "hidden",
                    }}>
                      <button onClick={() => setSimCount && setSimCount(c => Math.max(5, c - 5))}
                        style={{
                          background: "transparent", border: "none", color: "#4e6a8a",
                          padding: "10px 14px", cursor: "pointer", fontSize: 16, lineHeight: 1
                        }}>−</button>
                      <div style={{
                        fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 700,
                        color: C.teal, padding: "10px 16px", minWidth: 60, textAlign: "center",
                        borderLeft: "1px solid rgba(0,210,200,0.1)", borderRight: "1px solid rgba(0,210,200,0.1)"
                      }}>
                        {simCount || 20}
                      </div>
                      <button onClick={() => setSimCount && setSimCount(c => Math.min(200, c + 5))}
                        style={{
                          background: "transparent", border: "none", color: "#4e6a8a",
                          padding: "10px 14px", cursor: "pointer", fontSize: 16, lineHeight: 1
                        }}>+</button>
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#3a5570", letterSpacing: 1 }}>EVENTS</span>
                  </div>

                  <button
                    onClick={onSimulate}
                    disabled={simLoading}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 11, border: "none", cursor: simLoading ? "not-allowed" : "pointer",
                      background: simLoading
                        ? "rgba(0,0,0,0.3)"
                        : "linear-gradient(135deg,#00d2c8,#00a89f)",
                      color: simLoading ? "#4e6a8a" : "#001a1a",
                      fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 800,
                      letterSpacing: 1.5,
                      boxShadow: simLoading ? "none" : "0 4px 20px rgba(0,210,200,0.35)",
                      transition: "all 0.2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    }}>
                    {simLoading
                      ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> GENERATING EVENTS…</>
                      : <><span style={{ fontSize: 16 }}>⚡</span> START LIVE STREAM</>}
                  </button>

                  <div style={{ marginTop: 16, fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5, color: "#2a3f5a", lineHeight: 1.8 }}>
                    Generates {simCount || 20} synthetic login events · 35% attack rate<br />
                    Stream auto-refreshes every 5 seconds
                  </div>
                </div>
              ) : (
                /* ── Has events but filter shows nothing ── */
                <div style={{ textAlign: "center", gap: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: 0.4,
                  }}>◎</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>No events match this filter</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: "#3a5570" }}>
                    Try clearing the search or changing the filter
                  </div>
                  <button onClick={() => { setFilter && setFilter("ALL"); }}
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fontWeight: 700,
                      padding: "7px 20px", borderRadius: 8, cursor: "pointer",
                      background: "rgba(0,210,200,0.12)", color: C.teal,
                      border: "1px solid rgba(0,210,200,0.3)", letterSpacing: 0.5,
                    }}>
                    SHOW ALL EVENTS
                  </button>
                </div>
              )}
            </div>
          )}

          {displayed.map((e, i) => (
            <FeedEventCard key={e.id} e={e} isNew={newIds.has(e.id)} />
          ))}

          {displayed.length > 0 && (
            <div style={{
              textAlign: "center", padding: "16px 0 8px",
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 8,
              color: "#1c2d4a", letterSpacing: 2,
            }}>
              ── END OF STREAM · {displayed.length} events ──
            </div>
          )}
        </div>

        {/* ── Footer legend ──────────────────────────────────────────── */}
        <div className="feed-footer"
          style={{
            padding: "9px 18px", flexShrink: 0, display: "flex",
            justifyContent: "space-between", alignItems: "center", borderRadius: "0 0 14px 14px"
          }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[
              [C.safe, "Safe — cleared by ML"],
              [C.warn, "Suspicious — review"],
              [C.danger, "Blocked — threat"],
            ].map(([col, label]) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#3a5570" }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: col, display: "inline-block" }} />
                {label}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: "#2a3f5a" }}>
              ↓ click event to expand · auto-refreshes every 5s
            </span>
            {!paused && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.teal, animation: "blink 1.2s infinite" }} />
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: C.teal }}>LIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD — interactive KPI cards
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = memo(function Dashboard({ stats, events, onDrillDown }) {
  const ATK = [C.danger, C.warn, C.violet, C.teal];
  if (!stats) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 360, gap: 14 }}>
      <div style={{ fontSize: 36, opacity: 0.12 }}>⚡</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Backend Offline</div>
      <code style={{ ...mono, fontSize: 11, color: C.teal, background: C.dim, padding: "6px 14px", borderRadius: 6 }}>cd backend && python app.py</code>
    </div>
  );
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Interactive KPI cards */}
      <div style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: -4 }}>▸ CLICK ANY CARD TO DRILL DOWN INTO EVENTS</div>
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {[
          { l: "Total", v: stats.total, c: C.teal, f: "ALL", i: "◈" },
          { l: "Safe", v: stats.safe, c: C.safe, f: "SAFE", i: "✓" },
          { l: "Suspicious", v: stats.suspicious, c: C.warn, f: "SUSPICIOUS", i: "◆" },
          { l: "Blocked", v: stats.blocked, c: C.danger, f: "BLOCKED", i: "■" },
          { l: "Detection", v: stats.detection_rate + "%", c: C.violet, f: "ALL", i: "%" },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ padding: "16px 18px" }} onClick={() => onDrillDown(k.f)}
            title={`Click to see all ${k.l.toLowerCase()} events`}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${k.c}cc,transparent)` }} />
            <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6 }}>{k.l}</div>
            <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
            <div style={{ ...mono, fontSize: 8, color: k.c + "80", marginTop: 6, letterSpacing: 1 }}>CLICK TO EXPLORE →</div>
            <div style={{ position: "absolute", bottom: 6, right: 10, fontSize: 24, opacity: 0.05, color: k.c }}>{k.i}</div>
          </div>
        ))}
      </div>

      {/* Main charts */}
      <div className="chart-grid-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div className="panel" style={{ padding: "18px 18px" }}>
          <SLabel text="Risk Score Trend" />
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.risk_trend}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.teal} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim} />
              <XAxis dataKey="time" stroke={C.dim} tick={{ fontSize: 9, fill: C.muted }} tickFormatter={t => t.slice(-5)} />
              <YAxis stroke={C.dim} tick={{ fontSize: 9, fill: C.muted }} domain={[0, 1]} tickFormatter={v => (v * 100).toFixed(0) + "%"} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="score" name="Risk" stroke={C.teal} strokeWidth={2} fill="url(#rg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="panel" style={{ padding: "18px 18px" }}>
          <SLabel text="Attack Types" />
          {stats.attack_distribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={stats.attack_distribution} dataKey="count" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4} strokeWidth={0}>
                    {stats.attack_distribution.map((_, i) => <Cell key={i} fill={ATK[i % ATK.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {stats.attack_distribution.map((a, i) => (
                  <div key={a.type} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: ATK[i % ATK.length], flexShrink: 0 }} />
                    <span style={{ color: C.muted, flex: 1, fontSize: 10 }}>{a.type}</span>
                    <span style={{ ...mono, fontWeight: 600, color: C.text, fontSize: 11 }}>{a.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ textAlign: "center", color: C.muted, fontSize: 12, paddingTop: 36 }}>Simulate to populate</div>}
        </div>
      </div>

      {/* Bottom charts */}
      <div className="chart-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="panel" style={{ padding: "18px 18px" }}>
          <SLabel text="Hourly Volume" />
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={stats.hourly_activity} barSize={11}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim} vertical={false} />
              <XAxis dataKey="hour" stroke={C.dim} tick={{ fontSize: 9, fill: C.muted }} tickFormatter={h => h % 6 === 0 ? `${h}h` : ""} />
              <YAxis stroke={C.dim} tick={{ fontSize: 9, fill: C.muted }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" name="Logins" radius={[3, 3, 0, 0]}>
                {stats.hourly_activity.map((h, i) => (
                  <Cell key={i} fill={(h.hour >= 0 && h.hour <= 6) ? C.danger + "bb" : C.teal + "bb"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel" style={{ padding: "18px 18px" }}>
          <SLabel text="Top Threat Origins" />
          {stats.top_flagged_countries.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {stats.top_flagged_countries.slice(0, 5).map((c, i) => {
                const max = stats.top_flagged_countries[0].count;
                return (
                  <div key={c.country}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                        <span style={{ ...mono, fontSize: 9, color: C.muted }}>#{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{c.country}</span>
                        {HIGH_RISK.has(c.country) && <span style={{ fontSize: 8, color: C.danger, background: C.danger + "18", padding: "1px 5px", borderRadius: 3 }}>HIGH RISK</span>}
                      </div>
                      <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.danger }}>{c.count}</span>
                    </div>
                    <div style={{ background: C.dim, borderRadius: 2, height: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(c.count / max) * 100}%`, height: "100%", borderRadius: 2, background: `linear-gradient(90deg,${C.orange},${C.danger})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ color: C.muted, fontSize: 12, paddingTop: 28, textAlign: "center" }}>No data yet</div>}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED EVENTS TABLE — query filter + expandable rows + full JSON
// ─────────────────────────────────────────────────────────────────────────────
function parseQuery(q, events) {
  // Supports: field=value AND field>value AND field<value
  // Fields: user, ip, country, risk, attack, prediction, hour, failed
  if (!q.trim()) return events;
  try {
    const tokens = q.toLowerCase().split(/\s+and\s+/);
    return events.filter(e => {
      return tokens.every(tok => {
        const m = tok.match(/^(\w+)\s*(=|>|<|!=|>=|<=|~)\s*(.+)$/);
        if (!m || !m[1] || !m[3]) return true;
        const [, field, op, val] = m;
        const v = val.replace(/^['"]|['"]$/g, "").trim();

        const fieldMap = {
          user: String(e.username || "").toLowerCase(),
          ip: String(e.ip_address || ""),
          country: String(e.country || "").toLowerCase(),
          attack: String(e.attack_type || "").toLowerCase(),
          prediction: String(e.prediction || "").toLowerCase(),
          device: String(e.device || "").toLowerCase(),
          risk: e.risk_score * 100,
          hour: e.hour_of_day,
          failed: e.failed_attempts,
        };
        const actual = fieldMap[field];
        if (actual === undefined) return true;

        if (typeof actual === "number") {
          const n = parseFloat(v);
          if (op === "=") return actual === n;
          if (op === ">") return actual > n;
          if (op === "<") return actual < n;
          if (op === ">=") return actual >= n;
          if (op === "<=") return actual <= n;
          if (op === "!=") return actual !== n;
        } else {
          const s = String(actual);
          if (op === "=") return s === v;
          if (op === "!=") return s !== v;
          if (op === "~") return s.includes(v);
        }
        return true;
      });
    });
  } catch { return events; }
}

function ExpandedRow({ event }) {
  const details = {
    "Event ID": event.id,
    "Timestamp (UTC)": event.timestamp,
    "Username": event.username,
    "IP Address": event.ip_address,
    "Country": event.country,
    "Device": event.device,
    "Hour of Day": `${event.hour_of_day}:00`,
    "Day of Week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][event.day_of_week] || event.day_of_week,
    "Failed Attempts": event.failed_attempts,
    "Country Risk": event.country_risk?.toFixed(2),
    "Is New Device": event.is_new_device ? "Yes" : "No",
    "Is New IP": event.is_new_ip ? "Yes" : "No",
    "IP Reputation": event.ip_reputation?.toFixed(3),
    "Session Dur. (prev)": event.session_duration_prev?.toFixed(0) + "s",
    "Freq. Deviation": event.login_frequency_deviation?.toFixed(2),
    "Time Since Login": event.time_since_last_login_hours?.toFixed(1) + "h",
    "VPN / Proxy": event.vpn_proxy ? "Yes" : "No",
    "Risk Score": fmtPct(event.risk_score),
    "ML Verdict": event.prediction,
    "Attack Type": event.attack_type,
  };
  return (
    <tr><td colSpan={9} style={{ padding: 0, borderBottom: `1px solid ${C.dim}` }}>
      <div className="expand-row" style={{ background: "#060c18", borderTop: `1px solid ${C.dim}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
          {/* Session Details */}
          <div style={{ padding: "16px 18px", borderRight: `1px solid ${C.dim}` }}>
            <div style={{ ...mono, fontSize: 8, color: C.teal, letterSpacing: 2, marginBottom: 10 }}>SESSION DETAILS</div>
            {Object.entries(details).slice(0, 10).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                <span style={{ fontSize: 9, color: C.muted, flexShrink: 0 }}>{k}</span>
                <span style={{ ...mono, fontSize: 9, color: C.text, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          {/* ML Features */}
          <div style={{ padding: "16px 18px", borderRight: `1px solid ${C.dim}` }}>
            <div style={{ ...mono, fontSize: 8, color: C.violet, letterSpacing: 2, marginBottom: 10 }}>ML FEATURES</div>
            {Object.entries(details).slice(10).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                <span style={{ fontSize: 9, color: C.muted, flexShrink: 0 }}>{k}</span>
                <span style={{ ...mono, fontSize: 9, color: C.text, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          {/* Raw JSON */}
          <div style={{ padding: "16px 18px" }}>
            <div style={{ ...mono, fontSize: 8, color: C.warn, letterSpacing: 2, marginBottom: 10 }}>RAW JSON LOG</div>
            <pre style={{ ...mono, fontSize: 8, color: C.muted, background: C.bg, borderRadius: 6, padding: "10px", overflow: "auto", maxHeight: 200, border: `1px solid ${C.border}`, lineHeight: 1.6 }}>
              {(() => { try { return JSON.stringify(event, null, 2) } catch (e) { return 'Unable to serialize' } })()}
            </pre>
          </div>
        </div>
      </div>
    </td></tr>
  );
}

function AdvancedEventsTable({ events }) {
  const [query, setQuery] = useState("");
  const [liveQ, setLiveQ] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 15;

  const filtered = useMemo(() => parseQuery(liveQ, events), [liveQ, events]);
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const pages = Math.ceil(filtered.length / PER_PAGE);

  const exampleQueries = [
    "risk > 80 AND country=RU",
    "user~user_4 AND attack=Brute Force",
    "prediction=BLOCKED AND failed > 5",
    "country=CN AND vpn=1",
  ];

  return (
    <div className="panel fade-up" style={{ padding: 0, overflow: "visible" }}>
      {/* Query bar */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: "#080e1c", borderRadius: "10px 10px 0 0" }}>
        <div style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>QUERY FILTER — SIEM-STYLE</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            className="query-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setLiveQ(query); setPage(0); } if (e.key === "Escape") setQuery(""); }}
            placeholder='e.g.  risk > 80 AND country=RU  |  user~4196 AND attack=Brute Force  |  prediction=BLOCKED'
            style={{ flex: 1, ...mono, fontSize: 11, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 14px", color: C.text }}
          />
          <button onClick={() => { setLiveQ(query); setPage(0); }} className="btn"
            style={{ background: C.teal, color: "#001a1a", padding: "8px 18px", fontSize: 11, fontWeight: 700 }}>▶ RUN</button>
          <button onClick={() => { setQuery(""); setLiveQ(""); setPage(0); }} className="btn"
            style={{ background: C.dim, color: C.muted, padding: "8px 14px", fontSize: 11 }}>✕ CLEAR</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 8, color: C.muted, ...mono }}>QUICK:</span>
          {exampleQueries.map(q => (
            <button key={q} onClick={() => { setQuery(q); setLiveQ(q); setPage(0); }} className="btn"
              style={{ background: C.dim, color: C.muted, padding: "3px 10px", fontSize: 8, letterSpacing: 0.5, ...mono }}>
              {q}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 9, color: C.muted }}>
          Syntax: <code style={{ ...mono, color: C.teal }}>field=value</code> · <code style={{ ...mono, color: C.teal }}>field&gt;number</code> · <code style={{ ...mono, color: C.teal }}>field~substring</code> · join with <code style={{ ...mono, color: C.teal }}>AND</code>
          &nbsp;·&nbsp; Fields: <code style={{ ...mono, color: C.muted }}>user ip country risk attack prediction hour failed device</code>
        </div>
      </div>

      {/* Results header */}
      <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
        <span style={{ ...mono, fontSize: 9, color: C.muted }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} · page {page + 1}/{pages || 1}
          {liveQ && <span style={{ color: C.teal }}> · query: <em>{liveQ}</em></span>}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn"
            style={{ background: C.dim, color: C.muted, padding: "4px 12px", fontSize: 11 }}>← Prev</button>
          <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="btn"
            style={{ background: C.dim, color: C.muted, padding: "4px 12px", fontSize: 11 }}>Next →</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", padding: "0 0 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.dim}`, background: "#080e1c" }}>
              <th style={{ width: 28 }} />
              {["Time", "User", "IP", "Country", "Failed", "Risk", "Status", "Attack"].map(h => (
                <th key={h} style={{ padding: "8px 11px", color: C.muted, textAlign: "left", ...mono, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((e, i) => {
              const c = riskColor(e.prediction);
              const isExp = expanded === e.id;
              return (
                <>
                  <tr key={e.id} className="trow"
                    onClick={() => setExpanded(isExp ? null : e.id)}
                    style={{ borderBottom: isExp ? "none" : `1px solid ${C.dim}22`, background: isExp ? `${C.teal}08` : "transparent" }}>
                    <td style={{ padding: "10px 8px 10px 14px", textAlign: "center" }}>
                      <span style={{ ...mono, fontSize: 10, color: isExp ? C.teal : C.dim, transition: "transform 0.2s", display: "inline-block", transform: isExp ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                    </td>
                    <td style={{ padding: "10px 11px", ...mono, fontSize: 10, color: C.muted }}>{fmtTime(e.timestamp)}</td>
                    <td style={{ padding: "10px 11px", fontSize: 12, fontWeight: 700 }}>{e.username}</td>
                    <td style={{ padding: "10px 11px", ...mono, fontSize: 10, color: C.muted }}>{e.ip_address}</td>
                    <td style={{ padding: "10px 11px" }}>
                      <span style={{ ...mono, fontSize: 10, background: C.dim, padding: "2px 7px", borderRadius: 3 }}>{e.country}</span>
                    </td>
                    <td style={{ padding: "10px 11px", textAlign: "center" }}>
                      <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: e.failed_attempts > 3 ? C.danger : C.text, background: e.failed_attempts > 3 ? C.danger + "15" : "transparent", padding: "2px 7px", borderRadius: 3 }}>
                        {e.failed_attempts}
                      </span>
                    </td>
                    <td style={{ padding: "10px 11px", minWidth: 100 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ height: 3, flex: 1, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${e.risk_score * 100}%`, height: "100%", background: `linear-gradient(90deg,${c}80,${c})`, borderRadius: 2 }} />
                        </div>
                        <span style={{ ...mono, fontSize: 9, color: c, minWidth: 32 }}>{fmtPct(e.risk_score)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 11px" }}><Badge label={e.prediction} /></td>
                    <td style={{ padding: "10px 11px" }}>
                      {e.attack_type !== "None"
                        ? <span style={{ fontSize: 9, fontWeight: 700, color: C.warn, background: C.warn + "15", padding: "2px 8px", borderRadius: 3 }}>{e.attack_type}</span>
                        : <span style={{ color: C.dim }}>—</span>}
                    </td>
                  </tr>
                  {isExp && <ExpandedRow key={`exp-${e.id}`} event={e} />}
                </>
              );
            })}
          </tbody>
        </table>
        {!paged.length && (
          <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.15 }}>◎</div>
            <div style={{ fontSize: 12 }}>No events match your query</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function PredictPanel({ onResult }) {
  const [form, setForm] = useState({
    username: "user_demo", ip_address: "185.220.101.45", country: "RU", device: "Chrome/Windows",
    hour_of_day: 3, day_of_week: 1, failed_attempts: 8, country_risk: 4.5,
    is_new_device: 1, is_new_ip: 1, ip_reputation: 0.85, session_duration_prev: 30,
    login_frequency_deviation: 7.2, time_since_last_login_hours: 0.1, vpn_proxy: 1,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const PRESETS = [
    { l: "🔴 Brute Force", c: C.danger, v: { hour_of_day: 3, failed_attempts: 12, country_risk: 4.5, is_new_device: 1, is_new_ip: 1, ip_reputation: 0.9, vpn_proxy: 1, login_frequency_deviation: 9, time_since_last_login_hours: 0.05, country: "RU" } },
    { l: "🟢 Normal", c: C.safe, v: { hour_of_day: 14, failed_attempts: 0, country_risk: 1, is_new_device: 0, is_new_ip: 0, ip_reputation: 0.05, vpn_proxy: 0, login_frequency_deviation: 0.3, time_since_last_login_hours: 24, country: "US" } },
    { l: "🟡 Suspicious", c: C.warn, v: { hour_of_day: 1, failed_attempts: 2, country_risk: 3, is_new_device: 1, is_new_ip: 1, ip_reputation: 0.5, vpn_proxy: 1, login_frequency_deviation: 4, time_since_last_login_hours: 300, country: "NG" } },
    { l: "🟠 Cred. Stuffing", c: C.orange, v: { hour_of_day: 4, failed_attempts: 1, country_risk: 4, is_new_device: 1, is_new_ip: 1, ip_reputation: 0.75, vpn_proxy: 1, login_frequency_deviation: 11, time_since_last_login_hours: 0.1, country: "CN" } },
  ];

  const predict = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setResult(await r.json()); onResult?.();
    } catch { alert("Backend offline — run: python app.py"); }
    setLoading(false);
  };

  const F = ({ label, k, type = "number", step = 1 }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>{label}</label>
      <input type={type} step={step} value={form[k]}
        onChange={e => set(k, type === "number" ? parseFloat(e.target.value) : e.target.value)}
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "8px 10px", fontSize: 12, ...mono, width: "100%" }} />
    </div>
  );
  const color = result ? riskColor(result.prediction) : C.teal;
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="predict-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <div className="panel" style={{ padding: 22 }}>
          <SLabel text="Submit Login Event" />
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {PRESETS.map(p => (
              <button key={p.l} onClick={() => setForm(f => ({ ...f, ...p.v }))} className="btn"
                style={{ background: p.c + "15", border: `1px solid ${p.c}40`, color: p.c, padding: "5px 12px", fontSize: 11 }}>{p.l}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
            <F label="Username" k="username" type="text" />
            <F label="IP Address" k="ip_address" type="text" />
            <F label="Country" k="country" type="text" />
            <F label="Device" k="device" type="text" />
            <F label="Hour (0-23)" k="hour_of_day" />
            <F label="Day of Week" k="day_of_week" />
            <F label="Failed Attempts" k="failed_attempts" />
            <F label="Country Risk" k="country_risk" step={0.1} />
            <F label="IP Reputation" k="ip_reputation" step={0.01} />
            <F label="Freq Deviation" k="login_frequency_deviation" step={0.1} />
            <F label="Hrs Since Login" k="time_since_last_login_hours" step={0.1} />
            <F label="Session Dur." k="session_duration_prev" />
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            {[["New Device", "is_new_device"], ["New IP", "is_new_ip"], ["VPN/Proxy", "vpn_proxy"]].map(([l, k]) => (
              <div key={k} onClick={() => set(k, form[k] ? 0 : 1)}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 14px", borderRadius: 7, userSelect: "none", transition: "all 0.18s", background: form[k] ? C.teal + "18" : C.surface, border: `1px solid ${form[k] ? C.teal + "60" : C.border}`, color: form[k] ? C.teal : C.muted, fontSize: 12, fontWeight: 600 }}>
                <div style={{ width: 13, height: 13, borderRadius: 3, background: form[k] ? C.teal : "transparent", border: `2px solid ${form[k] ? C.teal : C.muted}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: C.bg }}>{form[k] ? "✓" : ""}</div>
                {l}
              </div>
            ))}
          </div>
          <button onClick={predict} disabled={loading} className="btn"
            style={{ background: loading ? C.dim : `linear-gradient(135deg,${C.teal},#008fa0)`, color: loading ? C.muted : "#001a1a", padding: "11px 30px", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
            {loading ? "ANALYZING···" : "▶ RUN PREDICTION"}
          </button>
        </div>
        <div className="panel" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <SLabel text="ML Verdict" />
          {result ? (
            <div className="fade-up" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
              <div style={{ position: "relative", width: 120, height: 120 }}>
                <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={60} cy={60} r={50} fill="none" stroke={C.dim} strokeWidth={6} />
                  <circle cx={60} cy={60} r={50} fill="none" stroke={color} strokeWidth={6}
                    strokeDasharray={314} strokeDashoffset={314 * (1 - result.risk_score)} strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "all 0.6s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ ...mono, fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{(result.risk_score * 100).toFixed(0)}</span>
                  <span style={{ ...mono, fontSize: 9, color: C.muted }}>RISK %</span>
                </div>
              </div>
              <Badge label={result.prediction} />
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {[["Attack", result.attack_type, C.warn], ["Confidence", fmtPct(result.model_confidence), C.violet], ["Risk Score", fmtPct(result.risk_score), color]].map(([k, v, c]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 7, background: C.surface, border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
                    <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: C.muted }}>
              <div style={{ fontSize: 44, opacity: 0.1 }}>◎</div>
              <div style={{ fontSize: 12, textAlign: "center", lineHeight: 1.8 }}>Run a prediction<br />to see the verdict</div>
            </div>
          )}
        </div>
      </div>
      {result && <ShapChart explanation={result.explanation} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN TIMELINE (sidebar)
// ─────────────────────────────────────────────────────────────────────────────
function LoginTimeline({ events }) {
  const [expanded, setExpanded] = useState(false);
  const byUser = {};
  events.slice(0, 120).forEach(e => {
    if (!byUser[e.username]) byUser[e.username] = [];
    if (byUser[e.username].length < 3) byUser[e.username].push(e);
  });
  const users = Object.entries(byUser).slice(0, expanded ? 12 : 5);
  return (
    <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: 3, textTransform: "uppercase" }}>Login Timeline</span>
        <button onClick={() => setExpanded(x => !x)} style={{ background: "transparent", border: "none", color: C.teal, fontSize: 9, cursor: "pointer", ...mono }}>
          {expanded ? "▲ less" : "▼ more"}
        </button>
      </div>
      <div style={{ maxHeight: expanded ? 340 : 200, overflowY: "auto" }}>
        {!users.length && <div style={{ fontSize: 10, color: C.muted, textAlign: "center", padding: "12px 0" }}>No events yet</div>}
        {users.map(([username, evts]) => (
          <div key={username} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg,${C.teal}30,${C.violet}20)`, border: `1px solid ${C.teal}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.teal, fontWeight: 700, flexShrink: 0 }}>
                {username.slice(-2).toUpperCase()}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{username}</span>
            </div>
            {evts.map((e, i) => {
              const c = riskColor(e.prediction);
              return (
                <div key={e.id} className="timeline-item">
                  <div className="timeline-dot" style={{ background: c + "30", borderColor: c }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><span style={{ ...mono, fontSize: 8, color: C.muted }}>{fmtTime(e.timestamp)}</span><span style={{ ...mono, fontSize: 8, color: C.muted, marginLeft: 4 }}>· {e.country}</span></div>
                    <span style={{ ...mono, fontSize: 8, fontWeight: 700, color: c }}>{(e.risk_score * 100).toFixed(0)}%</span>
                  </div>
                  {e.attack_type !== "None" && <span style={{ fontSize: 8, color: C.warn, marginTop: 1, display: "block" }}>⚠ {e.attack_type}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, stats, arActive, setArActive, countdown, onMobileClose, isOpen, events }) {
  const TABS = [
    { key: "dashboard", icon: "◈", label: "Dashboard", desc: "KPIs & overview" },
    { key: "feed", icon: "◉", label: "Live Feed", desc: "Streaming events" },
    { key: "map", icon: "🌍", label: "Threat Map", desc: "Leaflet · arc lines" },
    { key: "baseline", icon: "🧠", label: "Behaviour", desc: "Anomaly baseline" },
    { key: "predict", icon: "◎", label: "Predict", desc: "ML verdict + SHAP" },
    { key: "events", icon: "≡", label: "All Events", desc: "Query filter + expand" },
  ];
  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? "open" : ""}`} onClick={onMobileClose} />
      <aside className={`sidebar sidebar-glass ${isOpen ? "open" : ""}`} style={{
        width: 230, borderRight: `1px solid rgba(0,210,200,0.1)`,
        display: "flex", flexDirection: "column", height: "100vh",
        position: "sticky", top: 0, flexShrink: 0, zIndex: 50, overflowY: "auto",
        boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${C.teal}35,${C.violet}25)`, border: `1px solid ${C.teal}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.teal, animation: "glowPulse 3s infinite" }}>⬡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5 }}>THREAT<span style={{ color: C.teal }}>LENS</span></div>
              <div style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: 2 }}>ML DETECTION v5</div>
            </div>
          </div>
        </div>
        {/* Nav */}
        <nav style={{ padding: "10px 10px 0", flexShrink: 0 }}>
          <div style={{ ...mono, fontSize: 8, color: C.dim, letterSpacing: 3, padding: "0 8px", marginBottom: 8, textTransform: "uppercase" }}>Navigation</div>
          {TABS.map(({ key, icon, label, desc }) => (
            <button key={key} onClick={() => { setTab(key); onMobileClose(); }} className={`nav-item ${tab === key ? "active" : ""}`}>
              <span style={{ fontSize: key === "map" || key === "baseline" ? 14 : 16, flexShrink: 0, width: 20, textAlign: "center" }}>{icon}</span>
              <div><div style={{ fontSize: 12.5 }}>{label}</div><div style={{ fontSize: 9, color: C.dim, marginTop: 1 }}>{desc}</div></div>
            </button>
          ))}
        </nav>
        {/* Auto-reset */}
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, flexShrink: 0, marginTop: 6 }}>
          <div style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Auto-Reset</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CountdownRing secs={countdown} total={RESET_SECS} active={arActive} onClick={() => setArActive(a => !a)} size={44} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: arActive ? C.teal : C.muted, marginBottom: 3 }}>{arActive ? "Active" : "Inactive"}</div>
              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{arActive ? `Resets in ${countdown}s` : "Click ring to start"}</div>
            </div>
          </div>
          {arActive && <div style={{ marginTop: 10, height: 3, background: C.dim, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, width: `${(countdown / RESET_SECS) * 100}%`, background: `linear-gradient(90deg,${C.teal},${C.violet})`, transition: "width 1s linear" }} /></div>}
        </div>
        {/* Timeline */}
        <LoginTimeline events={events} />
        {/* Status */}
        <div style={{ padding: "14px 16px", flexShrink: 0 }}>
          <div style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>System</div>
          {[["ML Model", "RF+SHAP", C.safe], ["Map", "Leaflet", C.safe], ["API", stats ? "Online" : "Offline", stats ? C.safe : C.danger]].map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
              <span style={{ ...mono, fontSize: 10, fontWeight: 600, color: c, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: c, animation: c === C.safe ? "blink 2s infinite" : "none" }} />
                {v}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP SHELL
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [simCount, setSimCount] = useState(20);
  const [simLoading, setSimLoading] = useState(false);
  const [arActive, setArActive] = useState(false);
  const [countdown, setCountdown] = useState(RESET_SECS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clock, setClock] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [drillFilter, setDrillFilter] = useState(null);
  const [resetKey, setResetKey] = useState(0);   // bumped on every reset → child remounts
  const countRef = useRef(RESET_SECS);
  const arRef = useRef(false);
  const alertIdRef = useRef(0);
  const prevEventIds = useRef(new Set());

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  const dismissAlert = useCallback(id => setAlerts(a => a.filter(x => x.id !== id)), []);
  const fireAlert = useCallback(event => {
    const id = ++alertIdRef.current;
    setAlerts(a => [...a.slice(-2), { ...event, id }]);
    setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 6000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([fetch(`${API}/stats`), fetch(`${API}/events?limit=100`)]);
      const ns = await s.json(); const ne = await e.json();
      const hasNew = ne.some(ev => !prevEventIds.current.has(ev.id));
      if (hasNew) {
        ne.filter(ev => ev.prediction === "BLOCKED" && !prevEventIds.current.has(ev.id)).forEach(ev => fireAlert(ev));
        ne.forEach(ev => prevEventIds.current.add(ev.id)); setEvents(ne);
      }
      setStats(ns);
    } catch { }
  }, [fireAlert]);

  const resetAndFetch = useCallback(async () => {
    try {
      await fetch(`${API}/reset`, { method: "POST" });
      // ── Immediately clear ALL local state so every page shows empty ──
      prevEventIds.current = new Set();   // reset seen-event tracking
      setEvents([]);                       // empty the events array RIGHT NOW
      setStats(null);                      // clear dashboard stats
      setAlerts([]);                       // dismiss all alert toasts
      setResetKey(k => k + 1);            // remount feed / events / baseline
      // Then fetch fresh (empty) data from backend
      await fetchData();
    } catch { }
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const id = setInterval(fetchData, 5000); return () => clearInterval(id); }, [fetchData]);

  useEffect(() => {
    arRef.current = arActive;
    if (!arActive) { countRef.current = RESET_SECS; setCountdown(RESET_SECS); return; }
    const tick = setInterval(() => {
      if (!arRef.current) return;
      countRef.current -= 1; setCountdown(countRef.current);
      if (countRef.current <= 0) {
        resetAndFetch();
        countRef.current = RESET_SECS;
        setCountdown(RESET_SECS);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [arActive, resetAndFetch]);

  const simulate = async () => {
    setSimLoading(true);
    try { await fetch(`${API}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: simCount }) }); await fetchData(); }
    catch { alert("Backend offline — run: python app.py"); }
    setSimLoading(false);
  };

  const PAGE_TITLES = {
    dashboard: "Security Overview", feed: "Live Event Stream — Real-Time Monitor",
    map: "Global Threat Map — Leaflet",
    baseline: "Behaviour Baseline — Anomaly Detection",
    predict: "Prediction Engine", events: "Event Explorer — Advanced Query",
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: C.bg }}>

      {/* KPI drill-down modal */}
      {drillFilter && <DrillModal filter={drillFilter} events={events} onClose={() => setDrillFilter(null)} />}

      <AlertToast alerts={alerts} onDismiss={dismissAlert} />

      <Sidebar tab={tab} setTab={setTab} stats={stats}
        arActive={arActive} setArActive={setArActive} countdown={countdown}
        onMobileClose={() => setSidebarOpen(false)} isOpen={sidebarOpen}
        events={events} />

      <div className="main-area" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Topbar */}
        <header className="header-glass" style={{ height: 52, display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}
            style={{ display: "none", background: "transparent", border: "none", cursor: "pointer", flexDirection: "column", gap: 4, padding: 4, color: C.muted }}>
            {[0, 1, 2].map(i => <span key={i} style={{ display: "block", width: 20, height: 2, background: "currentColor", borderRadius: 2 }} />)}
          </button>
          <div className="topbar-logo" style={{ display: "none", alignItems: "center", gap: 8, marginRight: 4 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg,${C.teal}35,${C.violet}25)`, border: `1px solid ${C.teal}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.teal }}>⬡</div>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5 }}>THREAT<span style={{ color: C.teal }}>LENS</span></span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{PAGE_TITLES[tab]}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 7, background: C.panel, border: `1px solid ${C.border}` }}>
              <span style={{ ...mono, fontSize: 9, color: C.muted }}>SIM</span>
              <input type="number" value={simCount} min={1} max={200} onChange={e => setSimCount(parseInt(e.target.value))}
                style={{ width: 42, background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: 5, padding: "3px 6px", ...mono, fontSize: 11, textAlign: "center" }} />
              <button onClick={simulate} disabled={simLoading} className="btn"
                style={{ background: simLoading ? C.dim : C.violet + "cc", color: "#fff", padding: "4px 10px", fontSize: 11 }}>
                {simLoading ? "···" : "⚡"}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: stats ? C.safe + "18" : C.danger + "18", border: `1px solid ${stats ? C.safe + "50" : C.danger + "50"}` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: stats ? C.safe : C.danger, animation: "blink 1.5s infinite" }} />
              <span style={{ ...mono, fontSize: 9, color: stats ? C.safe : C.danger }}>{stats ? "ONLINE" : "OFFLINE"}</span>
            </div>
            <span style={{ ...mono, fontSize: 11, color: C.muted }}>{clock}</span>
            <button onClick={fetchData} className="btn" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted, padding: "6px 12px", fontSize: 12 }}>↻</button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>
          {tab === "dashboard" && <Dashboard stats={stats} events={events} onDrillDown={setDrillFilter} />}
          {tab === "feed" && (
            <div className="fade-up" style={{ height: "calc(100vh - 130px)", display: "flex", flexDirection: "column" }}>
              <LiveFeed key={`feed-${resetKey}`} events={events} onSimulate={simulate} simLoading={simLoading} simCount={simCount} setSimCount={setSimCount} />
            </div>
          )}
          {tab === "map" && <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}><LeafletThreatMap flagged={stats?.top_flagged_countries || []} /></div>}
          {tab === "baseline" && <div className="fade-up"><BehaviourBaseline key={`baseline-${resetKey}`} events={events} /></div>}
          {tab === "predict" && <PredictPanel onResult={fetchData} />}
          {tab === "events" && <AdvancedEventsTable key={`events-${resetKey}`} events={events} />}
        </main>

        {/* Footer */}
        <footer className="status-footer" style={{ height: 26, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
          <span style={{ ...mono, fontSize: 8, color: C.dim, letterSpacing: 2 }}>THREATLENS v5.1 · RF+SHAP · LEAFLET · LIVE FEED · QUERY ENGINE · BASELINE</span>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            {stats && <><span style={{ ...mono, fontSize: 8, color: C.muted }}>{stats.total} events</span><span style={{ ...mono, fontSize: 8, color: C.danger }}>{stats.blocked} blocked</span><span style={{ ...mono, fontSize: 8, color: C.safe }}>{stats.detection_rate}% detection</span></>}
            {arActive && <span style={{ ...mono, fontSize: 8, color: C.teal, animation: "blink 1s infinite" }}>● RESET IN {countdown}s</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
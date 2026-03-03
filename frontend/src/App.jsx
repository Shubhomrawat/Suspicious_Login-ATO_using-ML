import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:5000/api";

function resolveUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API}${p}`;
}

async function callApi(path, opts) {
  const url = resolveUrl(path);
  return fetch(url, opts);
}

const RESET_SECS = 30;

// ─── Global CSS ───────────────────────────────────────────────────────────────
const injectCSS = (css) => {
  if (typeof document === "undefined") return;
  let el = document.getElementById("__tl");
  if (!el) { el = document.createElement("style"); el.id = "__tl"; document.head.appendChild(el); }
  el.textContent = css;
};
injectCSS(`
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html,body,#root{height:100%;min-height:100%}
  body{
    background: linear-gradient(135deg,#060810,#080c14);
    background-size: 400% 400%;
    animation: bgAnim 30s ease infinite;
    font-family:'Syne',sans-serif;color:#dde4f0;overflow:hidden
  }
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#1c2d4a;border-radius:4px}

  @keyframes fadeUp   {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideR   {from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
  @keyframes blink    {0%,100%{opacity:1}50%{opacity:0.2}}
  @keyframes newRow   {from{background:rgba(0,210,200,0.14)}to{background:transparent}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 4px rgba(0,210,200,0.4)}50%{box-shadow:0 0 16px rgba(0,210,200,0.7)}}
  @keyframes radarSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes eyeBlink{0%,88%,100%{transform:scaleY(1)}94%{transform:scaleY(0.07)}}
  @keyframes scanPulse{0%,100%{opacity:0.12}50%{opacity:0.5}}
  @keyframes orbitDot{from{transform:rotate(0deg) translateX(11px)}to{transform:rotate(360deg) translateX(11px)}}
  @keyframes logoGlow{0%,100%{filter:drop-shadow(0 0 3px rgba(0,210,200,0.5))}50%{filter:drop-shadow(0 0 10px rgba(0,210,200,0.9))}}
  .logo-svg{animation:logoGlow 3s ease-in-out infinite}
  @keyframes scanMove {0%{top:-10%}100%{top:110%}}
  @keyframes spin     {to{transform:rotate(360deg)}}
  @keyframes bgAnim   {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

  .fade-up  {animation:fadeUp  0.35s ease both}
  .slide-r  {animation:slideR  0.3s ease both}

  .nav-item{
    display:flex;align-items:center;gap:10px;
    padding:11px 14px;border-radius:9px;
    cursor:pointer;border:none;background:transparent;
    font-family:'Syne',sans-serif;font-size:13px;font-weight:500;
    color:#4e6a8a;width:100%;text-align:left;
    transition:all 0.18s;position:relative;
  }
  .nav-item:hover{background:rgba(0,210,200,0.07);color:#dde4f0}
  .nav-item.active{background:rgba(0,210,200,0.1);color:#00d2c8;font-weight:700}
  .nav-item.active::before{
    content:'';position:absolute;left:0;top:20%;bottom:20%;
    width:3px;border-radius:0 3px 3px 0;background:#00d2c8;
  }

  .panel{
    background:#0b1120;border:1px solid #162035;border-radius:10px;
    position:relative;overflow:hidden;
    backdrop-filter: blur(4px); /* frosted glass effect */
    box-shadow:0 8px 24px rgba(0,0,0,0.6);
  }
  .panel::after{
    content:'';position:absolute;top:0;left:10%;right:10%;height:1px;
    background:linear-gradient(90deg,transparent,rgba(0,210,200,0.2),transparent);
  }

  .kpi-card{
    background:#0b1120;border:1px solid #162035;border-radius:10px;
    position:relative;overflow:hidden;
    transition:border-color 0.2s,transform 0.2s;
  }
  .kpi-card:hover{border-color:rgba(0,210,200,0.3);transform:translateY(-2px)}

  .btn{
    cursor:pointer;border:none;border-radius:7px;
    font-family:'IBM Plex Mono',monospace;font-weight:600;
    letter-spacing:0.5px;transition:all 0.18s;
  }
  .btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
  .btn:active{transform:translateY(0)}
  .btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;filter:none}

  .trow{transition:background 0.15s}
  .trow:hover{background:rgba(0,210,200,0.04)!important}
  .trow.is-new{animation:newRow 2s ease forwards}

  input:focus,select:focus{
    outline:none!important;
    border-color:#00d2c8!important;
    box-shadow:0 0 0 3px rgba(0,210,200,0.1)!important;
  }

  /* Sidebar overlay for mobile */
  .sidebar-overlay{
    display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:40;
  }

  /* ─── RESPONSIVE ─────────────────────────────── */
  @media(max-width:768px){
    body{overflow:auto}
    .sidebar{
      position:fixed!important;left:0!important;top:0!important;bottom:0!important;
      z-index:50!important;transform:translateX(-100%);transition:transform 0.28s ease!important;
    }
    .sidebar.open{transform:translateX(0)!important}
    .sidebar-overlay.open{display:block}
    .main-area{margin-left:0!important}
    .topbar-logo{display:flex!important}
    .hamburger{display:flex!important}
    .kpi-grid{grid-template-columns:repeat(2,1fr)!important}
    .chart-grid-2{grid-template-columns:1fr!important}
    .chart-grid-main{grid-template-columns:1fr!important}
    .predict-grid{grid-template-columns:1fr!important}
    .feed-grid{grid-template-columns:1fr!important}
    .form-grid-4{grid-template-columns:repeat(2,1fr)!important}
    .toggle-row{flex-wrap:wrap!important}
    .sim-bar{flex-wrap:wrap!important;gap:8px!important}
    .header-right{gap:8px!important}
    .status-footer{display:none!important}
  }
  @media(max-width:480px){
    .kpi-grid{grid-template-columns:1fr 1fr!important}
    .form-grid-4{grid-template-columns:1fr 1fr!important}
  }
`);

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#060810", surface:"#080e1c", panel:"#0b1120", border:"#162035",
  teal:"#00d2c8", orange:"#ff6b35", violet:"#8b5cf6",
  safe:"#22c55e", warn:"#eab308", danger:"#ef4444",
  text:"#dde4f0", muted:"#4e6a8a", dim:"#1c2d4a",
};
const mono       = { fontFamily:"'IBM Plex Mono',monospace" };
const riskColor  = (l) => l==="SAFE"?C.safe:l==="SUSPICIOUS"?C.warn:C.danger;
const fmtTime    = (t) => t ? t.slice(11,19) : "--";
const fmtPct     = (s) => (s*100).toFixed(1)+"%";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Badge({ label }) {
  const c = riskColor(label);
  return (
    <span style={{
      ...mono, fontSize:9, fontWeight:700, letterSpacing:1.5,
      padding:"3px 9px", borderRadius:3,
      background:c+"18", color:c, border:`1px solid ${c}45`,
    }}>{label}</span>
  );
}



// ─── Countdown Ring ───────────────────────────────────────────────────────────
function CountdownRing({ secs, total, active, onClick, size=40 }) {
  const r = size/2 - 4;
  const circ = 2*Math.PI*r;
  const offset = circ*(1 - secs/total);
  const color = active ? C.teal : C.muted;
  return (
    <div onClick={onClick} title={active?`Resets in ${secs}s — click to stop`:"Enable auto-reset"}
      style={{ position:"relative", width:size, height:size, cursor:"pointer", flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.dim} strokeWidth={3}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{
            transition: active?"stroke-dashoffset 1s linear,stroke 0.3s":"stroke 0.3s",
            filter: active?`drop-shadow(0 0 4px ${C.teal})`:"none",
          }}/>
      </svg>
      <div style={{
        position:"absolute", inset:0,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      }}>
        {active
          ? <span style={{...mono, fontSize:9, fontWeight:700, color:C.teal}}>{secs}</span>
          : <span style={{fontSize:12}}>↺</span>
        }
      </div>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{
      background:"#0f1928", border:`1px solid ${C.border}`,
      borderRadius:8, padding:"9px 13px", ...mono, fontSize:11,
      boxShadow:"0 8px 24px rgba(0,0,0,0.5)",
    }}>
      <div style={{color:C.muted, marginBottom:4}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||C.teal}}>
          {p.name}: <b>{typeof p.value==="number"?p.value.toFixed(3):p.value}</b>
        </div>
      ))}
    </div>
  );
};

// ─── Live Feed ────────────────────────────────────────────────────────────────
function LiveFeed({ events }) {
  const [items,  setItems]  = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const prevIds = useRef(new Set());

  useEffect(() => {
    const top = events.slice(0,15);
    const fresh = top.filter(e => !prevIds.current.has(e.id));
    if (fresh.length) {
      setNewIds(new Set(fresh.map(e=>e.id)));
      setTimeout(()=>setNewIds(new Set()), 2200);
    }
    top.forEach(e => prevIds.current.add(e.id));
    setItems(top);
  }, [events]);

  return (
    <div className="panel" style={{padding:"18px 18px"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
        <span style={{...mono, fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase"}}>Live Event Feed</span>
        <span style={{...mono, fontSize:9, color:C.teal, display:"flex", alignItems:"center", gap:5}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:C.teal,animation:"blink 1.2s infinite",display:"inline-block"}}/>
          STREAMING
        </span>
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:5, maxHeight:380, overflowY:"auto"}}>
        {!items.length && <div style={{color:C.muted, fontSize:12, textAlign:"center", padding:"32px 0"}}>No events yet — simulate some!</div>}
        {items.map(e => {
          const c = riskColor(e.prediction);
          const isNew = newIds.has(e.id);
          return (
            <div key={e.id} className={isNew?"trow is-new":"trow"}
              style={{
                display:"grid", gridTemplateColumns:"32px 1fr auto",
                alignItems:"center", gap:10,
                padding:"8px 10px", borderRadius:7,
                border:`1px solid ${isNew?c+"50":C.border+"60"}`,
                background: isNew?c+"0a":"transparent",
              }}>
              <div style={{
                width:32, height:32, borderRadius:6, flexShrink:0,
                background:c+"18", border:`1px solid ${c}40`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, color:c, fontWeight:700,
              }}>
                {e.prediction==="SAFE"?"✓":e.prediction==="SUSPICIOUS"?"?":"✕"}
              </div>
              <div style={{overflow:"hidden"}}>
                <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:2, flexWrap:"wrap"}}>
                  <span style={{fontSize:12, fontWeight:700}}>{e.username}</span>
                  <span style={{...mono, fontSize:9, color:C.muted}}>{e.ip_address}</span>
                  <span style={{...mono, fontSize:9, background:C.dim, padding:"1px 6px", borderRadius:3, color:C.muted}}>{e.country}</span>
                </div>
                <div style={{display:"flex", gap:6, alignItems:"center"}}>
                  <span style={{fontSize:10, color:C.muted}}>{e.device?.split("/")[0]||"Unknown"}</span>
                  {e.attack_type!=="None" && (
                    <span style={{fontSize:9, color:C.warn, background:C.warn+"15", padding:"1px 6px", borderRadius:3, fontWeight:600}}>
                      ⚠ {e.attack_type}
                    </span>
                  )}
                </div>
              </div>
              <div style={{textAlign:"right", flexShrink:0}}>
                <div style={{...mono, fontSize:12, fontWeight:700, color:c}}>{fmtPct(e.risk_score)}</div>
                <div style={{...mono, fontSize:9, color:C.muted}}>{fmtTime(e.timestamp)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Threat Map ───────────────────────────────────────────────────────────────
function ThreatMap({ flagged }) {
  const COUNTRIES = [
    {code:"US",name:"United States"},{code:"UK",name:"United Kingdom"},
    {code:"DE",name:"Germany"},{code:"FR",name:"France"},
    {code:"IN",name:"India"},{code:"CN",name:"China"},
    {code:"RU",name:"Russia"},{code:"BR",name:"Brazil"},
    {code:"NG",name:"Nigeria"},{code:"KP",name:"N. Korea"},
    {code:"IR",name:"Iran"},{code:"AU",name:"Australia"},
    {code:"CA",name:"Canada"},{code:"JP",name:"Japan"},
    {code:"MX",name:"Mexico"},{code:"ZA",name:"South Africa"},
  ];
  const flagMap = {};
  flagged.forEach(f => { flagMap[f.country]=f.count; });
  const maxCount = Math.max(...Object.values(flagMap), 1);
  const highRisk = new Set(["RU","CN","NG","KP","IR"]);

  return (
    <div className="panel" style={{padding:"18px 18px"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8}}>
        <span style={{...mono, fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase"}}>Threat Origin Map</span>
        <div style={{display:"flex", gap:12}}>
          {[[C.teal,"Clean"],[C.warn+"aa","High-Risk"],[C.danger,"Flagged"]].map(([c,l])=>(
            <span key={l} style={{fontSize:9, color:C.muted, display:"flex", alignItems:"center", gap:4}}>
              <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>{l}
            </span>
          ))}
        </div>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:6}}>
        {COUNTRIES.map(c => {
          const count = flagMap[c.code]||0;
          const flagged = count>0;
          const hr = highRisk.has(c.code);
          const bg = flagged?`rgba(239,68,68,${0.18+count/maxCount*0.55})`:hr?"rgba(234,179,8,0.08)":C.dim+"40";
          const bc = flagged?C.danger:hr?C.warn+"60":C.border;
          return (
            <div key={c.code} title={`${c.name}: ${count} threats`}
              style={{
                background:bg, border:`1px solid ${bc}`, borderRadius:6,
                padding:"8px 4px", display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                transition:"all 0.2s", cursor:"default",
                boxShadow: flagged?`0 0 8px rgba(239,68,68,${count/maxCount*0.4})`:"none",
              }}>
              <span style={{...mono, fontSize:10, fontWeight:700, color:flagged?C.danger:hr?C.warn:C.muted}}>{c.code}</span>
              {flagged && <span style={{...mono, fontSize:8, color:C.danger, fontWeight:700}}>{count}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ stats }) {
  const ATK = [C.danger, C.warn, C.violet, C.teal];
  if (!stats) return (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:360, gap:14}}>
      <div style={{fontSize:36, opacity:0.12}}>⚡</div>
      <div style={{fontSize:14, fontWeight:600, color:C.muted}}>Backend Offline</div>
      <code style={{...mono, fontSize:11, color:C.teal, background:C.dim, padding:"6px 14px", borderRadius:6}}>cd backend && python app.py</code>
    </div>
  );
  return (
    <div className="fade-up" style={{display:"flex", flexDirection:"column", gap:16}}>
      {/* Hero banner */}
      {/* <div style={{fontSize:28,fontWeight:900,
                   background:`linear-gradient(90deg,${C.teal},${C.violet})`,
                   WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
                   textAlign:'center',animation:'slideR 0.6s both'}}>
        ThreatLens Dashboard
      </div> */}
      {/* KPI */}
      <div className="kpi-grid" style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12}}>
        {[
          {l:"Total",      v:stats.total,              c:C.teal,   i:"◈"},
          {l:"Safe",       v:stats.safe,               c:C.safe,   i:"✓"},
          {l:"Suspicious", v:stats.suspicious,         c:C.warn,   i:"◆"},
          {l:"Blocked",    v:stats.blocked,            c:C.danger, i:"■"},
          {l:"Detection",  v:stats.detection_rate+"%", c:C.violet, i:"%"},
        ].map((k,i)=>(
          <div key={i} className="kpi-card" style={{padding:"16px 18px"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${k.c}cc,transparent)`}}/>
            <div style={{...mono, fontSize:9, color:C.muted, letterSpacing:2.5, textTransform:"uppercase", marginBottom:6}}>{k.l}</div>
            <div style={{...mono, fontSize:28, fontWeight:700, color:k.c, lineHeight:1}}>{k.v}</div>
            <div style={{position:"absolute", bottom:6, right:10, fontSize:24, opacity:0.05, color:k.c}}>{k.i}</div>
          </div>
        ))}
      </div>

      {/* Main charts */}
      <div className="chart-grid-main" style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:14}}>
        <div className="panel" style={{padding:"18px 18px"}}>
          <div style={{...mono, fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:14}}>Risk Score Trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.risk_trend}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.teal} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.teal} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
              <XAxis dataKey="time" stroke={C.dim} tick={{fontSize:9,fill:C.muted}} tickFormatter={t=>t.slice(-5)}/>
              <YAxis stroke={C.dim} tick={{fontSize:9,fill:C.muted}} domain={[0,1]} tickFormatter={v=>(v*100).toFixed(0)+"%"}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="score" name="Risk" stroke={C.teal} strokeWidth={2} fill="url(#rg)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel" style={{padding:"18px 18px"}}>
          <div style={{...mono, fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:14}}>Attack Types</div>
          {stats.attack_distribution.length>0?(
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={stats.attack_distribution} dataKey="count" cx="50%" cy="50%"
                    innerRadius={35} outerRadius={55} paddingAngle={4} strokeWidth={0}>
                    {stats.attack_distribution.map((_,i)=><Cell key={i} fill={ATK[i%ATK.length]}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex", flexDirection:"column", gap:5, marginTop:8}}>
                {stats.attack_distribution.map((a,i)=>(
                  <div key={a.type} style={{display:"flex", alignItems:"center", gap:7}}>
                    <span style={{width:7,height:7,borderRadius:2,background:ATK[i%ATK.length],flexShrink:0}}/>
                    <span style={{color:C.muted, flex:1, fontSize:10}}>{a.type}</span>
                    <span style={{...mono, fontWeight:600, color:C.text, fontSize:11}}>{a.count}</span>
                  </div>
                ))}
              </div>
            </>
          ):<div style={{textAlign:"center", color:C.muted, fontSize:12, paddingTop:36}}>Simulate to populate</div>}
        </div>
      </div>

      {/* Bottom charts */}
      <div className="chart-grid-2" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <div className="panel" style={{padding:"18px 18px"}}>
          <div style={{...mono, fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:14}}>
            Hourly Volume
            <span style={{marginLeft:10, color:C.danger+"88", fontSize:8}}>■ OFF-HRS</span>
            <span style={{marginLeft:6,  color:C.teal+"88",   fontSize:8}}>■ NORMAL</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={stats.hourly_activity} barSize={11}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.dim} vertical={false}/>
              <XAxis dataKey="hour" stroke={C.dim} tick={{fontSize:9,fill:C.muted}} tickFormatter={h=>h%6===0?`${h}h`:""}/>
              <YAxis stroke={C.dim} tick={{fontSize:9,fill:C.muted}}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="count" name="Logins" radius={[3,3,0,0]}>
                {stats.hourly_activity.map((h,i)=>(
                  <Cell key={i} fill={(h.hour>=0&&h.hour<=6)?C.danger+"bb":C.teal+"bb"}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel" style={{padding:"18px 18px"}}>
          <div style={{...mono, fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:14}}>Top Threat Origins</div>
          {stats.top_flagged_countries.length>0?(
            <div style={{display:"flex", flexDirection:"column", gap:11}}>
              {stats.top_flagged_countries.map((c,i)=>{
                const max=stats.top_flagged_countries[0].count;
                return (
                  <div key={c.country}>
                    <div style={{display:"flex", justifyContent:"space-between", marginBottom:5}}>
                      <div style={{display:"flex", gap:7, alignItems:"center"}}>
                        <span style={{...mono, fontSize:9, color:C.muted}}>#{i+1}</span>
                        <span style={{fontSize:12, fontWeight:600}}>{c.country}</span>
                      </div>
                      <span style={{...mono, fontSize:11, fontWeight:700, color:C.danger}}>{c.count}</span>
                    </div>
                    <div style={{background:C.dim, borderRadius:2, height:4, overflow:"hidden"}}>
                      <div style={{
                        width:`${(c.count/max)*100}%`, height:"100%", borderRadius:2,
                        background:`linear-gradient(90deg,${C.orange},${C.danger})`,
                      }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          ):<div style={{color:C.muted, fontSize:12, paddingTop:28, textAlign:"center"}}>No data yet</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Predict ──────────────────────────────────────────────────────────────────
function PredictPanel({ onResult }) {
  const [form, setForm] = useState({
    username:"user_demo", ip_address:"185.220.101.45", country:"RU", device:"Chrome/Windows",
    hour_of_day:3, day_of_week:1, failed_attempts:8, country_risk:4.5,
    is_new_device:1, is_new_ip:1, ip_reputation:0.85, session_duration_prev:30,
    login_frequency_deviation:7.2, time_since_last_login_hours:0.1, vpn_proxy:1,
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const PRESETS = [
    {l:"🔴 Brute Force",       c:C.danger, v:{hour_of_day:3,  failed_attempts:12, country_risk:4.5, is_new_device:1, is_new_ip:1, ip_reputation:0.9,  vpn_proxy:1, login_frequency_deviation:9,   time_since_last_login_hours:0.05, country:"RU"}},
    {l:"🟢 Normal",            c:C.safe,   v:{hour_of_day:14, failed_attempts:0,  country_risk:1,   is_new_device:0, is_new_ip:0, ip_reputation:0.05, vpn_proxy:0, login_frequency_deviation:0.3, time_since_last_login_hours:24,   country:"US"}},
    {l:"🟡 Suspicious",        c:C.warn,   v:{hour_of_day:1,  failed_attempts:2,  country_risk:3,   is_new_device:1, is_new_ip:1, ip_reputation:0.5,  vpn_proxy:1, login_frequency_deviation:4,   time_since_last_login_hours:300,  country:"NG"}},
    {l:"🟠 Cred. Stuffing",    c:C.orange, v:{hour_of_day:4,  failed_attempts:1,  country_risk:4,   is_new_device:1, is_new_ip:1, ip_reputation:0.75, vpn_proxy:1, login_frequency_deviation:11,  time_since_last_login_hours:0.1,  country:"CN"}},
  ];

  const predict = async () => {
    setLoading(true);
    try {
      const r = await fetch(resolveUrl('/predict'),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      setResult(await r.json());
      onResult?.();
    } catch { alert("Backend offline — run: python app.py"); }
    setLoading(false);
  };

  const F = ({label,k,type="number",step=1}) => (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{...mono,fontSize:9,color:C.muted,letterSpacing:2,textTransform:"uppercase"}}>{label}</label>
      <input type={type} step={step} value={form[k]}
        onChange={e=>set(k,type==="number"?parseFloat(e.target.value):e.target.value)}
        style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:6,padding:"8px 10px",fontSize:12,...mono,width:"100%"}}/>
    </div>
  );

  const color = result ? riskColor(result.prediction) : C.teal;
  return (
    <div className="predict-grid fade-up" style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16}}>
      <div className="panel" style={{padding:22}}>
        <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Submit Login Event</div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {PRESETS.map(p=>(
            <button key={p.l} onClick={()=>setForm(f=>({...f,...p.v}))} className="btn"
              style={{background:p.c+"15",border:`1px solid ${p.c}40`,color:p.c,padding:"5px 12px",fontSize:11}}>
              {p.l}
            </button>
          ))}
        </div>
        <div className="form-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
          <F label="Username"        k="username"                   type="text"/>
          <F label="IP Address"      k="ip_address"                 type="text"/>
          <F label="Country"         k="country"                    type="text"/>
          <F label="Device"          k="device"                     type="text"/>
          <F label="Hour (0-23)"     k="hour_of_day"/>
          <F label="Day of Week"     k="day_of_week"/>
          <F label="Failed Attempts" k="failed_attempts"/>
          <F label="Country Risk"    k="country_risk"               step={0.1}/>
          <F label="IP Reputation"   k="ip_reputation"              step={0.01}/>
          <F label="Freq Deviation"  k="login_frequency_deviation"  step={0.1}/>
          <F label="Hrs Since Login" k="time_since_last_login_hours" step={0.1}/>
          <F label="Session Dur."    k="session_duration_prev"/>
        </div>
        <div className="toggle-row" style={{display:"flex",gap:10,marginBottom:20}}>
          {[["New Device","is_new_device"],["New IP","is_new_ip"],["VPN/Proxy","vpn_proxy"]].map(([l,k])=>(
            <div key={k} onClick={()=>set(k,form[k]?0:1)}
              style={{
                display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                padding:"8px 14px",borderRadius:7,userSelect:"none",transition:"all 0.18s",
                background:form[k]?C.teal+"18":C.surface,
                border:`1px solid ${form[k]?C.teal+"60":C.border}`,
                color:form[k]?C.teal:C.muted, fontSize:12, fontWeight:600,
              }}>
              <div style={{
                width:13,height:13,borderRadius:3,
                background:form[k]?C.teal:"transparent",
                border:`2px solid ${form[k]?C.teal:C.muted}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,color:C.bg,
              }}>{form[k]?"✓":""}</div>
              {l}
            </div>
          ))}
        </div>
        <button onClick={predict} disabled={loading} className="btn"
          style={{background:loading?C.dim:`linear-gradient(135deg,${C.teal},#008fa0)`,color:loading?C.muted:"#001a1a",padding:"11px 30px",fontSize:13,fontWeight:700,letterSpacing:1}}>
          {loading?"ANALYZING···":"▶ RUN PREDICTION"}
        </button>
      </div>

      <div className="panel" style={{padding:22,display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>
        <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:3,textTransform:"uppercase",alignSelf:"flex-start"}}>ML Verdict</div>
        {result?(
          <div className="fade-up" style={{width:"100%",display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>
            <div style={{position:"relative",width:120,height:120}}>
              <svg width={120} height={120} style={{transform:"rotate(-90deg)"}}>
                <circle cx={60} cy={60} r={50} fill="none" stroke={C.dim} strokeWidth={6}/>
                <circle cx={60} cy={60} r={50} fill="none" stroke={color} strokeWidth={6}
                  strokeDasharray={314} strokeDashoffset={314*(1-result.risk_score)} strokeLinecap="round"
                  style={{filter:`drop-shadow(0 0 8px ${color})`,transition:"all 0.6s ease"}}/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <span style={{...mono,fontSize:26,fontWeight:700,color,lineHeight:1}}>{(result.risk_score*100).toFixed(0)}</span>
                <span style={{...mono,fontSize:9,color:C.muted,letterSpacing:1}}>RISK %</span>
              </div>
            </div>
            <Badge label={result.prediction}/>
            <div style={{width:"100%",display:"flex",flexDirection:"column",gap:8}}>
              {[
                ["Attack",     result.attack_type,               C.warn],
                ["Confidence", fmtPct(result.model_confidence),  C.violet],
                ["Risk Score", fmtPct(result.risk_score),        color],
              ].map(([k,v,c])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:7,background:C.surface,border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:11,color:C.muted}}>{k}</span>
                  <span style={{...mono,fontSize:12,fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ):(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:C.muted}}>
            <div style={{fontSize:44,opacity:0.1}}>◎</div>
            <div style={{fontSize:12,textAlign:"center",lineHeight:1.8}}>Run a prediction<br/>to see the verdict</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Events Table ─────────────────────────────────────────────────────────────
function EventsTable({ events }) {
  const [filter, setFilter] = useState("ALL");
  const filtered = filter==="ALL"?events:events.filter(e=>e.prediction===filter);
  return (
    <div className="panel fade-up" style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <span style={{...mono,fontSize:9,color:C.muted,letterSpacing:3,textTransform:"uppercase"}}>Events ({filtered.length})</span>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["ALL","SAFE","SUSPICIOUS","BLOCKED"].map(f=>{
            const active=filter===f;
            const c=f==="ALL"?C.teal:riskColor(f);
            return (
              <button key={f} onClick={()=>setFilter(f)} className="btn"
                style={{background:active?c+"20":"transparent",border:`1px solid ${active?c+"70":C.border}`,color:active?c:C.muted,padding:"4px 12px",fontSize:9,letterSpacing:1}}>
                {f}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${C.dim}`}}>
              {["Time","User","IP","Country","Device","Attempts","Risk","Status","Attack"].map(h=>(
                <th key={h} style={{padding:"7px 11px",color:C.muted,textAlign:"left",...mono,fontSize:8,letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e=>{
              const c=riskColor(e.prediction);
              return (
                <tr key={e.id} className="trow" style={{borderBottom:`1px solid ${C.dim}22`}}>
                  <td style={{padding:"10px 11px",...mono,fontSize:10,color:C.muted}}>{fmtTime(e.timestamp)}</td>
                  <td style={{padding:"10px 11px",fontSize:12,fontWeight:600}}>{e.username}</td>
                  <td style={{padding:"10px 11px",...mono,fontSize:10,color:C.muted}}>{e.ip_address}</td>
                  <td style={{padding:"10px 11px"}}>
                    <span style={{...mono,fontSize:10,background:C.dim,padding:"2px 7px",borderRadius:3}}>{e.country}</span>
                  </td>
                  <td style={{padding:"10px 11px",color:C.muted,fontSize:10,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.device}</td>
                  <td style={{padding:"10px 11px",textAlign:"center"}}>
                    <span style={{...mono,fontSize:11,fontWeight:700,color:e.failed_attempts>3?C.danger:C.text,background:e.failed_attempts>3?C.danger+"15":"transparent",padding:"2px 7px",borderRadius:3}}>
                      {e.failed_attempts}
                    </span>
                  </td>
                  <td style={{padding:"10px 11px",minWidth:100}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{height:3,flex:1,background:C.dim,borderRadius:2,overflow:"hidden"}}>
                        <div style={{width:`${e.risk_score*100}%`,height:"100%",background:`linear-gradient(90deg,${c}80,${c})`,borderRadius:2}}/>
                      </div>
                      <span style={{...mono,fontSize:9,color:c,minWidth:32}}>{fmtPct(e.risk_score)}</span>
                    </div>
                  </td>
                  <td style={{padding:"10px 11px"}}><Badge label={e.prediction}/></td>
                  <td style={{padding:"10px 11px"}}>
                    {e.attack_type!=="None"
                      ?<span style={{fontSize:9,fontWeight:700,color:C.warn,background:C.warn+"15",padding:"2px 8px",borderRadius:3}}>{e.attack_type}</span>
                      :<span style={{color:C.dim}}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div style={{textAlign:"center",padding:48,color:C.muted}}>
            <div style={{fontSize:28,marginBottom:8,opacity:0.15}}>◎</div>
            <div style={{fontSize:12}}>No events match this filter</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, stats, arActive, setArActive, countdown, onMobileClose, isOpen }) {
  const TABS = [
    {key:"dashboard", icon:"◈", label:"Dashboard",   desc:"Overview & charts"},
    {key:"feed",      icon:"◉", label:"Live Feed",    desc:"Streaming events"},
    {key:"map",       icon:"⬡", label:"Threat Map",   desc:"Origin heatmap"},
    {key:"predict",   icon:"◎", label:"Predict",      desc:"Run ML verdict"},
    {key:"events",    icon:"≡", label:"All Events",   desc:"Full event log"},
  ];

  return (
    <>
      {/* Overlay for mobile */}
      <div className={`sidebar-overlay ${isOpen?"open":""}`} onClick={onMobileClose}/>

      <aside className={`sidebar ${isOpen?"open":""}`} style={{
        width:220, background:C.surface, borderRight:`1px solid ${C.border}`,
        display:"flex", flexDirection:"column", height:"100vh",
        position:"sticky", top:0, flexShrink:0, zIndex:50,
        transition:"transform 0.28s ease",
      }}>
        {/* Logo */}
        <div style={{padding:"20px 18px 18px", borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              width:32,height:32,borderRadius:8,
              background:`linear-gradient(135deg,${C.teal}35,${C.violet}25)`,
              border:`1px solid ${C.teal}50`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:14,color:C.teal,
              animation:"glowPulse 3s infinite, spin 8s linear infinite",
            }}>⬡</div>
            <div>
              <div style={{fontSize:14,fontWeight:800,letterSpacing:1.5}}>
                THREAT<span style={{color:C.teal}}>LENS</span>
              </div>
              <div style={{...mono,fontSize:8,color:C.muted,letterSpacing:2}}>ML DETECTION v3</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
          <div style={{...mono,fontSize:8,color:C.dim,letterSpacing:3,padding:"0 8px",marginBottom:8,textTransform:"uppercase"}}>Navigation</div>
          {TABS.map(({key,icon,label,desc})=>(
            <button key={key} onClick={()=>{setTab(key);onMobileClose();}} className={`nav-item ${tab===key?"active":""}`}>
              <span style={{fontSize:16,flexShrink:0,width:20,textAlign:"center"}}>{icon}</span>
              <div>
                <div style={{fontSize:13}}>{label}</div>
                <div style={{fontSize:9,color:C.dim,marginTop:1}}>{desc}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Auto-reset widget */}
        <div style={{padding:"14px 16px", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`}}>
          <div style={{...mono,fontSize:8,color:C.muted,letterSpacing:3,textTransform:"uppercase",marginBottom:12}}>Auto-Reset</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <CountdownRing secs={countdown} total={RESET_SECS} active={arActive} onClick={()=>setArActive(a=>!a)} size={44}/>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:arActive?C.teal:C.muted,marginBottom:3}}>
                {arActive?"Active":"Inactive"}
              </div>
              <div style={{fontSize:10,color:C.muted,lineHeight:1.5}}>
                {arActive?`Resets in ${countdown}s`:"Click ring to start"}
              </div>
            </div>
          </div>
          {arActive && (
            <div style={{marginTop:10,height:3,background:C.dim,borderRadius:2,overflow:"hidden"}}>
              <div style={{
                height:"100%",borderRadius:2,
                width:`${(countdown/RESET_SECS)*100}%`,
                background:`linear-gradient(90deg,${C.teal},${C.violet})`,
                transition:"width 1s linear",
              }}/>
            </div>
          )}
        </div>

        {/* System status */}
        <div style={{padding:"14px 16px"}}>
          <div style={{...mono,fontSize:8,color:C.muted,letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>System Status</div>
          {[
            ["ML Model","RF / Active",C.safe],
            ["Database","SQLite",     C.safe],
            ["API",     stats?"Online":"Offline", stats?C.safe:C.danger],
          ].map(([k,v,c])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <span style={{fontSize:11,color:C.muted}}>{k}</span>
              <span style={{...mono,fontSize:10,fontWeight:600,color:c,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:c,animation:c===C.safe?"blink 2s infinite":"none"}}/>
                {v}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [stats,      setStats]      = useState(null);
  const [events,     setEvents]     = useState([]);
  const [tab,        setTab]        = useState("dashboard");
  const [simCount,   setSimCount]   = useState(20);
  const [simLoading, setSimLoading] = useState(false);
  const [arActive,   setArActive]   = useState(false);
  const [countdown,  setCountdown]  = useState(RESET_SECS);
  const [sidebarOpen,setSidebarOpen]= useState(false);
  const [clock,      setClock]      = useState("");
  const countRef = useRef(RESET_SECS);
  const arRef    = useRef(false);

  // Clock
  useEffect(()=>{
    const tick=()=>setClock(new Date().toLocaleTimeString("en-US",{hour12:false}));
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);

  const fetchData = useCallback(async()=>{
    try {
      const [s,e]=await Promise.all([fetch(resolveUrl('/stats')),fetch(resolveUrl('/events?limit=60'))]);
      setStats(await s.json());
      setEvents(await e.json());
    } catch {}
  },[]);

  const resetAndFetch = useCallback(async()=>{
    try {
      await fetch(resolveUrl('/reset'),{method:"POST"});
      await fetchData();
    } catch {}
  },[fetchData]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  // Auto-reset countdown
  useEffect(()=>{
    arRef.current = arActive;
    if (!arActive) { countRef.current=RESET_SECS; setCountdown(RESET_SECS); return; }
    const tick = setInterval(()=>{
      if (!arRef.current) return;
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) {
        resetAndFetch();
        countRef.current = RESET_SECS;
        setCountdown(RESET_SECS);
      }
    },1000);
    return ()=>clearInterval(tick);
  },[arActive, resetAndFetch]);

  const simulate = async()=>{
    setSimLoading(true);
    try {
      await fetch(resolveUrl('/simulate'),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({count:simCount})});
      await fetchData();
    } catch { alert("Backend offline — run: python app.py"); }
    setSimLoading(false);
  };

  const PAGE_TITLES = {
    dashboard:"Security Overview", feed:"Live Event Feed",
    map:"Threat Origin Map", predict:"Prediction Engine", events:"All Login Events",
  };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:C.bg}}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sidebar
        tab={tab} setTab={setTab} stats={stats}
        arActive={arActive} setArActive={setArActive} countdown={countdown}
        onMobileClose={()=>setSidebarOpen(false)}
        isOpen={sidebarOpen}
      />

      {/* ── Right side ──────────────────────────────────────────────────────── */}
      <div className="main-area" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

        {/* ── Topbar ──────────────────────────────────────────────────────── */}
        <header style={{
          height:52,background:C.surface,borderBottom:`1px solid ${C.border}`,
          backdropFilter:"blur(8px)", /* subtle glassy header */
          boxShadow:"0 2px 12px rgba(0,0,0,0.4)",
          display:"flex",alignItems:"center",padding:"0 18px",gap:12,flexShrink:0,
        }}>
          {/* Hamburger (mobile only) */}
          <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)}
            style={{
              display:"none", // shown via CSS on mobile
              background:"transparent",border:"none",cursor:"pointer",
              flexDirection:"column",gap:4,padding:4,color:C.muted,
            }}>
            <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:2}}/>
            <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:2}}/>
            <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:2}}/>
          </button>

          {/* Mobile logo */}
          <div className="topbar-logo" style={{display:"none",alignItems:"center",gap:8,marginRight:4}}>
            <div style={{
              width:26,height:26,borderRadius:6,
              background:`linear-gradient(135deg,${C.teal}35,${C.violet}25)`,
              border:`1px solid ${C.teal}50`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,color:C.teal,
            }}>⬡</div>
            <span style={{fontSize:13,fontWeight:800,letterSpacing:1.5}}>
              THREAT<span style={{color:C.teal}}>LENS</span>
            </span>
          </div>

          {/* Page title */}
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,
                background:`linear-gradient(90deg,${C.teal},${C.violet})`,
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              {PAGE_TITLES[tab]}
            </div>
          </div>

          {/* Right controls */}
          <div className="header-right" style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>

            {/* Simulate */}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",borderRadius:7,background:C.panel,border:`1px solid ${C.border}`}}>
              <span style={{...mono,fontSize:9,color:C.muted}}>SIM</span>
              <input type="number" value={simCount} min={1} max={200}
                onChange={e=>setSimCount(parseInt(e.target.value))}
                style={{width:42,background:"transparent",border:`1px solid ${C.border}`,color:C.text,borderRadius:5,padding:"3px 6px",...mono,fontSize:11,textAlign:"center"}}/>
              <button onClick={simulate} disabled={simLoading} className="btn"
                style={{background:simLoading?C.dim:C.violet+"cc",color:"#fff",padding:"4px 10px",fontSize:11}}>
                {simLoading?"···":"⚡"}
              </button>
            </div>

            {/* Status */}
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:stats?C.safe+"18":C.danger+"18",border:`1px solid ${stats?C.safe+"50":C.danger+"50"}`}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:stats?C.safe:C.danger,animation:"blink 1.5s infinite"}}/>
              <span style={{...mono,fontSize:9,color:stats?C.safe:C.danger,letterSpacing:1}}>{stats?"ONLINE":"OFFLINE"}</span>
            </div>

            {/* Clock */}
            <span style={{...mono,fontSize:11,color:C.muted,letterSpacing:1}}>{clock}</span>

            {/* Manual refresh */}
            <button onClick={fetchData} className="btn"
              style={{background:C.panel,border:`1px solid ${C.border}`,color:C.muted,padding:"6px 12px",fontSize:12}}>↻</button>
          </div>
        </header>

        {/* ── Page content ──────────────────────────────────────────────── */}
        <main style={{flex:1,overflowY:"auto",padding:"18px 20px 24px"}}>
          {tab==="dashboard" && <Dashboard stats={stats}/>}
          {tab==="feed" && (
            <div className="feed-grid fade-up" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <LiveFeed events={events}/>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {stats && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[
                      {l:"Safe",      v:stats.safe,               c:C.safe},
                      {l:"Suspicious",v:stats.suspicious,         c:C.warn},
                      {l:"Blocked",   v:stats.blocked,            c:C.danger},
                      {l:"Detection", v:stats.detection_rate+"%", c:C.violet},
                    ].map(k=>(
                      <div key={k.l} className="kpi-card" style={{padding:"13px 15px"}}>
                        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${k.c},transparent)`}}/>
                        <div style={{...mono,fontSize:8,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:5}}>{k.l}</div>
                        <div style={{...mono,fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="panel" style={{padding:"16px 18px"}}>
                  <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:3,textTransform:"uppercase",marginBottom:12}}>About Auto-Reset</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>
                    The <span style={{color:C.teal}}>countdown ring</span> in the sidebar controls auto-reset.<br/><br/>
                    When active, it counts down from 30s. When it hits zero, <b style={{color:C.text}}>all logs are wiped</b> from the database and the dashboard refreshes to zero — perfect for live demos.
                  </div>
                  <div style={{marginTop:12,padding:"10px 14px",borderRadius:7,background:arActive?C.teal+"10":C.dim+"40",border:`1px solid ${arActive?C.teal+"40":C.border}`}}>
                    <span style={{...mono,fontSize:10,color:arActive?C.teal:C.muted}}>
                      {arActive?`⏱ Next reset in ${countdown} seconds`:"○ Auto-reset is inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab==="map" && (
            <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:16}}>
              <ThreatMap flagged={stats?.top_flagged_countries||[]}/>
              <EventsTable events={events.filter(e=>e.prediction!=="SAFE").slice(0,25)}/>
            </div>
          )}
          {tab==="predict" && <PredictPanel onResult={fetchData}/>}
          {tab==="events"  && <EventsTable events={events}/>}
        </main>

        {/* ── Footer status bar ────────────────────────────────────────────── */}
        <footer className="status-footer" style={{
          height:26,background:C.surface,borderTop:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"0 20px",flexShrink:0,
        }}>
          <span style={{...mono,fontSize:8,color:C.dim,letterSpacing:2}}>THREATLENS v3.1 · RF MODEL · FLASK · REACT</span>
          <div style={{display:"flex",gap:18,alignItems:"center"}}>
            {stats && <>
              <span style={{...mono,fontSize:8,color:C.muted}}>{stats.total} events</span>
              <span style={{...mono,fontSize:8,color:C.danger}}>{stats.blocked} blocked</span>
              <span style={{...mono,fontSize:8,color:C.safe}}>{stats.detection_rate}% detection</span>
            </>}
            {arActive && <span style={{...mono,fontSize:8,color:C.teal,animation:"blink 1s infinite"}}>● RESET IN {countdown}s</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
"use client";
import {
  createContext, useContext, useEffect, useReducer, useRef, useState,
} from "react";
import {
  Crown, Shield, Skull, Plus, Minus, Play, Pause, RotateCcw,
  Megaphone, Trophy, Flame, ListChecks, Eye, Radio, Siren, X,
  Target, Timer, Bell, BellRing, BarChart2, Activity, Lock,
  UserCheck, Users, Filter, Trash2, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

/* ═══════════════════════════════════════════════════
   ROLES
   bigboss   → full admin control
   moderator → can nominate / evict / complete tasks; cannot change points/timer/announce
   viewer    → read-only
═══════════════════════════════════════════════════ */
const ROLES = {
  bigboss:   { label: "Big Boss",  icon: Crown,     color: "text-fuchsia-400" },
  moderator: { label: "Moderator", icon: UserCheck,  color: "text-amber-300"  },
  viewer:    { label: "Viewer",    icon: Eye,        color: "text-cyan-300"   },
};
const ROLE_PERMISSIONS = {
  bigboss:   ["POINTS","CAPTAIN","IMMUNITY","NOMINATE","EVICT","TOGGLE_TASK","ADD_TASK","ANNOUNCE","TIMER","RESET"],
  moderator: ["CAPTAIN","NOMINATE","EVICT","TOGGLE_TASK"],
  viewer:    [],
};
const can = (role, action) => ROLE_PERMISSIONS[role]?.includes(action) ?? false;

/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
const mk = (id, name, team, points) => ({
  id, name, team, points, status: "Active", role: "Housemate", immune: false, nominated: false,
});
const INITIAL = {
  userRole: "bigboss",
  contestants: [
    mk(1,"Aarav","Alpha",40), mk(2,"Meera","Alpha",55),
    mk(3,"Kabir","Beta",30),  mk(4,"Isha","Beta",62),
    mk(5,"Rohan","Gamma",25), mk(6,"Diya","Gamma",48),
    mk(7,"Vikram","Delta",35),mk(8,"Naina","Delta",51),
  ],
  tasks: [
    { id:1, title:"Build a human pyramid", assignee:1, done:false },
    { id:2, title:"Silent kitchen challenge", assignee:4, done:true  },
  ],
  log: [],
  notifications: [],
  toasts: [],
  announcement: null,
  timer: { total:300, left:300, running:false },
};

const stamp = () =>
  new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });

const logIt = (s, m, category = "system") => ({
  ...s,
  log: [{ id: Date.now() + Math.random(), time: stamp(), msg: m, category }, ...s.log].slice(0, 200),
});

const notify = (s, title, body, kind = "info") => ({
  ...s,
  notifications: [
    { id: Date.now() + Math.random(), time: stamp(), title, body, kind, read: false },
    ...s.notifications,
  ].slice(0, 50),
});

const addToast = (s, text, kind = "info") => ({
  ...s,
  toasts: [...s.toasts, { id: Math.random(), text, kind }].slice(-4),
});

const patch = (s, id, f) => ({
  ...s,
  contestants: s.contestants.map((c) => (c.id === id ? { ...c, ...f(c) } : c)),
});

const nameOf = (s, id) => s.contestants.find((c) => c.id === id)?.name;

/* ═══════════════════════════════════════════════════
   REDUCER
═══════════════════════════════════════════════════ */
function reducer(s, a) {
  switch (a.type) {
    case "HYDRATE":
      return { ...s, ...a.saved, toasts:[], announcement:null, timer:{...a.saved.timer, running:false} };

    case "SET_ROLE":
      return logIt({...s, userRole:a.role}, `Role switched to ${ROLES[a.role].label}`, "access");

    case "POINTS": {
      const n = nameOf(s, a.id);
      const delta = a.d > 0 ? `+${a.d}` : `${a.d}`;
      const s1 = patch(s, a.id, (c) => ({ points: Math.max(0, c.points + a.d) }));
      const s2 = logIt(s1, `Points ${a.d>0?"added to":"deducted from"} ${n} (${delta})`, "points");
      return notify(s2, "Points Updated", `${n} received ${delta} points`, "info");
    }

    case "CAPTAIN": {
      const makes = s.contestants.find((c) => c.id === a.id).role !== "Captain";
      const next  = {...s, contestants: s.contestants.map((c) => ({...c, role: c.id===a.id&&makes?"Captain":"Housemate"}))};
      const msg   = makes ? `${nameOf(s,a.id)} crowned as House Captain` : `${nameOf(s,a.id)} stepped down`;
      const s1    = logIt(next, msg, "captain");
      const s2    = notify(s1, "Captain Change", msg, "gold");
      return addToast(s2, makes?`${nameOf(s,a.id)} is Captain!`:"Captaincy vacant", "gold");
    }

    case "NOMINATE": {
      const c = s.contestants.find((x) => x.id === a.id);
      if (c.immune || c.status === "Evicted") return s;
      const entering = !c.nominated;
      const s1 = patch(s, a.id, (x) => ({nominated: !x.nominated}));
      const msg = entering ? `${c.name} entered the Danger Zone` : `${c.name} removed from Danger Zone`;
      const s2  = logIt(s1, msg, "nomination");
      const s3  = notify(s2, entering?"Nominated!":"Safe", msg, entering?"danger":"info");
      return addToast(s3, msg, entering?"danger":"info");
    }

    case "IMMUNITY": {
      const c  = s.contestants.find((x) => x.id === a.id);
      const s1 = patch(s, a.id, (x) => ({immune:!x.immune, nominated:x.immune?x.nominated:false}));
      const msg = `${c.name} ${c.immune?"lost":"won"} immunity`;
      const s2  = logIt(s1, msg, "immunity");
      const s3  = notify(s2, "Immunity", msg, "info");
      return addToast(s3, msg, "info");
    }

    case "EVICT": {
      const c  = s.contestants.find((x) => x.id === a.id);
      const s1 = patch(s, a.id, () => ({status:"Evicted",nominated:false,immune:false,role:"Housemate"}));
      const msg = `${c.name} was EVICTED from the house`;
      const s2  = logIt(s1, msg, "eviction");
      const s3  = notify(s2, "EVICTED!", msg, "danger");
      return addToast(s3, `${c.name} Evicted!`, "danger");
    }

    case "ADD_TASK": {
      const s1 = {...s, tasks:[{id:Date.now(),title:a.title,assignee:a.assignee,done:false},...s.tasks]};
      return logIt(s1, `Task assigned to ${nameOf(s,a.assignee)}: ${a.title}`, "task");
    }

    case "TOGGLE_TASK": {
      const t  = s.tasks.find((x) => x.id === a.id);
      const s1 = {...s, tasks:s.tasks.map((x)=>(x.id===a.id?{...x,done:!x.done}:x))};
      const msg = `Task "${t.title}" marked ${t.done?"incomplete":"complete"}`;
      const s2  = logIt(s1, msg, "task");
      if (!t.done) {
        const s3 = notify(s2, "Task Complete!", msg, "gold");
        return addToast(s3, msg, "gold");
      }
      return s2;
    }

    case "ANNOUNCE": {
      const s1 = {...s, announcement:a.text};
      const s2 = logIt(s1, `Big Boss announced: ${a.text}`, "announcement");
      const s3 = notify(s2, "Big Boss Speaks!", a.text, "gold");
      return addToast(s3, "Big Boss has spoken!", "gold");
    }

    case "CLEAR_ANN":   return {...s, announcement:null};
    case "DISMISS":     return {...s, toasts:s.toasts.filter((t)=>t.id!==a.id)};
    case "MARK_READ":   return {...s, notifications:s.notifications.map((n)=>n.id===a.id?{...n,read:true}:n)};
    case "CLEAR_NOTIF": return {...s, notifications:[]};

    case "T_START":
      return s.timer.left>0&&!s.timer.running
        ? logIt({...s,timer:{...s.timer,running:true}}, "Task Timer Started", "timer")
        : s;
    case "T_PAUSE":
      return s.timer.running
        ? logIt({...s,timer:{...s.timer,running:false}}, "Task Timer Paused", "timer")
        : s;
    case "T_RESET":
      return logIt({...s,timer:{...s.timer,left:s.timer.total,running:false}}, "Task Timer Reset", "timer");
    case "T_TICK": {
      const left = Math.max(0, s.timer.left-1);
      const n    = {...s, timer:{...s.timer,left,running:left>0}};
      if (left===0) {
        const s1 = logIt(n, "Task Timer hit zero — time's up!", "timer");
        const s2 = notify(s1, "Time's Up!", "The task timer has reached zero.", "danger");
        return addToast(s2, "Time's up!", "danger");
      }
      return n;
    }

    case "RESET_ALL": return logIt({...INITIAL,log:[],notifications:[]}, "House reset to factory state", "system");
    default: return s;
  }
}

/* ═══════════════════════════════════════════════════
   CONTEXT
═══════════════════════════════════════════════════ */
const Ctx = createContext(null);
const useStore = () => useContext(Ctx);
const KEY = "bigboss-v3";

function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) dispatch({ type:"HYDRATE", saved:JSON.parse(raw) }); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const { toasts, announcement, ...persist } = state;
    try { localStorage.setItem(KEY, JSON.stringify(persist)); } catch {}
  }, [state, ready]);

  useEffect(() => {
    if (!state.timer.running) return;
    const id = setInterval(() => dispatch({ type:"T_TICK" }), 1000);
    return () => clearInterval(id);
  }, [state.timer.running]);

  const userRole = state.userRole ?? "bigboss";
  const canDo    = (action) => can(userRole, action);

  return (
    <Ctx.Provider value={{ state, dispatch, ready, userRole, can: canDo }}>
      {children}
    </Ctx.Provider>
  );
}

/* ═══════════════════════════════════════════════════
   SHARED UI ATOMS
═══════════════════════════════════════════════════ */
const Panel = ({ title, icon: Icon, color = "text-cyan-300", children, className = "", badge }) => (
  <section className={`rounded-xl border border-white/10 bg-[#0d0b1e]/90 p-4 ${className}`}>
    <h2 className={`mb-3 flex items-center gap-2 text-sm font-bold ${color}`}>
      <Icon size={16}/>{title}
      {badge != null && (
        <span className="ml-auto rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[10px] text-white font-bold leading-none">
          {badge}
        </span>
      )}
    </h2>
    {children}
  </section>
);

const Btn = ({ children, onClick, disabled, tone = "cyan", title }) => {
  const tones = {
    cyan:  "border-cyan-400/60 text-cyan-300 hover:bg-cyan-400/15",
    pink:  "border-fuchsia-500/60 text-fuchsia-300 hover:bg-fuchsia-500/15",
    red:   "border-red-500/60 text-red-400 hover:bg-red-500/15",
    gold:  "border-amber-400/60 text-amber-300 hover:bg-amber-400/15",
    ghost: "border-white/10 text-white/60 hover:bg-white/10",
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-white
        disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent
        ${tones[tone]}`}>
      {children}
    </button>
  );
};

/* ═══════════════════════════════════════════════════
   HEADER  +  ROLE SWITCHER
═══════════════════════════════════════════════════ */
function Header() {
  const { state, dispatch, userRole } = useStore();
  const unread = state.notifications.filter((n) => !n.read).length;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-fuchsia-500/40 pb-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-fuchsia-400 drop-shadow-[0_0_12px_rgba(255,43,214,.7)]">
          BIG BOSS COMMAND CENTER
        </h1>
        <p className="text-xs text-cyan-300/70 mt-0.5">
          {ROLES[userRole].label} Mode —
          {userRole==="bigboss" ? " full control" : userRole==="moderator" ? " limited actions" : " read-only"}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <RoleSwitcher/>
        {unread > 0 && (
          <span className="flex items-center gap-1 rounded border border-fuchsia-500/60 bg-fuchsia-500/10 px-2 py-1 text-xs text-fuchsia-300">
            <BellRing size={12} className="animate-bounce"/>
            {unread} new
          </span>
        )}
        <Btn tone="red" disabled={userRole!=="bigboss"}
          onClick={() => confirm("Reset the whole house?") && dispatch({ type:"RESET_ALL" })}>
          <RotateCcw size={12}/>Reset house
        </Btn>
      </div>
    </header>
  );
}

function RoleSwitcher() {
  const { dispatch, userRole } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const cur = ROLES[userRole];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded border border-white/20 px-3 py-1.5 text-xs font-bold ${cur.color} hover:bg-white/10 transition`}>
        <cur.icon size={13}/>{cur.label}<ChevronDown size={12} className={`transition ${open?"rotate-180":""}`}/>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-white/10 bg-[#0d0b1e] shadow-xl">
          {Object.entries(ROLES).map(([key, { label, icon: Icon, color }]) => (
            <button key={key} onClick={() => { dispatch({ type:"SET_ROLE", role:key }); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition
                ${key===userRole?"font-bold":"text-white/60"} ${color}`}>
              <Icon size={13}/>{label}
              {key==="bigboss"   && <span className="ml-auto rounded-full bg-fuchsia-500/20 text-fuchsia-300 px-1.5 py-0.5 text-[9px]">Full</span>}
              {key==="moderator" && <span className="ml-auto rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[9px]">Limited</span>}
              {key==="viewer"    && <span className="ml-auto rounded-full bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 text-[9px]">Read-only</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STATS BAR
═══════════════════════════════════════════════════ */
function Stats() {
  const { state } = useStore();
  const active = state.contestants.filter((c) => c.status === "Active");
  const top    = [...active].sort((a, b) => b.points - a.points)[0];
  const items  = [
    ["Highest scorer",  top ? `${top.name} (${top.points})` : "None", Trophy,    "text-amber-300"],
    ["Tasks completed", `${state.tasks.filter((t)=>t.done).length} / ${state.tasks.length}`, ListChecks, "text-cyan-300"],
    ["Nominees",        state.contestants.filter((c)=>c.nominated&&c.status==="Active").length, Flame, "text-red-400"],
    ["In the house",    `${active.length} / ${state.contestants.length}`, Target, "text-fuchsia-300"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([l, v, I, c]) => (
        <div key={l} className="rounded-xl border border-white/10 bg-[#0d0b1e]/90 p-3 hover:border-white/20 transition">
          <div className={`flex items-center gap-2 text-xs ${c}`}><I size={14}/>{l}</div>
          <div className="mt-1 text-lg font-bold text-white">{v}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LEADERBOARD
═══════════════════════════════════════════════════ */
function Leaderboard() {
  const { state } = useStore();
  const rows = state.contestants.filter((c)=>c.status==="Active").sort((a,b)=>b.points-a.points);
  return (
    <Panel title="Live leaderboard" icon={Trophy} color="text-amber-300">
      <ol className="space-y-1">
        {rows.map((c, i) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5 text-sm">
            <span className="flex items-center gap-2">
              <b className={i===0?"text-amber-300":i===1?"text-white/70":"text-white/40"}>#{i+1}</b>
              {c.name}
              {c.role==="Captain" && <Crown size={12} className="text-amber-300"/>}
              {c.nominated && <Flame size={11} className="text-red-400"/>}
            </span>
            <b className="text-cyan-300">{c.points}</b>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   ROSTER
═══════════════════════════════════════════════════ */
function Roster() {
  const { state, dispatch, can } = useStore();
  const active = state.contestants.filter((c)=>c.status==="Active");
  return (
    <Panel title="Housemates" icon={Shield} className="lg:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {active.map((c) => (
          <div key={c.id} className={`rounded-xl border p-3 transition
            ${c.nominated?"border-red-500/70 shadow-[0_0_14px_rgba(255,0,60,.25)]"
              :c.immune?"border-cyan-400/60 shadow-[0_0_8px_rgba(0,229,255,.15)]"
              :"border-white/10 hover:border-white/20"} bg-black/30`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-white">{c.name}</div>
                <div className="text-xs text-white/50">Team {c.team}</div>
              </div>
              <div className="text-right text-xs space-y-0.5">
                {c.role==="Captain" && <div className="text-amber-300 flex items-center gap-1 justify-end"><Crown size={10}/>Captain</div>}
                {c.immune          && <div className="text-cyan-300 flex items-center gap-1 justify-end"><Shield size={10}/>Immune</div>}
                {c.nominated       && <div className="text-red-400 flex items-center gap-1 justify-end"><Flame size={10}/>Nominated</div>}
              </div>
            </div>
            <div className="my-2 flex items-center gap-2">
              <Btn disabled={!can("POINTS")} onClick={()=>dispatch({type:"POINTS",id:c.id,d:-5})} tone="red" title="Subtract 5 points"><Minus size={12}/>5</Btn>
              <span className="min-w-[3ch] text-center text-xl font-black text-cyan-300">{c.points}</span>
              <Btn disabled={!can("POINTS")} onClick={()=>dispatch({type:"POINTS",id:c.id,d:5})} title="Add 5 points"><Plus size={12}/>5</Btn>
            </div>
            <div className="flex flex-wrap gap-1">
              <Btn tone="gold" disabled={!can("CAPTAIN")}  onClick={()=>dispatch({type:"CAPTAIN",id:c.id})}><Crown size={12}/>{c.role==="Captain"?"Unseat":"Captain"}</Btn>
              <Btn tone="cyan" disabled={!can("IMMUNITY")} onClick={()=>dispatch({type:"IMMUNITY",id:c.id})}><Shield size={12}/>{c.immune?"Revoke":"Immunity"}</Btn>
              <Btn tone="pink" disabled={!can("NOMINATE")||c.immune} title={c.immune?"Immune — cannot nominate":""} onClick={()=>dispatch({type:"NOMINATE",id:c.id})}><Flame size={12}/>{c.nominated?"Un-nominate":"Nominate"}</Btn>
              <Btn tone="red"  disabled={!can("EVICT")}    onClick={()=>dispatch({type:"EVICT",id:c.id})}><Skull size={12}/>Evict</Btn>
            </div>
          </div>
        ))}
        {active.length===0 && <p className="text-sm text-white/50 col-span-3">The house is empty. Reset it to start again.</p>}
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   DANGER ZONE
═══════════════════════════════════════════════════ */
function DangerZone() {
  const { state, dispatch, can } = useStore();
  const noms = state.contestants.filter((c)=>c.nominated&&c.status==="Active");
  return (
    <Panel title="Danger zone" icon={Siren} color="text-red-400" className="border-red-500/30">
      {noms.length===0
        ? <p className="text-sm text-white/50">Nobody is nominated.</p>
        : (
          <ul className="space-y-2">
            {noms.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-sm">
                <span>{c.name} <span className="text-white/40">Team {c.team}</span></span>
                <Btn tone="red" disabled={!can("EVICT")} onClick={()=>dispatch({type:"EVICT",id:c.id})}><Skull size={12}/>Evict</Btn>
              </li>
            ))}
          </ul>
        )
      }
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   TASKS
═══════════════════════════════════════════════════ */
function Tasks() {
  const { state, dispatch, can } = useStore();
  const active   = state.contestants.filter((c)=>c.status==="Active");
  const [title, setTitle] = useState("");
  const [who, setWho]     = useState("");
  const assignee = Number(who)||active[0]?.id;
  const submit = () => { if (!title.trim()||!assignee) return; dispatch({type:"ADD_TASK",title:title.trim(),assignee}); setTitle(""); };
  return (
    <Panel title="Tasks" icon={ListChecks}>
      <div className="mb-3 flex flex-wrap gap-2">
        <input disabled={!can("ADD_TASK")} value={title} onChange={(e)=>setTitle(e.target.value)}
          onKeyDown={(e)=>e.key==="Enter"&&submit()}
          placeholder="New task title…" className="min-w-0 flex-1 rounded border border-white/20 bg-black/40 px-2 py-1 text-sm disabled:opacity-40"/>
        <select disabled={!can("ADD_TASK")} value={assignee||""} onChange={(e)=>setWho(e.target.value)}
          className="rounded border border-white/20 bg-black px-2 py-1 text-sm disabled:opacity-40">
          {active.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Btn disabled={!can("ADD_TASK")} onClick={submit}><Plus size={12}/>Assign</Btn>
      </div>
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {state.tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1 text-sm">
            <span className={t.done?"text-white/40 line-through":""}>
              {t.title} <span className="text-xs text-fuchsia-300">{nameOf(state,t.assignee)}</span>
            </span>
            <Btn tone={t.done?"gold":"cyan"} disabled={!can("TOGGLE_TASK")} onClick={()=>dispatch({type:"TOGGLE_TASK",id:t.id})}>
              {t.done?"Reopen":"Complete"}
            </Btn>
          </li>
        ))}
        {state.tasks.length===0 && <li className="text-sm text-white/50">No tasks yet.</li>}
      </ul>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   TIMER
═══════════════════════════════════════════════════ */
function TimerPanel() {
  const { state, dispatch, can } = useStore();
  const { left, running, total } = state.timer;
  const mm  = String(Math.floor(left/60)).padStart(2,"0");
  const ss  = String(left%60).padStart(2,"0");
  const pct = total>0?(left/total)*100:0;
  return (
    <Panel title="Task timer" icon={Timer} color="text-fuchsia-300">
      <div className={`text-center text-5xl font-black tabular-nums ${left===0?"text-red-500":running?"text-cyan-300":"text-white"}`}>
        {mm}:{ss}
      </div>
      <div className="my-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full transition-all duration-1000 ${left===0?"bg-red-500":running?"bg-fuchsia-500":"bg-white/30"}`}
          style={{width:`${pct}%`}}/>
      </div>
      <div className="flex justify-center gap-2">
        <Btn disabled={!can("TIMER")||running||left===0} onClick={()=>dispatch({type:"T_START"})}><Play size={12}/>Start</Btn>
        <Btn tone="gold" disabled={!can("TIMER")||!running}  onClick={()=>dispatch({type:"T_PAUSE"})}><Pause size={12}/>Pause</Btn>
        <Btn tone="red"  disabled={!can("TIMER")}            onClick={()=>dispatch({type:"T_RESET"})}><RotateCcw size={12}/>Reset</Btn>
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   ANNOUNCER
═══════════════════════════════════════════════════ */
function Announcer() {
  const { dispatch, can } = useStore();
  const [text, setText] = useState("");
  const send = () => { if (!text.trim()) return; dispatch({type:"ANNOUNCE",text:text.trim()}); setText(""); };
  return (
    <Panel title="Big Boss announcement" icon={Megaphone} color="text-amber-300">
      <div className="flex gap-2">
        <input disabled={!can("ANNOUNCE")} value={text} onChange={(e)=>setText(e.target.value)}
          onKeyDown={(e)=>e.key==="Enter"&&send()}
          placeholder="Attention housemates…" className="min-w-0 flex-1 rounded border border-white/20 bg-black/40 px-2 py-1 text-sm disabled:opacity-40"/>
        <Btn tone="gold" disabled={!can("ANNOUNCE")} onClick={send}><Megaphone size={12}/>Announce</Btn>
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   FEATURE 1 — EVENT NOTIFICATIONS
═══════════════════════════════════════════════════ */
const NOTIF_KINDS = {
  info:   "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  gold:   "border-amber-400/40 bg-amber-400/10 text-amber-200",
  danger: "border-red-500/40 bg-red-500/10 text-red-300",
};
const NOTIF_ICONS = { info:Bell, gold:Trophy, danger:Siren };

function EventNotifications() {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState("all");
  const unread = state.notifications.filter((n)=>!n.read).length;

  const filtered = filter==="unread"
    ? state.notifications.filter((n)=>!n.read)
    : state.notifications;

  return (
    <Panel title="Event Notifications" icon={BellRing} color="text-fuchsia-300"
      badge={unread>0?unread:null} className="border-fuchsia-500/20">
      <div className="mb-2 flex items-center gap-2">
        {["all","unread"].map((f) => (
          <button key={f} onClick={()=>setFilter(f)}
            className={`rounded px-2 py-0.5 text-xs transition ${filter===f?"bg-fuchsia-500 text-white":"text-white/50 hover:text-white/80"}`}>
            {f==="all" ? `All (${state.notifications.length})` : `Unread (${unread})`}
          </button>
        ))}
        {state.notifications.length>0 && (
          <button onClick={()=>dispatch({type:"CLEAR_NOTIF"})}
            className="ml-auto flex items-center gap-1 text-xs text-white/40 hover:text-red-400 transition">
            <Trash2 size={11}/>Clear
          </button>
        )}
      </div>

      <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {filtered.length===0 && (
          <li className="flex flex-col items-center gap-1 py-6 text-center text-xs text-white/30">
            <Bell size={24} className="opacity-30"/>
            No notifications yet
          </li>
        )}
        {filtered.map((n) => {
          const Icon = NOTIF_ICONS[n.kind]??Bell;
          return (
            <li key={n.id}
              onClick={()=>dispatch({type:"MARK_READ",id:n.id})}
              className={`flex cursor-pointer gap-2 rounded-lg border p-2 transition hover:opacity-80
                ${NOTIF_KINDS[n.kind]??NOTIF_KINDS.info}
                ${!n.read?"shadow-sm":"opacity-60"}`}>
              <Icon size={14} className="mt-0.5 shrink-0"/>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate">{n.title}</span>
                  <span className="shrink-0 text-[10px] opacity-60">{n.time}</span>
                </div>
                <p className="mt-0.5 text-[11px] opacity-80 leading-snug">{n.body}</p>
              </div>
              {!n.read && <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400"/>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   FEATURE 2 — PERFORMANCE ANALYTICS
═══════════════════════════════════════════════════ */
function Analytics() {
  const { state } = useStore();
  const [mounted, setMounted] = useState(false);
  const [view, setView]       = useState("individual"); // individual | team | radar
  useEffect(() => setMounted(true), []);

  const active = state.contestants.filter((c)=>c.status==="Active");

  const ptsData = active
    .sort((a,b)=>b.points-a.points)
    .map((c)=>({name:c.name, Points:c.points, Tasks:state.tasks.filter((t)=>t.assignee===c.id&&t.done).length}));

  const teams = [...new Set(active.map((c)=>c.team))];
  const teamData = teams.map((team) => {
    const members = active.filter((c)=>c.team===team);
    return {
      name:team,
      "Avg Points": Math.round(members.reduce((s,c)=>s+c.points,0)/members.length),
      "Members":    members.length,
      "Tasks Done": state.tasks.filter((t)=>members.some((m)=>m.id===t.assignee)&&t.done).length,
    };
  });

  const top5 = ptsData.slice(0,5);
  const radarData = [
    { metric:"Points",     ...Object.fromEntries(top5.map((c)=>[c.name, c.Points])) },
    { metric:"Tasks Done", ...Object.fromEntries(top5.map((c)=>[c.name, c.Tasks*20])) },
    { metric:"Activity",   ...Object.fromEntries(top5.map((c)=>[c.name, 60])) },
  ];
  const COLORS = ["#00e5ff","#ff2bd6","#ffc43d","#7fff6e","#ff6b6b"];
  const axis  = { stroke:"#8b8ba7", fontSize:11 };
  const tip   = { contentStyle:{ background:"#0d0b1e", border:"1px solid #ff2bd6", fontSize:12 } };

  return (
    <Panel title="Performance Analytics" icon={BarChart2} color="text-cyan-300" className="lg:col-span-2">
      <div className="mb-3 flex gap-1">
        {[["individual","Individual"],["team","Team"],["radar","Radar"]].map(([k,l]) => (
          <button key={k} onClick={()=>setView(k)}
            className={`rounded px-2.5 py-0.5 text-xs transition ${view===k?"bg-cyan-500/20 text-cyan-300 border border-cyan-500/40":"text-white/40 hover:text-white/70"}`}>
            {l}
          </button>
        ))}
      </div>

      {mounted && (
        <div className="grid gap-4 md:grid-cols-2">
          {view==="individual" && (
            <>
              <div>
                <p className="mb-1 text-xs text-white/50">Points by housemate</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ptsData}>
                      <CartesianGrid stroke="rgba(255,255,255,.06)"/>
                      <XAxis dataKey="name" {...axis}/>
                      <YAxis allowDecimals={false} {...axis}/>
                      <Tooltip {...tip}/>
                      <Bar dataKey="Points" fill="#00e5ff" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-white/50">Tasks completed per housemate</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ptsData}>
                      <CartesianGrid stroke="rgba(255,255,255,.06)"/>
                      <XAxis dataKey="name" {...axis}/>
                      <YAxis allowDecimals={false} {...axis}/>
                      <Tooltip {...tip}/>
                      <Bar dataKey="Tasks" fill="#ff2bd6" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {view==="team" && (
            <>
              <div>
                <p className="mb-1 text-xs text-white/50">Average points per team</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamData}>
                      <CartesianGrid stroke="rgba(255,255,255,.06)"/>
                      <XAxis dataKey="name" {...axis}/>
                      <YAxis allowDecimals={false} {...axis}/>
                      <Tooltip {...tip}/>
                      <Bar dataKey="Avg Points" fill="#ffc43d" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-white/50">Tasks done per team</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamData}>
                      <CartesianGrid stroke="rgba(255,255,255,.06)"/>
                      <XAxis dataKey="name" {...axis}/>
                      <YAxis allowDecimals={false} {...axis}/>
                      <Tooltip {...tip}/>
                      <Bar dataKey="Tasks Done" fill="#7fff6e" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {view==="radar" && (
            <div className="col-span-2">
              <p className="mb-1 text-xs text-white/50">Top-5 multi-metric radar</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,.12)"/>
                    <PolarAngleAxis dataKey="metric" tick={{fill:"#8b8ba7",fontSize:11}}/>
                    {top5.map((c,i) => (
                      <Radar key={c.name} name={c.name} dataKey={c.name}
                        stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15}/>
                    ))}
                    <Legend/>
                    <Tooltip {...tip}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   FEATURE 3 — REAL-TIME ACTIVITY LOG
═══════════════════════════════════════════════════ */
const LOG_CATEGORIES = ["all","points","nomination","eviction","captain","immunity","task","timer","announcement","access","system"];
const CAT_COLORS = {
  points:"text-cyan-300", nomination:"text-red-400", eviction:"text-red-500",
  captain:"text-amber-300", immunity:"text-cyan-400", task:"text-fuchsia-300",
  timer:"text-purple-300", announcement:"text-amber-400", access:"text-green-400", system:"text-white/40",
};

function ActivityLog() {
  const { state } = useStore();
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch]       = useState("");
  const [paused, setPaused]       = useState(false);
  const [displayLog, setDisplayLog] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!paused) setDisplayLog(state.log);
  }, [state.log, paused]);

  useEffect(() => {
    if (!paused && containerRef.current) containerRef.current.scrollTop = 0;
  }, [displayLog, paused]);

  const shown = displayLog
    .filter((l) => catFilter==="all" || l.category===catFilter)
    .filter((l) => !search || l.msg.toLowerCase().includes(search.toLowerCase()));

  return (
    <Panel title="Real-time Activity Log" icon={Activity} color="text-cyan-300"
      className={paused?"border-amber-400/30":"border-cyan-500/20"}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`flex items-center gap-1 text-[11px] font-bold ${paused?"text-amber-400":"text-green-400"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${paused?"bg-amber-400":"bg-green-400 animate-pulse"}`}/>
          {paused?"PAUSED":"LIVE"}
        </span>
        <button onClick={()=>setPaused((p)=>!p)}
          className={`rounded border px-2 py-0.5 text-[10px] transition ${paused?"border-amber-400/50 text-amber-300 hover:bg-amber-400/10":"border-white/20 text-white/50 hover:text-white"}`}>
          {paused?"Resume":"Pause"}
        </button>
        <input value={search} onChange={(e)=>setSearch(e.target.value)}
          placeholder="Search…" className="min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-2 py-0.5 text-xs"/>
        <span className="text-[10px] text-white/30">{shown.length} entries</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {LOG_CATEGORIES.map((cat) => (
          <button key={cat} onClick={()=>setCatFilter(cat)}
            className={`rounded px-1.5 py-0.5 text-[10px] transition capitalize
              ${catFilter===cat?"bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/40":"text-white/30 hover:text-white/60"}`}>
            {cat}
          </button>
        ))}
      </div>
      <ul ref={containerRef} className="h-64 overflow-y-auto space-y-0.5 pr-1">
        {shown.length===0 && (
          <li className="flex items-center justify-center h-full text-xs text-white/30">
            {state.log.length===0?"Waiting for the first action…":"No matching entries"}
          </li>
        )}
        {shown.map((l) => (
          <li key={l.id} className="flex gap-2 items-start border-l-2 border-fuchsia-500/30 pl-2 py-0.5 text-xs hover:border-fuchsia-500/70 transition">
            <span className="shrink-0 text-white/30 tabular-nums">{l.time}</span>
            <span className={`shrink-0 capitalize ${CAT_COLORS[l.category]??"text-white/50"}`}>[{l.category}]</span>
            <span className="text-white/80 leading-snug">{l.msg}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   FEATURE 4 — ROLE-BASED ACCESS PANEL
═══════════════════════════════════════════════════ */
const ALL_PERMS = [
  { key:"POINTS",      label:"Adjust points"       },
  { key:"TIMER",       label:"Manage timer"        },
  { key:"ANNOUNCE",    label:"Make announcements"  },
  { key:"IMMUNITY",    label:"Grant immunity"      },
  { key:"NOMINATE",    label:"Nominate housemates" },
  { key:"EVICT",       label:"Evict housemates"    },
  { key:"ADD_TASK",    label:"Assign tasks"        },
  { key:"TOGGLE_TASK", label:"Complete tasks"      },
  { key:"CAPTAIN",     label:"Set captain"         },
  { key:"RESET",       label:"Reset house"         },
];

function RoleAccessPanel() {
  const { userRole } = useStore();
  return (
    <Panel title="Role-based Access" icon={Lock} color="text-green-400" className="border-green-500/20">
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(ROLES).map(([key, { label, icon: Icon, color }]) => (
          <div key={key}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition
              ${key===userRole?"border-fuchsia-500/60 bg-fuchsia-500/10":"border-white/10 opacity-40"} ${color}`}>
            <Icon size={13}/>{label}
            {key===userRole && <span className="text-[9px] ml-1 opacity-60">(current)</span>}
          </div>
        ))}
      </div>
      <p className="mb-2 text-[11px] text-white/40">
        Showing permissions for: <span className={`font-bold ${ROLES[userRole].color}`}>{ROLES[userRole].label}</span>
        {" · "}{ROLE_PERMISSIONS[userRole].length} of {ALL_PERMS.length} permissions active
      </p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {ALL_PERMS.map(({key, label}) => {
          const granted = ROLE_PERMISSIONS[userRole].includes(key);
          return (
            <li key={key} className={`flex items-center gap-2 text-xs rounded px-2 py-1.5
              ${granted?"bg-green-500/10 text-green-300":"bg-red-500/10 text-red-400/60 line-through"}`}>
              {granted ? <UserCheck size={11} className="shrink-0"/> : <Lock size={11} className="shrink-0"/>}
              {label}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   EVICTED
═══════════════════════════════════════════════════ */
function Evicted() {
  const { state } = useStore();
  const out = state.contestants.filter((c)=>c.status==="Evicted");
  return (
    <Panel title="Evicted" icon={Skull} color="text-white/50">
      {out.length===0
        ? <p className="text-sm text-white/40">Nobody has left the house yet.</p>
        : (
          <ul className="space-y-1 text-sm">
            {out.map((c) => (
              <li key={c.id} className="flex justify-between rounded-lg bg-white/5 px-2 py-1 text-white/60">
                <span>{c.name} (Team {c.team})</span>
                <span>{c.points} pts</span>
              </li>
            ))}
          </ul>
        )
      }
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════
   OVERLAYS
═══════════════════════════════════════════════════ */
function Toasts() {
  const { state, dispatch } = useStore();
  return (
    <div className="fixed right-4 top-4 z-40 space-y-2 max-w-xs w-full">
      {state.toasts.map((t) => (
        <Toast key={t.id} t={t} close={()=>dispatch({type:"DISMISS",id:t.id})}/>
      ))}
    </div>
  );
}
function Toast({ t, close }) {
  useEffect(() => { const id = setTimeout(close, 4500); return () => clearTimeout(id); }, []);
  const kinds = {
    danger: "border-red-500   text-red-300",
    gold:   "border-amber-400 text-amber-200",
    info:   "border-cyan-400  text-cyan-200",
  };
  return (
    <div className={`slide flex items-center gap-3 rounded-lg border bg-[#0d0b1e] px-3 py-2 text-sm shadow-xl ${kinds[t.kind]}`}>
      <BellRing size={14} className="shrink-0"/>
      <span className="flex-1">{t.text}</span>
      <button onClick={close} aria-label="Dismiss"><X size={12}/></button>
    </div>
  );
}
function AnnouncementOverlay() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    if (!state.announcement) return;
    const id = setTimeout(()=>dispatch({type:"CLEAR_ANN"}), 8000);
    return () => clearTimeout(id);
  }, [state.announcement]);
  if (!state.announcement) return null;
  return (
    <div onClick={()=>dispatch({type:"CLEAR_ANN"})}
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/80 backdrop-blur-sm p-6">
      <div className="pop max-w-2xl w-full rounded-2xl border-2 border-fuchsia-500 bg-[#0d0b1e] p-8 text-center shadow-[0_0_80px_rgba(255,43,214,.5)]">
        <Megaphone className="mx-auto mb-3 text-amber-300" size={40}/>
        <div className="mb-2 text-sm text-fuchsia-300 font-bold tracking-widest uppercase">Big Boss Speaks</div>
        <p className="text-3xl font-black text-white leading-snug">{state.announcement}</p>
        <p className="mt-5 text-xs text-white/40">Click anywhere to dismiss</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD LAYOUT
═══════════════════════════════════════════════════ */
function Dashboard() {
  const { ready } = useStore();
  if (!ready) return <div className="p-10 text-cyan-300 animate-pulse">Booting command center…</div>;
  return (
    <main className="mx-auto max-w-[1400px] space-y-4 p-4">
      <Header/>
      <Stats/>

      {/* Row 1 — Roster + Danger Zone + Leaderboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Roster/>
        <div className="space-y-4"><DangerZone/><Leaderboard/></div>
      </div>

      {/* Row 2 — Timer + Announcer | Tasks | Activity Log */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4"><TimerPanel/><Announcer/></div>
        <Tasks/>
        <ActivityLog/>
      </div>

      {/* Row 3 — Analytics + Notifications + Evicted */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Analytics/>
        <div className="space-y-4"><EventNotifications/><Evicted/></div>
      </div>

      {/* Row 4 — Role Access (full-width) */}
      <RoleAccessPanel/>

      <Toasts/>
      <AnnouncementOverlay/>
    </main>
  );
}
export default function Page() { return <Provider><Dashboard/></Provider>; }

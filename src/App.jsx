import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Grid3x3, Activity, TrendingUp, Plus, X, Lock, Unlock, Check, Pencil, AlertTriangle, Settings, Trash2, History, ShieldAlert, Eye, EyeOff, FileDown, Save, XCircle } from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- Design tokens ----------
const TOKENS = `
  :root {
    --bg: #F5F6F8;
    --panel: #FFFFFF;
    --sidebar: #1C2430;
    --sidebar-text: #A7AFBD;
    --sidebar-text-active: #FFFFFF;
    --sidebar-accent: #4A9B94;
    --text: #1C2430;
    --text-muted: #5B6472;
    --border: #DEE2E7;
    --accent: #2E6F6E;
    --accent-light: #E3EFEE;
    --warn: #B8792E;
    --warn-light: #F6EADA;
    --danger: #AD4A32;
    --danger-light: #F5E2DB;
    --sans: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  body { margin: 0; background: var(--bg); }
`;

// ---------- Placeholder seed data (only used the very first time each key is created) ----------
const SEED_PEOPLE = [
  { id: "p1", name: "Team Member 1", role: "Solution Architect" },
  { id: "p2", name: "Team Member 2", role: "T24/Transact Consultant" },
  { id: "p3", name: "Team Member 3", role: "Integration Developer" },
  { id: "p4", name: "Team Member 4", role: "Business Analyst" },
  { id: "p5", name: "Team Member 5", role: "Project Manager" },
  { id: "p6", name: "Team Member 6", role: "Data / DWH Engineer" },
];

const SEED_SKILLS = [
  { id: "s1", name: "Core Banking (T24/Transact)" },
  { id: "s2", name: "Integration (TAFJ/API)" },
  { id: "s3", name: "Migration & Data Conversion" },
  { id: "s4", name: "Solution Architecture" },
  { id: "s5", name: "SQL & Data Warehousing" },
  { id: "s6", name: "Client Presentations / RFPs" },
];

const SEED_SKILL_LEVELS = {
  "p1|s1": 4, "p1|s4": 4, "p1|s6": 3, "p1|s2": 2,
  "p2|s1": 4, "p2|s3": 3, "p2|s2": 1,
  "p3|s2": 4, "p3|s5": 2, "p3|s1": 2,
  "p4|s6": 3, "p4|s1": 2, "p4|s3": 2,
  "p5|s6": 4, "p5|s4": 2,
  "p6|s5": 4, "p6|s3": 2, "p6|s1": 1,
};

const SEED_PROJECTS = [
  { id: "pr1", name: "Core Banking Migration - Client A", startDate: "2026-01-05", endDate: "2026-08-28" },
  { id: "pr2", name: "Intranet Modernisation - Client B", startDate: "2026-03-02", endDate: "2026-06-26" },
];

// Each allocation is an array of splits/segments (fractional FTE, time-phased),
// including a couple deliberately outside their project's window, one left
// unconfirmed, and one split into multiple segments - to demonstrate the
// alert, the confirm/edit toggle, and the split feature.
const SEED_ALLOCATIONS = {
  "p1|pr1": [{ id: "seg1", pct: 60, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true }],
  "p1|pr2": [{ id: "seg1", pct: 20, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: true }],
  "p2|pr1": [
    { id: "seg1", pct: 37.5, startDate: "2026-01-05", endDate: "2026-04-30", confirmed: true },
    { id: "seg2", pct: 80, startDate: "2026-05-01", endDate: "2026-08-28", confirmed: true },
  ],
  "p3|pr2": [{ id: "seg1", pct: 70, startDate: "2026-03-02", endDate: "2026-07-15", confirmed: true }],
  "p4|pr1": [{ id: "seg1", pct: 40, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true }],
  "p4|pr2": [{ id: "seg1", pct: 30, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: false }],
  "p5|pr1": [{ id: "seg1", pct: 50, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true }],
  "p5|pr2": [{ id: "seg1", pct: 50, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: true }],
  "p6|pr1": [{ id: "seg1", pct: 30, startDate: "2025-12-15", endDate: "2026-08-28", confirmed: true }],
};

const SEED_LOCKED_PEOPLE = { p1: true, p2: true };

const SEED_APP_SETTINGS = { logRetentionDays: 30, clearLog: [] };

// Client-side gate only (this app has no login/backend) - prevents accidental
// clicks, not a real access control. Set VITE_CLEAR_DATA_PASSWORD to override.
const CLEAR_DATA_PASSWORD = import.meta.env.VITE_CLEAR_DATA_PASSWORD || "clear-data";

const SEED_UPCOMING = [
  { id: "u1", name: "Data Warehouse Build - Prospect C", requiredSkillIds: ["s5", "s3"], note: "Kickoff expected next quarter" },
  { id: "u2", name: "Core Banking RFP - Prospect D", requiredSkillIds: ["s1", "s4", "s6"], note: "Proposal stage" },
];

const LEVEL_LABELS = ["None", "Basic", "Working", "Advanced", "Expert"];

// ---------- Shared, realtime-synced state backed by Supabase ----------
// Table expected: resourcing_data (key text primary key, value jsonb not null, updated_at timestamptz)
// See README.md for the SQL to create this table.
function useSupabaseState(key, seed) {
  const [value, setValue] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data, error: fetchError } = await supabase
          .from("resourcing_data")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        if (fetchError) throw fetchError;
        if (cancelled) return;
        if (data) {
          setValue(data.value);
        } else {
          const { error: upsertError } = await supabase
            .from("resourcing_data")
            .upsert({ key, value: seed });
          if (upsertError) throw upsertError;
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    init();

    const channel = supabase
      .channel(`resourcing_data_${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resourcing_data", filter: `key=eq.${key}` },
        (payload) => {
          if (payload.new && payload.new.value) setValue(payload.new.value);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [key]);

  const persist = async (next) => {
    setValue(next);
    try {
      const { error: upsertError } = await supabase
        .from("resourcing_data")
        .upsert({ key, value: next });
      if (upsertError) throw upsertError;
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  return [value, persist, loaded, error];
}

function levelColor(level) {
  if (level === 0) return "var(--border)";
  const opacities = [0, 0.25, 0.5, 0.75, 1];
  return `rgba(46, 111, 110, ${opacities[level]})`;
}

function pctColor(pct) {
  if (pct > 100) return "var(--danger)";
  if (pct >= 90) return "var(--warn)";
  return "var(--accent)";
}

// An allocation entry is an array of splits/segments, each a fractional FTE
// over its own date range: { id, pct, startDate, endDate, confirmed }.
// Older data may still be a bare percentage number or a single object -
// these helpers normalize any of those shapes into a segment array.
function toSegments(entry) {
  if (entry == null) return [];
  if (Array.isArray(entry)) return entry;
  if (typeof entry === "number") return entry ? [{ id: "seg1", pct: entry, startDate: "", endDate: "", confirmed: false }] : [];
  return [{ id: entry.id || "seg1", pct: entry.pct || 0, startDate: entry.startDate || "", endDate: entry.endDate || "", confirmed: !!entry.confirmed }];
}
function segmentsTotalPct(entry) {
  return toSegments(entry).reduce((sum, seg) => sum + (Number(seg.pct) || 0), 0);
}
function fte(pct) {
  return (Number(pct) / 100).toFixed(2);
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
// ISO yyyy-mm-dd strings compare lexically the same as chronologically.
function isOutsideWindow(allocStart, allocEnd, projStart, projEnd) {
  if (!allocStart || !allocEnd || !projStart || !projEnd) return false;
  return allocStart < projStart || allocEnd > projEnd;
}

function pruneClearLog(log, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return (log || []).filter((entry) => new Date(entry.clearedAt).getTime() >= cutoff);
}

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildSkillsReport(people, skills, skillLevels) {
  const header = ["Team member", "Role", ...skills.map((s) => s.name)];
  const rows = people.map((p) => [
    p.name,
    p.role,
    ...skills.map((s) => LEVEL_LABELS[skillLevels[`${p.id}|${s.id}`] || 0]),
  ]);
  return [header, ...rows];
}

function buildAllocationReport(people, projects, allocations) {
  const header = ["Team member", "Project", "Split #", "Allocation %", "FTE", "Start date", "End date", "Confirmed", "Outside project window"];
  const rows = [];
  people.forEach((p) => {
    projects.forEach((pr) => {
      const segments = toSegments(allocations[`${p.id}|${pr.id}`]);
      segments.forEach((seg, idx) => {
        if (!seg.pct && !seg.startDate && !seg.endDate) return;
        rows.push([
          p.name,
          pr.name,
          idx + 1,
          seg.pct,
          fte(seg.pct),
          seg.startDate,
          seg.endDate,
          seg.confirmed ? "Yes" : "No",
          isOutsideWindow(seg.startDate, seg.endDate, pr.startDate, pr.endDate) ? "Yes" : "No",
        ]);
      });
    });
  });
  return [header, ...rows];
}

function buildUtilisationReport(people, totalsByPerson) {
  const header = ["Team member", "Role", "Total allocation %", "Total FTE", "Available %", "Status"];
  const rows = people.map((p) => {
    const total = totalsByPerson[p.id] || 0;
    return [
      p.name,
      p.role,
      total,
      fte(total),
      Math.max(0, 100 - total),
      total > 100 ? "Over-allocated" : total >= 90 ? "Near capacity" : "OK",
    ];
  });
  return [header, ...rows];
}

function buildConsolidatedReport(people, skills, skillLevels, projects, allocations, totalsByPerson) {
  return [
    ["SKILLS REPORT"],
    ...buildSkillsReport(people, skills, skillLevels),
    [],
    ["ALLOCATION REPORT"],
    ...buildAllocationReport(people, projects, allocations),
    [],
    ["UTILISATION REPORT"],
    ...buildUtilisationReport(people, totalsByPerson),
  ];
}

export default function App() {
  const [tab, setTab] = useState("skills");

  const [peopleData, setPeopleData, peopleLoaded, peopleError] = useSupabaseState(
    "people-skills",
    { people: SEED_PEOPLE, skills: SEED_SKILLS, skillLevels: SEED_SKILL_LEVELS, lockedPeople: SEED_LOCKED_PEOPLE }
  );
  const [allocData, setAllocData, allocLoaded, allocError] = useSupabaseState(
    "projects-allocations",
    { projects: SEED_PROJECTS, allocations: SEED_ALLOCATIONS }
  );
  const [upcomingData, setUpcomingData, upcomingLoaded, upcomingError] = useSupabaseState(
    "upcoming-projects",
    { upcoming: SEED_UPCOMING }
  );
  const [appSettingsData, setAppSettingsData, appSettingsLoaded, appSettingsError] = useSupabaseState(
    "app-settings",
    SEED_APP_SETTINGS
  );

  const loaded = peopleLoaded && allocLoaded && upcomingLoaded && appSettingsLoaded;
  const connectionError = peopleError || allocError || upcomingError || appSettingsError;
  const { people, skills, skillLevels, lockedPeople = {} } = peopleData;
  const { projects, allocations } = allocData;
  const { upcoming } = upcomingData;
  const { logRetentionDays = 30, clearLog = [] } = appSettingsData;

  const CLEAR_LABELS = {
    "people-skills": "Skill matrix",
    "projects-allocations": "Current utilisation",
    "upcoming-projects": "Forward capacity",
    all: "All resourcing data",
  };

  const clearScope = async (scope) => {
    if (scope === "people-skills" || scope === "all") {
      await setPeopleData({ people: [], skills: [], skillLevels: {}, lockedPeople: {} });
    }
    if (scope === "projects-allocations" || scope === "all") {
      await setAllocData({ projects: [], allocations: {} });
    }
    if (scope === "upcoming-projects" || scope === "all") {
      await setUpcomingData({ upcoming: [] });
    }
    const entry = { id: `log${Date.now()}`, scope, label: CLEAR_LABELS[scope], clearedAt: new Date().toISOString() };
    const nextLog = [entry, ...pruneClearLog(clearLog, logRetentionDays)];
    await setAppSettingsData({ logRetentionDays, clearLog: nextLog });
  };

  const totalsByPerson = useMemo(() => {
    const totals = {};
    people.forEach((p) => {
      totals[p.id] = projects.reduce(
        (sum, pr) => sum + segmentsTotalPct(allocations[`${p.id}|${pr.id}`]),
        0
      );
    });
    return totals;
  }, [people, projects, allocations]);

  const chartData = useMemo(
    () =>
      people.map((p) => {
        const row = { name: p.name.replace("Team Member ", "TM"), total: totalsByPerson[p.id] };
        projects.forEach((pr) => {
          row[pr.name] = segmentsTotalPct(allocations[`${p.id}|${pr.id}`]);
        });
        return row;
      }),
    [people, projects, allocations, totalsByPerson]
  );

  const capacityData = useMemo(
    () =>
      people.map((p) => ({
        name: p.name.replace("Team Member ", "TM"),
        available: Math.max(0, 100 - totalsByPerson[p.id]),
        overCommitted: totalsByPerson[p.id] > 100,
      })),
    [people, totalsByPerson]
  );

  const projectColors = ["#2E6F6E", "#7A9E64", "#B8792E", "#5B7DA6", "#9A6B9E", "#AD4A32"];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--sans)", color: "var(--text)", background: "var(--bg)" }}>
      <style>{TOKENS}{`
        .rd-sidebar-btn { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:10px 14px; border:none; background:transparent; color:var(--sidebar-text); border-left:3px solid transparent; cursor:pointer; font-size:13.5px; font-family:var(--sans); border-radius:0; }
        .rd-sidebar-btn:hover { color:var(--sidebar-text-active); }
        .rd-sidebar-btn.active { color:var(--sidebar-text-active); border-left-color:var(--sidebar-accent); background:rgba(255,255,255,0.04); }
        .rd-table { border-collapse:collapse; width:100%; font-size:13px; }
        .rd-table th, .rd-table td { border:1px solid var(--border); padding:8px 10px; text-align:center; }
        .rd-table th { background:var(--panel); font-weight:600; font-size:12px; color:var(--text-muted); }
        .rd-table td.rowhead, .rd-table th.corner { text-align:left; position:sticky; left:0; background:var(--panel); z-index:1; }
        .rd-cell-btn { width:100%; height:100%; border:none; cursor:pointer; padding:6px 0; font-family:var(--mono); font-size:12px; color:var(--text); background:transparent; }
        .rd-input { font-family:var(--mono); font-size:13px; width:56px; text-align:center; border:1px solid var(--border); border-radius:3px; padding:3px 2px; background:var(--panel); color:var(--text); }
        .rd-date { font-family:var(--sans); font-size:11px; width:118px; text-align:center; border:1px solid var(--border); border-radius:3px; padding:2px; background:var(--panel); color:var(--text-muted); }
        .rd-tag { display:inline-block; padding:2px 8px; border-radius:3px; background:var(--accent-light); color:var(--accent); font-size:11.5px; margin:2px 3px 0 0; }
        .rd-add-btn { display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--accent); background:none; border:1px dashed var(--border); border-radius:4px; padding:6px 10px; cursor:pointer; }
        .rd-remove-btn { border:none; background:none; cursor:pointer; color:var(--text-muted); padding:2px; }
        .rd-remove-btn:hover { color:var(--danger); }
        input.rd-text { font-family:var(--sans); font-size:13px; border:1px solid var(--border); border-radius:4px; padding:5px 8px; background:var(--panel); color:var(--text); }
        @media (max-width: 720px) {
          .rd-shell { flex-direction:column; }
          .rd-sidebar { width:100% !important; flex-direction:row !important; overflow-x:auto; }
        }
      `}</style>

      <div className="rd-shell" style={{ display: "flex", width: "100%" }}>
        <div className="rd-sidebar" style={{ width: 210, background: "var(--sidebar)", display: "flex", flexDirection: "column", flexShrink: 0, paddingTop: 20 }}>
          <div style={{ padding: "0 16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>Resourcing</div>
            <div style={{ color: "var(--sidebar-text)", fontSize: 11.5, marginTop: 2 }}>Skills & allocation</div>
          </div>
          <button className={`rd-sidebar-btn ${tab === "skills" ? "active" : ""}`} onClick={() => setTab("skills")}>
            <Grid3x3 size={15} /> Skill matrix
          </button>
          <button className={`rd-sidebar-btn ${tab === "current" ? "active" : ""}`} onClick={() => setTab("current")}>
            <Activity size={15} /> Current utilisation
          </button>
          <button className={`rd-sidebar-btn ${tab === "forward" ? "active" : ""}`} onClick={() => setTab("forward")}>
            <TrendingUp size={15} /> Forward capacity
          </button>
          <button className={`rd-sidebar-btn ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}>
            <FileDown size={15} /> Reports
          </button>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "10px 0" }} />
          <button className={`rd-sidebar-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
            <Settings size={15} /> Settings
          </button>
          <div style={{ marginTop: "auto", padding: "14px 16px", fontSize: 10.5, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
            Live shared data. Anyone with this URL can view and edit, there is no login.
          </div>
        </div>

        <div style={{ flex: 1, padding: "28px 32px", overflowX: "auto" }}>
          {connectionError && (
            <div style={{ background: "var(--danger-light)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 6, padding: "10px 14px", fontSize: 12.5, marginBottom: 16 }}>
              Could not reach Supabase: {connectionError}. Check VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and that the resourcing_data table exists (see README.md).
            </div>
          )}
          {!loaded ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
          ) : tab === "skills" ? (
            <SkillMatrix
              people={people}
              skills={skills}
              skillLevels={skillLevels}
              lockedPeople={lockedPeople}
              onChange={(next) => setPeopleData({ people, skills, skillLevels: next, lockedPeople })}
              onAddPerson={(person) => setPeopleData({ people: [...people, person], skills, skillLevels, lockedPeople })}
              onAddSkill={(skill) => setPeopleData({ people, skills: [...skills, skill], skillLevels, lockedPeople })}
              onRemovePerson={(id) => setPeopleData({ people: people.filter((p) => p.id !== id), skills, skillLevels, lockedPeople })}
              onRemoveSkill={(id) => setPeopleData({ people, skills: skills.filter((s) => s.id !== id), skillLevels, lockedPeople })}
              onToggleLock={(personId) => setPeopleData({ people, skills, skillLevels, lockedPeople: { ...lockedPeople, [personId]: !lockedPeople[personId] } })}
              onUpdatePerson={(id, updates) => setPeopleData({ people: people.map((p) => (p.id === id ? { ...p, ...updates } : p)), skills, skillLevels, lockedPeople })}
            />
          ) : tab === "current" ? (
            <CurrentUtilisation
              people={people}
              projects={projects}
              allocations={allocations}
              totalsByPerson={totalsByPerson}
              chartData={chartData}
              projectColors={projectColors}
              onChangeAllocations={(next) => setAllocData({ projects, allocations: next })}
              onAddProject={(project) => setAllocData({ projects: [...projects, project], allocations })}
              onRemoveProject={(id) => setAllocData({ projects: projects.filter((p) => p.id !== id), allocations })}
            />
          ) : tab === "forward" ? (
            <ForwardCapacity
              people={people}
              skills={skills}
              skillLevels={skillLevels}
              upcoming={upcoming}
              capacityData={capacityData}
              totalsByPerson={totalsByPerson}
              onAddUpcoming={(proj) => setUpcomingData({ upcoming: [...upcoming, proj] })}
              onRemoveUpcoming={(id) => setUpcomingData({ upcoming: upcoming.filter((u) => u.id !== id) })}
            />
          ) : tab === "reports" ? (
            <ReportsPage
              people={people}
              skills={skills}
              skillLevels={skillLevels}
              projects={projects}
              allocations={allocations}
              totalsByPerson={totalsByPerson}
            />
          ) : (
            <SettingsPage
              people={people}
              skills={skills}
              projects={projects}
              upcoming={upcoming}
              logRetentionDays={logRetentionDays}
              clearLog={clearLog}
              onClearScope={clearScope}
              onSetRetentionDays={(days) => setAppSettingsData({ logRetentionDays: days, clearLog })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Skill matrix ----------
function SkillMatrix({ people, skills, skillLevels, lockedPeople, onChange, onAddPerson, onAddSkill, onRemovePerson, onRemoveSkill, onToggleLock, onUpdatePerson }) {
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", role: "" });

  const addPerson = () => {
    if (!newPersonName.trim()) return;
    onAddPerson({ id: `p${Date.now()}`, name: newPersonName.trim(), role: newPersonRole.trim() });
    setNewPersonName("");
    setNewPersonRole("");
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditDraft({ name: p.name, role: p.role });
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = () => {
    if (!editDraft.name.trim()) return;
    onUpdatePerson(editingId, { name: editDraft.name.trim(), role: editDraft.role.trim() });
    setEditingId(null);
  };

  const cycle = (personId, skillId) => {
    if (lockedPeople[personId]) return;
    const key = `${personId}|${skillId}`;
    const current = skillLevels[key] || 0;
    const next = (current + 1) % 5;
    onChange({ ...skillLevels, [key]: next });
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Skill matrix</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Click a cell to cycle proficiency: None, Basic, Working, Advanced, Expert. Lock a row to stop it from being changed.
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th className="corner">Team member</th>
              {skills.map((s) => (
                <th key={s.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span>{s.name}</span>
                    <button className="rd-remove-btn" onClick={() => onRemoveSkill(s.id)} title="Remove skill">
                      <X size={11} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const locked = !!lockedPeople[p.id];
              return (
                <tr key={p.id}>
                  <td className="rowhead">
                    {editingId === p.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <input
                          className="rd-text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          style={{ fontSize: 13, padding: "4px 6px" }}
                          autoFocus
                        />
                        <input
                          className="rd-text"
                          placeholder="Role"
                          value={editDraft.role}
                          onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          style={{ fontSize: 12, padding: "4px 6px" }}
                        />
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="rd-remove-btn" onClick={saveEdit} title="Save"><Save size={13} /></button>
                          <button className="rd-remove-btn" onClick={cancelEdit} title="Cancel"><XCircle size={13} /></button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.role}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button className="rd-remove-btn" onClick={() => startEdit(p)} title="Edit team member">
                            <Pencil size={12} />
                          </button>
                          <button
                            className="rd-remove-btn"
                            onClick={() => onToggleLock(p.id)}
                            title={locked ? "Unlock proficiency editing" : "Lock proficiency editing"}
                            style={{ color: locked ? "var(--warn)" : "var(--text-muted)" }}
                          >
                            {locked ? <Lock size={12} /> : <Unlock size={12} />}
                          </button>
                          <button className="rd-remove-btn" onClick={() => onRemovePerson(p.id)} title="Remove person">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  {skills.map((s) => {
                    const level = skillLevels[`${p.id}|${s.id}`] || 0;
                    return (
                      <td key={s.id} style={{ padding: 0, background: levelColor(level) }}>
                        <button
                          className="rd-cell-btn"
                          onClick={() => cycle(p.id, s.id)}
                          title={locked ? "Locked" : LEVEL_LABELS[level]}
                          disabled={locked}
                          style={{ cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.6 : 1 }}
                        >
                          {level === 0 ? "-" : LEVEL_LABELS[level]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input className="rd-text" placeholder="New team member name" value={newPersonName}
          onChange={(e) => setNewPersonName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addPerson(); }} style={{ minWidth: 180 }} />
        <input className="rd-text" placeholder="Role" value={newPersonRole}
          onChange={(e) => setNewPersonRole(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addPerson(); }} style={{ minWidth: 160 }} />
        <button className="rd-add-btn" onClick={addPerson}><Plus size={13} /> Add member</button>

        <AddRow placeholder="New skill name" value={newSkill} setValue={setNewSkill}
          onAdd={() => { if (newSkill.trim()) { onAddSkill({ id: `s${Date.now()}`, name: newSkill.trim() }); setNewSkill(""); } }} />
      </div>
    </div>
  );
}

// ---------- Current utilisation ----------
function CurrentUtilisation({ people, projects, allocations, totalsByPerson, chartData, projectColors, onChangeAllocations, onAddProject, onRemoveProject }) {
  const [newProject, setNewProject] = useState("");
  const [newProjectStart, setNewProjectStart] = useState("");
  const [newProjectEnd, setNewProjectEnd] = useState("");

  const setSegmentField = (personId, projectId, segId, field, value) => {
    const key = `${personId}|${projectId}`;
    const segments = toSegments(allocations[key]);
    const exists = segments.some((seg) => seg.id === segId);
    const nextSegments = exists
      ? segments.map((seg) =>
          seg.id === segId ? { ...seg, [field]: value, ...(field === "confirmed" ? {} : { confirmed: false }) } : seg
        )
      : [...segments, { id: segId, pct: 0, startDate: "", endDate: "", confirmed: false, [field]: value }];
    onChangeAllocations({ ...allocations, [key]: nextSegments });
  };

  const addSegment = (personId, projectId) => {
    const key = `${personId}|${projectId}`;
    const segments = toSegments(allocations[key]);
    onChangeAllocations({
      ...allocations,
      [key]: [...segments, { id: `seg${Date.now()}`, pct: 0, startDate: "", endDate: "", confirmed: false }],
    });
  };

  const removeSegment = (personId, projectId, segId) => {
    const key = `${personId}|${projectId}`;
    onChangeAllocations({ ...allocations, [key]: toSegments(allocations[key]).filter((seg) => seg.id !== segId) });
  };

  const addProject = () => {
    if (!newProject.trim()) return;
    onAddProject({ id: `pr${Date.now()}`, name: newProject.trim(), startDate: newProjectStart, endDate: newProjectEnd });
    setNewProject("");
    setNewProjectStart("");
    setNewProjectEnd("");
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Current utilisation</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Allocation percentage (with FTE) and dates per project, per team member. Use "Split" to add a second time-phased
          segment for fractional or ramping allocations. Totals above 100% are flagged.
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 22 }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th className="corner">Team member</th>
              {projects.map((pr) => (
                <th key={pr.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span>{pr.name}</span>
                    <button className="rd-remove-btn" onClick={() => onRemoveProject(pr.id)} title="Remove project">
                      <X size={11} />
                    </button>
                  </div>
                  {(pr.startDate || pr.endDate) && (
                    <div style={{ fontSize: 10.5, fontWeight: 400, color: "var(--text-muted)", marginTop: 3 }}>
                      {formatDate(pr.startDate) || "?"} &ndash; {formatDate(pr.endDate) || "?"}
                    </div>
                  )}
                </th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const total = totalsByPerson[p.id];
              return (
                <tr key={p.id}>
                  <td className="rowhead">
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.role}</div>
                  </td>
                  {projects.map((pr) => {
                    const key = `${p.id}|${pr.id}`;
                    const rawSegments = toSegments(allocations[key]);
                    const segments = rawSegments.length ? rawSegments : [{ id: "seg1", pct: 0, startDate: "", endDate: "", confirmed: false }];
                    const cellTotal = segmentsTotalPct(allocations[key]);
                    return (
                      <td key={pr.id}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 128 }}>
                          {segments.map((seg, idx) => {
                            const outOfWindow = isOutsideWindow(seg.startDate, seg.endDate, pr.startDate, pr.endDate);
                            return (
                              <div
                                key={seg.id}
                                style={{
                                  paddingBottom: idx < segments.length - 1 ? 6 : 0,
                                  borderBottom: idx < segments.length - 1 ? "1px dashed var(--border)" : "none",
                                  background: outOfWindow ? "var(--danger-light)" : undefined,
                                  borderRadius: outOfWindow ? 4 : undefined,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                                  <input
                                    className="rd-input"
                                    type="number"
                                    step="0.1"
                                    value={seg.pct}
                                    onChange={(e) => setSegmentField(p.id, pr.id, seg.id, "pct", Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
                                  />
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>
                                  {rawSegments.length > 1 && (
                                    <button className="rd-remove-btn" onClick={() => removeSegment(p.id, pr.id, seg.id)} title="Remove this split">
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                                <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{fte(seg.pct)} FTE</div>

                                {seg.confirmed ? (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 3 }}>
                                    <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                                      {formatDate(seg.startDate)} &rarr; {formatDate(seg.endDate)}
                                    </span>
                                    <button
                                      className="rd-remove-btn"
                                      onClick={() => setSegmentField(p.id, pr.id, seg.id, "confirmed", false)}
                                      title="Edit split dates"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                                    <input
                                      className="rd-date"
                                      type="date"
                                      title="Split start date"
                                      value={seg.startDate}
                                      onChange={(e) => setSegmentField(p.id, pr.id, seg.id, "startDate", e.target.value)}
                                    />
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>&rarr;</span>
                                    <input
                                      className="rd-date"
                                      type="date"
                                      title="Split end date"
                                      value={seg.endDate}
                                      onChange={(e) => setSegmentField(p.id, pr.id, seg.id, "endDate", e.target.value)}
                                    />
                                    <button
                                      className="rd-remove-btn"
                                      onClick={() => seg.startDate && seg.endDate && setSegmentField(p.id, pr.id, seg.id, "confirmed", true)}
                                      title={seg.startDate && seg.endDate ? "Confirm split dates" : "Set both dates to confirm"}
                                      disabled={!seg.startDate || !seg.endDate}
                                      style={{ color: seg.startDate && seg.endDate ? "var(--accent)" : "var(--border)", cursor: seg.startDate && seg.endDate ? "pointer" : "not-allowed" }}
                                    >
                                      <Check size={12} />
                                    </button>
                                  </div>
                                )}

                                {outOfWindow && (
                                  <div
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 3, color: "var(--danger)", fontSize: 10 }}
                                    title="Split dates fall outside the project's duration"
                                  >
                                    <AlertTriangle size={11} /> Outside window
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <button
                            className="rd-remove-btn"
                            onClick={() => addSegment(p.id, pr.id)}
                            title="Add another split for this person on this project"
                            style={{ fontSize: 10.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
                          >
                            <Plus size={10} /> Split
                          </button>

                          {segments.length > 1 && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: pctColor(cellTotal) }}>Total {cellTotal}%</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: pctColor(total) }}>
                    {total}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="rd-text"
          placeholder="New project name"
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addProject(); }}
          style={{ minWidth: 200 }}
        />
        <input className="rd-text" type="date" title="Project start date" value={newProjectStart} onChange={(e) => setNewProjectStart(e.target.value)} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
        <input className="rd-text" type="date" title="Project end date" value={newProjectEnd} onChange={(e) => setNewProjectEnd(e.target.value)} />
        <button className="rd-add-btn" onClick={addProject}><Plus size={13} /> Add</button>
      </div>

      <div style={{ marginTop: 26, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "18px 20px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Allocation by person</div>
        <ResponsiveContainer width="100%" height={Math.max(220, people.length * 46)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {projects.map((pr, i) => (
              <Bar key={pr.id} dataKey={pr.name} stackId="a" fill={projectColors[i % projectColors.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------- Forward capacity ----------
function ForwardCapacity({ people, skills, skillLevels, upcoming, capacityData, totalsByPerson, onAddUpcoming, onRemoveUpcoming }) {
  const [newName, setNewName] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);

  const toggleSkill = (id) => {
    setSelectedSkillIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const rank = (project) => {
    return people
      .map((p) => {
        const relevant = project.requiredSkillIds.length
          ? project.requiredSkillIds
          : skills.map((s) => s.id);
        const avgSkill =
          relevant.reduce((sum, sid) => sum + (skillLevels[`${p.id}|${sid}`] || 0), 0) / relevant.length;
        const available = Math.max(0, 100 - totalsByPerson[p.id]);
        const score = (avgSkill / 4) * 0.7 + (available / 100) * 0.3;
        return { person: p, avgSkill, available, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Forward capacity</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Available capacity today, and suggested fits for upcoming work based on skill level and free capacity.
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Available capacity by person</div>
        <ResponsiveContainer width="100%" height={Math.max(200, people.length * 40)}>
          <BarChart data={capacityData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
            <Tooltip />
            <Bar dataKey="available">
              {capacityData.map((d, i) => (
                <Cell key={i} fill={d.overCommitted ? "var(--danger)" : "var(--accent)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Upcoming projects</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {upcoming.map((proj) => {
          const candidates = rank(proj);
          return (
            <div key={proj.id} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{proj.name}</div>
                  {proj.note && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{proj.note}</div>}
                  <div style={{ marginTop: 8 }}>
                    {proj.requiredSkillIds.map((sid) => {
                      const skill = skills.find((s) => s.id === sid);
                      return skill ? <span key={sid} className="rd-tag">{skill.name}</span> : null;
                    })}
                  </div>
                </div>
                <button className="rd-remove-btn" onClick={() => onRemoveUpcoming(proj.id)} title="Remove project">
                  <X size={14} />
                </button>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {candidates.map((c) => (
                  <div key={c.person.id} style={{ border: "1px solid var(--border)", borderRadius: 5, padding: "8px 12px", minWidth: 150 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.person.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      avg skill {c.avgSkill.toFixed(1)}/4 · {c.available}% free
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add upcoming project</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input className="rd-text" placeholder="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ minWidth: 220 }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Required skills</div>
          {skills.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSkill(s.id)}
              className="rd-tag"
              style={{
                border: "1px solid var(--border)",
                cursor: "pointer",
                background: selectedSkillIds.includes(s.id) ? "var(--accent)" : "var(--accent-light)",
                color: selectedSkillIds.includes(s.id) ? "#fff" : "var(--accent)",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button
          className="rd-add-btn"
          onClick={() => {
            if (!newName.trim()) return;
            onAddUpcoming({ id: `u${Date.now()}`, name: newName.trim(), requiredSkillIds: selectedSkillIds, note: "" });
            setNewName("");
            setSelectedSkillIds([]);
          }}
        >
          <Plus size={13} /> Add project
        </button>
      </div>
    </div>
  );
}

// ---------- Reports ----------
function ReportsPage({ people, skills, skillLevels, projects, allocations, totalsByPerson }) {
  const stamp = new Date().toISOString().slice(0, 10);

  const cards = [
    {
      key: "skills",
      label: "Skills report",
      detail: `Proficiency levels for ${people.length} team members across ${skills.length} skills`,
      onDownload: () => downloadCSV(`skills-report-${stamp}.csv`, buildSkillsReport(people, skills, skillLevels)),
    },
    {
      key: "allocation",
      label: "Allocation report",
      detail: `${projects.length} projects · every allocation split with %, FTE and dates`,
      onDownload: () => downloadCSV(`allocation-report-${stamp}.csv`, buildAllocationReport(people, projects, allocations)),
    },
    {
      key: "utilisation",
      label: "Utilisation report",
      detail: `Total allocation and available capacity per team member`,
      onDownload: () => downloadCSV(`utilisation-report-${stamp}.csv`, buildUtilisationReport(people, totalsByPerson)),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Reports</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Download data as CSV, individually or all at once.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {cards.map((c) => (
          <div key={c.key} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.detail}</div>
            </div>
            <button className="rd-add-btn" onClick={c.onDownload}>
              <FileDown size={13} /> Download CSV
            </button>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: 6, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--accent)" }}>Consolidated report</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>All three reports combined into a single CSV file, in labelled sections.</div>
        </div>
        <button
          className="rd-add-btn"
          style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
          onClick={() => downloadCSV(`resourcing-consolidated-report-${stamp}.csv`, buildConsolidatedReport(people, skills, skillLevels, projects, allocations, totalsByPerson))}
        >
          <FileDown size={13} /> Download consolidated CSV
        </button>
      </div>
    </div>
  );
}

// ---------- Settings ----------
function SettingsPage({ people, skills, projects, upcoming, logRetentionDays, clearLog, onClearScope, onSetRetentionDays }) {
  const [pendingScope, setPendingScope] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retentionDraft, setRetentionDraft] = useState(String(logRetentionDays));

  useEffect(() => {
    setRetentionDraft(String(logRetentionDays));
  }, [logRetentionDays]);

  const openConfirm = (scope) => {
    setPendingScope(scope);
    setPassword("");
    setError("");
  };
  const cancelConfirm = () => {
    setPendingScope(null);
    setPassword("");
    setError("");
  };

  const confirmClear = async () => {
    if (password !== CLEAR_DATA_PASSWORD) {
      setError("Incorrect password.");
      return;
    }
    setBusy(true);
    await onClearScope(pendingScope);
    setBusy(false);
    cancelConfirm();
  };

  const commitRetention = () => {
    const num = Math.max(1, Math.min(365, Number(retentionDraft) || logRetentionDays));
    setRetentionDraft(String(num));
    if (num !== logRetentionDays) onSetRetentionDays(num);
  };

  const visibleLog = pruneClearLog(clearLog, logRetentionDays);

  const cards = [
    { key: "people-skills", label: "Skill matrix data", detail: `${people.length} team members · ${skills.length} skills · all proficiency levels` },
    { key: "projects-allocations", label: "Current utilisation data", detail: `${projects.length} projects · all allocation percentages and dates` },
    { key: "upcoming-projects", label: "Forward capacity data", detail: `${upcoming.length} upcoming projects` },
    { key: "all", label: "Everything", detail: "All of the above, across the whole dashboard" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Settings</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Clear stored data. This updates the shared data for everyone immediately and cannot be undone.
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Danger zone</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {cards.map((c) => (
          <div key={c.key} style={{ background: "var(--panel)", border: "1px solid var(--danger)", borderRadius: 6, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.detail}</div>
              </div>
              {pendingScope !== c.key && (
                <button className="rd-add-btn" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => openConfirm(c.key)}>
                  <Trash2 size={13} /> Clear
                </button>
              )}
            </div>

            {pendingScope === c.key && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }}>
                  <ShieldAlert size={13} /> Enter the password to permanently clear this data.
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ position: "relative" }}>
                    <input
                      className="rd-text"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmClear(); }}
                      style={{ minWidth: 180, paddingRight: 30 }}
                      autoFocus
                    />
                    <button
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? "Hide password" : "Show password"}
                      style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button className="rd-add-btn" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={confirmClear} disabled={busy}>
                    <Trash2 size={13} /> {busy ? "Clearing..." : "Confirm clear"}
                  </button>
                  <button className="rd-remove-btn" onClick={cancelConfirm} style={{ fontSize: 12.5 }}>Cancel</button>
                </div>
                {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <History size={15} /> Clear log
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
        Keep entries for
        <input
          className="rd-input"
          style={{ width: 50 }}
          type="number"
          value={retentionDraft}
          onChange={(e) => setRetentionDraft(e.target.value)}
          onBlur={commitRetention}
          onKeyDown={(e) => { if (e.key === "Enter") commitRetention(); }}
        />
        days
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Cleared</th>
              <th style={{ textAlign: "left" }}>When</th>
            </tr>
          </thead>
          <tbody>
            {visibleLog.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ textAlign: "left", color: "var(--text-muted)", fontStyle: "italic" }}>
                  No clear events recorded in the last {logRetentionDays} day{logRetentionDays === 1 ? "" : "s"}.
                </td>
              </tr>
            ) : (
              visibleLog.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ textAlign: "left" }}>{entry.label}</td>
                  <td style={{ textAlign: "left", fontFamily: "var(--mono)", fontSize: 12 }}>{new Date(entry.clearedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Shared small components ----------
function AddRow({ placeholder, value, setValue, onAdd }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input className="rd-text" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }} style={{ minWidth: 200 }} />
      <button className="rd-add-btn" onClick={onAdd}><Plus size={13} /> Add</button>
    </div>
  );
}

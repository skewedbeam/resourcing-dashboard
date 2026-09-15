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
import { Grid3x3, Activity, TrendingUp, Plus, X, Lock, Unlock, Check, Pencil, AlertTriangle } from "lucide-react";
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

// Sample allocation dates, including a couple deliberately outside their
// project's window and one left unconfirmed, to demonstrate the alert and
// the confirm/edit toggle.
const SEED_ALLOCATIONS = {
  "p1|pr1": { pct: 60, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true },
  "p1|pr2": { pct: 20, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: true },
  "p2|pr1": { pct: 80, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true },
  "p3|pr2": { pct: 70, startDate: "2026-03-02", endDate: "2026-07-15", confirmed: true },
  "p4|pr1": { pct: 40, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true },
  "p4|pr2": { pct: 30, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: false },
  "p5|pr1": { pct: 50, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true },
  "p5|pr2": { pct: 50, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: true },
  "p6|pr1": { pct: 30, startDate: "2025-12-15", endDate: "2026-08-28", confirmed: true },
};

const SEED_LOCKED_PEOPLE = { p1: true, p2: true };

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

// Allocation entries used to be a bare percentage number; they are now
// { pct, startDate, endDate }. These helpers read either shape safely.
function allocPct(entry) {
  if (typeof entry === "number") return entry;
  return entry?.pct || 0;
}
function allocStart(entry) {
  return typeof entry === "object" && entry ? entry.startDate || "" : "";
}
function allocEnd(entry) {
  return typeof entry === "object" && entry ? entry.endDate || "" : "";
}
function allocConfirmed(entry) {
  return typeof entry === "object" && entry ? !!entry.confirmed : false;
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

  const loaded = peopleLoaded && allocLoaded && upcomingLoaded;
  const connectionError = peopleError || allocError || upcomingError;
  const { people, skills, skillLevels, lockedPeople = {} } = peopleData;
  const { projects, allocations } = allocData;
  const { upcoming } = upcomingData;

  const totalsByPerson = useMemo(() => {
    const totals = {};
    people.forEach((p) => {
      totals[p.id] = projects.reduce(
        (sum, pr) => sum + allocPct(allocations[`${p.id}|${pr.id}`]),
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
          row[pr.name] = allocPct(allocations[`${p.id}|${pr.id}`]);
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
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Skill matrix ----------
function SkillMatrix({ people, skills, skillLevels, lockedPeople, onChange, onAddPerson, onAddSkill, onRemovePerson, onRemoveSkill, onToggleLock }) {
  const [newPerson, setNewPerson] = useState("");
  const [newSkill, setNewSkill] = useState("");

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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.role}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <AddRow placeholder="New team member name" value={newPerson} setValue={setNewPerson}
          onAdd={() => { if (newPerson.trim()) { onAddPerson({ id: `p${Date.now()}`, name: newPerson.trim(), role: "" }); setNewPerson(""); } }} />
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

  const setPct = (personId, projectId, value) => {
    const num = Math.max(0, Math.min(999, Number(value) || 0));
    const key = `${personId}|${projectId}`;
    const existing = allocations[key];
    onChangeAllocations({
      ...allocations,
      [key]: { pct: num, startDate: allocStart(existing), endDate: allocEnd(existing) },
    });
  };

  const setAllocDate = (personId, projectId, field, value) => {
    const key = `${personId}|${projectId}`;
    const existing = allocations[key];
    onChangeAllocations({
      ...allocations,
      [key]: { pct: allocPct(existing), startDate: allocStart(existing), endDate: allocEnd(existing), confirmed: false, [field]: value },
    });
  };

  const setConfirmed = (personId, projectId, value) => {
    const key = `${personId}|${projectId}`;
    const existing = allocations[key];
    onChangeAllocations({
      ...allocations,
      [key]: { pct: allocPct(existing), startDate: allocStart(existing), endDate: allocEnd(existing), confirmed: value },
    });
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
          Allocation percentage and allocated dates per project, per team member. Totals above 100% are flagged.
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
                    const entry = allocations[key];
                    const start = allocStart(entry);
                    const end = allocEnd(entry);
                    const confirmed = allocConfirmed(entry);
                    const outOfWindow = isOutsideWindow(start, end, pr.startDate, pr.endDate);
                    return (
                      <td key={pr.id} style={outOfWindow ? { background: "var(--danger-light)" } : undefined}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                          <input
                            className="rd-input"
                            type="number"
                            value={allocPct(entry)}
                            onChange={(e) => setPct(p.id, pr.id, e.target.value)}
                          />
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>
                        </div>

                        {confirmed ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
                            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                              {formatDate(start)} &rarr; {formatDate(end)}
                            </span>
                            <button
                              className="rd-remove-btn"
                              onClick={() => setConfirmed(p.id, pr.id, false)}
                              title="Edit allocation dates"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                            <input
                              className="rd-date"
                              type="date"
                              title="Allocation start date"
                              value={start}
                              onChange={(e) => setAllocDate(p.id, pr.id, "startDate", e.target.value)}
                            />
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>&rarr;</span>
                            <input
                              className="rd-date"
                              type="date"
                              title="Allocation end date"
                              value={end}
                              onChange={(e) => setAllocDate(p.id, pr.id, "endDate", e.target.value)}
                            />
                            <button
                              className="rd-remove-btn"
                              onClick={() => start && end && setConfirmed(p.id, pr.id, true)}
                              title={start && end ? "Confirm allocation dates" : "Set both dates to confirm"}
                              disabled={!start || !end}
                              style={{ color: start && end ? "var(--accent)" : "var(--border)", cursor: start && end ? "pointer" : "not-allowed" }}
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        )}

                        {outOfWindow && (
                          <div
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 3, color: "var(--danger)", fontSize: 10 }}
                            title="Allocation dates fall outside the project's duration"
                          >
                            <AlertTriangle size={11} /> Outside project window
                          </div>
                        )}
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

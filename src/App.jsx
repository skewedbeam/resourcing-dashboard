import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { Grid3x3, Activity, TrendingUp, Plus, X, Lock, Unlock, Check, Pencil, AlertTriangle, Settings, Trash2, History, ShieldAlert, Eye, EyeOff, FileDown, Save, XCircle, FileText, ThumbsUp, ThumbsDown, GanttChart, Briefcase, KeyRound, LayoutDashboard, Users, Gauge, UploadCloud, LogOut, BookOpen, FileSpreadsheet, Upload, DollarSign } from "lucide-react";
import { supabase } from "./supabaseClient";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
  { id: "pr1", name: "Core Banking Migration - Client A", startDate: "2026-01-05", endDate: "2026-08-28", requiredSkillIds: ["s1", "s3", "s4"], proposedFte: 2.5 },
  { id: "pr2", name: "Intranet Modernisation - Client B", startDate: "2026-03-02", endDate: "2026-06-26", requiredSkillIds: ["s2"], proposedFte: 1.5 },
];

// Each allocation is an array of splits/segments (fractional FTE, time-phased),
// including a couple deliberately outside their project's window, one left
// unconfirmed, one split into multiple segments, and one with a "proposed"
// segment alongside its "current" one - to demonstrate the alert, the
// confirm/edit toggle, the split feature, and the current/proposed compare.
const SEED_ALLOCATIONS = {
  "p1|pr1": [{ id: "seg1", pct: 60, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true, status: "current" }],
  "p1|pr2": [
    { id: "seg1", pct: 20, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: true, status: "current" },
    { id: "seg2", pct: 40, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: false, status: "proposed" },
  ],
  "p2|pr1": [
    { id: "seg1", pct: 37.5, startDate: "2026-01-05", endDate: "2026-04-30", confirmed: true, status: "current" },
    { id: "seg2", pct: 80, startDate: "2026-05-01", endDate: "2026-08-28", confirmed: true, status: "current" },
  ],
  "p3|pr2": [{ id: "seg1", pct: 70, startDate: "2026-03-02", endDate: "2026-07-15", confirmed: true, status: "current" }],
  "p4|pr1": [{ id: "seg1", pct: 40, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true, status: "current" }],
  "p4|pr2": [{ id: "seg1", pct: 30, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: false, status: "current" }],
  "p5|pr1": [{ id: "seg1", pct: 50, startDate: "2026-01-05", endDate: "2026-08-28", confirmed: true, status: "current" }],
  "p5|pr2": [{ id: "seg1", pct: 50, startDate: "2026-03-02", endDate: "2026-06-26", confirmed: true, status: "current" }],
  "p6|pr1": [{ id: "seg1", pct: 30, startDate: "2025-12-15", endDate: "2026-08-28", confirmed: true, status: "current" }],
};

const SEED_LOCKED_PEOPLE = { p1: true, p2: true };

const SEED_APP_SETTINGS = { logRetentionDays: 30, clearLog: [] };

// Client-side gates only (this app has no login/backend) - deter accidental
// changes, not real access control. Set these to override the defaults.
const CLEAR_DATA_PASSWORD = import.meta.env.VITE_CLEAR_DATA_PASSWORD || "clear-data";
const EDIT_PASSWORD = import.meta.env.VITE_EDIT_PASSWORD || "edit-access";
const EDIT_UNLOCKED_KEY = "rd-edit-unlocked";

const SEED_UPCOMING = [
  { id: "u1", name: "Data Warehouse Build - Prospect C", requiredSkillIds: ["s5", "s3"], note: "Kickoff expected next quarter" },
  { id: "u2", name: "Core Banking RFP - Prospect D", requiredSkillIds: ["s1", "s4", "s6"], note: "Proposal stage" },
];

const LEVEL_LABELS = ["None", "Basic", "Working", "Advanced", "Expert"];

// Wrapping a tab's content in <fieldset disabled> is a one-line way to make
// every nested button/input inert in view-only mode, without threading a
// disabled prop through each component.
const FIELDSET_RESET = { border: "none", margin: 0, padding: 0, minWidth: 0 };

// ---------- Shared, realtime-synced state backed by Supabase ----------
// Table expected: resourcing_data (key text primary key, value jsonb not null, updated_at timestamptz)
// See README.md for the SQL to create this table.
function useSupabaseState(key, seed, enabled = true) {
  const [value, setValue] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;
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
  }, [key, enabled]);

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
// over its own date range: { id, pct, startDate, endDate, confirmed, status }.
// status is "current" (committed) or "proposed" (a draft change being
// compared against what's committed) - defaults to "current" for legacy data.
// Older data may still be a bare percentage number or a single object -
// these helpers normalize any of those shapes into a segment array.
function toSegments(entry) {
  if (entry == null) return [];
  if (Array.isArray(entry)) return entry;
  if (typeof entry === "number") return entry ? [{ id: "seg1", pct: entry, startDate: "", endDate: "", confirmed: false, status: "current" }] : [];
  return [{ id: entry.id || "seg1", pct: entry.pct || 0, startDate: entry.startDate || "", endDate: entry.endDate || "", confirmed: !!entry.confirmed, status: entry.status || "current" }];
}
function segmentsTotalPct(entry, statusFilter) {
  return toSegments(entry)
    .filter((seg) => (statusFilter ? (seg.status || "current") === statusFilter : true))
    .reduce((sum, seg) => sum + (Number(seg.pct) || 0), 0);
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
// True only once both dates are set and "to" is before "from" - an
// incomplete range (only one date picked yet) is not an error.
function isDateRangeInvalid(start, end) {
  return !!start && !!end && end < start;
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

function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Full-fidelity backup of every Supabase-backed bucket, restorable via
// importFullBackup below. This is separate from the Reports CSV/PDF exports,
// which are one-way summaries rather than round-trippable data.
function buildFullBackup(state) {
  return { format: "resourcing-app-backup", version: 2, exportedAt: new Date().toISOString(), ...state };
}

// ---------- Excel (Team + Skill Matrix) import/export ----------
// A narrower, spreadsheet-friendly companion to the JSON backup above: just
// the team roster and skill matrix, in a shape people can edit directly in
// Excel/Sheets rather than only through the app's UI.
function buildSkillMatrixWorkbook(people, skills, skillLevels) {
  const hasData = people.length > 0 && skills.length > 0;
  const skillNames = hasData ? skills.map((s) => s.name) : ["Example Skill A", "Example Skill B"];
  const teamRows = hasData
    ? people.map((p) => [p.name, p.role])
    : [["Jordan Lee", "Solution Architect"], ["Alex Kim", "Integration Developer"]];
  const matrixRows = hasData
    ? people.map((p) => [p.name, ...skills.map((s) => LEVEL_LABELS[skillLevels[`${p.id}|${s.id}`] || 0])])
    : [
        ["Jordan Lee", "Advanced", "Working"],
        ["Alex Kim", "Basic", "Expert"],
      ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["How to use this template"],
      [""],
      ['1. Edit the "Team" sheet - one row per team member: Name, Role.'],
      ['2. Edit the "Skill Matrix" sheet - one row per team member (Name must match the Team sheet), one column per skill.'],
      ["3. Skill Matrix cell values: None, Basic, Working, Advanced, or Expert (or 0-4). Blank counts as None."],
      ['4. To add a new skill, add a new column to "Skill Matrix" with the skill name as its header.'],
      ["5. Save as .xlsx and upload it from Settings -> Import from Excel."],
      [""],
      ["Importing replaces the current team, skills and proficiency levels for everyone - it does not merge with what's already there."],
    ]),
    "Read me"
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Name", "Role"], ...teamRows]), "Team");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Name", ...skillNames], ...matrixRows]), "Skill Matrix");
  return wb;
}

function parseSkillMatrixWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const teamSheet = wb.Sheets["Team"];
  const matrixSheet = wb.Sheets["Skill Matrix"];
  if (!teamSheet || !matrixSheet) {
    throw new Error('Workbook must have "Team" and "Skill Matrix" sheets - download the template from Settings for the expected format.');
  }

  const teamRows = XLSX.utils.sheet_to_json(teamSheet, { defval: "" });
  const people = teamRows
    .map((row) => ({ name: String(row.Name ?? row.name ?? "").trim(), role: String(row.Role ?? row.role ?? "").trim() }))
    .filter((p) => p.name);
  if (!people.length) throw new Error('No rows found in the "Team" sheet.');

  const matrixRows = XLSX.utils.sheet_to_json(matrixSheet, { defval: "" });
  const skillNameSet = new Set();
  matrixRows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key.trim().toLowerCase() !== "name") skillNameSet.add(key.trim());
    });
  });
  const skillNames = [...skillNameSet];

  const levelByLabel = {};
  LEVEL_LABELS.forEach((label, i) => {
    levelByLabel[label.toLowerCase()] = i;
  });

  const warnings = [];
  const skillEntries = [];
  matrixRows.forEach((row) => {
    const name = String(row.Name ?? row.name ?? "").trim();
    if (!name) return;
    skillNames.forEach((skillName) => {
      const raw = row[skillName];
      const value = raw == null ? "" : String(raw).trim();
      if (!value) return;
      let level;
      const asNumber = Number(value);
      if (levelByLabel[value.toLowerCase()] != null) {
        level = levelByLabel[value.toLowerCase()];
      } else if (!Number.isNaN(asNumber) && asNumber >= 0 && asNumber <= 4) {
        level = Math.round(asNumber);
      } else {
        warnings.push(`"${value}" for ${name} / ${skillName} isn't a recognised level (None/Basic/Working/Advanced/Expert or 0-4) - treated as None.`);
        level = 0;
      }
      if (level > 0) skillEntries.push({ personName: name, skillName, level });
    });
  });

  return { people, skillNames, skillEntries, warnings };
}

// Assigns ids for the imported roster/skills, reusing an existing id (and
// lock state) wherever a name matches what's already there, so unrelated
// data keyed by person/skill id - allocations, upcoming-project requirements
// - doesn't silently orphan itself on a routine re-import.
function reconcileImportedSkillMatrix(imported, existingPeople, existingSkills, existingLockedPeople) {
  const norm = (s) => s.trim().toLowerCase();
  const findPerson = (name) => existingPeople.find((p) => norm(p.name) === norm(name));
  const findSkill = (name) => existingSkills.find((s) => norm(s.name) === norm(name));

  const people = imported.people.map((p, i) => {
    const match = findPerson(p.name);
    return { id: match ? match.id : `p${Date.now()}_${i}`, name: p.name, role: p.role };
  });

  const skills = imported.skillNames.map((name, i) => {
    const match = findSkill(name);
    return { id: match ? match.id : `s${Date.now()}_${i}`, name };
  });

  const skillLevels = {};
  imported.skillEntries.forEach(({ personName, skillName, level }) => {
    const person = people.find((p) => norm(p.name) === norm(personName));
    const skill = skills.find((s) => norm(s.name) === norm(skillName));
    if (person && skill) skillLevels[`${person.id}|${skill.id}`] = level;
  });

  const lockedPeople = {};
  people.forEach((p) => {
    if (existingLockedPeople[p.id]) lockedPeople[p.id] = true;
  });

  return { people, skills, skillLevels, lockedPeople };
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

// Groups every allocation split by project, ordered by period (start date),
// for a "allocation by period per project" view rather than a flat dump.
function buildAllocationByProject(projects, people, allocations) {
  return projects.map((pr) => {
    const rows = [];
    people.forEach((p) => {
      toSegments(allocations[`${p.id}|${pr.id}`]).forEach((seg) => {
        if (!seg.pct && !seg.startDate && !seg.endDate) return;
        rows.push({
          person: p.name,
          pct: seg.pct,
          fteVal: fte(seg.pct),
          start: seg.startDate,
          end: seg.endDate,
          confirmed: seg.confirmed,
          status: seg.status || "current",
          outOfWindow: isOutsideWindow(seg.startDate, seg.endDate, pr.startDate, pr.endDate),
        });
      });
    });
    rows.sort((a, b) => (a.start || "9999-99-99").localeCompare(b.start || "9999-99-99"));
    const currentTotal = rows.filter((r) => r.status === "current").reduce((sum, r) => sum + (Number(r.pct) || 0), 0);
    const proposedTotal = rows.filter((r) => r.status === "proposed").reduce((sum, r) => sum + (Number(r.pct) || 0), 0);
    return { project: pr, rows, currentTotal, proposedTotal };
  });
}

function buildAllocationCSV(groupedByProject) {
  const header = ["Project", "Project duration", "Resource", "Allocation %", "FTE", "Start", "End", "Status", "Confirmed", "Outside project window"];
  const rows = [];
  groupedByProject.forEach(({ project, rows: segRows, currentTotal, proposedTotal }) => {
    if (!segRows.length) return;
    segRows.forEach((r) => {
      rows.push([
        project.name,
        `${formatDate(project.startDate) || "?"} - ${formatDate(project.endDate) || "?"}`,
        r.person,
        r.pct,
        r.fteVal,
        r.start,
        r.end,
        r.status === "proposed" ? "Proposed" : "Current",
        r.confirmed ? "Yes" : "No",
        r.outOfWindow ? "Yes" : "No",
      ]);
    });
    rows.push([project.name, "TOTAL", "", currentTotal, fte(currentTotal), "", "", proposedTotal ? `+${proposedTotal}% proposed (${fte(proposedTotal)} FTE)` : "", "", ""]);
  });
  return [header, ...rows];
}

function buildUtilisationReport(people, totalsByPerson, proposedTotalsByPerson) {
  const header = ["Team member", "Role", "Current %", "Current FTE", "Proposed %", "Proposed FTE", "Available %", "Status"];
  const rows = people.map((p) => {
    const total = totalsByPerson[p.id] || 0;
    const proposed = proposedTotalsByPerson[p.id] || 0;
    return [
      p.name,
      p.role,
      total,
      fte(total),
      proposed,
      fte(proposed),
      Math.max(0, 100 - total),
      total > 100 ? "Over-allocated" : total >= 90 ? "Near capacity" : "OK",
    ];
  });
  return [header, ...rows];
}

// "Proposed FTE" here is the project's own budget figure (set on the
// Projects page) - a different thing from a split's "current vs proposed"
// status. "Allocated FTE" below means current (committed) allocation only.
function buildBudgetVarianceRows(projects, people, allocations) {
  return projects.map((pr) => {
    const allocatedFte = people.reduce((sum, p) => sum + segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "current"), 0) / 100;
    const proposedFte = Number(pr.proposedFte) || 0;
    const variance = allocatedFte - proposedFte;
    const status = Math.abs(variance) < 0.05 ? "On budget" : variance > 0 ? "Over budget" : "Under budget";
    return { project: pr, proposedFte, allocatedFte, variance, status };
  });
}

function buildBudgetVarianceReport(projects, people, allocations) {
  const header = ["Project", "Proposed FTE (budget)", "Allocated FTE (current)", "Variance", "Status"];
  const rows = buildBudgetVarianceRows(projects, people, allocations).map((r) => [
    r.project.name,
    r.proposedFte.toFixed(2),
    r.allocatedFte.toFixed(2),
    `${r.variance >= 0 ? "+" : ""}${r.variance.toFixed(2)}`,
    r.status,
  ]);
  return [header, ...rows];
}

function buildConsolidatedReport(people, skills, skillLevels, projects, allocations, totalsByPerson, proposedTotalsByPerson) {
  return [
    ["SKILLS REPORT"],
    ...buildSkillsReport(people, skills, skillLevels),
    [],
    ["ALLOCATION BY PROJECT REPORT"],
    ...buildAllocationCSV(buildAllocationByProject(projects, people, allocations)),
    [],
    ["UTILISATION REPORT"],
    ...buildUtilisationReport(people, totalsByPerson, proposedTotalsByPerson),
    [],
    ["BUDGET VARIANCE REPORT (proposed vs allocated FTE)"],
    ...buildBudgetVarianceReport(projects, people, allocations),
  ];
}

// ---------- PDF report builders ----------
function newReportDoc(title) {
  const doc = new jsPDF({ unit: "pt" });
  doc.setFontSize(16);
  doc.setTextColor(28, 36, 48);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 56);
  doc.setTextColor(0, 0, 0);
  return doc;
}

function addTableSection(doc, startY, heading, subheading, head, body) {
  let y = startY;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(heading, 40, y);
  y += 14;
  if (subheading) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(subheading, 40, y);
    doc.setTextColor(0, 0, 0);
    y += 12;
  }
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [46, 111, 110] },
    theme: "grid",
  });
  return doc.lastAutoTable.finalY + 22;
}

function buildSkillsPDF(people, skills, skillLevels) {
  const doc = newReportDoc("Skills Report");
  const head = ["Team member", "Role", ...skills.map((s) => s.name)];
  const body = people.map((p) => [p.name, p.role, ...skills.map((s) => LEVEL_LABELS[skillLevels[`${p.id}|${s.id}`] || 0])]);
  addTableSection(doc, 76, "Proficiency by team member", null, head, body);
  return doc;
}

function addAllocationSections(doc, startY, projects, people, allocations) {
  let y = startY;
  const grouped = buildAllocationByProject(projects, people, allocations);
  grouped.forEach(({ project, rows, currentTotal, proposedTotal }) => {
    if (!rows.length) return;
    if (y > 660) {
      doc.addPage();
      y = 40;
    }
    const head = ["Resource", "Allocation %", "FTE", "Start", "End", "Status", "Confirmed", "Outside window"];
    const body = rows.map((r) => [
      r.person,
      r.pct,
      r.fteVal,
      formatDate(r.start) || "-",
      formatDate(r.end) || "-",
      r.status === "proposed" ? "Proposed" : "Current",
      r.confirmed ? "Yes" : "No",
      r.outOfWindow ? "Yes" : "No",
    ]);
    const totalsLine = `Total: ${currentTotal}% current (${fte(currentTotal)} FTE)${proposedTotal ? ` · +${proposedTotal}% proposed (${fte(proposedTotal)} FTE)` : ""}`;
    y = addTableSection(doc, y, project.name, `${formatDate(project.startDate) || "?"} - ${formatDate(project.endDate) || "?"} — ${totalsLine}`, head, body);
  });
  return y;
}

function buildAllocationPDF(projects, people, allocations) {
  const doc = newReportDoc("Allocation by Project");
  addAllocationSections(doc, 76, projects, people, allocations);
  return doc;
}

function buildUtilisationPDF(people, totalsByPerson, proposedTotalsByPerson) {
  const doc = newReportDoc("Utilisation by Resource");
  const head = ["Team member", "Role", "Current %", "Current FTE", "Proposed %", "Proposed FTE", "Available %", "Status"];
  const body = people.map((p) => {
    const total = totalsByPerson[p.id] || 0;
    const proposed = proposedTotalsByPerson[p.id] || 0;
    return [p.name, p.role, total, fte(total), proposed, fte(proposed), Math.max(0, 100 - total), total > 100 ? "Over-allocated" : total >= 90 ? "Near capacity" : "OK"];
  });
  addTableSection(doc, 76, "Current vs proposed allocation & utilisation", null, head, body);
  return doc;
}

function buildBudgetVariancePDF(projects, people, allocations) {
  const doc = newReportDoc("Budget Variance - Proposed vs Allocated FTE");
  const head = ["Project", "Proposed FTE", "Allocated FTE", "Variance", "Status"];
  const body = buildBudgetVarianceRows(projects, people, allocations).map((r) => [
    r.project.name,
    r.proposedFte.toFixed(2),
    r.allocatedFte.toFixed(2),
    `${r.variance >= 0 ? "+" : ""}${r.variance.toFixed(2)}`,
    r.status,
  ]);
  addTableSection(doc, 76, "Proposed (budgeted) vs allocated FTE per project", null, head, body);
  return doc;
}

function buildConsolidatedPDF(people, skills, skillLevels, projects, allocations, totalsByPerson, proposedTotalsByPerson) {
  const doc = newReportDoc("Resourcing Consolidated Report");
  addTableSection(
    doc,
    76,
    "Skills",
    null,
    ["Team member", "Role", ...skills.map((s) => s.name)],
    people.map((p) => [p.name, p.role, ...skills.map((s) => LEVEL_LABELS[skillLevels[`${p.id}|${s.id}`] || 0])])
  );

  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Allocation by Project", 40, 40);
  addAllocationSections(doc, 66, projects, people, allocations);

  doc.addPage();
  doc.setFontSize(14);
  doc.text("Utilisation by Resource", 40, 40);
  const uHead = ["Team member", "Role", "Current %", "Current FTE", "Proposed %", "Proposed FTE", "Available %", "Status"];
  const uBody = people.map((p) => {
    const total = totalsByPerson[p.id] || 0;
    const proposed = proposedTotalsByPerson[p.id] || 0;
    return [p.name, p.role, total, fte(total), proposed, fte(proposed), Math.max(0, 100 - total), total > 100 ? "Over-allocated" : total >= 90 ? "Near capacity" : "OK"];
  });
  addTableSection(doc, 66, "Current vs proposed allocation & utilisation", null, uHead, uBody);

  doc.addPage();
  doc.setFontSize(14);
  doc.text("Budget Variance", 40, 40);
  const bHead = ["Project", "Proposed FTE", "Allocated FTE", "Variance", "Status"];
  const bBody = buildBudgetVarianceRows(projects, people, allocations).map((r) => [
    r.project.name,
    r.proposedFte.toFixed(2),
    r.allocatedFte.toFixed(2),
    `${r.variance >= 0 ? "+" : ""}${r.variance.toFixed(2)}`,
    r.status,
  ]);
  addTableSection(doc, 66, "Proposed (budgeted) vs allocated FTE per project", null, bHead, bBody);

  return doc;
}

export default function App() {
  const [tab, setTab] = useState("dashboard");

  // session === undefined while the initial session check is in flight,
  // null once we know the visitor is signed out, an object once signed in.
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);
  const authed = !!session;
  const signOut = () => supabase.auth.signOut();

  const [editUnlocked, setEditUnlocked] = useState(() => {
    try {
      return localStorage.getItem(EDIT_UNLOCKED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const unlockEdit = (password) => {
    if (password !== EDIT_PASSWORD) return false;
    setEditUnlocked(true);
    try {
      localStorage.setItem(EDIT_UNLOCKED_KEY, "true");
    } catch {}
    return true;
  };
  const lockEdit = () => {
    setEditUnlocked(false);
    try {
      localStorage.removeItem(EDIT_UNLOCKED_KEY);
    } catch {}
  };

  const [peopleData, setPeopleData, peopleLoaded, peopleError] = useSupabaseState(
    "people-skills",
    { people: SEED_PEOPLE, skills: SEED_SKILLS, skillLevels: SEED_SKILL_LEVELS, lockedPeople: SEED_LOCKED_PEOPLE },
    authed
  );
  const [allocData, setAllocData, allocLoaded, allocError] = useSupabaseState(
    "projects-allocations",
    { projects: SEED_PROJECTS, allocations: SEED_ALLOCATIONS },
    authed
  );
  const [upcomingData, setUpcomingData, upcomingLoaded, upcomingError] = useSupabaseState(
    "upcoming-projects",
    { upcoming: SEED_UPCOMING },
    authed
  );
  const [appSettingsData, setAppSettingsData, appSettingsLoaded, appSettingsError] = useSupabaseState(
    "app-settings",
    SEED_APP_SETTINGS,
    authed
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

  // Current-only (committed) totals - drives capacity, charts and ranking.
  const totalsByPerson = useMemo(() => {
    const totals = {};
    people.forEach((p) => {
      totals[p.id] = projects.reduce(
        (sum, pr) => sum + segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "current"),
        0
      );
    });
    return totals;
  }, [people, projects, allocations]);

  // Current + proposed combined - "what utilisation would be if proposals are accepted".
  const proposedTotalsByPerson = useMemo(() => {
    const totals = {};
    people.forEach((p) => {
      const proposedOnly = projects.reduce(
        (sum, pr) => sum + segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "proposed"),
        0
      );
      totals[p.id] = (totalsByPerson[p.id] || 0) + proposedOnly;
    });
    return totals;
  }, [people, projects, allocations, totalsByPerson]);

  const chartData = useMemo(
    () =>
      people.map((p) => {
        const row = { name: p.name.replace("Team Member ", "TM"), total: totalsByPerson[p.id] };
        projects.forEach((pr) => {
          row[pr.name] = segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "current");
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

  const exportAllData = () => {
    const payload = buildFullBackup({
      people, skills, skillLevels, lockedPeople,
      projects, allocations,
      upcoming,
      logRetentionDays, clearLog,
    });
    downloadJSON(`resourcing-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
  };

  const importAllData = async (data) => {
    await setPeopleData({
      people: data.people,
      skills: data.skills || [],
      skillLevels: data.skillLevels || {},
      lockedPeople: data.lockedPeople || {},
    });
    await setAllocData({
      projects: data.projects || [],
      allocations: data.allocations || {},
    });
    await setUpcomingData({ upcoming: Array.isArray(data.upcoming) ? data.upcoming : [] });
    if (data.logRetentionDays != null || Array.isArray(data.clearLog)) {
      await setAppSettingsData({
        logRetentionDays: data.logRetentionDays || logRetentionDays,
        clearLog: Array.isArray(data.clearLog) ? data.clearLog : clearLog,
      });
    }
  };

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

      {session === undefined ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", color: "var(--text-muted)", fontSize: 13 }}>
          Checking session...
        </div>
      ) : !session ? (
        <LoginScreen />
      ) : (
      <div className="rd-shell" style={{ display: "flex", width: "100%" }}>
        <div className="rd-sidebar" style={{ width: 210, background: "var(--sidebar)", display: "flex", flexDirection: "column", flexShrink: 0, paddingTop: 20 }}>
          <div style={{ padding: "0 16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>Resourcing</div>
            <div style={{ color: "var(--sidebar-text)", fontSize: 11.5, marginTop: 2 }}>Skills & allocation</div>
          </div>
          <button className={`rd-sidebar-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
            <LayoutDashboard size={15} /> Dashboard
          </button>
          <button className={`rd-sidebar-btn ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}>
            <Briefcase size={15} /> Projects
          </button>
          <button className={`rd-sidebar-btn ${tab === "skills" ? "active" : ""}`} onClick={() => setTab("skills")}>
            <Grid3x3 size={15} /> Skill matrix
          </button>
          <button className={`rd-sidebar-btn ${tab === "current" ? "active" : ""}`} onClick={() => setTab("current")}>
            <Activity size={15} /> Current utilisation
          </button>
          <button className={`rd-sidebar-btn ${tab === "forward" ? "active" : ""}`} onClick={() => setTab("forward")}>
            <TrendingUp size={15} /> Forward capacity
          </button>
          <button className={`rd-sidebar-btn ${tab === "timeline" ? "active" : ""}`} onClick={() => setTab("timeline")}>
            <GanttChart size={15} /> Timeline
          </button>
          <button className={`rd-sidebar-btn ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}>
            <FileDown size={15} /> Reports
          </button>
          <button className={`rd-sidebar-btn ${tab === "manual" ? "active" : ""}`} onClick={() => setTab("manual")}>
            <BookOpen size={15} /> User manual
          </button>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "10px 0" }} />
          <button className={`rd-sidebar-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
            <Settings size={15} /> Settings
          </button>
          <div style={{ marginTop: "auto", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <EditAccessControl editUnlocked={editUnlocked} onUnlock={unlockEdit} onLock={lockEdit} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={session.user?.email}>
                {session.user?.email}
              </div>
              <button
                onClick={signOut}
                title="Log out"
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--sidebar-text)", background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "3px 7px", cursor: "pointer", flexShrink: 0 }}
              >
                <LogOut size={11} /> Log out
              </button>
            </div>
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
          ) : tab === "dashboard" ? (
            <Dashboard
              people={people}
              skills={skills}
              skillLevels={skillLevels}
              projects={projects}
              allocations={allocations}
              upcoming={upcoming}
              totalsByPerson={totalsByPerson}
              proposedTotalsByPerson={proposedTotalsByPerson}
              onNavigate={setTab}
            />
          ) : tab === "projects" ? (
            <fieldset disabled={!editUnlocked} style={FIELDSET_RESET}>
              <ProjectsPage
                projects={projects}
                skills={skills}
                people={people}
                allocations={allocations}
                onAddProject={(project) => setAllocData({ projects: [...projects, project], allocations })}
                onUpdateProject={(id, updates) => setAllocData({ projects: projects.map((p) => (p.id === id ? { ...p, ...updates } : p)), allocations })}
                onRemoveProject={(id) => setAllocData({ projects: projects.filter((p) => p.id !== id), allocations })}
              />
            </fieldset>
          ) : tab === "skills" ? (
            <fieldset disabled={!editUnlocked} style={FIELDSET_RESET}>
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
            </fieldset>
          ) : tab === "current" ? (
            <fieldset disabled={!editUnlocked} style={FIELDSET_RESET}>
              <CurrentUtilisation
                people={people}
                projects={projects}
                allocations={allocations}
                totalsByPerson={totalsByPerson}
                proposedTotalsByPerson={proposedTotalsByPerson}
                chartData={chartData}
                projectColors={projectColors}
                onChangeAllocations={(next) => setAllocData({ projects, allocations: next })}
              />
            </fieldset>
          ) : tab === "forward" ? (
            <fieldset disabled={!editUnlocked} style={FIELDSET_RESET}>
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
            </fieldset>
          ) : tab === "timeline" ? (
            <TimelinePage people={people} projects={projects} allocations={allocations} />
          ) : tab === "reports" ? (
            <ReportsPage
              people={people}
              skills={skills}
              skillLevels={skillLevels}
              projects={projects}
              allocations={allocations}
              totalsByPerson={totalsByPerson}
              proposedTotalsByPerson={proposedTotalsByPerson}
              onExportBackup={exportAllData}
            />
          ) : tab === "manual" ? (
            <UserManual />
          ) : (
            <SettingsPage
              editUnlocked={editUnlocked}
              people={people}
              skills={skills}
              skillLevels={skillLevels}
              lockedPeople={lockedPeople}
              projects={projects}
              upcoming={upcoming}
              logRetentionDays={logRetentionDays}
              clearLog={clearLog}
              onClearScope={clearScope}
              onSetRetentionDays={(days) => setAppSettingsData({ logRetentionDays: days, clearLog })}
              onImportBackup={importAllData}
              onImportSkillMatrix={(next) => setPeopleData(next)}
            />
          )}
        </div>
      </div>
      )}
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ people, skills, skillLevels, projects, allocations, upcoming, totalsByPerson, proposedTotalsByPerson, onNavigate }) {
  const stats = useMemo(() => {
    const totals = people.map((p) => totalsByPerson[p.id] || 0);
    const avgUtil = totals.length ? totals.reduce((s, t) => s + t, 0) / totals.length : 0;
    const overCommitted = totals.filter((t) => t > 100).length;
    const benchFte = totals.reduce((s, t) => s + Math.max(0, 100 - t), 0) / 100;
    const pendingProposals = people.reduce(
      (sum, p) => sum + projects.reduce((s2, pr) => s2 + toSegments(allocations[`${p.id}|${pr.id}`]).filter((seg) => (seg.status || "current") === "proposed").length, 0),
      0
    );

    const projectRows = projects.map((pr) => {
      const rows = people
        .map((p) => ({ person: p, pct: segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "current") }))
        .filter((r) => r.pct > 0);
      const totalAlloc = rows.reduce((s, r) => s + r.pct, 0);
      const proposedFte = Number(pr.proposedFte) || 0;
      const allocatedFte = totalAlloc / 100;
      const variance = allocatedFte - proposedFte;
      return { project: pr, headcount: rows.length, totalAlloc, proposedFte, allocatedFte, variance };
    });
    const overBudgetCount = projectRows.filter((r) => r.proposedFte > 0 && r.variance >= 0.05).length;

    const teamRows = people
      .map((p) => ({ person: p, total: totalsByPerson[p.id] || 0, proposed: proposedTotalsByPerson[p.id] || 0 }))
      .sort((a, b) => b.total - a.total);

    // Per upcoming project, every required skill plus whether anyone on the
    // team is already Advanced (3) or Expert (4) in it - not just a flat
    // "has a gap" flag, so the reader can see what's fine as well as what isn't.
    const pipelineCoverage = upcoming.map((u) => {
      const skillRows = (u.requiredSkillIds || [])
        .map((sid) => {
          const skill = skills.find((s) => s.id === sid);
          if (!skill) return null;
          const maxLevel = Math.max(0, ...people.map((p) => skillLevels[`${p.id}|${sid}`] || 0));
          return { skill, maxLevel, covered: maxLevel >= 3 };
        })
        .filter(Boolean);
      return { project: u, skillRows, gapCount: skillRows.filter((r) => !r.covered).length };
    });

    return { avgUtil, overCommitted, benchFte, pendingProposals, projectRows, teamRows, pipelineCoverage, overBudgetCount };
  }, [people, skills, skillLevels, projects, allocations, upcoming, totalsByPerson, proposedTotalsByPerson]);

  const cards = [
    { label: "Team members", value: people.length, icon: Users, tab: "skills" },
    { label: "Active projects", value: projects.length, icon: Briefcase, tab: "projects" },
    { label: "Avg. utilisation", value: `${Math.round(stats.avgUtil)}%`, icon: Gauge, tab: "current" },
    { label: "Over-committed", value: stats.overCommitted, icon: AlertTriangle, tab: "current", warn: stats.overCommitted > 0 },
    { label: "Bench capacity", value: `${stats.benchFte.toFixed(1)} FTE`, icon: TrendingUp, tab: "forward" },
    { label: "Pipeline projects", value: upcoming.length, icon: LayoutDashboard, tab: "forward" },
    { label: "Pending proposals", value: stats.pendingProposals, icon: ThumbsUp, tab: "current", warn: stats.pendingProposals > 0 },
    { label: "Over budget (FTE)", value: stats.overBudgetCount, icon: DollarSign, tab: "reports", warn: stats.overBudgetCount > 0 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Dashboard</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
            A ready reckoner of resourcing across the team, current projects and the pipeline.
          </div>
        </div>
        <button
          onClick={() => onNavigate("manual")}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--accent)", background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: 5, padding: "7px 12px", cursor: "pointer", fontFamily: "var(--sans)", flexShrink: 0 }}
        >
          <BookOpen size={13} /> User manual
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 26 }}>
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => onNavigate(c.tab)}
            style={{
              textAlign: "left",
              background: "var(--panel)",
              border: `1px solid ${c.warn ? "var(--danger)" : "var(--border)"}`,
              borderRadius: 6,
              padding: "14px 16px",
              cursor: "pointer",
              fontFamily: "var(--sans)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: c.warn ? "var(--danger)" : "var(--text-muted)" }}>
              <c.icon size={14} />
              <span style={{ fontSize: 11.5 }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: c.warn ? "var(--danger)" : "var(--text)" }}>
              {c.value}
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 18, marginBottom: 22 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Team allocation</div>
          <table className="rd-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Team member</th>
                <th>Current</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.teamRows.map(({ person, total, proposed }) => (
                <tr key={person.id}>
                  <td className="rowhead">
                    <div style={{ fontWeight: 600 }}>{person.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{person.role}</div>
                  </td>
                  <td style={{ fontFamily: "var(--mono)" }}>
                    <div style={{ fontWeight: 700, color: pctColor(total) }}>{total}%</div>
                    {proposed > total && <div style={{ fontSize: 10, color: "var(--warn)" }}>&rarr; {proposed}% proposed</div>}
                  </td>
                  <td style={{ fontSize: 11.5, color: pctColor(total) }}>
                    {total > 100 ? "Over-committed" : total >= 90 ? "Near capacity" : "Available"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Projects overview</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
            Variance is allocated FTE minus proposed (budgeted) FTE - positive means over budget.
          </div>
          <table className="rd-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Project</th>
                <th>People</th>
                <th>Allocated FTE</th>
                <th>Proposed FTE</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {stats.projectRows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-muted)", fontSize: 12 }}>No projects yet.</td>
                </tr>
              )}
              {stats.projectRows.map(({ project, headcount, allocatedFte, proposedFte, variance }) => (
                <tr key={project.id}>
                  <td className="rowhead" style={{ fontWeight: 600 }}>{project.name}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{headcount}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{allocatedFte.toFixed(2)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{proposedFte.toFixed(2)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: proposedFte === 0 ? "var(--text-muted)" : Math.abs(variance) < 0.05 ? "var(--accent)" : variance > 0 ? "var(--danger)" : "var(--warn)" }}>
                    {proposedFte === 0 ? "-" : `${variance >= 0 ? "+" : ""}${variance.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Pipeline & skill gaps</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, marginBottom: 14 }}>
          Every required skill for each upcoming project, and whether anyone on the team is already
          Advanced or Expert in it. <span style={{ color: "var(--accent)", fontWeight: 600 }}>Green</span> means
          yes; <span style={{ color: "var(--danger)", fontWeight: 600 }}>red</span> means no one is yet - a
          gap to plan for, via hiring, training, or bringing someone in.
        </div>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No upcoming projects tracked.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stats.pipelineCoverage.map(({ project, skillRows, gapCount }) => (
              <div key={project.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{project.name}</div>
                  {skillRows.length > 0 && (
                    <div style={{ fontSize: 11, color: gapCount > 0 ? "var(--danger)" : "var(--accent)", fontWeight: 600 }}>
                      {gapCount > 0 ? `${gapCount} of ${skillRows.length} skill${skillRows.length === 1 ? "" : "s"} not yet covered` : "All required skills covered"}
                    </div>
                  )}
                </div>
                {skillRows.length === 0 ? (
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic" }}>No required skills set for this project</span>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {skillRows.map((r) => (
                      <span
                        key={r.skill.id}
                        className="rd-tag"
                        title={r.covered ? `Best match on the team: ${LEVEL_LABELS[r.maxLevel]}` : "No one on the team is Advanced or Expert in this skill yet"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: r.covered ? "var(--accent-light)" : "var(--danger-light)",
                          color: r.covered ? "var(--accent)" : "var(--danger)",
                        }}
                      >
                        {r.covered ? <Check size={11} /> : <AlertTriangle size={11} />} {r.skill.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Projects ----------
function ProjectsPage({ projects, skills, people, allocations, onAddProject, onUpdateProject, onRemoveProject }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", startDate: "", endDate: "", requiredSkillIds: [], proposedFte: "" });
  const [editDateError, setEditDateError] = useState(false);

  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newSkillIds, setNewSkillIds] = useState([]);
  const [newProposedFte, setNewProposedFte] = useState("");
  const [addDateError, setAddDateError] = useState(false);

  const startEdit = (pr) => {
    setEditingId(pr.id);
    setDraft({ name: pr.name, startDate: pr.startDate || "", endDate: pr.endDate || "", requiredSkillIds: pr.requiredSkillIds || [], proposedFte: pr.proposedFte ? String(pr.proposedFte) : "" });
    setEditDateError(false);
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = () => {
    if (!draft.name.trim()) return;
    if (isDateRangeInvalid(draft.startDate, draft.endDate)) {
      setEditDateError(true);
      return;
    }
    onUpdateProject(editingId, {
      name: draft.name.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate,
      requiredSkillIds: draft.requiredSkillIds,
      proposedFte: Math.max(0, Number(draft.proposedFte) || 0),
    });
    setEditingId(null);
  };
  const toggleDraftSkill = (id) =>
    setDraft((d) => ({ ...d, requiredSkillIds: d.requiredSkillIds.includes(id) ? d.requiredSkillIds.filter((x) => x !== id) : [...d.requiredSkillIds, id] }));

  const toggleNewSkill = (id) => setNewSkillIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const addProject = () => {
    if (!newName.trim()) return;
    if (isDateRangeInvalid(newStart, newEnd)) {
      setAddDateError(true);
      return;
    }
    onAddProject({
      id: `pr${Date.now()}`,
      name: newName.trim(),
      startDate: newStart,
      endDate: newEnd,
      requiredSkillIds: newSkillIds,
      proposedFte: Math.max(0, Number(newProposedFte) || 0),
    });
    setNewName("");
    setNewStart("");
    setNewEnd("");
    setNewProposedFte("");
    setNewSkillIds([]);
    setAddDateError(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Projects</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Master list of projects/programs: name, duration, required skills, and the proposed (budgeted) FTE.
          Add, edit and remove projects here - Current Utilisation only manages who's allocated to them.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {projects.map((pr) => (
          <div key={pr.id} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px" }}>
            {editingId === pr.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input className="rd-text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} style={{ minWidth: 220, flex: 1 }} autoFocus />
                  <input
                    className="rd-text"
                    type="date"
                    title="Start date"
                    value={draft.startDate}
                    onChange={(e) => { setDraft((d) => ({ ...d, startDate: e.target.value })); setEditDateError(false); }}
                    style={editDateError ? { borderColor: "var(--danger)" } : undefined}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>to</span>
                  <input
                    className="rd-text"
                    type="date"
                    title="End date"
                    value={draft.endDate}
                    onChange={(e) => { setDraft((d) => ({ ...d, endDate: e.target.value })); setEditDateError(false); }}
                    style={editDateError ? { borderColor: "var(--danger)" } : undefined}
                  />
                </div>
                {editDateError && (
                  <div style={{ fontSize: 11.5, color: "var(--danger)", display: "flex", alignItems: "center", gap: 4, marginTop: -4 }}>
                    <AlertTriangle size={12} /> End date can't be before the start date.
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  Proposed FTE (budget)
                  <input
                    className="rd-input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={draft.proposedFte}
                    onChange={(e) => setDraft((d) => ({ ...d, proposedFte: e.target.value }))}
                    style={{ width: 70 }}
                  />
                </label>
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Required skills</div>
                  {skills.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleDraftSkill(s.id)}
                      className="rd-tag"
                      style={{
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: draft.requiredSkillIds.includes(s.id) ? "var(--accent)" : "var(--accent-light)",
                        color: draft.requiredSkillIds.includes(s.id) ? "#fff" : "var(--accent)",
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="rd-add-btn" onClick={saveEdit}><Save size={13} /> Save</button>
                  <button className="rd-remove-btn" onClick={cancelEdit} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}><XCircle size={13} /> Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{pr.name}</div>
                  {(pr.startDate || pr.endDate) && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {formatDate(pr.startDate) || "?"} &ndash; {formatDate(pr.endDate) || "?"}
                    </div>
                  )}
                  {(() => {
                    const allocatedFte = people.reduce((sum, p) => sum + segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "current"), 0) / 100;
                    const proposedFte = Number(pr.proposedFte) || 0;
                    const variance = allocatedFte - proposedFte;
                    return (
                      <div style={{ fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ color: "var(--text-muted)" }}>
                          Proposed {proposedFte.toFixed(2)} FTE &middot; Allocated {allocatedFte.toFixed(2)} FTE
                        </span>
                        {proposedFte > 0 && Math.abs(variance) >= 0.05 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600, color: variance > 0 ? "var(--danger)" : "var(--warn)" }}>
                            <DollarSign size={11} /> {variance > 0 ? "+" : ""}{variance.toFixed(2)} FTE {variance > 0 ? "over budget" : "under budget"}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ marginTop: 8 }}>
                    {(pr.requiredSkillIds || []).length === 0 ? (
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic" }}>No required skills set</span>
                    ) : (
                      pr.requiredSkillIds.map((sid) => {
                        const skill = skills.find((s) => s.id === sid);
                        return skill ? <span key={sid} className="rd-tag">{skill.name}</span> : null;
                      })
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button className="rd-remove-btn" onClick={() => startEdit(pr)} title="Edit project"><Pencil size={13} /></button>
                  <button className="rd-remove-btn" onClick={() => onRemoveProject(pr.id)} title="Remove project"><X size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add project</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input className="rd-text" placeholder="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ minWidth: 220, flex: 1 }} />
          <input
            className="rd-text"
            type="date"
            title="Start date"
            value={newStart}
            onChange={(e) => { setNewStart(e.target.value); setAddDateError(false); }}
            style={addDateError ? { borderColor: "var(--danger)" } : undefined}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>to</span>
          <input
            className="rd-text"
            type="date"
            title="End date"
            value={newEnd}
            onChange={(e) => { setNewEnd(e.target.value); setAddDateError(false); }}
            style={addDateError ? { borderColor: "var(--danger)" } : undefined}
          />
        </div>
        {addDateError && (
          <div style={{ fontSize: 11.5, color: "var(--danger)", display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
            <AlertTriangle size={12} /> End date can't be before the start date.
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Proposed FTE (budget)
          <input
            className="rd-input"
            type="number"
            min="0"
            step="0.1"
            value={newProposedFte}
            onChange={(e) => setNewProposedFte(e.target.value)}
            style={{ width: 70 }}
          />
        </label>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Required skills</div>
          {skills.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleNewSkill(s.id)}
              className="rd-tag"
              style={{
                border: "1px solid var(--border)",
                cursor: "pointer",
                background: newSkillIds.includes(s.id) ? "var(--accent)" : "var(--accent-light)",
                color: newSkillIds.includes(s.id) ? "#fff" : "var(--accent)",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button className="rd-add-btn" onClick={addProject}><Plus size={13} /> Add project</button>
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
function CurrentUtilisation({ people, projects, allocations, totalsByPerson, proposedTotalsByPerson, chartData, projectColors, onChangeAllocations }) {
  const RESETS_CONFIRM = new Set(["pct", "startDate", "endDate"]);

  const setSegmentField = (personId, projectId, segId, field, value) => {
    const key = `${personId}|${projectId}`;
    const segments = toSegments(allocations[key]);
    const exists = segments.some((seg) => seg.id === segId);
    const nextSegments = exists
      ? segments.map((seg) =>
          seg.id === segId ? { ...seg, [field]: value, ...(RESETS_CONFIRM.has(field) ? { confirmed: false } : {}) } : seg
        )
      : [...segments, { id: segId, pct: 0, startDate: "", endDate: "", confirmed: false, status: "current", [field]: value }];
    onChangeAllocations({ ...allocations, [key]: nextSegments });
  };

  const addSegment = (personId, projectId) => {
    const key = `${personId}|${projectId}`;
    const segments = toSegments(allocations[key]);
    onChangeAllocations({
      ...allocations,
      [key]: [...segments, { id: `seg${Date.now()}`, pct: 0, startDate: "", endDate: "", confirmed: false, status: "proposed" }],
    });
  };

  const removeSegment = (personId, projectId, segId) => {
    const key = `${personId}|${projectId}`;
    onChangeAllocations({ ...allocations, [key]: toSegments(allocations[key]).filter((seg) => seg.id !== segId) });
  };

  const totalAllocatedFte = people.reduce((sum, p) => sum + (totalsByPerson[p.id] || 0) / 100, 0);
  const totalProposedFte = people.reduce((sum, p) => sum + (proposedTotalsByPerson[p.id] || 0) / 100, 0);
  const avgUtilisation = people.length ? people.reduce((sum, p) => sum + (totalsByPerson[p.id] || 0), 0) / people.length : 0;
  const overAllocatedCount = people.filter((p) => (totalsByPerson[p.id] || 0) > 100).length;
  const pendingProposals = people.reduce(
    (sum, p) => sum + projects.reduce((s2, pr) => s2 + toSegments(allocations[`${p.id}|${pr.id}`]).filter((seg) => (seg.status || "current") === "proposed").length, 0),
    0
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Current utilisation</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Allocation percentage (with FTE) and dates per project, per team member. Use "Split" to add a second time-phased
          segment for fractional or ramping allocations. Totals above 100% are flagged. Manage the project list itself
          (name, duration, required skills) on the Projects page.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Current allocated FTE" value={totalAllocatedFte.toFixed(2)} sub={`across ${people.length} team members`} />
        <StatCard
          label="Proposed FTE"
          value={totalProposedFte.toFixed(2)}
          sub="if proposals accepted"
          color={totalProposedFte > totalAllocatedFte ? "var(--warn)" : "var(--text)"}
        />
        <StatCard label="Average utilisation" value={`${avgUtilisation.toFixed(0)}%`} color={pctColor(avgUtilisation)} />
        <StatCard
          label="Over-allocated"
          value={overAllocatedCount}
          sub={overAllocatedCount === 1 ? "person above 100%" : "people above 100%"}
          color={overAllocatedCount > 0 ? "var(--danger)" : "var(--accent)"}
        />
        <StatCard
          label="Pending proposals"
          value={pendingProposals}
          sub="splits awaiting accept/reject"
          color={pendingProposals > 0 ? "var(--warn)" : "var(--text)"}
        />
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 22 }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th className="corner">Team member</th>
              {projects.map((pr) => (
                <th key={pr.id}>
                  <div>{pr.name}</div>
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
              const proposed = proposedTotalsByPerson[p.id] || 0;
              return (
                <tr key={p.id}>
                  <td className="rowhead">
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.role}</div>
                  </td>
                  {projects.map((pr) => {
                    const key = `${p.id}|${pr.id}`;
                    const rawSegments = toSegments(allocations[key]);
                    const segments = rawSegments.length ? rawSegments : [{ id: "seg1", pct: 0, startDate: "", endDate: "", confirmed: false, status: "current" }];
                    const cellCurrent = segmentsTotalPct(allocations[key], "current");
                    const cellProposed = segmentsTotalPct(allocations[key], "proposed");
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
                                {(seg.status || "current") === "proposed" ? (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 3 }}>
                                    <button
                                      onClick={() => setSegmentField(p.id, pr.id, seg.id, "status", "current")}
                                      title="Accept proposal - make this the current allocation"
                                      style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}
                                    >
                                      <ThumbsUp size={9} /> Accept
                                    </button>
                                    <button
                                      onClick={() => removeSegment(p.id, pr.id, seg.id)}
                                      title="Reject proposal - discard this split"
                                      style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--danger)", color: "var(--danger)", background: "var(--danger-light)" }}
                                    >
                                      <ThumbsDown size={9} /> Reject
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 3 }}>
                                    <button
                                      onClick={() => setSegmentField(p.id, pr.id, seg.id, "status", "proposed")}
                                      title="Revert to proposed"
                                      style={{ fontSize: 9, fontWeight: 600, padding: "1px 7px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}
                                    >
                                      Current
                                    </button>
                                  </div>
                                )}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                                  <input
                                    className="rd-input"
                                    type="number"
                                    step="0.1"
                                    value={seg.pct}
                                    onChange={(e) => setSegmentField(p.id, pr.id, seg.id, "pct", Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
                                  />
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>
                                  {rawSegments.length > 1 && (seg.status || "current") !== "proposed" && (
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
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, marginTop: 3 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, flexWrap: "wrap" }}>
                                      <input
                                        className="rd-date"
                                        type="date"
                                        title="Split start date"
                                        value={seg.startDate}
                                        onChange={(e) => setSegmentField(p.id, pr.id, seg.id, "startDate", e.target.value)}
                                        style={isDateRangeInvalid(seg.startDate, seg.endDate) ? { borderColor: "var(--danger)" } : undefined}
                                      />
                                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>&rarr;</span>
                                      <input
                                        className="rd-date"
                                        type="date"
                                        title="Split end date"
                                        value={seg.endDate}
                                        onChange={(e) => setSegmentField(p.id, pr.id, seg.id, "endDate", e.target.value)}
                                        style={isDateRangeInvalid(seg.startDate, seg.endDate) ? { borderColor: "var(--danger)" } : undefined}
                                      />
                                      <button
                                        className="rd-remove-btn"
                                        onClick={() => seg.startDate && seg.endDate && !isDateRangeInvalid(seg.startDate, seg.endDate) && setSegmentField(p.id, pr.id, seg.id, "confirmed", true)}
                                        title={
                                          isDateRangeInvalid(seg.startDate, seg.endDate)
                                            ? "End date can't be before the start date"
                                            : seg.startDate && seg.endDate
                                            ? "Confirm split dates"
                                            : "Set both dates to confirm"
                                        }
                                        disabled={!seg.startDate || !seg.endDate || isDateRangeInvalid(seg.startDate, seg.endDate)}
                                        style={{
                                          color: seg.startDate && seg.endDate && !isDateRangeInvalid(seg.startDate, seg.endDate) ? "var(--accent)" : "var(--border)",
                                          cursor: seg.startDate && seg.endDate && !isDateRangeInvalid(seg.startDate, seg.endDate) ? "pointer" : "not-allowed",
                                        }}
                                      >
                                        <Check size={12} />
                                      </button>
                                    </div>
                                    {isDateRangeInvalid(seg.startDate, seg.endDate) && (
                                      <div style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--danger)", fontSize: 9.5 }}>
                                        <AlertTriangle size={10} /> End before start
                                      </div>
                                    )}
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
                            <div style={{ fontSize: 10, fontWeight: 600 }}>
                              <span style={{ color: pctColor(cellCurrent) }}>Current {cellCurrent}%</span>
                              {cellProposed > 0 && <span style={{ color: "var(--warn)", marginLeft: 4 }}>+Proposed {cellProposed}%</span>}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ fontFamily: "var(--mono)" }}>
                    <div style={{ fontWeight: 700, color: pctColor(total) }}>{total}%</div>
                    {proposed > total && (
                      <div style={{ fontSize: 10, color: "var(--warn)", fontWeight: 600 }}>&rarr; {proposed}% proposed</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="rowhead" style={{ fontWeight: 700 }}>Project total</td>
              {projects.map((pr) => {
                const projCurrent = people.reduce((sum, p) => sum + segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "current"), 0);
                const projProposed = people.reduce((sum, p) => sum + segmentsTotalPct(allocations[`${p.id}|${pr.id}`], "proposed"), 0);
                return (
                  <td key={pr.id} style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                    <div style={{ fontWeight: 700 }}>{projCurrent}% &middot; {fte(projCurrent)} FTE</div>
                    {projProposed > 0 && (
                      <div style={{ color: "var(--warn)" }}>+{projProposed}% &middot; {fte(projProposed)} FTE proposed</div>
                    )}
                  </td>
                );
              })}
              <td></td>
            </tr>
          </tfoot>
        </table>
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
  const [skillWeight, setSkillWeight] = useState(70);
  const capacityWeight = 100 - skillWeight;

  const toggleSkill = (id) => {
    setSelectedSkillIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  // Every person, ranked - not just a shortlist. Over-allocated people stay in
  // the list (just scored lower on the capacity half) so they're still visible
  // as an option, flagged rather than hidden.
  const rankAll = (project) => {
    const relevant = project.requiredSkillIds.length ? project.requiredSkillIds : skills.map((s) => s.id);
    return people
      .map((p) => {
        const avgSkill = relevant.reduce((sum, sid) => sum + (skillLevels[`${p.id}|${sid}`] || 0), 0) / relevant.length;
        const total = totalsByPerson[p.id] || 0;
        const available = Math.max(0, 100 - total);
        const score = (avgSkill / 4) * (skillWeight / 100) + (available / 100) * (capacityWeight / 100);
        return { person: p, avgSkill, available, total, score };
      })
      .sort((a, b) => b.score - a.score);
  };

  // Required skills nobody on the team holds at Advanced (3) or Expert (4).
  const skillGapsFor = (project) =>
    (project.requiredSkillIds || []).filter((sid) => Math.max(0, ...people.map((p) => skillLevels[`${p.id}|${sid}`] || 0)) < 3);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Forward capacity</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Available capacity today, and every team member ranked against upcoming work by skill level and free
          capacity.
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Ranking weights</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 130 }}>Skill match {skillWeight}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={skillWeight}
            onChange={(e) => setSkillWeight(Number(e.target.value))}
            style={{ flex: 1, minWidth: 140 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 130, textAlign: "right" }}>Free capacity {capacityWeight}%</span>
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
          const rows = rankAll(proj);
          const gaps = skillGapsFor(proj);
          const skillCols = (proj.requiredSkillIds || []).map((sid) => skills.find((s) => s.id === sid)).filter(Boolean);
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

              {gaps.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {gaps.map((sid) => {
                    const skill = skills.find((s) => s.id === sid);
                    return (
                      <span
                        key={sid}
                        className="rd-tag"
                        style={{ background: "var(--danger-light)", color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <AlertTriangle size={11} /> No one Advanced+ in {skill?.name}
                      </span>
                    );
                  })}
                </div>
              )}

              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table className="rd-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Team member</th>
                      {skillCols.map((s) => (
                        <th key={s.id}>{s.name}</th>
                      ))}
                      <th>Avg skill</th>
                      <th>Capacity</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.person.id} style={idx < 3 ? { background: "var(--accent-light)" } : undefined}>
                        <td className="rowhead">
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            {idx < 3 && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", background: "var(--panel)", border: "1px solid var(--accent)", borderRadius: 3, padding: "1px 4px" }}>
                                TOP {idx + 1}
                              </span>
                            )}
                            <span style={{ fontWeight: 600 }}>{r.person.name}</span>
                            {r.total >= 90 && (
                              <AlertTriangle
                                size={12}
                                color={r.total > 100 ? "var(--danger)" : "var(--warn)"}
                                title={r.total > 100 ? `${r.total}% allocated - over-committed` : `${r.total}% allocated - near capacity`}
                              />
                            )}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{r.person.role}</div>
                        </td>
                        {skillCols.map((s) => {
                          const level = skillLevels[`${r.person.id}|${s.id}`] || 0;
                          return (
                            <td key={s.id} style={{ background: levelColor(level) }}>
                              {level === 0 ? "-" : LEVEL_LABELS[level]}
                            </td>
                          );
                        })}
                        <td style={{ fontFamily: "var(--mono)" }}>{r.avgSkill.toFixed(1)}/4</td>
                        <td style={{ fontFamily: "var(--mono)", color: pctColor(r.total) }}>{r.available}% free</td>
                        <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{Math.round(r.score * 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

// ---------- Timeline ----------
function TimelinePage({ people, projects, allocations }) {
  const [groupBy, setGroupBy] = useState("project");

  const allDates = [];
  projects.forEach((pr) => {
    if (pr.startDate) allDates.push(pr.startDate);
    if (pr.endDate) allDates.push(pr.endDate);
  });
  people.forEach((p) => {
    projects.forEach((pr) => {
      toSegments(allocations[`${p.id}|${pr.id}`]).forEach((seg) => {
        if (seg.startDate) allDates.push(seg.startDate);
        if (seg.endDate) allDates.push(seg.endDate);
      });
    });
  });

  if (!allDates.length) {
    return (
      <div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Timeline</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
            A visual view of allocations across time, by project or by person.
          </div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No dated projects or allocations yet - add dates in Current Utilisation to see them here.
        </div>
      </div>
    );
  }

  const sortedDates = [...allDates].sort();
  const minDate = new Date(`${sortedDates[0]}T00:00:00`);
  const maxDate = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00`);
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 3);
  const baseMs = minDate.getTime();
  const totalDays = Math.max(1, (maxDate.getTime() - baseMs) / 86400000);

  const pctFor = (iso) => {
    const d = new Date(`${iso}T00:00:00`).getTime();
    return Math.max(0, Math.min(100, ((d - baseMs) / 86400000 / totalDays) * 100));
  };

  const months = [];
  let cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cursor <= maxDate) {
    months.push({
      label: cursor.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      pct: pctFor(cursor.toISOString().slice(0, 10)),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayPct = todayIso >= sortedDates[0] && todayIso <= sortedDates[sortedDates.length - 1] ? pctFor(todayIso) : null;

  // Width scales with the actual date span so a multi-year range gets more
  // room to breathe instead of being crushed into a fixed-width chart -
  // the outer panel scrolls (both axes) once content exceeds its size.
  const chartWidth = Math.max(900, Math.round(totalDays * 4));

  const groups =
    groupBy === "project"
      ? projects
          .map((pr) => ({
            key: pr.id,
            heading: pr.name,
            band: pr.startDate && pr.endDate ? { start: pr.startDate, end: pr.endDate } : null,
            bars: people.flatMap((p) =>
              toSegments(allocations[`${p.id}|${pr.id}`])
                .filter((seg) => seg.startDate && seg.endDate)
                .map((seg) => ({ label: p.name, seg, outOfWindow: isOutsideWindow(seg.startDate, seg.endDate, pr.startDate, pr.endDate) }))
            ),
          }))
          .filter((g) => g.bars.length || g.band)
      : people
          .map((p) => ({
            key: p.id,
            heading: p.name,
            band: null,
            bars: projects.flatMap((pr) =>
              toSegments(allocations[`${p.id}|${pr.id}`])
                .filter((seg) => seg.startDate && seg.endDate)
                .map((seg) => ({ label: pr.name, seg, outOfWindow: isOutsideWindow(seg.startDate, seg.endDate, pr.startDate, pr.endDate) }))
            ),
          }))
          .filter((g) => g.bars.length);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Timeline</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          A visual view of allocations across time. Solid bars are current, dashed amber bars are proposed. A red outline
          means the split falls outside its project's duration.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className="rd-add-btn"
          style={groupBy === "project" ? { background: "var(--accent-light)", borderStyle: "solid" } : undefined}
          onClick={() => setGroupBy("project")}
        >
          By project
        </button>
        <button
          className="rd-add-btn"
          style={groupBy === "person" ? { background: "var(--accent-light)", borderStyle: "solid" } : undefined}
          onClick={() => setGroupBy("person")}
        >
          By person
        </button>
      </div>

      <div style={{ overflow: "auto", maxHeight: "min(70vh, 640px)", border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)" }}>
        <div style={{ minWidth: chartWidth }}>
          <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 2, background: "var(--panel)" }}>
            <div style={{ width: 160, flexShrink: 0, borderBottom: "1px solid var(--border)", position: "sticky", left: 0, zIndex: 1, background: "var(--panel)" }} />
            <div style={{ flex: 1, position: "relative", height: 28, borderBottom: "1px solid var(--border)" }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  style={{ position: "absolute", left: `${m.pct}%`, top: 0, bottom: 0, borderLeft: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", paddingLeft: 4, whiteSpace: "nowrap" }}
                >
                  {m.label}
                </div>
              ))}
              {todayPct != null && (
                <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: "1px solid var(--danger)", fontSize: 10, color: "var(--danger)", paddingLeft: 4, whiteSpace: "nowrap" }}>
                  Today
                </div>
              )}
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.key} style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 160, flexShrink: 0, padding: "8px 10px", fontSize: 12, fontWeight: 600, position: "sticky", left: 0, zIndex: 1, background: "var(--panel)", borderRight: "1px solid var(--border)" }}>{g.heading}</div>
              <div style={{ flex: 1, position: "relative", minHeight: Math.max(34, 10 + g.bars.length * 22), padding: "6px 0" }}>
                {g.band && (
                  <div
                    style={{ position: "absolute", left: `${pctFor(g.band.start)}%`, width: `${Math.max(0.5, pctFor(g.band.end) - pctFor(g.band.start))}%`, top: 0, bottom: 0, background: "var(--accent-light)", opacity: 0.5 }}
                    title={`Project duration: ${formatDate(g.band.start)} - ${formatDate(g.band.end)}`}
                  />
                )}
                {g.bars.map((b, i) => {
                  const left = pctFor(b.seg.startDate);
                  const width = Math.max(0.6, pctFor(b.seg.endDate) - left);
                  const proposed = (b.seg.status || "current") === "proposed";
                  return (
                    <div
                      key={`${b.label}-${b.seg.id}-${i}`}
                      title={`${b.label}: ${b.seg.pct}% (${fte(b.seg.pct)} FTE) · ${formatDate(b.seg.startDate)} - ${formatDate(b.seg.endDate)}${proposed ? " · proposed" : ""}${b.outOfWindow ? " · outside project window" : ""}`}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 4 + i * 22,
                        height: 16,
                        borderRadius: 3,
                        background: proposed ? "var(--warn-light)" : "var(--accent)",
                        border: proposed ? "1px dashed var(--warn)" : b.outOfWindow ? "1px solid var(--danger)" : "none",
                        color: proposed ? "var(--warn)" : "#fff",
                        fontSize: 9,
                        lineHeight: "16px",
                        paddingLeft: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        boxSizing: "border-box",
                      }}
                    >
                      {b.label}
                    </div>
                  );
                })}
                {g.bars.length === 0 && <div style={{ height: 20 }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Reports ----------
function ReportsPage({ people, skills, skillLevels, projects, allocations, totalsByPerson, proposedTotalsByPerson, onExportBackup }) {
  const stamp = new Date().toISOString().slice(0, 10);

  const avgProficiency = people.length && skills.length
    ? people.reduce((sum, p) => sum + skills.reduce((s2, sk) => s2 + (skillLevels[`${p.id}|${sk.id}`] || 0), 0), 0) / (people.length * skills.length)
    : 0;
  const totalAllocatedFte = people.reduce((sum, p) => sum + (totalsByPerson[p.id] || 0) / 100, 0);
  const totalProposedFte = people.reduce((sum, p) => sum + (proposedTotalsByPerson[p.id] || 0) / 100, 0);
  const avgUtilisation = people.length ? people.reduce((sum, p) => sum + (totalsByPerson[p.id] || 0), 0) / people.length : 0;

  const cards = [
    {
      key: "skills",
      label: "Skills report",
      detail: `Proficiency levels for ${people.length} team members across ${skills.length} skills`,
      onDownloadCSV: () => downloadCSV(`skills-report-${stamp}.csv`, buildSkillsReport(people, skills, skillLevels)),
      onDownloadPDF: () => buildSkillsPDF(people, skills, skillLevels).save(`skills-report-${stamp}.pdf`),
    },
    {
      key: "allocation",
      label: "Allocation by project",
      detail: `${projects.length} projects · resources grouped per project, ordered by period, current vs proposed`,
      onDownloadCSV: () => downloadCSV(`allocation-by-project-${stamp}.csv`, buildAllocationCSV(buildAllocationByProject(projects, people, allocations))),
      onDownloadPDF: () => buildAllocationPDF(projects, people, allocations).save(`allocation-by-project-${stamp}.pdf`),
    },
    {
      key: "utilisation",
      label: "Utilisation per resource",
      detail: `Current vs proposed FTE allocation and utilisation per team member`,
      onDownloadCSV: () => downloadCSV(`utilisation-report-${stamp}.csv`, buildUtilisationReport(people, totalsByPerson, proposedTotalsByPerson)),
      onDownloadPDF: () => buildUtilisationPDF(people, totalsByPerson, proposedTotalsByPerson).save(`utilisation-report-${stamp}.pdf`),
    },
    {
      key: "budget",
      label: "Budget variance",
      detail: `Proposed (budgeted) vs allocated FTE per project - flags discrepancies that could impact financials`,
      onDownloadCSV: () => downloadCSV(`budget-variance-${stamp}.csv`, buildBudgetVarianceReport(projects, people, allocations)),
      onDownloadPDF: () => buildBudgetVariancePDF(projects, people, allocations).save(`budget-variance-${stamp}.pdf`),
    },
  ];

  const budgetRows = buildBudgetVarianceRows(projects, people, allocations);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>Reports</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          Concise skills, allocation-by-project and per-resource utilisation reports - as CSV or PDF, individually or consolidated.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <StatCard label="Team members" value={people.length} />
        <StatCard label="Skills tracked" value={skills.length} />
        <StatCard label="Active projects" value={projects.length} />
        <StatCard label="Avg proficiency" value={`${avgProficiency.toFixed(1)}/4`} />
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Current FTE allocation &amp; utilisation, live</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Current allocated FTE" value={totalAllocatedFte.toFixed(2)} />
        <StatCard
          label="Proposed FTE"
          value={totalProposedFte.toFixed(2)}
          sub="if proposals accepted"
          color={totalProposedFte > totalAllocatedFte ? "var(--warn)" : "var(--text)"}
        />
        <StatCard label="Average utilisation" value={`${avgUtilisation.toFixed(0)}%`} color={pctColor(avgUtilisation)} />
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 26 }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Team member</th>
              <th style={{ textAlign: "left" }}>Role</th>
              <th>Current FTE</th>
              <th>Proposed FTE</th>
              <th>Utilisation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const total = totalsByPerson[p.id] || 0;
              const proposed = proposedTotalsByPerson[p.id] || 0;
              return (
                <tr key={p.id}>
                  <td style={{ textAlign: "left", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ textAlign: "left", color: "var(--text-muted)" }}>{p.role}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fte(total)}</td>
                  <td style={{ fontFamily: "var(--mono)", color: proposed > total ? "var(--warn)" : "var(--text-muted)" }}>
                    {proposed > total ? fte(proposed) : "-"}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: pctColor(total) }}>{total}%</td>
                  <td>{total > 100 ? "Over-allocated" : total >= 90 ? "Near capacity" : "OK"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Budget variance, live</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        Proposed (budgeted) FTE per project, set on the Projects page, vs allocated (current) FTE - a gap here can
        mean cost overrun (allocated more than budgeted) or under-delivery (allocated less).
      </div>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 26 }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Project</th>
              <th>Proposed FTE</th>
              <th>Allocated FTE</th>
              <th>Variance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {budgetRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "left", color: "var(--text-muted)", fontStyle: "italic" }}>No projects yet.</td>
              </tr>
            ) : (
              budgetRows.map((r) => (
                <tr key={r.project.id}>
                  <td style={{ textAlign: "left", fontWeight: 600 }}>{r.project.name}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{r.proposedFte.toFixed(2)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{r.allocatedFte.toFixed(2)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: r.proposedFte === 0 ? "var(--text-muted)" : r.status === "On budget" ? "var(--accent)" : r.variance > 0 ? "var(--danger)" : "var(--warn)" }}>
                    {r.proposedFte === 0 ? "-" : `${r.variance >= 0 ? "+" : ""}${r.variance.toFixed(2)}`}
                  </td>
                  <td>{r.proposedFte === 0 ? "No budget set" : r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Downloadable reports</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {cards.map((c) => (
          <div key={c.key} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.detail}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="rd-add-btn" onClick={c.onDownloadCSV}>
                <FileDown size={13} /> CSV
              </button>
              <button className="rd-add-btn" onClick={c.onDownloadPDF}>
                <FileText size={13} /> PDF
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: 6, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--accent)" }}>Consolidated report</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>All three reports combined into one file, in labelled sections.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="rd-add-btn"
            style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
            onClick={() => downloadCSV(`resourcing-consolidated-report-${stamp}.csv`, buildConsolidatedReport(people, skills, skillLevels, projects, allocations, totalsByPerson, proposedTotalsByPerson))}
          >
            <FileDown size={13} /> Consolidated CSV
          </button>
          <button
            className="rd-add-btn"
            style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
            onClick={() => buildConsolidatedPDF(people, skills, skillLevels, projects, allocations, totalsByPerson, proposedTotalsByPerson).save(`resourcing-consolidated-report-${stamp}.pdf`)}
          >
            <FileText size={13} /> Consolidated PDF
          </button>
        </div>
      </div>

      <div style={{ marginTop: 22, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Full data backup (JSON)</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Every underlying record - team, skills, projects, allocations, pipeline - in one restorable file. Restore it from Settings.
          </div>
        </div>
        <button className="rd-add-btn" onClick={onExportBackup}>
          <FileDown size={13} /> Export JSON backup
        </button>
      </div>
    </div>
  );
}

// ---------- Settings ----------
function SettingsPage({ editUnlocked, people, skills, skillLevels, lockedPeople, projects, upcoming, logRetentionDays, clearLog, onClearScope, onSetRetentionDays, onImportBackup, onImportSkillMatrix }) {
  const [pendingScope, setPendingScope] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retentionDraft, setRetentionDraft] = useState(String(logRetentionDays));

  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const importInputRef = useRef(null);

  const [xlsxFile, setXlsxFile] = useState(null);
  const [xlsxParsed, setXlsxParsed] = useState(null);
  const [xlsxPassword, setXlsxPassword] = useState("");
  const [xlsxError, setXlsxError] = useState("");
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const xlsxInputRef = useRef(null);

  const downloadTemplate = () => {
    const wb = buildSkillMatrixWorkbook(people, skills, skillLevels);
    XLSX.writeFile(wb, `team-skill-matrix-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const pickXlsxFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setXlsxError("");
    setXlsxFile(null);
    setXlsxParsed(null);
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSkillMatrixWorkbook(buffer);
      setXlsxFile(file.name);
      setXlsxParsed(parsed);
    } catch (err) {
      setXlsxError(err.message || String(err));
    }
  };

  const cancelXlsxImport = () => {
    setXlsxFile(null);
    setXlsxParsed(null);
    setXlsxPassword("");
    setXlsxError("");
  };

  const confirmXlsxImport = async () => {
    if (xlsxPassword !== CLEAR_DATA_PASSWORD) {
      setXlsxError("Incorrect password.");
      return;
    }
    setXlsxBusy(true);
    const reconciled = reconcileImportedSkillMatrix(xlsxParsed, people, skills, lockedPeople);
    await onImportSkillMatrix(reconciled);
    setXlsxBusy(false);
    cancelXlsxImport();
  };

  const pickImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setImportError("");
    setImportFile(null);
    setImportData(null);
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.people) || !Array.isArray(data.skills) || !Array.isArray(data.projects)) {
        throw new Error("This file doesn't look like a resourcing backup.");
      }
      setImportFile(file.name);
      setImportData(data);
    } catch (err) {
      setImportError(err.message || String(err));
    }
  };

  const cancelImport = () => {
    setImportFile(null);
    setImportData(null);
    setImportPassword("");
    setImportError("");
  };

  const confirmImport = async () => {
    if (importPassword !== CLEAR_DATA_PASSWORD) {
      setImportError("Incorrect password.");
      return;
    }
    setImportBusy(true);
    await onImportBackup(importData);
    setImportBusy(false);
    cancelImport();
  };

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
          Bulk-manage data via Excel, restore a backup, or clear stored data. Changes below update the shared
          data for everyone immediately.
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <FileSpreadsheet size={15} /> Team & skill matrix (Excel)
      </div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Download the current team and skill matrix as an editable spreadsheet, update it, and upload it back to
          replace the team roster, skills and proficiency levels in one go - handy for bulk edits that would be
          tedious cell-by-cell in the app.
        </div>
        <button className="rd-add-btn" onClick={downloadTemplate} style={{ marginBottom: 14 }}>
          <FileSpreadsheet size={13} /> Download Excel template
        </button>

        <fieldset disabled={!editUnlocked} style={FIELDSET_RESET}>
          {!xlsxParsed ? (
            <>
              <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: "none" }} onChange={pickXlsxFile} />
              <button className="rd-add-btn" onClick={() => xlsxInputRef.current?.click()}>
                <Upload size={13} /> Choose Excel file to import
              </button>
              {xlsxError && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{xlsxError}</div>}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5 }}>
                Selected: <strong>{xlsxFile}</strong> &middot; {xlsxParsed.people.length} team member{xlsxParsed.people.length === 1 ? "" : "s"},{" "}
                {xlsxParsed.skillNames.length} skill{xlsxParsed.skillNames.length === 1 ? "" : "s"}, {xlsxParsed.skillEntries.length} proficiency entries
              </div>
              {xlsxParsed.warnings.length > 0 && (
                <div style={{ fontSize: 11.5, color: "var(--warn)", background: "var(--warn-light)", borderRadius: 4, padding: "6px 8px" }}>
                  {xlsxParsed.warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }}>
                <ShieldAlert size={13} /> Enter the password to replace the current team, skills and skill matrix with this file.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <input
                    className="rd-text"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={xlsxPassword}
                    onChange={(e) => setXlsxPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmXlsxImport(); }}
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
                <button className="rd-add-btn" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={confirmXlsxImport} disabled={xlsxBusy}>
                  <Upload size={13} /> {xlsxBusy ? "Importing..." : "Confirm import"}
                </button>
                <button className="rd-remove-btn" onClick={cancelXlsxImport} style={{ fontSize: 12.5 }}>Cancel</button>
              </div>
              {xlsxError && <div style={{ fontSize: 12, color: "var(--danger)" }}>{xlsxError}</div>}
            </div>
          )}
        </fieldset>
      </div>

      <fieldset disabled={!editUnlocked} style={FIELDSET_RESET}>

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
        <UploadCloud size={15} /> Restore from backup
      </div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Import a JSON file exported from Reports &rarr; "Export JSON backup". This replaces the team, skills, projects,
          allocations and pipeline data below with the contents of that file, for everyone viewing this app.
        </div>
        {!importData ? (
          <>
            <input ref={importInputRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={pickImportFile} />
            <button className="rd-add-btn" onClick={() => importInputRef.current?.click()}>
              <UploadCloud size={13} /> Choose backup file
            </button>
            {importError && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{importError}</div>}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5 }}>
              Selected: <strong>{importFile}</strong> &middot; {importData.people.length} team members, {importData.projects.length} projects
            </div>
            <div style={{ fontSize: 12, color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }}>
              <ShieldAlert size={13} /> Enter the password to overwrite the current shared data with this backup.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <input
                  className="rd-text"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmImport(); }}
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
              <button className="rd-add-btn" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={confirmImport} disabled={importBusy}>
                <UploadCloud size={13} /> {importBusy ? "Restoring..." : "Confirm restore"}
              </button>
              <button className="rd-remove-btn" onClick={cancelImport} style={{ fontSize: 12.5 }}>Cancel</button>
            </div>
            {importError && <div style={{ fontSize: 12, color: "var(--danger)" }}>{importError}</div>}
          </div>
        )}
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
      </fieldset>
    </div>
  );
}

// ---------- User manual ----------
const MANUAL_SECTIONS = [
  {
    id: "access",
    title: "Signing in & access levels",
    body: (
      <>
        <p>
          Everything in this app - including just viewing it - sits behind the team's shared login
          (email + password, created for you by whoever set the app up). There's no public sign-up page.
        </p>
        <p>
          Once signed in, the app opens in <strong>view-only mode</strong>: you can see every page, but
          buttons and fields are disabled. To make changes, unlock editing with the separate edit password
          at the bottom of the sidebar. That's a lighter, second gate on top of login - it exists so people
          can browse safely without accidentally changing a cell, and it resets per browser (you'll need to
          re-enter it on a new device). Reports, Timeline and this manual are always readable without
          unlocking editing, since they don't change anything.
        </p>
        <p>Use "Log out" in the sidebar to end your session.</p>
      </>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    body: (
      <>
        <p>The landing page - a ready reckoner of where things stand:</p>
        <ul>
          <li>Stat cards for team size, active projects, average utilisation, anyone over-committed,
            spare bench capacity (in FTE), pipeline projects, proposed splits awaiting a decision, and
            how many projects are over their proposed FTE budget. Click any card to jump to the page
            it's about.</li>
          <li>A team allocation table (current % and status per person) and a projects overview table
            (headcount, allocated FTE, proposed/budgeted FTE, and the variance between them, color-coded
            over/under budget).</li>
          <li>A pipeline &amp; skill gaps panel - flags any upcoming project that needs a skill nobody
            on the team currently holds at Advanced level or higher.</li>
        </ul>
      </>
    ),
  },
  {
    id: "projects",
    title: "Projects",
    body: (
      <>
        <p>
          The master list of active projects/programs. Add, edit or remove a project here - name,
          start/end dates, the skills it requires (used for the skill-gap check and the Forward
          Capacity ranking), and its <strong>proposed FTE</strong>. Current Utilisation only manages
          who's allocated to projects already on this list; it doesn't add or remove projects itself.
        </p>
        <p>
          <strong>Proposed FTE</strong> is the FTE that was proposed/budgeted for the project - not to
          be confused with a split's "current vs proposed" status in Current Utilisation, which is a
          different, per-person concept. Each project's card shows this figure next to the FTE actually
          allocated (summed from everyone's current splits) and flags the difference as over or under
          budget once it's off by 0.05 FTE or more. See Reports &rarr; Budget variance for the full
          picture across every project.
        </p>
      </>
    ),
  },
  {
    id: "skills",
    title: "Skill matrix",
    body: (
      <>
        <p>
          One row per team member, one column per skill. Click a cell to cycle its proficiency: None,
          Basic, Working, Advanced, Expert.
        </p>
        <ul>
          <li>Add or remove team members and skills from the controls under the table.</li>
          <li>Edit a person's name/role with the pencil icon next to their name.</li>
          <li>Lock a row (the lock icon) to stop its proficiency levels from being changed - handy once
            someone's levels are agreed and shouldn't shift accidentally.</li>
        </ul>
      </>
    ),
  },
  {
    id: "current",
    title: "Current utilisation",
    body: (
      <>
        <p>
          Who's allocated to what, as a percentage (with the FTE equivalent shown underneath). Every
          person/project cell can hold more than one time-phased <strong>split</strong> - use "Split" to
          add another segment, each with its own %, date range and status.
        </p>
        <ul>
          <li><strong>Current vs proposed</strong> - a split is either "Current" (committed) or
            "Proposed" (a draft change being compared against what's committed). A proposed split shows
            Accept (promotes it to current) / Reject (discards it) buttons. A current split can be sent
            back to "Proposed" with its own toggle. The per-person and per-project totals, and the
            "Pending proposals" stat, all key off this.</li>
          <li><strong>Dates</strong> - set a split's start/end date, then confirm it (checkmark) to lock
            it to read-only text with an edit (pencil) toggle to reopen it. If a confirmed split's dates
            fall outside its project's own duration, it's highlighted with an "Outside window" warning.</li>
          <li>The table footer totals current and proposed FTE per project; the chart below totals
            allocation per person, stacked by project.</li>
        </ul>
      </>
    ),
  },
  {
    id: "forward",
    title: "Forward capacity",
    body: (
      <>
        <p>
          Shows free capacity today (100% minus current allocation) per person, and for each upcoming
          project in the pipeline, every team member ranked against it - not just a shortlist.
        </p>
        <ul>
          <li><strong>Ranking weights</strong> - a slider at the top controls how much the score weighs
            skill match vs free capacity (defaults to 70% skill / 30% capacity). Adjust it and every
            project's ranking recalculates immediately.</li>
          <li>Each project's table shows every person's level in each required skill, their average
            skill match, free capacity, and overall score, sorted best-fit first. The top 3 are badged
            "TOP 1/2/3" and highlighted, but everyone stays in the list - people at 90%+ allocation
            aren't excluded, just flagged with a warning icon next to their name (amber at 90-100%,
            red over 100%) so you can still see them as an option.</li>
          <li>If nobody on the team holds Advanced or Expert level in one of the project's required
            skills, that's called out explicitly above the table as a skill gap.</li>
        </ul>
        <p>Add an upcoming project with its required skills using the form at the bottom; remove one with the X.</p>
      </>
    ),
  },
  {
    id: "timeline",
    title: "Timeline",
    body: (
      <>
        <p>
          A Gantt-style view of every dated allocation split, grouped by project or by person (toggle at
          the top). Solid bars are current splits, dashed amber bars are proposed, and a bar outlined in
          red means that split falls outside its project's duration. A vertical line marks today.
        </p>
      </>
    ),
  },
  {
    id: "reports",
    title: "Reports & backup",
    body: (
      <>
        <p>
          Download-ready summaries: a skills/proficiency report, an allocation-by-project report
          (grouped by project, ordered by period, current vs proposed), a per-resource utilisation
          report, and a <strong>budget variance report</strong> (proposed vs allocated FTE per project,
          flagging discrepancies that could impact financials) - each as CSV or PDF, or all four combined
          into one consolidated file. The live tables above them mirror the same data on-screen.
        </p>
        <p>
          Separately, <strong>"Export JSON backup"</strong> at the bottom of this page downloads every
          underlying record - team, skills, proficiency, projects, allocations, pipeline, settings - as
          one file. Unlike the CSV/PDF reports, this is round-trippable: it's the file you'd use to
          restore the app's full state (see Settings below), not just read.
        </p>
      </>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    body: (
      <>
        <p>
          <strong>Team &amp; skill matrix (Excel)</strong> - download a spreadsheet template
          (pre-filled with the current team and skill matrix, or a small example if there's nothing yet)
          from the "Read me" sheet's instructions, edit it in Excel or Sheets, then upload it back to
          replace the team roster, skills and proficiency levels in one go. The template has two sheets:
          "Team" (Name, Role) and "Skill Matrix" (one row per person, one column per skill, valued
          None/Basic/Working/Advanced/Expert or 0-4). Re-importing matches people and skills by name to
          keep existing allocations and locks intact; anything not in the file is removed. The download
          button works in view-only mode; the actual import is password-gated like the actions below.
        </p>
        <p>
          Two further destructive actions, both password-gated (the same edit-adjacent "clear data"
          password) so they can't happen by accident:
        </p>
        <ul>
          <li><strong>Clear data</strong> - wipe the skill matrix, current utilisation, forward capacity,
            or everything, immediately and for everyone. Every clear is recorded in the log below with a
            timestamp, kept for a configurable number of days.</li>
          <li><strong>Restore from backup</strong> - upload a JSON file from Reports &rarr;
            "Export JSON backup" to replace all of the above with that file's contents. You'll see a
            preview (file name, team/project counts) before confirming.</li>
        </ul>
      </>
    ),
  },
];

function UserManual() {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>User manual</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          What each page does and how the pieces fit together.
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", marginBottom: 20 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
          On this page
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MANUAL_SECTIONS.map((s) => (
            <a key={s.id} href={`#manual-${s.id}`} className="rd-tag" style={{ textDecoration: "none" }}>
              {s.title}
            </a>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {MANUAL_SECTIONS.map((s) => (
          <div key={s.id} id={`manual-${s.id}`} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px", scrollMarginTop: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Login ----------
// One shared account for the whole team, created in the Supabase dashboard
// (no public sign-up here). The check happens server-side via Supabase Auth,
// and Row Level Security requires an authenticated session for any read or
// write, so this can't be bypassed by editing the client bundle.
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(signInError.message);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
      <form
        onSubmit={submit}
        style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "32px 28px", width: 320, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>Resourcing</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Sign in with the team login to continue.</div>
        </div>
        <input
          className="rd-text"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <input
          className="rd-text"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="rd-add-btn"
          style={{ justifyContent: "center", borderStyle: "solid", background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }}
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// ---------- Shared small components ----------
function EditAccessControl({ editUnlocked, onUnlock, onLock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const tryUnlock = () => {
    if (onUnlock(password)) {
      setPassword("");
      setError("");
    } else {
      setError("Incorrect password.");
    }
  };

  if (editUnlocked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sidebar-accent)", fontWeight: 600 }}>
          <Unlock size={13} /> Edit mode
        </div>
        <button
          onClick={onLock}
          title="Switch to view-only"
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--sidebar-text)", background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "3px 7px", cursor: "pointer" }}
        >
          <Lock size={11} /> Lock
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sidebar-text)", fontWeight: 600, marginBottom: 6 }}>
        <Lock size={13} /> View only
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="password"
          placeholder="Edit password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") tryUnlock(); }}
          style={{ flex: 1, minWidth: 0, fontSize: 11.5, padding: "5px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff" }}
        />
        <button
          onClick={tryUnlock}
          title="Unlock editing"
          style={{ display: "flex", alignItems: "center", color: "var(--sidebar-accent)", background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "0 8px", cursor: "pointer" }}
        >
          <KeyRound size={13} />
        </button>
      </div>
      {error && <div style={{ fontSize: 10.5, color: "#E08A73", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px", minWidth: 140, flex: "1 1 140px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--text)", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function AddRow({ placeholder, value, setValue, onAdd }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input className="rd-text" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }} style={{ minWidth: 200 }} />
      <button className="rd-add-btn" onClick={onAdd}><Plus size={13} /> Add</button>
    </div>
  );
}

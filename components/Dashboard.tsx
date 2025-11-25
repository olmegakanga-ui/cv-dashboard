"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const INVALID_LABEL = "(CV non lisible automatiquement)";

type CandidateRow = {
  id: string;
  full_name: string | null;
  file_name: string | null;
  cv_url?: string | null;
  degree_level: string | null;
  field_of_study: string | null;
  education_raw: string | null;
  total_experience_years: number | null;
  last_job_title: string | null;
  last_company: string | null;
  experience_raw: string | null;
  speaks_english: boolean | null;
  english_level: string | null;
  cv_language: string | null;
  profile_type: string | null;
  score_profil: number | null;
  notes: string | null;
  cv_batch: string | null;
};

type TabKey = "tous" | "profil_cible" | "cv_anglais";
type ProfileFilter = "all" | "A" | "B" | "C" | "review";
type SortKey = "name" | "score_desc" | "exp_desc";

type Stats = {
  total: number;
  invalid: number;
  countA: number;
  countB: number;
  countC: number;
  countReview: number;
};

export default function Dashboard({ lot }: { lot: "LOT1" | "LOT2" }) {
  const [activeTab, setActiveTab] = useState<TabKey>("tous");

  const [allCandidates, setAllCandidates] = useState<CandidateRow[]>([]);
  const [profilCible, setProfilCible] = useState<CandidateRow[]>([]);
  const [cvAnglais, setCvAnglais] = useState<CandidateRow[]>([]);

  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("all");
  const [hideInvalid, setHideInvalid] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot]);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: dataAll, error: errorAll } = await supabase
        .from("dashboard_all_candidates")
        .select("*")
        .eq("cv_batch", lot)
        .order("full_name", { ascending: true });

      if (errorAll) setErrorMsg("Erreur chargement: Tous les candidats");
      else setAllCandidates((dataAll ?? []) as CandidateRow[]);

      const { data: dataProfil, error: errorProfil } = await supabase
        .from("dashboard_profil_cible")
        .select("*")
        .eq("cv_batch", lot)
        .order("full_name", { ascending: true });

      if (errorProfil) setErrorMsg("Erreur chargement: Profils cibles");
      else setProfilCible((dataProfil ?? []) as CandidateRow[]);

      const { data: dataAnglais, error: errorAnglais } = await supabase
        .from("dashboard_cv_anglais")
        .select("*")
        .eq("cv_batch", lot)
        .order("full_name", { ascending: true });

      if (errorAnglais) setErrorMsg("Erreur chargement: CV en anglais");
      else setCvAnglais((dataAnglais ?? []) as CandidateRow[]);
    } finally {
      setLoading(false);
    }
  }

  function isInvalidRow(row: CandidateRow) {
    return row.full_name === INVALID_LABEL;
  }

  function matchesProfileFilter(row: CandidateRow, filter: ProfileFilter) {
    if (filter === "all") return true;
    const t = (row.profile_type || "").toUpperCase().replace(/\s+/g, "");
    if (filter === "A") return t === "A";
    if (filter === "B") return t === "B";
    if (filter === "C") return t === "C";
    if (filter === "review") return t === "ÀREVOIR" || t === "AREVOIR";
    return true;
  }

  function applySort(rows: CandidateRow[]) {
    const copy = [...rows];
    if (sortKey === "name") {
      copy.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      return copy;
    }
    if (sortKey === "score_desc") {
      copy.sort((a, b) => (b.score_profil ?? -1) - (a.score_profil ?? -1));
      return copy;
    }
    if (sortKey === "exp_desc") {
      copy.sort(
        (a, b) => (b.total_experience_years ?? -1) - (a.total_experience_years ?? -1)
      );
      return copy;
    }
    return copy;
  }

  function filterRows(input: CandidateRow[]) {
    const trimmed = search.trim().toLowerCase();
    const filtered = input.filter((row) => {
      if (hideInvalid && isInvalidRow(row)) return false;
      if (!matchesProfileFilter(row, profileFilter)) return false;
      if (!trimmed) return true;
      return (row.full_name || "").toLowerCase().includes(trimmed);
    });
    return applySort(filtered);
  }

  const filteredAll = useMemo(() => filterRows(allCandidates), [allCandidates, search, profileFilter, hideInvalid, sortKey]);
  const filteredProfil = useMemo(() => filterRows(profilCible), [profilCible, search, profileFilter, hideInvalid, sortKey]);
  const filteredAnglais = useMemo(() => filterRows(cvAnglais), [cvAnglais, search, profileFilter, hideInvalid, sortKey]);

  const statsAll = useMemo(() => computeStats(allCandidates), [allCandidates]);
  const statsProfil = useMemo(() => computeStats(profilCible), [profilCible]);
  const statsAnglais = useMemo(() => computeStats(cvAnglais), [cvAnglais]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center">
      <div className="w-full max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Recrutement 2025 — {lot}
            </h1>
            <p className="text-sm text-slate-400">
              Trois dashboards (Tous / Profils cibles / CV anglais) + stats + filtres
            </p>
          </div>
          <button
            onClick={loadData}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"
          >
            🔄 Rafraîchir
          </button>
        </header>

        {/* Tabs + filtres */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <TabButton active={activeTab === "tous"} onClick={() => setActiveTab("tous")}>Tous</TabButton>
            <TabButton active={activeTab === "profil_cible"} onClick={() => setActiveTab("profil_cible")}>Profils cibles</TabButton>
            <TabButton active={activeTab === "cv_anglais"} onClick={() => setActiveTab("cv_anglais")}>CV anglais</TabButton>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value as ProfileFilter)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tous les profils</option>
                <option value="A">Profil A</option>
                <option value="B">Profil B</option>
                <option value="C">Profil C</option>
                <option value="review">À revoir</option>
              </select>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="name">Trier: Nom</option>
                <option value="score_desc">Trier: Score (desc)</option>
                <option value="exp_desc">Trier: Expérience (desc)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                checked={hideInvalid}
                onChange={(e) => setHideInvalid(e.target.checked)}
              />
              <span>Masquer CV inutilisables</span>
            </label>
          </div>
        </div>

        <ScoringInfo />

        {/* Stats + “tri rapide” en cliquant */}
        {activeTab === "tous" && (
          <StatsBar
            title="Stats — Tous"
            stats={statsAll}
            onClickProfile={(p) => setProfileFilter(p)}
          />
        )}
        {activeTab === "profil_cible" && (
          <StatsBar
            title="Stats — Profils cibles"
            stats={statsProfil}
            onClickProfile={(p) => setProfileFilter(p)}
          />
        )}
        {activeTab === "cv_anglais" && (
          <StatsBar
            title="Stats — CV anglais"
            stats={statsAnglais}
            onClickProfile={(p) => setProfileFilter(p)}
          />
        )}

        {loading && <div className="mb-4 text-sm text-slate-300">Chargement…</div>}
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        <section className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-4 shadow-xl shadow-black/50">
          {activeTab === "tous" && <CandidatesTable rows={filteredAll} showLanguage />}
          {activeTab === "profil_cible" && <CandidatesTable rows={filteredProfil} />}
          {activeTab === "cv_anglais" && <CandidatesTable rows={filteredAnglais} />}
        </section>
      </div>
    </main>
  );
}

/* ---------------- UI ---------------- */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
        active ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30" : "text-slate-300 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function ScoringInfo() {
  return (
    <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs sm:text-sm text-slate-300">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-emerald-400">ⓘ</span>
        <div>
          <p className="font-medium text-slate-100 mb-1">Comment est calculé le score ?</p>
          <p>
            Score /100 = ~40% diplôme+domaine, ~40% expérience, ~20% anglais.
            Profil = <b>A</b>(≥80), <b>B</b>(60–79), <b>C</b>(40–59), <b>À revoir</b>(&lt;40).
            Survoler la pastille affiche la note IA.
          </p>
        </div>
      </div>
    </div>
  );
}

function computeStats(rows: CandidateRow[]) {
  let total = rows.length;
  let invalid = 0;
  let countA = 0, countB = 0, countC = 0, countReview = 0;

  for (const r of rows) {
    if (r.full_name === INVALID_LABEL) { invalid++; continue; }
    const t = (r.profile_type || "").toUpperCase().replace(/\s+/g, "");
    if (t === "A") countA++;
    else if (t === "B") countB++;
    else if (t === "C") countC++;
    else if (t === "ÀREVOIR" || t === "AREVOIR") countReview++;
  }
  return { total, invalid, countA, countB, countC, countReview } as Stats;
}

function StatsBar({
  title,
  stats,
  onClickProfile,
}: {
  title: string;
  stats: Stats;
  onClickProfile: (p: ProfileFilter) => void;
}) {
  const retained = Math.max(0, stats.total - stats.invalid);
  return (
    <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="mb-2 text-xs text-slate-300">{title} — (cliquer sur A/B/C/À revoir pour filtrer)</div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatPill label="CV uploadés" value={stats.total} />
        <StatPill label="CV inutilisables" value={stats.invalid} tone="red" />
        <StatPill label="CV utilisables" value={retained} tone="blue" />
        <StatPill label="Profils A" value={stats.countA} tone="green" clickable onClick={() => onClickProfile("A")} />
        <StatPill label="Profils B" value={stats.countB} tone="blue" clickable onClick={() => onClickProfile("B")} />
        <StatPill label="Profils C" value={stats.countC} tone="amber" clickable onClick={() => onClickProfile("C")} />
      </div>
      <div className="mt-2">
        <StatPill
          label="À revoir"
          value={stats.countReview}
          tone="red"
          clickable
          onClick={() => onClickProfile("review")}
        />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "default",
  clickable = false,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "blue" | "amber" | "red";
  clickable?: boolean;
  onClick?: () => void;
}) {
  const base = "flex flex-col rounded-xl border px-3 py-2 text-xs sm:text-sm";
  const tones: Record<string, string> = {
    default: "border-slate-700 bg-slate-900/80 text-slate-200",
    green: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
    blue: "border-sky-500/60 bg-sky-500/10 text-sky-200",
    amber: "border-amber-500/60 bg-amber-500/10 text-amber-100",
    red: "border-rose-500/60 bg-rose-500/10 text-rose-100",
  };
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      className={`${base} ${tones[tone]} ${clickable ? "hover:opacity-90 cursor-pointer text-left" : "cursor-default text-left"}`}
    >
      <span className="text-[11px] uppercase tracking-wide opacity-80">{label}</span>
      <span className="mt-1 text-base font-semibold">{value}</span>
    </button>
  );
}

function getProfileBadgeClasses(profile_type?: string | null) {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
  switch (profile_type) {
    case "A":
      return `${base} bg-emerald-500/15 border-emerald-400/60 text-emerald-300`;
    case "B":
      return `${base} bg-sky-500/15 border-sky-400/60 text-sky-300`;
    case "C":
      return `${base} bg-amber-500/20 border-amber-400/60 text-amber-200`;
    case "À revoir":
    case "A revoir":
      return `${base} bg-rose-500/20 border-rose-400/60 text-rose-200`;
    default:
      return `${base} bg-slate-700/40 border-slate-600/60 text-slate-200`;
  }
}

function CandidatesTable({ rows, showLanguage = false }: { rows: CandidateRow[]; showLanguage?: boolean }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-300">Aucune donnée pour ce filtre.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-800 text-slate-300">
          <tr className="bg-slate-900/80">
            <th className="px-3 py-2 text-left">Candidat</th>
            <th className="px-3 py-2 text-left">Profil</th>
            <th className="px-3 py-2 text-left">Diplôme</th>
            <th className="px-3 py-2 text-left">Domaine</th>
            <th className="px-3 py-2 text-left">Exp. (ans)</th>
            <th className="px-3 py-2 text-left">Dernier poste</th>
            <th className="px-3 py-2 text-left">Anglais</th>
            {showLanguage && <th className="px-3 py-2 text-left">Langue CV</th>}
            <th className="px-3 py-2 text-left">CV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const exp = row.total_experience_years ?? 0;
            const englishLabel = row.english_level || (row.speaks_english ? "Anglais: oui" : "—");
            const profileLabel = row.profile_type || "—";
            const scoreLabel = typeof row.score_profil === "number" ? `${row.score_profil.toFixed(0)}/100` : "—";
            const notes = row.notes?.trim() ? row.notes : undefined;

            return (
              <tr key={row.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{row.full_name || "—"}</span>
                    <span className="text-xs text-slate-400">{row.last_company || ""}</span>
                  </div>
                </td>

                <td className="px-3 py-2">
                  <div className={getProfileBadgeClasses(row.profile_type)} title={notes}>
                    <span>{profileLabel}</span>
                    <span className="ml-2 text-[10px] text-slate-200/80">{scoreLabel}</span>
                  </div>
                </td>

                <td className="px-3 py-2">{row.degree_level || "—"}</td>
                <td className="px-3 py-2">{row.field_of_study || "—"}</td>
                <td className="px-3 py-2">{exp.toFixed(1).replace(".", ",")}</td>
                <td className="px-3 py-2">{row.last_job_title || "—"}</td>
                <td className="px-3 py-2 text-xs">{englishLabel}</td>
                {showLanguage && <td className="px-3 py-2 text-xs">{row.cv_language || "—"}</td>}

                <td className="px-3 py-2">
                  {row.file_name ? (
                    row.cv_url ? (
                      <a
                        href={row.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs text-emerald-300 underline decoration-emerald-500/60 hover:bg-slate-700"
                      >
                        {row.file_name}
                      </a>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
                        {row.file_name}
                      </span>
                    )
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Constant pour marquer les CV non lisibles automatiquement
 * (doit être identique à ce que tu mets côté script Node)
 */
const INVALID_LABEL = "(CV non lisible automatiquement)";

/**
 * Ligne standard pour tous les dashboards (tous, profils cibles, CV anglais)
 */
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
};

type TabKey = "tous" | "profil_cible" | "cv_anglais";
type ProfileFilter = "all" | "A" | "B" | "C" | "review";

type Stats = {
  total: number;
  invalid: number;
  countA: number;
  countB: number;
  countC: number;
  countReview: number;
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("tous");

  const [allCandidates, setAllCandidates] = useState<CandidateRow[]>([]);
  const [profilCible, setProfilCible] = useState<CandidateRow[]>([]);
  const [cvAnglais, setCvAnglais] = useState<CandidateRow[]>([]);

  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] =
    useState<ProfileFilter>("all");
  const [hideInvalid, setHideInvalid] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Tous les candidats
      const { data: dataAll, error: errorAll } = await supabase
        .from("dashboard_all_candidates")
        .select("*")
        .order("full_name", { ascending: true });

      if (errorAll) {
        console.error("Erreur tous candidats:", errorAll.message);
        setErrorMsg(
          "Erreur lors du chargement de la liste complète des candidats."
        );
      } else if (dataAll) {
        setAllCandidates(dataAll as CandidateRow[]);
      }

      // Profils cibles
      const { data: dataProfil, error: errorProfil } = await supabase
        .from("dashboard_profil_cible")
        .select("*")
        .order("full_name", { ascending: true });

      if (errorProfil) {
        console.error("Erreur profils cibles:", errorProfil.message);
        setErrorMsg("Erreur lors du chargement des profils cibles.");
      } else if (dataProfil) {
        setProfilCible(dataProfil as CandidateRow[]);
      }

      // CV en anglais
      const { data: dataAnglais, error: errorAnglais } = await supabase
        .from("dashboard_cv_anglais")
        .select("*")
        .order("full_name", { ascending: true });

      if (errorAnglais) {
        console.error("Erreur CV anglais:", errorAnglais.message);
        setErrorMsg("Erreur lors du chargement des CV en anglais.");
      } else if (dataAnglais) {
        setCvAnglais(dataAnglais as CandidateRow[]);
      }
    } finally {
      setLoading(false);
    }
  }

  // Helpers filtres
  function isInvalidRow(row: CandidateRow) {
    return row.full_name === INVALID_LABEL;
  }

  function matchesProfileFilter(row: CandidateRow, filter: ProfileFilter) {
    if (filter === "all") return true;
    const t = (row.profile_type || "").toUpperCase().replace(/\s+/g, "");
    if (filter === "A") return t === "A";
    if (filter === "B") return t === "B";
    if (filter === "C") return t === "C";
    if (filter === "review")
      return t === "ÀREVOIR" || t === "AREVOIR";
    return true;
  }

  // Filtrage des lignes selon recherche + filtres
  const filteredAll = allCandidates.filter((row) => {
    if (hideInvalid && isInvalidRow(row)) return false;
    if (!matchesProfileFilter(row, profileFilter)) return false;
    if (!search) return true;
    const name = row.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredProfilCible = profilCible.filter((row) => {
    if (hideInvalid && isInvalidRow(row)) return false;
    if (!matchesProfileFilter(row, profileFilter)) return false;
    if (!search) return true;
    const name = row.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredCvAnglais = cvAnglais.filter((row) => {
    if (hideInvalid && isInvalidRow(row)) return false;
    if (!matchesProfileFilter(row, profileFilter)) return false;
    if (!search) return true;
    const name = row.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Statistiques par segment (non filtrées → sur la population réelle)
  const statsAll = computeStats(allCandidates);
  const statsProfil = computeStats(profilCible);
  const statsAnglais = computeStats(cvAnglais);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center">
      <div className="w-full max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Tableau de bord – Recrutement 2025
            </h1>
            <p className="text-sm text-slate-400">
              Analyse automatique des CV (Supabase + IA OpenAI).
            </p>
          </div>
          <button
            onClick={loadData}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"
          >
            🔄 Rafraîchir les données
          </button>
        </header>

        {/* Tabs + recherche + filtres */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <TabButton
                active={activeTab === "tous"}
                onClick={() => setActiveTab("tous")}
              >
                Tous les candidats
              </TabButton>
              <TabButton
                active={activeTab === "profil_cible"}
                onClick={() => setActiveTab("profil_cible")}
              >
                Profils cibles
              </TabButton>
              <TabButton
                active={activeTab === "cv_anglais"}
                onClick={() => setActiveTab("cv_anglais")}
              >
                CV en anglais
              </TabButton>
            </div>
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
                onChange={(e) =>
                  setProfileFilter(e.target.value as ProfileFilter)
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tous les profils</option>
                <option value="A">Profil A (≥ 80)</option>
                <option value="B">Profil B (60–79)</option>
                <option value="C">Profil C (40–59)</option>
                <option value="review">Profil “À revoir”</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                checked={hideInvalid}
                onChange={(e) => setHideInvalid(e.target.checked)}
              />
              <span>Masquer les CV inutilisables</span>
            </label>
          </div>
        </div>

        {/* Bloc explication scoring */}
        <ScoringInfo />

        {/* Bloc statistiques selon l'onglet */}
        {activeTab === "tous" && <StatsBarAll stats={statsAll} />}
        {activeTab === "profil_cible" && (
          <StatsBarProfil
            statsGlobal={statsAll}
            statsSegment={statsProfil}
          />
        )}
        {activeTab === "cv_anglais" && (
          <StatsBarAnglais
            statsGlobal={statsAll}
            statsSegment={statsAnglais}
          />
        )}

        {/* Info / erreurs */}
        {loading && (
          <div className="mb-4 text-sm text-slate-300">
            Chargement des données…
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Contenu des tabs */}
        <section className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-4 shadow-xl shadow-black/50">
          {activeTab === "tous" && <AllCandidatesTable rows={filteredAll} />}
          {activeTab === "profil_cible" && (
            <ProfilCibleTable rows={filteredProfilCible} />
          )}
          {activeTab === "cv_anglais" && (
            <CvAnglaisTable rows={filteredCvAnglais} />
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- UI HELPERS ---------- */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
        active
          ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30"
          : "text-slate-300 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Petit bloc qui explique comment les candidats sont scorés
 */
function ScoringInfo() {
  return (
    <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs sm:text-sm text-slate-300">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-emerald-400">ⓘ</span>
        <div>
          <p className="font-medium text-slate-100 mb-1">
            Lecture du score & du profil
          </p>
          <p>
            Chaque candidat reçoit un score sur 100 et un type de profil :
            <span className="ml-1 font-semibold text-emerald-300">
              A&nbsp;(≥ 80)
            </span>
            ,
            <span className="ml-1 font-semibold text-sky-300">
              B&nbsp;(60–79)
            </span>
            ,
            <span className="ml-1 font-semibold text-amber-300">
              C&nbsp;(40–59)
            </span>{" "}
            ou{" "}
            <span className="ml-1 font-semibold text-rose-300">
              À revoir&nbsp;(&lt; 40)
            </span>
            .
          </p>
          <p className="mt-1">
            Le score combine ~40 % diplôme/domaine (économie, informatique,
            data…), ~40 % années d&apos;expérience et ~20 % niveau d&apos;anglais.
            En passant la souris sur la pastille de profil, vous voyez
            une synthèse courte générée par l&apos;IA.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- STATS ---------- */

function computeStats(rows: CandidateRow[]): Stats {
  let total = rows.length;
  let invalid = 0;
  let countA = 0;
  let countB = 0;
  let countC = 0;
  let countReview = 0;

  for (const r of rows) {
    const isInvalid = r.full_name === INVALID_LABEL;
    if (isInvalid) {
      invalid++;
      continue;
    }

    const t = (r.profile_type || "").toUpperCase().replace(/\s+/g, "");
    if (t === "A") countA++;
    else if (t === "B") countB++;
    else if (t === "C") countC++;
    else if (t === "ÀREVOIR" || t === "AREVOIR") countReview++;
  }

  return { total, invalid, countA, countB, countC, countReview };
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "blue" | "amber" | "red";
}) {
  const base =
    "flex flex-col rounded-xl border px-3 py-2 text-xs sm:text-sm";
  const tones: Record<string, string> = {
    default: "border-slate-700 bg-slate-900/80 text-slate-200",
    green: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
    blue: "border-sky-500/60 bg-sky-500/10 text-sky-200",
    amber: "border-amber-500/60 bg-amber-500/10 text-amber-100",
    red: "border-rose-500/60 bg-rose-500/10 text-rose-100",
  };

  return (
    <div className={`${base} ${tones[tone]}`}>
      <span className="text-[11px] uppercase tracking-wide opacity-80">
        {label}
      </span>
      <span className="mt-1 text-base font-semibold">{value}</span>
    </div>
  );
}

/** Stats pour le dashboard "Tous les candidats" */
function StatsBarAll({ stats }: { stats: Stats }) {
  const retenus =
    stats.total - stats.invalid < 0 ? 0 : stats.total - stats.invalid;

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatPill label="CV uploadés" value={stats.total} />
      <StatPill label="CV inutilisables" value={stats.invalid} tone="red" />
      <StatPill label="CV retenus (utilisables)" value={retenus} tone="blue" />
      <StatPill label="Profils A" value={stats.countA} tone="green" />
      <StatPill label="Profils B" value={stats.countB} tone="blue" />
      <StatPill label="Profils C" value={stats.countC} tone="amber" />
    </div>
  );
}

/** Stats pour le dashboard "Profils cibles" */
function StatsBarProfil({
  statsGlobal,
  statsSegment,
}: {
  statsGlobal: Stats;
  statsSegment: Stats;
}) {
  const retenusSegment =
    statsSegment.total - statsSegment.invalid < 0
      ? 0
      : statsSegment.total - statsSegment.invalid;

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatPill
        label="CV uploadés (global)"
        value={statsGlobal.total}
      />
      <StatPill
        label="CV inutilisables (global)"
        value={statsGlobal.invalid}
        tone="red"
      />
      <StatPill
        label="CV profil cible retenus"
        value={retenusSegment}
        tone="blue"
      />
      <StatPill
        label="Profils cibles A"
        value={statsSegment.countA}
        tone="green"
      />
      <StatPill
        label="Profils cibles B"
        value={statsSegment.countB}
        tone="blue"
      />
      <StatPill
        label="Profils cibles C"
        value={statsSegment.countC}
        tone="amber"
      />
    </div>
  );
}

/** Stats pour le dashboard "CV en anglais" */
function StatsBarAnglais({
  statsGlobal,
  statsSegment,
}: {
  statsGlobal: Stats;
  statsSegment: Stats;
}) {
  const retenusSegment =
    statsSegment.total - statsSegment.invalid < 0
      ? 0
      : statsSegment.total - statsSegment.invalid;

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatPill
        label="CV uploadés (global)"
        value={statsGlobal.total}
      />
      <StatPill
        label="CV inutilisables (global)"
        value={statsGlobal.invalid}
        tone="red"
      />
      <StatPill
        label="CV anglais retenus"
        value={retenusSegment}
        tone="blue"
      />
      <StatPill
        label="CV anglais profil A"
        value={statsSegment.countA}
        tone="green"
      />
      <StatPill
        label="CV anglais profil B"
        value={statsSegment.countB}
        tone="blue"
      />
      <StatPill
        label="CV anglais profil C"
        value={statsSegment.countC}
        tone="amber"
      />
    </div>
  );
}

/* ---------- PROFIL BADGE ---------- */

function getProfileBadgeClasses(profile_type?: string | null) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";

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

/* ---------- TABLES ---------- */

function AllCandidatesTable({ rows }: { rows: CandidateRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-300">
        Aucun candidat pour l&apos;instant.  
        Assurez-vous que les CV ont bien été importés et analysés.
      </p>
    );
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
            <th className="px-3 py-2 text-left">Langue CV</th>
            <th className="px-3 py-2 text-left">CV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const exp = row.total_experience_years ?? 0;
            const expBadge =
              exp >= 5
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : exp >= 3
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-slate-700/40 text-slate-200 border-slate-600/60";

            const englishLabel =
              row.english_level || (row.speaks_english ? "Anglais: oui" : "—");

            const profileLabel = row.profile_type || "—";
            const scoreLabel =
              typeof row.score_profil === "number"
                ? `${row.score_profil.toFixed(0)}/100`
                : "—";

            const notes =
              row.notes && row.notes.trim().length > 0 ? row.notes : undefined;

            return (
              <tr
                key={row.id}
                className="border-b border-slate-800/60 hover:bg-slate-800/40"
              >
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {row.full_name || "—"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {row.last_company || ""}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-2">
                  <div
                    className={getProfileBadgeClasses(row.profile_type)}
                    title={notes}
                  >
                    <span>{profileLabel}</span>
                    <span className="ml-2 text-[10px] text-slate-200/80">
                      {scoreLabel}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-2">{row.degree_level || "—"}</td>
                <td className="px-3 py-2">{row.field_of_study || "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${expBadge}`}
                  >
                    {exp.toFixed(1).replace(".", ",")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span>{row.last_job_title || "—"}</span>
                    <span className="text-xs text-slate-400 line-clamp-1">
                      {row.experience_raw || ""}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-200">
                  {englishLabel}
                </td>
                <td className="px-3 py-2 text-xs text-slate-300">
                  {row.cv_language || "—"}
                </td>
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

function ProfilCibleTable({ rows }: { rows: CandidateRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-300">
        Aucun profil ne correspond encore à vos critères.  
        Laissez le script analyser les CV, puis cliquez sur “Rafraîchir”.
      </p>
    );
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
            <th className="px-3 py-2 text-left">CV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const exp = row.total_experience_years ?? 0;
            const expBadge =
              exp >= 5
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : exp >= 3
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-slate-700/40 text-slate-200 border-slate-600/60";

            const englishLabel =
              row.english_level || (row.speaks_english ? "Anglais: oui" : "—");

            const profileLabel = row.profile_type || "—";
            const scoreLabel =
              typeof row.score_profil === "number"
                ? `${row.score_profil.toFixed(0)}/100`
                : "—";

            const notes =
              row.notes && row.notes.trim().length > 0 ? row.notes : undefined;

            return (
              <tr
                key={row.id}
                className="border-b border-slate-800/60 hover:bg-slate-800/40"
              >
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {row.full_name || "—"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {row.last_company || ""}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-2">
                  <div
                    className={getProfileBadgeClasses(row.profile_type)}
                    title={notes}
                  >
                    <span>{profileLabel}</span>
                    <span className="ml-2 text-[10px] text-slate-200/80">
                      {scoreLabel}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-2">{row.degree_level || "—"}</td>
                <td className="px-3 py-2">{row.field_of_study || "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${expBadge}`}
                  >
                    {exp.toFixed(1).replace(".", ",")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span>{row.last_job_title || "—"}</span>
                    <span className="text-xs text-slate-400 line-clamp-1">
                      {row.experience_raw || ""}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-200">
                  {englishLabel}
                </td>
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

function CvAnglaisTable({ rows }: { rows: CandidateRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-300">
        Aucun CV en anglais détecté pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-800 text-slate-300">
          <tr className="bg-slate-900/80">
            <th className="px-3 py-2 text-left">Candidat</th>
            <th className="px-3 py-2 text-left">Profil</th>
            <th className="px-3 py-2 text-left">Titre (dernier poste)</th>
            <th className="px-3 py-2 text-left">Diplôme</th>
            <th className="px-3 py-2 text-left">Domaine</th>
            <th className="px-3 py-2 text-left">CV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const profileLabel = row.profile_type || "—";
            const scoreLabel =
              typeof row.score_profil === "number"
                ? `${row.score_profil.toFixed(0)}/100`
                : "—";
            const notes =
              row.notes && row.notes.trim().length > 0 ? row.notes : undefined;

            return (
              <tr
                key={row.id}
                className="border-b border-slate-800/60 hover:bg-slate-800/40"
              >
                <td className="px-3 py-2">
                  <span className="font-medium">
                    {row.full_name || "—"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div
                    className={getProfileBadgeClasses(row.profile_type)}
                    title={notes}
                  >
                    <span>{profileLabel}</span>
                    <span className="ml-2 text-[10px] text-slate-200/80">
                      {scoreLabel}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {row.last_job_title || "—"}
                </td>
                <td className="px-3 py-2">
                  {row.degree_level || "—"}
                </td>
                <td className="px-3 py-2">
                  {row.field_of_study || "—"}
                </td>
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

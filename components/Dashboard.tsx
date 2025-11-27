"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Lot = "LOT1" | "LOT2";
type TabKey = "all" | "target" | "english";
type ProfileFilter = "ALL" | "A" | "B" | "C" | "A_REVOIR";
type SortKey = "name" | "score_desc" | "score_asc" | "exp_desc" | "exp_asc";

type CandidateRow = {
  id: string;

  // fichier / storage
  file_name: string | null;
  cv_url: string | null; // peut être une URL, ou un path storage, ou null
  cv_batch: string | null;

  // identité
  full_name: string | null;

  // extraction IA
  degree_level: string | null;
  field_of_study: string | null;
  total_experience_years: number | null;
  last_job_title: string | null;
  last_company: string | null;

  speaks_english: boolean | null;
  english_level: string | null;
  cv_language: string | null; // "en"/"fr"/etc.

  // scoring
  profile_type: string | null; // "A"/"B"/"C"/"A revoir" etc
  score_profil: number | null; // /100
  notes: string | null;

  // bruts (optionnel)
  education_raw?: string | null;
  experience_raw?: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function norm(s: unknown) {
  return String(s ?? "").trim();
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function toProfileFilter(profile_type: string | null): ProfileFilter {
  const p = (profile_type ?? "").toLowerCase();
  if (p.startsWith("a") && p.includes("revoir")) return "A_REVOIR";
  if (p === "a") return "A";
  if (p === "b") return "B";
  if (p === "c") return "C";
  return "ALL";
}

function profileBadgeLabel(p: ProfileFilter, score?: number | null) {
  if (p === "A_REVOIR") return `À revoir${score != null ? ` ${score}/100` : ""}`;
  if (p === "ALL") return "—";
  return `${p}${score != null ? ` ${score}/100` : ""}`;
}

function looksLikeUnusable(row: CandidateRow) {
  // heuristique: si nom vide OU beaucoup d'infos clés manquantes
  const name = norm(row.full_name);
  const hasKey =
    name.length > 2 ||
    norm(row.degree_level).length > 0 ||
    norm(row.field_of_study).length > 0 ||
    (row.total_experience_years ?? 0) > 0 ||
    norm(row.last_job_title).length > 0 ||
    norm(row.notes).toLowerCase().includes("non lisible");

  // si rien de solide => inutilisable
  return !hasKey;
}

function looksTargetProfile(row: CandidateRow) {
  // critères: Bac+5 / Licence / Master / Ingé + domaine proche + exp>=3 + anglais
  const degree = norm(row.degree_level).toLowerCase();
  const field = norm(row.field_of_study).toLowerCase();
  const exp = row.total_experience_years ?? 0;
  const eng = row.speaks_english === true || norm(row.english_level).length > 0;

  const degreeOk =
    degree.includes("bac+5") ||
    degree.includes("licence") ||
    degree.includes("master") ||
    degree.includes("ing") ||
    degree.includes("ingen");

  const fieldOk =
    field.includes("économie math") ||
    field.includes("economie math") ||
    field.includes("économie quant") ||
    field.includes("economie quant") ||
    field.includes("quant") ||
    field.includes("econom") ||
    field.includes("génie") ||
    field.includes("genie") ||
    field.includes("informat") ||
    field.includes("computer") ||
    field.includes("software") ||
    field.includes("data");

  return degreeOk && fieldOk && exp >= 3 && eng;
}

async function createSignedUrlIfNeeded(pathOrUrl: string, bucket: string) {
  if (!pathOrUrl) return null;
  if (isHttpUrl(pathOrUrl)) return pathOrUrl;

  // si c'est un path sans folder, ok. si c'est "bucket/fichier", on enlève éventuellement le prefix bucket/
  const cleaned = pathOrUrl.startsWith(bucket + "/")
    ? pathOrUrl.slice((bucket + "/").length)
    : pathOrUrl;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(cleaned, 60 * 15); // 15 minutes

  if (error) {
    console.error("Signed URL error:", error.message);
    return null;
  }
  return data.signedUrl;
}

function StatCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "text-left rounded-2xl border px-4 py-3 transition",
        "bg-white/5 hover:bg-white/10 border-white/10",
        active && "ring-2 ring-emerald-400/50"
      )}
    >
      <div className="text-xs text-white/70">{label}</div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </button>
  );
}

function Pill({
  kind,
  label,
  title,
}: {
  kind: "A" | "B" | "C" | "A_REVOIR" | "NONE";
  label: string;
  title?: string;
}) {
  const cls =
    kind === "A"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30"
      : kind === "B"
      ? "bg-sky-500/15 text-sky-200 border-sky-400/30"
      : kind === "C"
      ? "bg-amber-500/15 text-amber-200 border-amber-400/30"
      : kind === "A_REVOIR"
      ? "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30"
      : "bg-white/5 text-white/60 border-white/10";

  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        cls
      )}
    >
      {label}
    </span>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-semibold text-white">{title}</div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            Fermer
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function Dashboard({ lot }: { lot: Lot }) {
  const BUCKET = process.env.NEXT_PUBLIC_CV_BUCKET || "cvs"; // adapte si ton bucket a un autre nom

  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("ALL");
  const [hideUnusable, setHideUnusable] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");

  // modal CV
  const [cvOpen, setCvOpen] = useState(false);
  const [cvTitle, setCvTitle] = useState("");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvLoading, setCvLoading] = useState(false);

  const cvBatch = lot; // ✅ source de vérité : LOT vient de l’URL

  async function fetchAllCandidatesForLot(batch: Lot) {
    setLoading(true);
    setErrorMsg(null);

    try {
      const pageSize = 1000;
      let from = 0;
      let all: CandidateRow[] = [];

      while (true) {
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from("dashboard_all_candidates")
          .select(
            [
              "id",
              "file_name",
              "cv_url",
              "cv_batch",
              "full_name",
              "degree_level",
              "field_of_study",
              "total_experience_years",
              "last_job_title",
              "last_company",
              "speaks_english",
              "english_level",
              "cv_language",
              "profile_type",
              "score_profil",
              "notes",
              "education_raw",
              "experience_raw",
            ].join(",")
          )
          .eq("cv_batch", batch)
          .range(from, to);

        if (error) throw error;

        const chunk = (data ?? []) as CandidateRow[];
        all = all.concat(chunk);

        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      setRows(all);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.confirm?.message || e?.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllCandidatesForLot(cvBatch);
    // reset filtres visuels quand on change de lot
    setTab("all");
    setSearch("");
    setProfileFilter("ALL");
    setHideUnusable(false);
    setSortKey("name");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvBatch]);

  const computed = useMemo(() => {
    const usable: CandidateRow[] = [];
    const unusable: CandidateRow[] = [];

    for (const r of rows) {
      (looksLikeUnusable(r) ? unusable : usable).push(r);
    }

    const byProfile = {
      A: 0,
      B: 0,
      C: 0,
      A_REVOIR: 0,
    };

    const inc = (r: CandidateRow) => {
      const pf = toProfileFilter(r.profile_type);
      if (pf === "A") byProfile.A++;
      else if (pf === "B") byProfile.B++;
      else if (pf === "C") byProfile.C++;
      else if (pf === "A_REVOIR") byProfile.A_REVOIR++;
    };

    for (const r of rows) inc(r);

    // subsets
    const target = rows.filter((r) => looksTargetProfile(r));
    const english = rows.filter((r) => norm(r.cv_language).toLowerCase() === "en");

    const countProfiles = (arr: CandidateRow[]) => {
      const out = { A: 0, B: 0, C: 0, A_REVOIR: 0 };
      for (const r of arr) {
        const pf = toProfileFilter(r.profile_type);
        if (pf === "A") out.A++;
        else if (pf === "B") out.B++;
        else if (pf === "C") out.C++;
        else if (pf === "A_REVOIR") out.A_REVOIR++;
      }
      return out;
    };

    return {
      total: rows.length,
      usableCount: usable.length,
      unusableCount: unusable.length,
      byProfile,
      target: {
        total: target.length,
        usableCount: target.filter((r) => !looksLikeUnusable(r)).length,
        unusableCount: target.filter((r) => looksLikeUnusable(r)).length,
        byProfile: countProfiles(target),
      },
      english: {
        total: english.length,
        usableCount: english.filter((r) => !looksLikeUnusable(r)).length,
        unusableCount: english.filter((r) => looksLikeUnusable(r)).length,
        byProfile: countProfiles(english),
      },
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    let base = rows;

    if (tab === "target") base = base.filter((r) => looksTargetProfile(r));
    if (tab === "english") base = base.filter((r) => norm(r.cv_language).toLowerCase() === "en");

    if (hideUnusable) base = base.filter((r) => !looksLikeUnusable(r));

    const q = norm(search).toLowerCase();
    if (q) {
      base = base.filter((r) => {
        const name = norm(r.full_name).toLowerCase();
        const file = norm(r.file_name).toLowerCase();
        return name.includes(q) || file.includes(q);
      });
    }

    if (profileFilter !== "ALL") {
      base = base.filter((r) => toProfileFilter(r.profile_type) === profileFilter);
    }

    base = [...base].sort((a, b) => {
      const nameA = norm(a.full_name).toLowerCase();
      const nameB = norm(b.full_name).toLowerCase();
      const scoreA = a.score_profil ?? -1;
      const scoreB = b.score_profil ?? -1;
      const expA = a.total_experience_years ?? -1;
      const expB = b.total_experience_years ?? -1;

      switch (sortKey) {
        case "score_desc":
          return scoreB - scoreA;
        case "score_asc":
          return scoreA - scoreB;
        case "exp_desc":
          return expB - expA;
        case "exp_asc":
          return expA - expB;
        case "name":
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return base;
  }, [rows, tab, hideUnusable, search, profileFilter, sortKey]);

  async function openCv(row: CandidateRow) {
    setCvOpen(true);
    setCvLoading(true);
    setCvUrl(null);

    const name = norm(row.full_name) || "Candidat";
    const file = norm(row.file_name) || "CV";
    setCvTitle(`${name} — ${file}`);

    try {
      const candidatePathOrUrl = norm(row.cv_url) || norm(row.file_name);
      if (!candidatePathOrUrl) {
        setCvUrl(null);
        setCvLoading(false);
        return;
      }

      const signed = await createSignedUrlIfNeeded(candidatePathOrUrl, BUCKET);
      setCvUrl(signed);
    } finally {
      setCvLoading(false);
    }
  }

  const statsForTab = useMemo(() => {
    if (tab === "target") return computed.target;
    if (tab === "english") return computed.english;
    return {
      total: computed.total,
      usableCount: computed.usableCount,
      unusableCount: computed.unusableCount,
      byProfile: computed.byProfile,
    };
  }, [tab, computed]);

  const isStatActive = (key: ProfileFilter | "UNUSABLE" | "USABLE") => {
    if (key === "UNUSABLE") return hideUnusable === false && profileFilter === "ALL" && false;
    if (key === "USABLE") return hideUnusable === true;
    return profileFilter === key;
  };

  const scoreHelp =
    "Score /100 = ~40% diplôme+domaine, ~40% expérience, ~20% anglais. " +
    "Profil = A(>=80), B(60–79), C(40–59), À revoir(<40). Survole la pastille pour lire la note IA.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Recrutement 2025 — {cvBatch}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Trois dashboards (Tous / Profils cibles / CV anglais) + stats + filtres
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchAllCandidatesForLot(cvBatch)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Rafraîchir
            </button>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
              Total lot: <span className="text-white">{rows.length}</span>
            </div>
          </div>
        </div>

        {/* Tabs + filtres */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                className={cx(
                  "rounded-xl px-4 py-2 text-sm",
                  tab === "all" ? "bg-emerald-500/20 text-emerald-100" : "text-white/80 hover:bg-white/10"
                )}
                onClick={() => setTab("all")}
              >
                Tous
              </button>
              <button
                className={cx(
                  "rounded-xl px-4 py-2 text-sm",
                  tab === "target"
                    ? "bg-emerald-500/20 text-emerald-100"
                    : "text-white/80 hover:bg-white/10"
                )}
                onClick={() => setTab("target")}
              >
                Profils cibles
              </button>
              <button
                className={cx(
                  "rounded-xl px-4 py-2 text-sm",
                  tab === "english"
                    ? "bg-emerald-500/20 text-emerald-100"
                    : "text-white/80 hover:bg-white/10"
                )}
                onClick={() => setTab("english")}
              >
                CV anglais
              </button>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou fichier…"
              className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400/40"
            />

            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value as ProfileFilter)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none"
            >
              <option value="ALL">Tous les profils</option>
              <option value="A">Profil A</option>
              <option value="B">Profil B</option>
              <option value="C">Profil C</option>
              <option value="A_REVOIR">À revoir</option>
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none"
            >
              <option value="name">Trier: Nom</option>
              <option value="score_desc">Trier: Score (desc)</option>
              <option value="score_asc">Trier: Score (asc)</option>
              <option value="exp_desc">Trier: Exp (desc)</option>
              <option value="exp_asc">Trier: Exp (asc)</option>
            </select>

            <label className="ml-1 inline-flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={hideUnusable}
                onChange={(e) => setHideUnusable(e.target.checked)}
                className="h-4 w-4 accent-emerald-400"
              />
              Masquer CV inutilisables
            </label>
          </div>

          {/* Bloc explication score */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            <div className="font-semibold text-white/90">Comment est calculé le score ?</div>
            <div className="mt-1">{scoreHelp}</div>
          </div>
        </div>

        {/* Erreur */}
        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMsg}
          </div>
        )}

        {/* Stats cliquables */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold text-white/90">
            Stats — {tab === "all" ? "Tous" : tab === "target" ? "Profils cibles" : "CV anglais"}{" "}
            <span className="text-white/60">(clique sur A/B/C/À revoir pour filtrer)</span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
            <StatCard
              label="CV uploadés"
              value={statsForTab.total}
              onClick={() => {
                setProfileFilter("ALL");
                setHideUnusable(false);
              }}
            />
            <StatCard
              label="CV inutilisables"
              value={statsForTab.unusableCount}
              onClick={() => setHideUnusable(false)}
            />
            <StatCard
              label="CV utilisables"
              value={statsForTab.usableCount}
              onClick={() => setHideUnusable(true)}
              active={hideUnusable}
            />
            <StatCard
              label="Profils A"
              value={statsForTab.byProfile.A}
              onClick={() => setProfileFilter("A")}
              active={profileFilter === "A"}
            />
            <StatCard
              label="Profils B"
              value={statsForTab.byProfile.B}
              onClick={() => setProfileFilter("B")}
              active={profileFilter === "B"}
            />
            <StatCard
              label="Profils C"
              value={statsForTab.byProfile.C}
              onClick={() => setProfileFilter("C")}
              active={profileFilter === "C"}
            />
            <StatCard
              label="À revoir"
              value={statsForTab.byProfile.A_REVOIR}
              onClick={() => setProfileFilter("A_REVOIR")}
              active={profileFilter === "A_REVOIR"}
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm text-white/80">
              Affichés:{" "}
              <span className="font-semibold text-white">{visibleRows.length}</span>
              {loading && <span className="ml-2 text-white/60">Chargement…</span>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-3">Candidat</th>
                  <th className="px-4 py-3">Profil</th>
                  <th className="px-4 py-3">Diplôme</th>
                  <th className="px-4 py-3">Domaine</th>
                  <th className="px-4 py-3">Exp. (ans)</th>
                  <th className="px-4 py-3">Dernier poste</th>
                  <th className="px-4 py-3">Anglais</th>
                  <th className="px-4 py-3">Langue CV</th>
                  <th className="px-4 py-3">CV</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((r) => {
                  const pf = toProfileFilter(r.profile_type);
                  const unusable = looksLikeUnusable(r);
                  const score = r.score_profil;

                  const pillKind =
                    pf === "A"
                      ? "A"
                      : pf === "B"
                      ? "B"
                      : pf === "C"
                      ? "C"
                      : pf === "A_REVOIR"
                      ? "A_REVOIR"
                      : "NONE";

                  const cvLabel = norm(r.file_name) || "CV";
                  const name = norm(r.full_name) || "—";

                  const lastJob = norm(r.last_job_title);
                  const lastCompany = norm(r.last_company);
                  const jobLine =
                    lastJob && lastCompany ? `${lastJob} — ${lastCompany}` : lastJob || lastCompany || "—";

                  return (
                    <tr key={r.id} className={cx("border-t border-white/10", "hover:bg-white/5")}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{name}</div>
                        <div className="text-xs text-white/60">{unusable ? "(CV non lisible automatiquement)" : " "}</div>
                      </td>

                      <td className="px-4 py-3">
                        <Pill
                          kind={pillKind}
                          label={profileBadgeLabel(pf, score)}
                          title={r.notes ? `Notes IA: ${r.notes}` : undefined}
                        />
                      </td>

                      <td className="px-4 py-3 text-white/90">{norm(r.degree_level) || "—"}</td>
                      <td className="px-4 py-3 text-white/90">{norm(r.field_of_study) || "—"}</td>
                      <td className="px-4 py-3 text-white/90">{(r.total_experience_years ?? 0).toFixed(1)}</td>

                      <td className="px-4 py-3">
                        <div className="text-white/90">{jobLine}</div>
                      </td>

                      <td className="px-4 py-3 text-white/90">
                        {r.speaks_english ? norm(r.english_level) || "Oui" : norm(r.english_level) || "—"}
                      </td>

                      <td className="px-4 py-3 text-white/90">{norm(r.cv_language) || "—"}</td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => openCv(r)}
                          className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
                          title="Ouvrir le CV"
                        >
                          {cvLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {visibleRows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-white/60">
                      Aucun résultat pour ces filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal CV */}
        <Modal
          open={cvOpen}
          title={cvTitle}
          onClose={() => {
            setCvOpen(false);
            setCvUrl(null);
            setCvTitle("");
          }}
        >
          {cvLoading && <div className="text-sm text-white/70">Chargement du CV…</div>}

          {!cvLoading && !cvUrl && (
            <div className="text-sm text-red-100">
              Impossible d’ouvrir ce CV (URL/path manquant ou problème de permissions Storage).
            </div>
          )}

          {!cvLoading && cvUrl && (
            <div className="flex flex-col gap-3">
              <a
                href={cvUrl}
                target="_blank"
                rel="noreferrer"
                className="w-fit rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
              >
                Ouvrir dans un nouvel onglet
              </a>

              {/* Preview PDF */}
              {cvUrl.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={cvUrl}
                  className="h-[75vh] w-full rounded-2xl border border-white/10 bg-black"
                  title="Preview CV"
                />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  Aperçu intégré indisponible pour ce format (DOCX/Word). Utilise “Ouvrir dans un nouvel onglet”.
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type LotBatch = "LOT1" | "LOT2";
type TabKey = "all" | "target" | "english";
type SortKey = "name" | "score_desc" | "exp_desc";
type ScoreBand = "A" | "B" | "C" | "REVIEW" | "UNUSABLE";

export type DashboardProps = { lot: LotBatch };

// ✅ Mets ici les NOMS RÉELS de tes vues Supabase
const VIEW_ALL = "dashboard_all_candidates";
const VIEW_TARGET = "dashboard_profil_cible";
const VIEW_ENGLISH = "dashboard_cv_anglais";

// Fallback si tu n’as pas de vues (optionnel)
const USE_VIEWS = true;

type CandidateRow = {
  id: string;
  file_name: string | null;
  cv_url: string | null;
  cv_batch: string | null;

  full_name: string | null;
  degree_level: string | null;
  field_of_study: string | null;
  total_experience_years: number | null;

  last_job_title: string | null;
  last_company: string | null;

  speaks_english: boolean | null;
  english_level: string | null;

  cv_language: string | null;

  profile_type: string | null; // peut être "—" si VIEW
  score_profil: number | null;
  notes: string | null;

  education_raw?: string | null;
  experience_raw?: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function norm(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  // ✅ très important : certaines VIEWS renvoient "—" au lieu de NULL
  if (
    low === "—" ||
    low === "–" ||
    low === "-" ||
    low === "n/a" ||
    low === "na" ||
    low === "null" ||
    low === "undefined" ||
    low === "non spécifié" ||
    low === "non specifie"
  ) {
    return "";
  }
  return s;
}

function isEnglishCv(r: CandidateRow) {
  const lang = norm(r.cv_language).toLowerCase();
  return lang === "en" || lang.startsWith("en-") || lang.includes("english") || lang.includes("anglais");
}

// ⚠️ Ne sert que si USE_VIEWS=false (fallback)
function isTargetFallback(r: CandidateRow) {
  // Heuristique minimale : on considère "cible" si domaine/poste contient des mots clés
  const hay = `${norm(r.field_of_study)} ${norm(r.last_job_title)} ${norm(r.degree_level)}`.toLowerCase();
  const kws = [
    "audit",
    "comptable",
    "finance",
    "account",
    "tax",
    "informat",
    "it",
    "réseau",
    "reseau",
    "cyber",
    "data",
    "developer",
    "développeur",
    "developpeur",
    "system",
    "système",
  ];
  return kws.some((k) => hay.includes(k));
}

function isUnusable(r: CandidateRow) {
  // ✅ plus robuste : beaucoup de champs vides => inutilisable
  const hasAny =
    norm(r.full_name) ||
    norm(r.degree_level) ||
    norm(r.field_of_study) ||
    norm(r.last_job_title) ||
    norm(r.last_company) ||
    norm(r.education_raw) ||
    norm(r.experience_raw);

  const note = norm(r.notes).toLowerCase();
  const flagged =
    note.includes("cv non lisible") ||
    note.includes("illisible") ||
    note.includes("inutilisable") ||
    note.includes("texte trop court");

  return !hasAny || flagged;
}

function bandFromScore(r: CandidateRow): ScoreBand {
  if (isUnusable(r)) return "UNUSABLE";
  const s = Number.isFinite(r.score_profil as number) ? (r.score_profil as number) : 0;
  if (s >= 80) return "A";
  if (s >= 60) return "B";
  if (s >= 40) return "C";
  return "REVIEW";
}

function statCardClasses(kind: "neutral" | "danger" | "ok" | "a" | "b" | "c" | "review") {
  const base =
    "rounded-2xl border px-4 py-3 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:-translate-y-[1px]";
  switch (kind) {
    case "danger":
      return `${base} border-pink-500/35 bg-pink-500/10`;
    case "ok":
      return `${base} border-teal-500/35 bg-teal-500/10`;
    case "a":
      return `${base} border-emerald-500/35 bg-emerald-500/10`;
    case "b":
      return `${base} border-sky-500/35 bg-sky-500/10`;
    case "c":
      return `${base} border-amber-500/35 bg-amber-500/10`;
    case "review":
      return `${base} border-fuchsia-500/35 bg-fuchsia-500/10`;
    default:
      return `${base} border-white/10 bg-white/5`;
  }
}

export default function Dashboard({ lot }: DashboardProps) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="text-xl font-semibold mb-2">Configuration manquante</div>
          <div className="text-white/80 text-sm">
            Ajoute <b>NEXT_PUBLIC_SUPABASE_URL</b> et <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> dans <b>.env.local</b> (local)
            et dans Vercel (Settings → Environment Variables).
          </div>
        </div>
      </div>
    );
  }

  const supabase = useMemo<SupabaseClient>(() => {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }, []);

  const [tab, setTab] = useState<TabKey>("all");
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [totalLot, setTotalLot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [hideUnusable, setHideUnusable] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [bandFilter, setBandFilter] = useState<ScoreBand | "ALL">("ALL");
  const [cvModal, setCvModal] = useState<{ title: string; url: string } | null>(null);

  const viewForTab = (t: TabKey) => {
    if (!USE_VIEWS) return VIEW_ALL;
    if (t === "target") return VIEW_TARGET;
    if (t === "english") return VIEW_ENGLISH;
    return VIEW_ALL;
  };

  async function fetchTotalLot() {
    try {
      const { count, error } = await supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("cv_batch", lot);
      if (error) throw error;
      setTotalLot(count ?? null);
    } catch {
      setTotalLot(null);
    }
  }

  async function fetchTabData() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const pageSize = 1000;
      const view = viewForTab(tab);

      let all: CandidateRow[] = [];
      let from = 0;

      while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase.from(view).select("*").eq("cv_batch", lot).range(from, to);
        if (error) throw error;

        const chunk = (data ?? []) as unknown as CandidateRow[];
        all = all.concat(chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      // ✅ si pas de vues, fallback de filtrage côté front
      if (!USE_VIEWS) {
        if (tab === "english") all = all.filter(isEnglishCv);
        if (tab === "target") all = all.filter(isTargetFallback);
      }

      setRows(all);
    } catch (e: any) {
      setRows([]);
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTotalLot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot]);

  useEffect(() => {
    fetchTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot, tab]);

  const computed = useMemo(() => {
    const withBands = rows.map((r) => ({ r, band: bandFromScore(r) }));

    const total = withBands.length;
    const unusable = withBands.filter((x) => x.band === "UNUSABLE").length;
    const usable = total - unusable;

    const countA = withBands.filter((x) => x.band === "A").length;
    const countB = withBands.filter((x) => x.band === "B").length;
    const countC = withBands.filter((x) => x.band === "C").length;
    const countReview = withBands.filter((x) => x.band === "REVIEW").length;

    let filtered = withBands;

    if (hideUnusable) filtered = filtered.filter((x) => x.band !== "UNUSABLE");

    const query = q.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((x) => {
        const name = norm(x.r.full_name).toLowerCase();
        const file = norm(x.r.file_name).toLowerCase();
        const company = norm(x.r.last_company).toLowerCase();
        return name.includes(query) || file.includes(query) || company.includes(query);
      });
    }

    if (bandFilter !== "ALL") filtered = filtered.filter((x) => x.band === bandFilter);

    filtered.sort((a, b) => {
      const ar = a.r;
      const br = b.r;
      if (sort === "score_desc") return (br.score_profil ?? 0) - (ar.score_profil ?? 0);
      if (sort === "exp_desc") return (br.total_experience_years ?? 0) - (ar.total_experience_years ?? 0);
      return norm(ar.full_name || ar.file_name).localeCompare(norm(br.full_name || br.file_name), "fr", { sensitivity: "base" });
    });

    return { total, unusable, usable, countA, countB, countC, countReview, filtered };
  }, [rows, hideUnusable, q, bandFilter, sort]);

  function badge(band: ScoreBand, score: number | null, notes: string | null) {
    const s = score ?? 0;
    const title = norm(notes) || "—";

    if (band === "UNUSABLE")
      return (
        <span title={title} className="text-xs px-2 py-1 rounded-full border border-pink-500/30 bg-pink-500/10">
          Inutilisable
        </span>
      );
    if (band === "REVIEW")
      return (
        <span title={title} className="text-xs px-2 py-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10">
          À revoir {s}/100
        </span>
      );
    if (band === "A")
      return (
        <span title={title} className="text-xs px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10">
          A {s}/100
        </span>
      );
    if (band === "B")
      return (
        <span title={title} className="text-xs px-2 py-1 rounded-full border border-sky-500/30 bg-sky-500/10">
          B {s}/100
        </span>
      );
    return (
      <span title={title} className="text-xs px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10">
        C {s}/100
      </span>
    );
  }

  function openCv(r: CandidateRow) {
    const url = r.cv_url;
    if (!url) return;
    setCvModal({ title: norm(r.full_name) || norm(r.file_name) || "CV", url });
  }

  const titleTab = tab === "all" ? "Tous" : tab === "target" ? "Profils cibles" : "CV anglais";

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="max-w-7xl mx-auto px-5 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-3xl font-bold">Recrutement 2025 — {lot}</div>
            <div className="text-white/70 text-sm mt-1">Onglet actif: <b>{titleTab}</b> (données depuis la vue Supabase)</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTabData}
              className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition"
            >
              Rafraîchir
            </button>
            <div className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm">
              Total lot: <b>{totalLot ?? "—"}</b>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setTab("all")}
              className={`px-4 py-2 rounded-xl text-sm transition ${tab === "all" ? "bg-emerald-500/20 border border-emerald-500/30" : "hover:bg-white/10"}`}
            >
              Tous
            </button>
            <button
              onClick={() => setTab("target")}
              className={`px-4 py-2 rounded-xl text-sm transition ${tab === "target" ? "bg-emerald-500/20 border border-emerald-500/30" : "hover:bg-white/10"}`}
            >
              Profils cibles
            </button>
            <button
              onClick={() => setTab("english")}
              className={`px-4 py-2 rounded-xl text-sm transition ${tab === "english" ? "bg-emerald-500/20 border border-emerald-500/30" : "hover:bg-white/10"}`}
            >
              CV anglais
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom / fichier / entreprise..."
            className="flex-1 min-w-[240px] px-4 py-2 rounded-2xl border border-white/10 bg-white/5 outline-none focus:border-white/25"
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5"
          >
            <option value="name">Trier: Nom</option>
            <option value="score_desc">Trier: Score (desc)</option>
            <option value="exp_desc">Trier: Exp (desc)</option>
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={hideUnusable} onChange={(e) => setHideUnusable(e.target.checked)} className="accent-emerald-400" />
            Masquer CV inutilisables
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/75 mb-3">
            Stats — <b>{titleTab}</b> (clique sur A/B/C/À revoir pour filtrer)
          </div>

          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <div className={statCardClasses("neutral")}>
              <div className="text-xs text-white/60">CV (onglet)</div>
              <div className="text-2xl font-bold">{computed.total}</div>
            </div>

            <button
              className={statCardClasses("danger")}
              onClick={() => setBandFilter(bandFilter === "UNUSABLE" ? "ALL" : "UNUSABLE")}
              title="Filtrer Inutilisables"
            >
              <div className="text-xs text-white/60">Inutilisables</div>
              <div className="text-2xl font-bold">{computed.unusable}</div>
            </button>

            <div className={statCardClasses("ok")}>
              <div className="text-xs text-white/60">Utilisables</div>
              <div className="text-2xl font-bold">{computed.usable}</div>
            </div>

            <button className={statCardClasses("a")} onClick={() => setBandFilter(bandFilter === "A" ? "ALL" : "A")}>
              <div className="text-xs text-white/60">A</div>
              <div className="text-2xl font-bold">{computed.countA}</div>
            </button>

            <button className={statCardClasses("b")} onClick={() => setBandFilter(bandFilter === "B" ? "ALL" : "B")}>
              <div className="text-xs text-white/60">B</div>
              <div className="text-2xl font-bold">{computed.countB}</div>
            </button>

            <button className={statCardClasses("c")} onClick={() => setBandFilter(bandFilter === "C" ? "ALL" : "C")}>
              <div className="text-xs text-white/60">C</div>
              <div className="text-2xl font-bold">{computed.countC}</div>
            </button>

            <button className={statCardClasses("review")} onClick={() => setBandFilter(bandFilter === "REVIEW" ? "ALL" : "REVIEW")}>
              <div className="text-xs text-white/60">À revoir</div>
              <div className="text-2xl font-bold">{computed.countReview}</div>
            </button>
          </div>

          {bandFilter !== "ALL" && (
            <div className="mt-3 text-sm text-white/70">
              Filtre actif : <b>{bandFilter}</b>{" "}
              <button className="underline text-white/80 hover:text-white" onClick={() => setBandFilter("ALL")}>
                (retirer)
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm text-white/70">
              {loading ? "Chargement..." : errorMsg ? `Erreur: ${errorMsg}` : `${computed.filtered.length} résultat(s)`}
            </div>
            <div className="text-xs text-white/50">
              Source: <b>{viewForTab(tab)}</b>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-white/70 bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3">Candidat</th>
                  <th className="text-left px-4 py-3">Profil</th>
                  <th className="text-left px-4 py-3">Diplôme</th>
                  <th className="text-left px-4 py-3">Domaine</th>
                  <th className="text-left px-4 py-3">Exp.</th>
                  <th className="text-left px-4 py-3">Dernier poste</th>
                  <th className="text-left px-4 py-3">Anglais</th>
                  <th className="text-left px-4 py-3">Langue</th>
                  <th className="text-left px-4 py-3">CV</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  !errorMsg &&
                  computed.filtered.map(({ r, band }) => (
                    <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.04]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{norm(r.full_name) || "—"}</div>
                        <div className="text-xs text-white/50">{norm(r.file_name) || "—"}</div>
                      </td>
                      <td className="px-4 py-3">{badge(band, r.score_profil, r.notes)}</td>
                      <td className="px-4 py-3">{norm(r.degree_level) || "—"}</td>
                      <td className="px-4 py-3">{norm(r.field_of_study) || "—"}</td>
                      <td className="px-4 py-3">{(r.total_experience_years ?? 0).toFixed?.(1) ?? (r.total_experience_years ?? 0)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{norm(r.last_job_title) || "—"}</div>
                        <div className="text-xs text-white/50">{norm(r.last_company) || "—"}</div>
                      </td>
                      <td className="px-4 py-3">{norm(r.english_level) || (r.speaks_english ? "Oui" : "—")}</td>
                      <td className="px-4 py-3">{norm(r.cv_language) || "—"}</td>
                      <td className="px-4 py-3">
                        {r.cv_url ? (
                          <button
                            onClick={() => openCv(r)}
                            className="px-3 py-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition text-xs"
                          >
                            Ouvrir
                          </button>
                        ) : (
                          <span className="text-xs text-white/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                {!loading && !errorMsg && computed.filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-white/60">
                      Aucun résultat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {cvModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-5xl h-[85vh] rounded-2xl border border-white/10 bg-[#050816] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="font-semibold">{cvModal.title}</div>
                <button
                  onClick={() => setCvModal(null)}
                  className="px-3 py-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-sm"
                >
                  Fermer
                </button>
              </div>
              <iframe title="CV Viewer" src={cvModal.url} className="w-full h-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

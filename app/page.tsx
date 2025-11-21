"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfilCibleRow = {
  id: string;
  full_name: string | null;
  file_name: string | null;
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
  cv_url?: string | null; // ✅ lien vers le fichier CV dans Supabase Storage
};

type CvAnglaisRow = {
  id: string;
  full_name: string | null;
  file_name: string | null;
  last_job_title: string | null;
  degree_level: string | null;
  field_of_study: string | null;
  cv_language: string | null;
  cv_url?: string | null; // ✅ idem ici
};

type TabKey = "profil_cible" | "cv_anglais";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("profil_cible");
  const [profilCible, setProfilCible] = useState<ProfilCibleRow[]>([]);
  const [cvAnglais, setCvAnglais] = useState<CvAnglaisRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Vue 1 : profils cibles
      const { data: dataProfil, error: errorProfil } = await supabase
        .from("dashboard_profil_cible")
        .select("*")
        .order("full_name", { ascending: true });

      if (errorProfil) {
        console.error("Erreur profils cibles:", errorProfil.message);
        setErrorMsg("Erreur lors du chargement des profils cibles.");
      } else if (dataProfil) {
        setProfilCible(dataProfil as ProfilCibleRow[]);
      }

      // Vue 2 : CV en anglais
      const { data: dataAnglais, error: errorAnglais } = await supabase
        .from("dashboard_cv_anglais")
        .select("*")
        .order("full_name", { ascending: true });

      if (errorAnglais) {
        console.error("Erreur CV anglais:", errorAnglais.message);
        setErrorMsg("Erreur lors du chargement des CV en anglais.");
      } else if (dataAnglais) {
        setCvAnglais(dataAnglais as CvAnglaisRow[]);
      }
    } finally {
      setLoading(false);
    }
  }

  // Filtrage simple par nom
  const filteredProfilCible = profilCible.filter((row) => {
    if (!search) return true;
    const name = row.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredCvAnglais = cvAnglais.filter((row) => {
    if (!search) return true;
    const name = row.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

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

        {/* Tabs + recherche */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
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

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

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
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-4 shadow-xl shadow-black/50">
          {activeTab === "profil_cible" ? (
            <ProfilCibleTable rows={filteredProfilCible} />
          ) : (
            <CvAnglaisTable rows={filteredCvAnglais} />
          )}
        </section>
      </div>
    </main>
  );
}

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

function ProfilCibleTable({ rows }: { rows: ProfilCibleRow[] }) {
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

function CvAnglaisTable({ rows }: { rows: CvAnglaisRow[] }) {
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
            <th className="px-3 py-2 text-left">Titre (dernier poste)</th>
            <th className="px-3 py-2 text-left">Diplôme</th>
            <th className="px-3 py-2 text-left">Domaine</th>
            <th className="px-3 py-2 text-left">CV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

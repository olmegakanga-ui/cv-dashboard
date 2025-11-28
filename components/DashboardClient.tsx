"use client";

import { useMemo, useState } from "react";

type ProfileType = "A" | "B" | "C" | "À revoir" | null; // DB
type ProfileFilter = "ALL" | "A" | "B" | "C" | "À revoir"; // UI (⚠️ pas de null)

type ViewMode = "ALL" | "TARGET" | "ENGLISH";
type LotFilter = "ALL" | "LOT1" | "LOT2";
type ParseStatus = "done" | "failed" | "unusable" | "processing" | null;

type Candidate = {
  id: string;
  full_name: string | null;
  file_name: string | null;
  file_path: string | null;
  cv_url: string | null;
  cv_batch: string | null;

  degree_level: string | null;
  field_of_study: string | null;
  total_experience_years: number | null;

  speaks_english: boolean | null;
  english_level: string | null;
  cv_language: string | null;

  profile_type: ProfileType;
  score_profil: number | null;
  notes: string | null;

  parse_status: ParseStatus;
};

type Stats = {
  uploaded: number;
  unusable: number;
  a: number;
  b: number;
  c: number;
  toReview: number;
  retained: number; // done
};

function normalizeProfile(p: ProfileType): "A" | "B" | "C" | "À revoir" | null {
  if (!p) return null;
  const v = String(p).trim().toLowerCase();

  if (v === "a") return "A";
  if (v === "b") return "B";
  if (v === "c") return "C";

  // accepte variantes: "a revoir", "à revoir", "revoir", "review"
  if (v.includes("revoir") || v.includes("review")) return "À revoir";

  return null;
}

function computeStats(rows: Candidate[]): Stats {
  const uploaded = rows.length;

  // on compte failed + unusable comme inutilisables
  const unusable = rows.filter(
    (r) => r.parse_status === "unusable" || r.parse_status === "failed"
  ).length;

  const a = rows.filter((r) => normalizeProfile(r.profile_type) === "A").length;
  const b = rows.filter((r) => normalizeProfile(r.profile_type) === "B").length;
  const c = rows.filter((r) => normalizeProfile(r.profile_type) === "C").length;
  const toReview = rows.filter((r) => normalizeProfile(r.profile_type) === "À revoir").length;

  const retained = rows.filter((r) => r.parse_status === "done").length;

  return { uploaded, unusable, a, b, c, toReview, retained };
}

/** Profil cible (à ajuster selon vos critères exacts) */
function isTargetProfile(c: Candidate): boolean {
  const degree = (c.degree_level || "").toLowerCase();
  const field = (c.field_of_study || "").toLowerCase();

  const goodDegree =
    degree.includes("bac+5") ||
    degree.includes("bac +5") ||
    degree.includes("licence") ||
    degree.includes("master");

  const goodField =
    field.includes("économie") ||
    field.includes("econom") ||
    field.includes("finance") ||
    field.includes("audit") ||
    field.includes("informatique") ||
    field.includes("gestion") ||
    field.includes("data") ||
    field.includes("quant") ||
    field.includes("math");

  const exp = c.total_experience_years ?? 0;
  const expOk = exp >= 3;

  // ✅ IMPORTANT:
  // "Profils ciblés" ne doit PAS dépendre de l'anglais,
  // car tu as un onglet séparé "CV en anglais".
  return goodDegree && goodField && expOk;
}

function isEnglishCv(c: Candidate): boolean {
  // ✅ "CV en anglais" = langue du CV détectée en anglais
  return (c.cv_language || "").toLowerCase() === "en";
}

function badgeColor(profile: ProfileType) {
  const p = normalizeProfile(profile);
  switch (p) {
    case "A":
      return "#16a34a";
    case "B":
      return "#0ea5e9";
    case "C":
      return "#f97316";
    case "À revoir":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function statusLabel(s: ParseStatus) {
  if (!s) return "—";
  return s;
}

/** URL publique du CV (ouvre au clic) */
function getPublicCvUrl(c: Candidate) {
  if (c.cv_url) return c.cv_url;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_CV_BUCKET || "cvs";
  if (!base || !bucket) return null;

  // file_path prioritaire si présent (ex: LOT2/4627.pdf)
  if (c.file_path) {
    return `${base}/storage/v1/object/public/${bucket}/${c.file_path}`;
  }

  // fallback: LOT2/filename ou filename
  if (!c.file_name) return null;
  const lot = (c.cv_batch || "").toUpperCase();

  const guessPath = lot === "LOT2" ? `LOT2/${c.file_name}` : `${c.file_name}`;
  return `${base}/storage/v1/object/public/${bucket}/${guessPath}`;
}

export default function DashboardClient({
  initialCandidates,
}: {
  initialCandidates: Candidate[];
}) {
  // 👉 Boutons LOT1 / LOT2 / AUTRES
  const [lotFilter, setLotFilter] = useState<LotFilter>("ALL");

  // 👉 3 onglets
  const [viewMode, setViewMode] = useState<ViewMode>("ALL");

  // filtres
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("ALL"); // ✅ plus de null
  const [statusFilter, setStatusFilter] = useState<ParseStatus | "ALL">("ALL");
  const [minScore, setMinScore] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sortKey, setSortKey] = useState<"score" | "exp" | "name">("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const byLot = useMemo(() => {
    return initialCandidates.filter((c) => {
      if (lotFilter === "ALL") return true;
      return (c.cv_batch || "").toUpperCase() === lotFilter;
    });
  }, [initialCandidates, lotFilter]);

  const allView = byLot;
  const targetView = byLot.filter(isTargetProfile);
  const englishView = byLot.filter(isEnglishCv);

  const baseRows = useMemo(() => {
    if (viewMode === "TARGET") return targetView;
    if (viewMode === "ENGLISH") return englishView;
    return allView;
  }, [viewMode, allView, targetView, englishView]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minScore.trim() ? Number(minScore) : null;

    let rows = baseRows.filter((c) => {
      if (profileFilter !== "ALL") {
        const p = normalizeProfile(c.profile_type);
        if (p !== profileFilter) return false;
      }

      if (statusFilter !== "ALL" && c.parse_status !== statusFilter) return false;

      if (min !== null) {
        const sc = c.score_profil ?? -1;
        if (sc < min) return false;
      }

      if (q) {
        const blob = `${c.full_name || ""} ${c.file_name || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }

      return true;
    });

    rows = rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "score")
        return ((a.score_profil ?? -1) - (b.score_profil ?? -1)) * dir;
      if (sortKey === "exp")
        return (
          ((a.total_experience_years ?? -1) - (b.total_experience_years ?? -1)) *
          dir
        );
      return (a.full_name || "")
        .toLowerCase()
        .localeCompare((b.full_name || "").toLowerCase()) * dir;
    });

    return rows;
  }, [baseRows, profileFilter, statusFilter, minScore, search, sortKey, sortDir]);

  const stats = useMemo(() => computeStats(baseRows), [baseRows]);

  const viewTitle =
    viewMode === "ALL"
      ? "Tous les candidats"
      : viewMode === "TARGET"
      ? "Profils ciblés"
      : "CV en anglais";

  const lotTitle =
    lotFilter === "ALL" ? "AUTRES (LOT1 + LOT2)" : lotFilter;

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", color: "#e5e7eb", padding: 24 }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          Tableau de bord – Recrutement 2025
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: 14 }}>
          {lotTitle} • {viewTitle}
        </p>

        {/* Boutons LOT */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <LotBtn active={lotFilter === "LOT1"} onClick={() => setLotFilter("LOT1")}>LOT1</LotBtn>
          <LotBtn active={lotFilter === "LOT2"} onClick={() => setLotFilter("LOT2")}>LOT2</LotBtn>
          <LotBtn active={lotFilter === "ALL"} onClick={() => setLotFilter("ALL")}>AUTRES</LotBtn>
        </div>

        {/* Onglets */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 6,
            borderRadius: 999,
            border: "1px solid #1f2a44",
            background: "#060b16",
            width: "fit-content",
            marginBottom: 16,
          }}
        >
          <Tab active={viewMode === "ALL"} onClick={() => setViewMode("ALL")}>Tous</Tab>
          <Tab active={viewMode === "TARGET"} onClick={() => setViewMode("TARGET")}>Profils ciblés</Tab>
          <Tab active={viewMode === "ENGLISH"} onClick={() => setViewMode("ENGLISH")}>CV en anglais</Tab>
        </div>

        {/* note scoring */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #1f2a44",
            background: "#060b16",
            marginBottom: 16,
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          <b style={{ color: "#e5e7eb" }}>Notation :</b> A ≥ 80 • B = 60–79 • C = 40–59 •{" "}
          <span style={{ color: "#ef4444" }}>À revoir &lt; 40</span>
        </div>

        {/* stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Stat label="Nombre de CV (vue)" value={stats.uploaded} />
          <Stat label="CV inutilisables (failed+unusable)" value={stats.unusable} color="#ef4444" />
          <Stat label="Rendus (done)" value={stats.retained} color="#22c55e" />
          <Stat label="Score A" value={stats.a} color="#16a34a" />
          <Stat label="Score B" value={stats.b} color="#0ea5e9" />
          <Stat label="Score C" value={stats.c} color="#f97316" />
          <Stat label="À revoir" value={stats.toReview} color="#ef4444" />
        </div>

        {/* filtres */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #1f2a44",
            background: "#060b16",
          }}
        >
          <Field label="Type de profil">
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value as ProfileFilter)}
              style={selectStyle}
            >
              <option value="ALL">Tous</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="À revoir">À revoir</option>
            </select>
          </Field>

          <Field label="Statut parsing">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value === "ALL" ? "ALL" : (e.target.value as ParseStatus))}
              style={selectStyle}
            >
              <option value="ALL">Tous</option>
              <option value="done">done</option>
              <option value="failed">failed</option>
              <option value="unusable">unusable</option>
              <option value="processing">processing</option>
            </select>
          </Field>

          <Field label="Score minimum">
            <input
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="ex: 80"
              style={inputStyle}
            />
          </Field>

          <Field label="Recherche (nom / fichier)">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ex: KABUYA, 4627.pdf..."
              style={inputStyle}
            />
          </Field>

          <Field label="Tri">
            <div style={{ display: "flex", gap: 8 }}>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} style={selectStyle}>
                <option value="score">Score</option>
                <option value="exp">Expérience</option>
                <option value="name">Nom</option>
              </select>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value as any)} style={selectStyle}>
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </Field>
        </div>

        {/* table */}
        <div style={{ borderRadius: 12, border: "1px solid #1f2a44", background: "#060b16", overflow: "hidden" }}>
          <div style={{ padding: 12, color: "#94a3b8", fontSize: 12 }}>
            {filtered.length} candidat(s) après filtres
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#040814" }}>
                  <Th>Nom (clic = ouvrir CV)</Th>
                  <Th>Fichier</Th>
                  <Th>Lot</Th>
                  <Th>Exp</Th>
                  <Th>Langue</Th>
                  <Th>Anglais</Th>
                  <Th>Profil</Th>
                  <Th>Score</Th>
                  <Th>Statut</Th>
                  <Th>Notes (tooltip)</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const url = getPublicCvUrl(c);
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid #121a2f" }}>
                      <Td>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 700 }}
                          >
                            {c.full_name || "(Nom inconnu)"}
                          </a>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>{c.full_name || "(Nom inconnu)"}</span>
                        )}
                      </Td>
                      <Td>{c.file_name || "—"}</Td>
                      <Td>{(c.cv_batch || "—").toUpperCase()}</Td>
                      <Td style={{ textAlign: "center" }}>{c.total_experience_years ?? "—"}</Td>
                      <Td>{c.cv_language || "—"}</Td>
                      <Td>{c.speaks_english === true ? "Oui" : "Non/?"}</Td>
                      <Td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            background: badgeColor(c.profile_type),
                            color: "#0b1220",
                            fontWeight: 900,
                            fontSize: 12,
                          }}
                        >
                          {normalizeProfile(c.profile_type) || "—"}
                        </span>
                      </Td>
                      <Td style={{ textAlign: "center" }}>{c.score_profil ?? "—"}</Td>
                      <Td>{statusLabel(c.parse_status)}</Td>
                      <Td style={{ maxWidth: 320 }}>
                        <span
                          title={c.notes || ""}
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 320,
                            color: c.notes ? "#e5e7eb" : "#94a3b8",
                          }}
                        >
                          {c.notes || "—"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <Td colSpan={10} style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>
                      Aucun résultat.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 14, color: "#94a3b8", fontSize: 12 }}>
          <b style={{ color: "#e5e7eb" }}>Rappel :</b> “Profils ciblés” = filtre métier (diplôme+domaine+expérience).  
          L’anglais est isolé dans l’onglet “CV en anglais”.
        </div>
      </div>
    </div>
  );
}

function LotBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "1px solid #1f2a44",
        cursor: "pointer",
        padding: "10px 14px",
        borderRadius: 14,
        background: active ? "#e5e7eb" : "#060b16",
        color: active ? "#0b1220" : "#e5e7eb",
        fontWeight: 900,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </button>
  );
}

function Tab({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        cursor: "pointer",
        padding: "8px 12px",
        borderRadius: 999,
        background: active ? "#e5e7eb" : "transparent",
        color: active ? "#0b1220" : "#94a3b8",
        fontWeight: active ? 900 : 700,
      }}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: "1px solid #1f2a44", background: "#060b16" }}>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || "#e5e7eb" }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Th({ children }: any) {
  return (
    <th style={{ textAlign: "left", padding: "10px 12px", color: "#94a3b8", fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function Td({ children, colSpan, style }: any) {
  return (
    <td colSpan={colSpan} style={{ padding: "10px 12px", verticalAlign: "middle", ...style }}>
      {children}
    </td>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #1f2a44",
  background: "#040814",
  color: "#e5e7eb",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #1f2a44",
  background: "#040814",
  color: "#e5e7eb",
  outline: "none",
};

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="w-full max-w-3xl p-6">
        <h1 className="text-3xl font-semibold">Recrutement 2025</h1>
        <p className="mt-2 text-slate-400">
          Choisissez le lot de CV à consulter.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/lot/lot1"
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:bg-slate-800/40 transition"
          >
            <div className="text-lg font-medium">LOT 1</div>
            <div className="mt-1 text-sm text-slate-400">
              Première vague de candidatures
            </div>
          </Link>

          <Link
            href="/lot/lot2"
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:bg-slate-800/40 transition"
          >
            <div className="text-lg font-medium">LOT 2</div>
            <div className="mt-1 text-sm text-slate-400">
              Nouvelle vague de candidatures
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
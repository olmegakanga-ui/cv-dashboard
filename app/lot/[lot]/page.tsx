"use client";

import { useParams } from "next/navigation";
import Dashboard from "@/components/Dashboard";

export default function LotPage() {
  // ✅ On récupère le paramètre directement côté client
  const params = useParams();
  const raw = typeof params?.lot === "string" ? params.lot.toUpperCase() : "LOT1";
  const lot: "LOT1" | "LOT2" = raw === "LOT2" ? "LOT2" : "LOT1";

  return <Dashboard lot={lot} />;
}

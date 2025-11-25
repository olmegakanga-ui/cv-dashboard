import Dashboard from "@/components/Dashboard";

export default function LotPage({ params }: { params: { lot: string } }) {
  const lot = params.lot?.toUpperCase() === "LOT2" ? "LOT2" : "LOT1";
  return <Dashboard lot={lot} />;
}
import { loadDashboard } from "./data";
import { LiveDashboard } from "./LiveDashboard";

export const metadata = { title: "Live" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  return <LiveDashboard {...await loadDashboard((await params).id)} />;
}

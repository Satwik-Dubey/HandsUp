import { LiveDashboard } from "../live/LiveDashboard";
import { loadDashboard } from "../live/data";

export const metadata = { title: "Presenter" };

/** Compact dashboard for a second screen or a phone: four big numbers and the newest insight. */
export default async function PresenterPage({ params }: { params: Promise<{ id: string }> }) {
  return <LiveDashboard {...await loadDashboard((await params).id)} presenter />;
}

import AdminApp from "@internal/components/admin/admin-app";
import SurveyResultsView from "@internal/features/engagement/survey-results-view";
import { surveyResultsHref } from "../../../../../shared/engagement";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminApp moduleHint="surveys" pageTitle="Kết quả khảo sát" pageHref={surveyResultsHref(id)}><SurveyResultsView key={id} id={id} /></AdminApp>;
}

import { OrganizationSearchPage } from "@/components/search/organization-search-page";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationSearchPage organizationId={organizationId} />;
}

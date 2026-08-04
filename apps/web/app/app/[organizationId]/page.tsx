import { OrganizationHome } from "@/components/organizations/organization-home";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationHome organizationId={organizationId} />;
}

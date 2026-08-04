import { OrganizationSettings } from "@/components/organizations/organization-settings";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationSettings organizationId={organizationId} />;
}

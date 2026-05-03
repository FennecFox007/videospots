// Intercepting route: when the user navigates to /campaigns/new from /
// or /campaigns via client-side routing, this renders inside the @modal
// slot instead of replacing the underlying page. Direct URL hits still
// fall through to the standalone app/campaigns/new/page.tsx.
//
// Reuses the same form + data-loading helper as the standalone page —
// the only difference is the wrapper (RouteModal vs the page's own
// `<div>` shell). Form submission goes to the same `createCampaign`
// server action; the redirect on success closes the modal naturally
// because Next navigates the underlying page to the new detail URL.

import { CampaignFormBody } from "@/components/campaign-form-body";
import { createCampaign } from "@/app/campaigns/new/actions";
import {
  loadNewCampaignContext,
  type NewCampaignSearchParams,
} from "@/app/campaigns/new/_context";
import { RouteModal } from "@/components/route-modal";
import { getT } from "@/lib/i18n/server";

export default async function NewCampaignModalPage({
  searchParams,
}: {
  searchParams: Promise<NewCampaignSearchParams>;
}) {
  const params = await searchParams;
  const { groups, defaults, hint } = await loadNewCampaignContext(params);
  const t = await getT();

  return (
    <RouteModal title={t("form.new_campaign_title")} subtitle={hint}>
      <form action={createCampaign} className="space-y-6">
        <CampaignFormBody
          groups={groups}
          defaults={defaults}
          submitLabel={t("form.submit_create")}
          cancelHref="/"
          showRecurring
        />
      </form>
    </RouteModal>
  );
}

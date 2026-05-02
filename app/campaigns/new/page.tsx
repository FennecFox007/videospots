// Standalone /campaigns/new page. Direct URL hits (refresh, deep link)
// land here as a full page. When navigated to from / or /campaigns via
// client-side <Link>, the @modal/(.)campaigns/new intercepting route
// renders the same form inside a modal instead — see app/@modal.

import { CampaignFormBody } from "@/components/campaign-form-body";
import { createCampaign } from "./actions";
import {
  loadNewCampaignContext,
  type NewCampaignSearchParams,
} from "./_context";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<NewCampaignSearchParams>;
}) {
  const params = await searchParams;
  const { groups, defaults, hint } = await loadNewCampaignContext(params);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Nová kampaň
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{hint}</p>

      <form action={createCampaign} className="space-y-6">
        <CampaignFormBody
          groups={groups}
          defaults={defaults}
          submitLabel="Vytvořit kampaň"
          cancelHref="/"
          showRecurring
        />
      </form>
    </div>
  );
}

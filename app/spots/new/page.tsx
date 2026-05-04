import Link from "next/link";
import { SpotFormBody } from "@/components/spot-form-body";
import { createSpot } from "@/app/spots/actions";
import { getT } from "@/lib/i18n/server";

export default async function NewSpotPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-3xl font-semibold tracking-tight mb-1">
        {t("spots.form.heading_new")}
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
        {t("spots.form.subhead_new")}
      </p>
      <form action={createSpot} className="space-y-6">
        <SpotFormBody />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
          >
            {t("spots.form.submit_create")}
          </button>
          <Link
            href="/spots"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

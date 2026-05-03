import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function AdminIndexPage() {
  const t = await getT();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AdminCard
        href="/admin/countries"
        title={t("admin.tab.countries")}
        description={t("admin.card.countries.desc")}
      />
      <AdminCard
        href="/admin/chains"
        title={t("admin.tab.chains")}
        description={t("admin.card.chains.desc")}
      />
      <AdminCard
        href="/admin/channels"
        title={t("admin.tab.channels")}
        description={t("admin.card.channels.desc")}
      />
      <AdminCard
        href="/admin/products"
        title={t("admin.tab.products")}
        description={t("admin.card.products.desc")}
      />
      <AdminCard
        href="/admin/users"
        title={t("admin.tab.users")}
        description={t("admin.card.users.desc")}
      />
      <AdminCard
        href="/admin/templates"
        title={t("admin.tab.templates")}
        description={t("admin.card.templates.desc")}
      />
      <AdminCard
        href="/admin/import"
        title={t("admin.tab.import")}
        description={t("admin.card.import.desc")}
      />
      <AdminCard
        href="/admin/archive"
        title={t("admin.tab.archive")}
        description={t("admin.card.archive.desc")}
      />
      <AdminCard
        href="/admin/audit"
        title={t("admin.tab.audit")}
        description={t("admin.card.audit.desc")}
      />
    </div>
  );
}

function AdminCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5 hover:shadow-md hover:ring-zinc-300/80 dark:hover:ring-zinc-700/80 hover:-translate-y-0.5 transition-all duration-200 ease-out"
    >
      <h2 className="font-medium mb-1">{title}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </Link>
  );
}

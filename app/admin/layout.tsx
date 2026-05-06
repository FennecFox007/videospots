import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getCurrentRole } from "@/lib/auth-helpers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // /admin/* is admin-only. Editor/viewer bounce back to the dashboard.
  // Unauth users go through the regular middleware redirect to /sign-in
  // — getCurrentRole() returns null for them and we redirect here.
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect(role === null ? "/sign-in" : "/");
  }
  const t = await getT();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("admin.heading")}
        </h1>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800 mb-6">
        <div className="flex gap-1 -mb-px">
          <SubLink href="/admin/countries">{t("admin.tab.countries")}</SubLink>
          <SubLink href="/admin/chains">{t("admin.tab.chains")}</SubLink>
          <SubLink href="/admin/channels">{t("admin.tab.channels")}</SubLink>
          <SubLink href="/admin/products">{t("admin.tab.products")}</SubLink>
          <SubLink href="/admin/users">{t("admin.tab.users")}</SubLink>
          <SubLink href="/admin/share-links">
            {t("admin.tab.share_links")}
          </SubLink>
          <SubLink href="/admin/import">{t("admin.tab.import")}</SubLink>
          <SubLink href="/admin/archive">{t("admin.tab.archive")}</SubLink>
          <SubLink href="/admin/audit">{t("admin.tab.audit")}</SubLink>
        </div>
      </div>

      {children}
    </div>
  );
}

function SubLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 text-sm border-b-2 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 text-zinc-600 dark:text-zinc-400 transition-colors"
    >
      {children}
    </Link>
  );
}

import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Administrace</h1>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800 mb-6">
        <div className="flex gap-1 -mb-px">
          <SubLink href="/admin/countries">Státy</SubLink>
          <SubLink href="/admin/chains">Řetězce</SubLink>
          <SubLink href="/admin/channels">Kanály (matice)</SubLink>
          <SubLink href="/admin/users">Uživatelé</SubLink>
          <SubLink href="/admin/templates">Šablony</SubLink>
          <SubLink href="/admin/archive">Archiv</SubLink>
          <SubLink href="/admin/audit">Audit log</SubLink>
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

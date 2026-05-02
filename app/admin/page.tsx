import Link from "next/link";

export default function AdminIndexPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AdminCard
        href="/admin/countries"
        title="Státy"
        description="Trhy, kde provozujeme kampaně. CZ, SK, HU, PL — přidat lze libovolný."
      />
      <AdminCard
        href="/admin/chains"
        title="Řetězce"
        description="Maloobchodní brandy s našimi zobrazovači — Datart, Alza, MediaMarkt…"
      />
      <AdminCard
        href="/admin/channels"
        title="Kanály"
        description="Matice Stát × Řetězec. Označ které kombinace skutečně existují."
      />
      <AdminCard
        href="/admin/products"
        title="Produkty"
        description="Hry, konzole, ovladače, příslušenství… s daty vydání a covery. Kampaně se na ně mapují."
      />
      <AdminCard
        href="/admin/users"
        title="Uživatelé"
        description="Přidávej, mažeš, nastavuješ hesla členům týmu."
      />
      <AdminCard
        href="/admin/templates"
        title="Šablony"
        description="Uložené konfigurace kampaní (klient, barva, kanály, štítky, délka) pro rychlé opakování."
      />
      <AdminCard
        href="/admin/import"
        title="Import CSV"
        description="Hromadný import kampaní z CSV (migrace z Excelu)."
      />
      <AdminCard
        href="/admin/archive"
        title="Archiv"
        description="Archivované kampaně. Lze obnovit zpět, nebo definitivně smazat."
      />
      <AdminCard
        href="/admin/audit"
        title="Audit log"
        description="Co kdo kdy udělal — kompletní historie akcí."
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
      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
    >
      <h2 className="font-medium mb-1">{title}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </Link>
  );
}

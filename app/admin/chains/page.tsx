import { asc } from "drizzle-orm";
import { db, chains } from "@/lib/db/client";
import { createChain, deleteChain, reorderChain } from "./actions";

export default async function ChainsPage() {
  const rows = await db
    .select()
    .from(chains)
    .orderBy(asc(chains.sortOrder), asc(chains.name));

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">Přidat řetězec</h2>
        <form action={createChain} className="flex flex-wrap gap-3 items-end">
          <Field label="Kód (slug)" name="code" placeholder="datart" required className="w-40" />
          <Field label="Název" name="name" placeholder="Datart" required className="flex-1 min-w-48" />
          <Field label="Logo URL (volit.)" name="logoUrl" placeholder="https://…" className="flex-1 min-w-64" />
          <button
            type="submit"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
          >
            Přidat
          </button>
        </form>
      </section>

      <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left">
            <tr>
              <th className="px-4 py-2 font-medium w-20">Pořadí</th>
              <th className="px-4 py-2 font-medium">Logo</th>
              <th className="px-4 py-2 font-medium">Kód</th>
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium w-24">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2">
                  <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <form
                      action={async () => {
                        "use server";
                        await reorderChain(c.id, -1);
                      }}
                    >
                      <button
                        type="submit"
                        disabled={i === 0}
                        title="Posunout výš"
                        className="px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed border-r border-zinc-200 dark:border-zinc-700"
                      >
                        ↑
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await reorderChain(c.id, 1);
                      }}
                    >
                      <button
                        type="submit"
                        disabled={i === rows.length - 1}
                        title="Posunout níž"
                        className="px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                    </form>
                  </div>
                </td>
                <td className="px-4 py-2">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt={c.name} className="h-6 max-w-24 object-contain" />
                  ) : (
                    <span className="text-zinc-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono">{c.code}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">
                  <form
                    action={async () => {
                      "use server";
                      await deleteChain(c.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Smazat
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Žádné řetězce. Přidej výše.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  className,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      <input
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

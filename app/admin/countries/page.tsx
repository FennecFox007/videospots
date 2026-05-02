import { asc } from "drizzle-orm";
import { db, countries } from "@/lib/db/client";
import { createCountry, deleteCountry } from "./actions";

export default async function CountriesPage() {
  const rows = await db
    .select()
    .from(countries)
    .orderBy(asc(countries.sortOrder), asc(countries.code));

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">Přidat stát</h2>
        <form action={createCountry} className="flex flex-wrap gap-3 items-end">
          <Field label="Kód" name="code" placeholder="CZ" required maxLength={3} className="w-20" />
          <Field label="Název" name="name" placeholder="Česko" required className="flex-1 min-w-48" />
          <Field label="Vlajka (emoji)" name="flagEmoji" placeholder="🇨🇿" className="w-32" />
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
              <th className="px-4 py-2 font-medium">Vlajka</th>
              <th className="px-4 py-2 font-medium">Kód</th>
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium w-24">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2 text-xl">{c.flagEmoji}</td>
                <td className="px-4 py-2 font-mono">{c.code}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">
                  <form
                    action={async () => {
                      "use server";
                      await deleteCountry(c.id);
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
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  Žádné státy. Přidej výše.
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
  maxLength,
  className,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
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
        maxLength={maxLength}
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

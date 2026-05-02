import { asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users } from "@/lib/db/client";
import { createUser, updatePassword, deleteUser } from "./actions";

export default async function UsersPage() {
  const session = await auth();
  const currentUserId = session?.user?.id;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      hasPassword: users.passwordHash,
    })
    .from(users)
    .orderBy(asc(users.email));

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">Přidat uživatele</h2>
        <form
          action={createUser}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <Field label="E-mail / username" required>
            <input
              name="email"
              type="text"
              required
              placeholder="kolega@firma.cz"
              className={inputClass}
            />
          </Field>
          <Field label="Jméno (volit.)">
            <input name="name" type="text" placeholder="Jan Novák" className={inputClass} />
          </Field>
          <Field label="Heslo" required>
            <input
              name="password"
              type="text"
              required
              minLength={4}
              placeholder="aspoň 4 znaky"
              className={inputClass}
            />
          </Field>
          <button
            type="submit"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 h-fit"
          >
            Přidat
          </button>
        </form>
      </section>

      <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">E-mail / username</th>
              <th className="px-4 py-2 font-medium">Jméno</th>
              <th className="px-4 py-2 font-medium">Heslo</th>
              <th className="px-4 py-2 font-medium">Reset hesla</th>
              <th className="px-4 py-2 font-medium w-20">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isMe = u.id === currentUserId;
              return (
                <tr
                  key={u.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-2 font-mono">
                    {u.email}
                    {isMe && (
                      <span className="ml-2 text-xs text-zinc-500">(ty)</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{u.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {u.hasPassword ? (
                      <span className="text-xs text-green-600">nastaveno</span>
                    ) : (
                      <span className="text-xs text-amber-600">není</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <form
                      action={updatePassword.bind(null, u.id)}
                      className="flex gap-2"
                    >
                      <input
                        name="password"
                        type="text"
                        minLength={4}
                        placeholder="nové heslo"
                        className="w-32 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs"
                        required
                      />
                      <button
                        type="submit"
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Reset
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    {!isMe && (
                      <form
                        action={async () => {
                          "use server";
                          await deleteUser(u.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Smazat
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Žádní uživatelé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-zinc-500">
        Tip: noví uživatelé se přihlašují svým e-mailem (nebo username) + heslem co jsi jim tady nastavil. Změna hesla se projeví okamžitě, ale stávající přihlášené uživatele neodhlásí (token je platný do dalšího sign-inu).
      </p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

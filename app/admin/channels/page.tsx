import { asc } from "drizzle-orm";
import { db, countries, chains, channels } from "@/lib/db/client";
import { toggleChannel, addChainToCountry } from "./actions";

export default async function ChannelsPage() {
  const [allCountries, allChains, allChannels] = await Promise.all([
    db.select().from(countries).orderBy(asc(countries.sortOrder), asc(countries.code)),
    db.select().from(chains).orderBy(asc(chains.sortOrder), asc(chains.name)),
    db.select().from(channels),
  ]);

  // Set of "countryId:chainId" strings that exist as channels.
  const existingSet = new Set(
    allChannels.map((ch) => `${ch.countryId}:${ch.chainId}`)
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Klikni do buňky a označ kombinaci, která reálně existuje. Každý
        zaškrtnutý čtvereček = virtuální kanál (např. „Datart v ČR"). Posledním
        sloupcem můžeš pro libovolný stát rovnou založit nový řetězec.
      </p>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400 sticky left-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 min-w-32">
                Stát \ Řetězec
              </th>
              {allChains.map((chain) => (
                <th
                  key={chain.id}
                  className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 min-w-24"
                >
                  {chain.name}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 border-l border-zinc-200 dark:border-zinc-800 min-w-56 bg-zinc-50/50 dark:bg-zinc-950/50">
                + řetězec do této země
              </th>
            </tr>
          </thead>
          <tbody>
            {allCountries.map((country) => (
              <tr key={country.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2 sticky left-0 bg-white dark:bg-zinc-900 font-medium">
                  <span className="mr-1.5 text-base">{country.flagEmoji}</span>
                  {country.name}
                </td>
                {allChains.map((chain) => {
                  const isOn = existingSet.has(`${country.id}:${chain.id}`);
                  return (
                    <td key={chain.id} className="text-center p-1">
                      <form
                        action={async () => {
                          "use server";
                          await toggleChannel(country.id, chain.id);
                        }}
                      >
                        <button
                          type="submit"
                          aria-label={`Přepnout ${country.name} × ${chain.name}`}
                          className={
                            "w-8 h-8 rounded transition-colors " +
                            (isOn
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400")
                          }
                        >
                          {isOn ? "✓" : ""}
                        </button>
                      </form>
                    </td>
                  );
                })}
                <td className="px-3 py-2 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                  <form
                    action={addChainToCountry.bind(null, country.id)}
                    className="flex gap-1"
                  >
                    <input
                      name="chainName"
                      required
                      maxLength={40}
                      placeholder="např. Okay"
                      className="flex-1 min-w-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3"
                      title={`Přidat nový řetězec do ${country.name}`}
                    >
                      +
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {allCountries.length === 0 && (
              <tr>
                <td colSpan={allChains.length + 2} className="px-4 py-8 text-center text-zinc-500">
                  Nejdřív přidej státy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Stav: {allChannels.length} kanálů ze {allCountries.length * allChains.length} možných kombinací.
        Přidání nového řetězce ho vytvoří v tabulce řetězců a rovnou propojí s vybraným státem.
      </p>
    </div>
  );
}

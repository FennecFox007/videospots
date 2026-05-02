import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">videospots</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Plánování video kampaní pro PlayStation
          </p>
        </div>

        <SignInForm searchParams={searchParams} />
      </div>
    </div>
  );
}

async function SignInForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <form
      action={async (formData) => {
        "use server";
        const email = String(formData.get("email") ?? "").trim();
        const password = String(formData.get("password") ?? "");
        if (!email || !password) {
          redirect(
            "/sign-in?error=" + encodeURIComponent("Vyplň oba údaje")
          );
        }
        try {
          await signIn("credentials", {
            email,
            password,
            redirectTo: "/",
          });
        } catch (e) {
          // Auth.js throws AuthError on bad creds; let NEXT_REDIRECT bubble.
          if (e instanceof AuthError) {
            redirect(
              "/sign-in?error=" +
                encodeURIComponent("Špatné přihlašovací údaje")
            );
          }
          throw e;
        }
      }}
      className="space-y-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
    >
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium mb-1.5"
        >
          E-mail / username
        </label>
        <input
          id="email"
          name="email"
          type="text"
          required
          autoFocus
          autoComplete="username"
          placeholder="admin"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium mb-1.5"
        >
          Heslo
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 transition-colors"
      >
        Přihlásit se
      </button>

      {params.error && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">
          {decodeURIComponent(params.error)}
        </p>
      )}

      <p className="text-xs text-zinc-500 text-center">
        Nemáš účet? Zeptej se admina, ať ti ho založí v{" "}
        <span className="font-mono">/admin/users</span>.
      </p>
    </form>
  );
}

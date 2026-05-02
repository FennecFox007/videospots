"use server";

// AI summarization of recent audit-log activity. Uses Claude (Anthropic SDK)
// with prompt caching on the system prompt — system text doesn't change run
// to run, so we get cache hits on repeat calls and pay only for the
// (small) audit-log payload.

import Anthropic from "@anthropic-ai/sdk";
import { desc, eq, gte } from "drizzle-orm";
import { auth } from "@/auth";
import { db, auditLog, users, campaigns } from "@/lib/db/client";

const SYSTEM_PROMPT = `Jsi asistent shrnující aktivitu ve videospots — interní aplikaci pro plánování video kampaní pro Sony PlayStation na in-store displejích v ČR/SR/HU/PL.

Dostaneš strukturovaný výpis audit-log záznamů. Tvým úkolem je vytvořit krátké, čitelné shrnutí v češtině pod 200 slov:
- Začni jednou větou s agregátní statistikou (kolik akcí, kolik unikátních uživatelů).
- Dál v 3–5 odrážkách vyzdvihni klíčové události. Sumarizuj série podobných drobných úprav.
- Pokud někdo smazal/archivoval/zrušil něco velkého, zdůrazni to.
- Pokud se objevila nová kampaň pro velkého klienta nebo notable hru, zmiň ji.
- Vyhni se technickému žargonu (žádné "entity", "audit_log", "INSERT") — píšeš pro provozního manažera.
- Žádné Markdown nadpisy, jen prostý text + bullety s "•".

Pokud je log prázdný, odpověz jednou větou "V daném období se nic významného nestalo."`;

export type AiDigestResult = {
  ok: boolean;
  summary?: string;
  error?: string;
  daysBack: number;
  entryCount: number;
};

export async function summarizeRecentActivity(
  daysBack: number = 7
): Promise<AiDigestResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized", daysBack, entryCount: 0 };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY není nastaven. Přidej ho do .env.local a restartuj dev server.",
      daysBack,
      entryCount: 0,
    };
  }

  const safeDays = Math.max(1, Math.min(90, Math.round(daysBack)));
  const since = new Date(Date.now() - safeDays * 86_400_000);

  const rows = await db
    .select({
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      changes: auditLog.changes,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userEmail: users.email,
      campaignName: campaigns.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .leftJoin(campaigns, eq(auditLog.entityId, campaigns.id))
    .where(gte(auditLog.createdAt, since))
    .orderBy(desc(auditLog.createdAt))
    .limit(500);

  if (rows.length === 0) {
    return {
      ok: true,
      summary: `V posledních ${safeDays} dnech nebyl zaznamenán žádný pohyb.`,
      daysBack: safeDays,
      entryCount: 0,
    };
  }

  const formatted = rows
    .map((r) => {
      const who = r.userName ?? r.userEmail ?? "?";
      const what =
        r.entity === "campaign"
          ? r.campaignName
            ? `kampaň "${r.campaignName}"`
            : `kampaň #${r.entityId} (smazaná)`
          : `${r.entity}${r.entityId ? ` #${r.entityId}` : ""}`;
      const changesStr = r.changes ? ` ${JSON.stringify(r.changes)}` : "";
      return `${r.createdAt.toISOString()} | ${who} | ${r.action} | ${what}${changesStr}`;
    })
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Audit log z posledních ${safeDays} ${safeDays === 1 ? "dne" : safeDays < 5 ? "dní" : "dní"} (${rows.length} záznamů):\n\n${formatted}`,
        },
      ],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return {
      ok: true,
      summary: text || "(prázdná odpověď)",
      daysBack: safeDays,
      entryCount: rows.length,
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).message,
      daysBack: safeDays,
      entryCount: rows.length,
    };
  }
}

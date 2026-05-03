// Printable campaign detail — opens window.print() automatically. Designed for
// "Save as PDF" handoff to a client. Strips action buttons, comments, history.

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { eq, asc } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  campaignVideos,
  channels,
  countries,
  chains,
  products,
} from "@/lib/db/client";
import { kindLabel, kindEmoji } from "@/lib/products";
import {
  formatDate,
  daysBetween,
  computedRunState,
  statusLabel,
} from "@/lib/utils";
import { communicationTypeLabel } from "@/lib/communication";
import { AutoPrint } from "@/components/auto-print";
import { getT } from "@/lib/i18n/server";

export default async function PrintCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const [row] = await db
    .select({ campaign: campaigns, product: products })
    .from(campaigns)
    .leftJoin(products, eq(campaigns.productId, products.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!row) notFound();

  const channelRows = await db
    .select({
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      chainName: chains.name,
    })
    .from(campaignChannels)
    .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .innerJoin(chains, eq(channels.chainId, chains.id))
    .where(eq(campaignChannels.campaignId, campaignId))
    .orderBy(asc(countries.sortOrder), asc(chains.sortOrder));

  const c = row.campaign;
  const product = row.product;
  const dur = daysBetween(c.startsAt, c.endsAt);
  const totalReach = dur * channelRows.length;
  const runState = computedRunState(c);

  const videoRows = await db
    .select({
      countryName: countries.name,
      countryCode: countries.code,
      countryFlag: countries.flagEmoji,
      videoUrl: campaignVideos.videoUrl,
    })
    .from(campaignVideos)
    .innerJoin(countries, eq(campaignVideos.countryId, countries.id))
    .where(eq(campaignVideos.campaignId, campaignId))
    .orderBy(asc(countries.sortOrder));

  // QR code: prefer the first available video URL (a scan-from-print should
  // open SOMETHING playable). When the campaign has multiple country
  // versions, we point to the first by sortOrder — typically CZ. Falls back
  // to the internal campaign detail URL if no video is set.
  const reqHeaders = await headers();
  const proto =
    reqHeaders.get("x-forwarded-proto") ?? reqHeaders.get("x-proto") ?? "https";
  const host =
    reqHeaders.get("x-forwarded-host") ??
    reqHeaders.get("host") ??
    "localhost:3000";
  const internalUrl = `${proto}://${host}/campaigns/${campaignId}`;
  const firstVideoUrl = videoRows[0]?.videoUrl ?? null;
  const qrTarget = firstVideoUrl || internalUrl;
  const t = await getT();
  const qrLabel = firstVideoUrl
    ? `${t("print.scan_video")}${videoRows.length > 1 ? ` (${videoRows[0].countryCode})` : ""}`
    : t("print.scan_campaign");
  const qrSvg = await QRCode.toString(qrTarget, {
    type: "svg",
    margin: 0,
    width: 96,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="bg-white text-black mx-auto max-w-3xl px-8 py-10 print-clean">
      <AutoPrint />

      <div className="border-b-2 border-black pb-4 mb-6 flex items-start gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs uppercase tracking-widest text-zinc-500">
              videospots · {t("print.subheading")}
            </span>
            <span className="text-xs text-zinc-500">
              {t("print.created", { date: formatDate(new Date()) })}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span
              className="inline-block w-5 h-5 rounded-full ring-2 ring-zinc-300"
              style={{ background: c.color }}
            />
            <h1 className="text-3xl font-bold">{c.name}</h1>
            <span className="ml-auto text-sm font-medium px-2 py-0.5 rounded bg-zinc-100 border border-zinc-300">
              {runState === "active"
                ? t("timeline.bar_running_now")
                : runState === "upcoming"
                  ? t("timeline.bar_upcoming")
                  : runState === "done"
                    ? t("timeline.bar_done")
                    : statusLabel(c.status)}
            </span>
          </div>
        {c.communicationType && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs bg-zinc-100 border border-zinc-400 rounded-full px-2 py-0.5">
              {communicationTypeLabel(c.communicationType)}
            </span>
          </div>
        )}
        {c.client && <p className="mt-1 text-zinc-600">{c.client}</p>}
        {c.tags && c.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.tags.map((tg) => (
              <span
                key={tg}
                className="text-xs bg-zinc-100 border border-zinc-300 rounded-full px-2 py-0.5"
              >
                #{tg}
              </span>
            ))}
          </div>
        )}
        </div>
        {/* QR — scan to open trailer (or campaign detail if no video) */}
        <div className="shrink-0 flex flex-col items-center text-[9px] text-zinc-600 leading-tight">
          <div
            className="border border-zinc-300 p-1 bg-white"
            // SVG produced server-side from a trusted helper; safe to inline.
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            style={{
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          />
          <span className="mt-1 text-center max-w-24">{qrLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <PrintCard label={t("common.start")} value={formatDate(c.startsAt)} />
        <PrintCard label={t("common.end")} value={formatDate(c.endsAt)} />
        <PrintCard
          label={t("common.duration")}
          value={`${dur} ${t.plural(dur, "unit.day")}`}
        />
        <PrintCard
          label={t("detail.total_reach")}
          value={`${totalReach}`}
          sub={`${t("detail.screen_days")} · ${channelRows.length} × ${t.plural(dur, "unit.day")}`}
        />
      </div>

      {product && (
        <Section title={t("detail.product_section")}>
          <div className="flex items-start gap-4">
            {product.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.coverUrl}
                alt={product.name}
                className="w-20 h-28 object-cover rounded border border-zinc-300"
              />
            )}
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                {product.name}
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 border border-zinc-300 px-2 py-0.5 text-xs font-normal">
                  <span aria-hidden>{kindEmoji(product.kind)}</span>
                  {kindLabel(product.kind)}
                </span>
              </div>
              {product.releaseDate && (
                <div className="text-sm text-zinc-600">
                  {t("detail.product_released", {
                    date: formatDate(product.releaseDate),
                  })}
                </div>
              )}
              {product.summary && (
                <p className="text-sm mt-2">{product.summary}</p>
              )}
            </div>
          </div>
        </Section>
      )}

      <Section title={`${t("detail.channels_section")} (${channelRows.length})`}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="text-left py-1.5 pr-4 font-medium">
                {t.locale === "en" ? "Country" : "Stát"}
              </th>
              <th className="text-left py-1.5 font-medium">
                {t.locale === "en" ? "Chain" : "Řetězec"}
              </th>
            </tr>
          </thead>
          <tbody>
            {channelRows.map((ch, i) => (
              <tr
                key={i}
                className="border-b border-zinc-100 last:border-b-0"
              >
                <td className="py-1.5 pr-4">
                  <span className="mr-1.5">{ch.countryFlag}</span>
                  {ch.countryName}
                </td>
                <td className="py-1.5">{ch.chainName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {videoRows.length > 0 && (
        <Section title={`${t("detail.videos_section")} (${videoRows.length})`}>
          <ul className="space-y-1.5">
            {videoRows.map((v) => (
              <li
                key={v.countryCode}
                className="flex items-baseline gap-2 text-sm"
              >
                <span aria-hidden>{v.countryFlag}</span>
                <span className="font-medium w-20 shrink-0">
                  {v.countryName}
                </span>
                <a
                  href={v.videoUrl}
                  className="text-zinc-600 break-all hover:underline"
                >
                  {v.videoUrl}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c.notes && (
        <Section title={t("detail.notes_section")}>
          <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
        </Section>
      )}

      <p className="text-xs text-zinc-400 mt-12 text-center border-t border-zinc-200 pt-4">
        {t("print.generated", { date: formatDate(new Date()) })} · #{c.id}
      </p>
    </div>
  );
}

function PrintCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-zinc-300 rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 border-b border-zinc-200 pb-1 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

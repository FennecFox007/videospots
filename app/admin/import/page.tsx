import { CsvImport } from "@/components/csv-import";

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Hromadný import kampaní z CSV. Vhodné pro migraci ze stávajícího
          Excelu / sdíleného listu.
        </p>
      </div>
      <CsvImport />
    </div>
  );
}

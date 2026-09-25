"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, Plus } from "lucide-react";
import type { ModuleDefinition, ModuleKey } from "@/src/types/admin";
import {
  DataTable,
  PrimaryButton,
  SummaryStats,
  Toolbar,
  Workflow,
} from "@/src/components/admin/ui";

type Props = {
  moduleKey: ModuleKey;
  definition: ModuleDefinition;
  onCreate: () => void;
  onBack: () => void;
};

export function ModuleView({ definition, onCreate, onBack }: Props) {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      definition.rows.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [definition.rows, query],
  );
  return (
    <>
      <button className="module-back" onClick={onBack}>
        <ArrowLeft /> Quay lại trang trước
      </button>
      {definition.stats && <SummaryStats items={definition.stats} />}
      {definition.workflow && <Workflow items={definition.workflow} />}
      <div className="module-toolbar-row">
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          placeholder={definition.searchPlaceholder}
          filters={definition.filters}
        />
        {definition.addLabel && (
          <PrimaryButton onClick={onCreate}>
            <Plus /> {definition.addLabel}
          </PrimaryButton>
        )}
      </div>
      <DataTable
        rows={rows}
        columns={definition.columns}
        detailSection={definition.detailSection}
      />
      {definition.note && (
        <div className="note schema-note">
          <CircleAlert />
          <p>
            <b>Quy tắc nghiệp vụ</b>
            <span>{definition.note}</span>
          </p>
        </div>
      )}
    </>
  );
}

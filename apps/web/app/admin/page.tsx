"use client";

import Typography from "@mui/joy/Typography";
import { type ColumnDef } from "@tanstack/react-table";
import { type AdminScript } from "@zysk/ts-rest";

import { useAdminScripts } from "#/api/admin";
import { DataTable } from "#/ui/data-table";

import { AdminScriptRunnerButton } from "./admin-script-runner";

const columns = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => {
      return (
        <Typography level="body-sm" height="3rem" lineHeight="3rem">
          {row.original.name}
        </Typography>
      );
    },
    footer: () => (
      <Typography level="body-md" fontWeight="lg" sx={{ paddingLeft: 2 }}>
        Total
      </Typography>
    ),
    size: 100,
  },
  {
    id: "description",
    header: "Description",
    cell: ({ row }) => (
      <Typography level="body-sm">{row.original.description}</Typography>
    ),
    minSize: 300,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <AdminScriptRunnerButton script={row.original} />,
    size: 100,
  },
] as ColumnDef<AdminScript>[];

export default function AdminPage() {
  const { data } = useAdminScripts();

  if (!data) return null;

  return (
    <DataTable
      data={data}
      columns={columns}
      stripe="even"
      sx={{ width: 1000 }}
    />
  );
}

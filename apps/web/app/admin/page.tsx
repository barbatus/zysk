"use client";

import Typography from "@mui/joy/Typography";
import { type ColumnDef } from "@tanstack/react-table";
import { type AdminScript } from "@zysk/ts-rest";

import { useAdminScripts } from "#/api/admin";
import { DataTable } from "#/ui/data-table";

const columns = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => {
      return <Typography level="body-sm">{row.original.name}</Typography>;
    },
    footer: () => (
      <Typography level="body-md" fontWeight="lg" sx={{ paddingLeft: 2 }}>
        Total
      </Typography>
    ),
    size: 30,
  },
  {
    id: "description",
    header: "Description",
    cell: ({ row }) => (
      <Typography level="body-sm" whiteSpace="nowrap">
        {row.original.description}
      </Typography>
    ),
    size: 120,
  },
] as ColumnDef<AdminScript>[];

export default function AdminPage() {
  const { data } = useAdminScripts();

  if (!data) return null;

  return <DataTable data={data} columns={columns} stripe="even" />;
}

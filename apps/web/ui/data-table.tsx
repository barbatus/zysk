"use client";

import { Sheet, Table, type TableProps, Typography } from "@mui/joy";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  type RowData,
  useReactTable,
} from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface HeaderContext<TData extends RowData, TValue> {
    row?: TData;
  }
}

export function DataTable<
  Entity extends object,
  TData extends object & { entity?: Entity } & {
    subRows?: TData[];
  },
  TValue,
>({
  data,
  columns,
  footerRow,
  ...props
}: TableProps & {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  footerRow?: TData;
}) {
  const table = useReactTable({
    data,
    columns,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <Sheet
      variant="outlined"
      sx={{
        // maxWidth: 1400,
        mx: "auto",
        my: 4,
        p: 2,
        borderRadius: "sm",
        boxShadow: "md",
        height: "auto",
      }}
    >
      <Table
        borderAxis="header"
        {...props}
        sx={{
          "--TableCell-footBackground": "transparent",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{
                    width: header.column.getSize(),
                  }}
                >
                  <Typography level="body-sm" whiteSpace="normal">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </Typography>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {table.getFooterGroups().map((footerGroup) => (
            <tr key={footerGroup.id}>
              {footerGroup.headers.map((header) => (
                <td key={header.id}>
                  {flexRender(header.column.columnDef.footer, {
                    ...header.getContext(),
                    row: footerRow,
                  })}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </Table>
    </Sheet>
  );
}

"use client";

import { Sheet, Table, type TableProps, Typography } from "@mui/joy";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowData,
  useReactTable,
} from "@tanstack/react-table";

// interface Person {
//   id: number;
//   name: string;
//   age: number;
//   occupation: string;
// }

// const data: Person[] = [
//   { id: 1, name: "Alice", age: 28, occupation: "Engineer" },
//   { id: 2, name: "Bob", age: 34, occupation: "Designer" },
//   { id: 3, name: "Charlie", age: 25, occupation: "Teacher" },
// ];

// const columns: ColumnDef<Person>[] = [
//   { accessorKey: "id", header: "ID" },
//   { accessorKey: "name", header: "Name" },
//   { accessorKey: "age", header: "Age" },
//   { accessorKey: "occupation", header: "Occupation" },
// ];

export function DataTable<TData extends RowData, TValue>({
  data,
  columns,
  ...props
}: TableProps & {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Sheet
      variant="outlined"
      sx={{
        maxWidth: 800,
        mx: "auto",
        my: 4,
        p: 2,
        borderRadius: "sm",
        boxShadow: "md",
        height: "auto",
      }}
    >
      <Table borderAxis="header" {...props}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  <Typography level="body-sm">
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
      </Table>
    </Sheet>
  );
}

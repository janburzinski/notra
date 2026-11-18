import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@notra/ui/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "ui/table";

function RowMenuFixture() {
  const [result, setResult] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <section className="w-[580px]">
      <DataTable
        columns={[
          { key: "name", header: "Name", width: "1fr" },
          {
            key: "link",
            header: "Link",
            width: "8rem",
            cell: (row) =>
              row.name === "First" ? <a href="#first">Row link</a> : null,
          },
        ]}
        data={[{ name: "First" }, { name: "Menu only" }, { name: "Native" }]}
        getRowId={(row) => row.name}
        height={200}
        isRowClickable={(row) => row.name === "First"}
        onRowClick={(row) => setResult(`Opened ${row.name}`)}
        onSelectionChange={setSelected}
        renderRowContextMenu={(row) =>
          row.name === "Native" ? null : (
            <ContextMenuItem
              onClick={() => setResult(`Action for ${row.name}`)}
            >
              {`Action for ${row.name}`}
            </ContextMenuItem>
          )
        }
        selectable
        selectedRowIds={selected}
      />
      <output data-testid="row-result">{result}</output>
      <output data-testid="row-selection">{selected.join(", ")}</output>
    </section>
  );
}

function MenuHighlightFixture() {
  return (
    <main className="bg-background text-foreground flex min-h-screen items-start gap-8 p-8">
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Overview</DropdownMenuItem>
          <DropdownMenuItem>Prompts</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Copy link</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
      <ContextMenu>
        <ContextMenuTrigger data-testid="context-trigger">
          Right click for context menu
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Child action</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
      <RowMenuFixture />
    </main>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<MenuHighlightFixture />);
}

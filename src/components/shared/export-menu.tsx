"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Word for editing and sharing; PDF through the browser's print dialog. */
export function ExportMenu({ wordHref, printHref }: { wordHref: string; printHref: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4" aria-hidden="true" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <a href={wordHref} download>Word document (.docx)</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={printHref} target="_blank" rel="noopener">PDF (print view)</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";

import { Button } from "../../button/components/button";
import { EdgeLight } from "../components/edge-light";

export default function EdgeLightExample() {
  const [active, setActive] = useState(true);

  return (
    <div className="flex w-full max-w-xl flex-col items-start gap-3 p-6">
      <div className="relative w-full rounded-[10px]">
        <div className="border-table-card-border bg-table-card shadow-table-card text-muted-foreground h-24 rounded-[10px] border px-3 py-2.5 text-sm">
          Writing this week's changelog...
        </div>
        <EdgeLight active={active} />
      </div>
      <Button
        onClick={() => setActive((current) => !current)}
        size="sm"
        variant="outline"
      >
        {active ? "Stop" : "Start"}
      </Button>
    </div>
  );
}

"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useEffect } from "react";

interface SelectionPluginProps {
  onSelectionChange: (selectedText: string | null) => void;
}

export function SelectionPlugin({ onSelectionChange }: SelectionPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          const text = selection.getTextContent().trim();
          onSelectionChange(text || null);
        } else {
          onSelectionChange(null);
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, onSelectionChange]);

  return null;
}

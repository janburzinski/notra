"use client";

import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

interface MarkdownSyncPluginProps {
  onChange: (markdown: string) => void;
}

export function MarkdownSyncPlugin({ onChange }: MarkdownSyncPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS);
        onChange(markdown);
      });
    });
  }, [editor, onChange]);

  return null;
}

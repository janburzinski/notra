"use client";

import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { type RefObject, useImperativeHandle } from "react";

export interface EditorRefHandle {
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
}

interface EditorRefPluginProps {
  editorRef: RefObject<EditorRefHandle | null>;
}

export function EditorRefPlugin({ editorRef }: EditorRefPluginProps) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(
    editorRef,
    () => ({
      setMarkdown: (markdown: string) => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          $convertFromMarkdownString(markdown, TRANSFORMERS);
        });
      },
      getMarkdown: () => {
        let markdown = "";
        editor.getEditorState().read(() => {
          markdown = $convertToMarkdownString(TRANSFORMERS);
        });
        return markdown;
      },
    }),
    [editor]
  );

  return null;
}

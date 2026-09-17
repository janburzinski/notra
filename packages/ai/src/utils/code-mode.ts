import {
  DIRECT_TOOL_CALL,
  experimental_codeModeTool as codeModeTool,
} from "@ai-sdk/code-mode";
import {
  CODE_MODE_SEARCH_TOOL_NAME,
  CODE_MODE_TIMEOUT_MS,
  CODE_MODE_TOOL_NAME,
  STANDALONE_CODE_MODE_TOOL_NAMES,
} from "@notra/ai/constants/code-mode";
import { type Experimental_ToolCallers, type Tool, toolSearch } from "ai";

/**
 * Adds the official code_mode tool and restricts the read-only standalone
 * tools to it, so the model can only reach them from sandboxed code.
 *
 * The read-only tools are deferred (`deferLoading`): instead of inlining all
 * of their signatures into the code_mode description, the model discovers
 * them with the `searchTools` tool and they become callable on the next model
 * step, announced via code_mode capability-update messages.
 */
export function withStandaloneCodeMode(tools: Record<string, Tool>) {
  const toolsWithCodeMode: Record<string, Tool> = {
    ...tools,
    [CODE_MODE_SEARCH_TOOL_NAME]: toolSearch(),
    [CODE_MODE_TOOL_NAME]: codeModeTool({
      executionPolicy: { timeoutMs: CODE_MODE_TIMEOUT_MS },
      // Deferred tools require a caller that announces them in conversation
      // messages. 'conversation' also keeps the provider-visible code_mode
      // definition stable for prompt caching as tools are discovered.
      toolDiscovery: "conversation",
    }),
  };
  for (const toolName of STANDALONE_CODE_MODE_TOOL_NAMES) {
    const standaloneTool = toolsWithCodeMode[toolName];
    if (standaloneTool) {
      standaloneTool.deferLoading = true;
    }
  }
  // The tool record is string-keyed, so the SDK cannot infer code_mode as a
  // caller name from its type.
  const callerEntries: [string, string[]][] =
    STANDALONE_CODE_MODE_TOOL_NAMES.filter((toolName) => toolName in tools).map(
      (toolName) => [toolName, [CODE_MODE_TOOL_NAME]]
    );
  // Search discovers deferred tools only through callers it shares with them,
  // so code_mode must be listed here; DIRECT_TOOL_CALL keeps a lookup from
  // needing a sandbox round trip.
  callerEntries.push([
    CODE_MODE_SEARCH_TOOL_NAME,
    [DIRECT_TOOL_CALL, CODE_MODE_TOOL_NAME],
  ]);
  const toolCallers = Object.fromEntries(
    callerEntries
  ) as unknown as Experimental_ToolCallers<Record<string, Tool>>;

  return { tools: toolsWithCodeMode, toolCallers };
}

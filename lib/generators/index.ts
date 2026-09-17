import type { ClassifiedRoute } from "@/lib/core";
import { generateLlmsTxt } from "./llms-txt";
import { generateMcpServer, generateMcpToolsJson } from "./mcp";
import type { GenerateOptions, GeneratedFile } from "./shared";

export function generateOutputs(
  routes: ClassifiedRoute[],
  options: GenerateOptions,
): GeneratedFile[] {
  return [
    { filename: "llms.txt", content: generateLlmsTxt(routes, options) },
    { filename: "mcp-tools.json", content: generateMcpToolsJson(routes) },
    { filename: "mcp-server.mjs", content: generateMcpServer(routes, options) },
  ];
}

export { generateLlmsTxt } from "./llms-txt";
export { generateMcpServer, generateMcpTools, generateMcpToolsJson } from "./mcp";
export type { GenerateOptions, GeneratedFile } from "./shared";

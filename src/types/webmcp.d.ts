export {};

type WebMcpJsonSchema = Record<string, unknown>;

type WebMcpToolDefinition = {
  name: string;
  description: string;
  inputSchema: WebMcpJsonSchema;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (definition: WebMcpToolDefinition) => Promise<void> | void;
    };
  }
}

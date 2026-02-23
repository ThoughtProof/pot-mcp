#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runVerify, runDeep } from './tools.js';

const server = new McpServer({
  name: 'pot-mcp',
  version: '0.1.0',
});

const ApiKeysSchema = z.object({
  anthropic: z.string().optional(),
  xai: z.string().optional(),
  deepseek: z.string().optional(),
  moonshot: z.string().optional(),
}).optional();

// Tool 1: pot_verify
server.tool(
  'pot_verify',
  'Verify an AI output using adversarial multi-model consensus (pot-sdk). Returns confidence score, flags, MDI, SAS, and dissent report.',
  {
    output: z.string().describe('The AI output to verify'),
    question: z.string().describe('The original question or prompt that produced the output'),
    tier: z.enum(['basic', 'pro']).default('basic').describe('Verification depth: basic (~200ms) or pro (deeper, slower)'),
    apiKeys: ApiKeysSchema.describe('Optional API key overrides. Falls back to env vars: ANTHROPIC_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY, MOONSHOT_API_KEY'),
  },
  async ({ output, question, tier, apiKeys }) => {
    try {
      const result = await runVerify({ output, question, tier, apiKeys });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool 2: pot_deep
server.tool(
  'pot_deep',
  'Run a deep multi-model analysis on an AI output using pot-sdk. More thorough than pot_verify — uses rotating synthesizers and full dissent documentation.',
  {
    output: z.string().describe('The AI output to analyze'),
    question: z.string().describe('The original question or prompt'),
    apiKeys: ApiKeysSchema.describe('Optional API key overrides'),
  },
  async ({ output, question, apiKeys }) => {
    try {
      const result = await runDeep({ output, question, apiKeys });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

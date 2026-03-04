#!/usr/bin/env node
/**
 * pot-mcp — ThoughtProof MCP Server
 * ===================================
 * Exposes ThoughtProof verification as MCP tools for Claude Desktop, Cursor, Windsurf, etc.
 *
 * Setup (one-liner):
 *   npx pot-mcp
 *
 * Config (cursor/mcp.json or claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "thoughtproof": {
 *         "command": "npx",
 *         "args": ["pot-mcp"],
 *         "env": { "TP_API_KEY": "tp_op_..." }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const API_BASE = process.env.TP_API_URL ?? 'https://api.thoughtproof.ai';
const API_KEY  = process.env.TP_API_KEY ?? '';

if (!API_KEY) {
  process.stderr.write('[pot-mcp] Warning: TP_API_KEY not set. Get a free key at https://thoughtproof.ai/api\n');
}

// ── HTTP helper ───────────────────────────────────────────────────────────

async function tpFetch(path: string, opts: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method:  opts.method ?? 'GET',
    headers: {
      'Content-Type':   'application/json',
      'X-Operator-Key': API_KEY,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`ThoughtProof API error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ── Tool schemas ──────────────────────────────────────────────────────────

const VerifySchema = z.object({
  agentId:  z.string().describe('The agent ID making the claim'),
  claim:    z.string().describe('The claim or decision to verify (e.g. "Approve €500 payment to vendor-42")'),
  verdict:  z.enum(['VERIFIED', 'UNVERIFIED', 'UNCERTAIN', 'DISSENT']).describe('Your preliminary verdict'),
  domain:   z.string().optional().default('general').describe('Domain context: finance, medical, legal, general'),
  metadata: z.record(z.string(), z.string()).optional().describe('Optional key-value metadata for the receipt'),
});

const ScoreSchema = z.object({
  agentId: z.string().describe('The agent ID to score'),
  domain:  z.string().optional().describe('Optional domain filter'),
});

const RegisterAgentSchema = z.object({
  name:        z.string().describe('Human-readable agent name'),
  description: z.string().optional().describe('What this agent does'),
});

const GetReceiptSchema = z.object({
  receiptId: z.string().describe('Receipt ID (starts with rcpt_)'),
});

const RecordEventSchema = z.object({
  agentId:          z.string().describe('The agent ID'),
  type:             z.enum(['verification', 'peer_review', 'adversarial_test']).describe('Event type'),
  outcome:          z.enum(['correct', 'incorrect', 'contested']).describe('Outcome of this verification'),
  peerRating:       z.number().min(0).max(1).describe('Peer rating score (0–1)'),
  adversarialScore: z.number().min(0).max(1).describe('How well the agent survived adversarial challenge (0–1)'),
  domain:           z.string().describe('Domain of this event (e.g. finance)'),
  context:          z.string().optional().describe('Optional free-text context'),
});

// ── Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'thoughtproof', version: '0.2.0' },
  { capabilities: { tools: {} } } as any,
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'thoughtproof_verify',
      description: 'Issue a cryptographically signed verification receipt for an AI agent\'s claim or decision. Returns a JWT receipt + score. Use BEFORE the agent takes any sensitive action.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId:  { type: 'string', description: 'Agent ID from thoughtproof_register_agent' },
          claim:    { type: 'string', description: 'The claim or decision to verify' },
          verdict:  { type: 'string', enum: ['VERIFIED', 'UNVERIFIED', 'UNCERTAIN', 'DISSENT'] },
          domain:   { type: 'string', description: 'Domain: finance, medical, legal, general', default: 'general' },
          metadata: { type: 'object', description: 'Optional metadata included in receipt' },
        },
        required: ['agentId', 'claim', 'verdict'],
      },
    },
    {
      name: 'thoughtproof_score',
      description: 'Get the current trust score (0–1) for an AI agent based on its verification history.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          domain:  { type: 'string', description: 'Optional domain filter' },
        },
        required: ['agentId'],
      },
    },
    {
      name: 'thoughtproof_register_agent',
      description: 'Register a new AI agent to track its trust score. Returns agentId to use in subsequent calls.',
      inputSchema: {
        type: 'object',
        properties: {
          name:        { type: 'string', description: 'Human-readable agent name' },
          description: { type: 'string', description: 'What this agent does' },
        },
        required: ['name'],
      },
    },
    {
      name: 'thoughtproof_get_receipt',
      description: 'Retrieve a previously issued verification receipt by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', description: 'Receipt ID (starts with rcpt_)' },
        },
        required: ['receiptId'],
      },
    },
    {
      name: 'thoughtproof_record_event',
      description: 'Record a verification event to update an agent\'s trust score.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId:          { type: 'string' },
          type:             { type: 'string', enum: ['verification', 'peer_review', 'adversarial_test'] },
          outcome:          { type: 'string', enum: ['correct', 'incorrect', 'contested'] },
          peerRating:       { type: 'number', minimum: 0, maximum: 1 },
          adversarialScore: { type: 'number', minimum: 0, maximum: 1 },
          domain:           { type: 'string' },
          context:          { type: 'string' },
        },
        required: ['agentId', 'type', 'outcome', 'peerRating', 'adversarialScore', 'domain'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'thoughtproof_verify': {
        const p = VerifySchema.parse(args);
        result = await tpFetch('/v1/verify', { method: 'POST', body: p });
        break;
      }
      case 'thoughtproof_score': {
        const p = ScoreSchema.parse(args);
        const qs = p.domain ? `?domain=${encodeURIComponent(p.domain)}` : '';
        result = await tpFetch(`/v1/agents/${p.agentId}/score${qs}`);
        break;
      }
      case 'thoughtproof_register_agent': {
        const p = RegisterAgentSchema.parse(args);
        result = await tpFetch('/v1/agents', { method: 'POST', body: p });
        break;
      }
      case 'thoughtproof_get_receipt': {
        const p = GetReceiptSchema.parse(args);
        result = await tpFetch(`/v1/receipts/${p.receiptId}`);
        break;
      }
      case 'thoughtproof_record_event': {
        const p = RecordEventSchema.parse(args);
        result = await tpFetch(`/v1/agents/${p.agentId}/events`, { method: 'POST', body: p });
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[pot-mcp] ThoughtProof MCP server ready\n');

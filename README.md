# pot-mcp

MCP server for [pot-sdk](https://npmjs.com/package/pot-sdk) — verify any AI output via adversarial multi-model consensus. Add it to any MCP client and get `pot_verify` + `pot_deep` as native tools.

## What it does

pot-mcp wraps pot-sdk as a Model Context Protocol server. Any agent or IDE that supports MCP can call `pot_verify(output, question)` to run the output through a Generator → Critic → Synthesizer pipeline across multiple AI providers. It returns a confidence score, flags, MDI (Model Diversity Index), SAS (Synthesis Audit Score), and a full dissent report.

## Install

```bash
# Run directly (no install needed)
npx pot-mcp

# Or install globally
npm install -g pot-mcp
```

## Setup: Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pot-verify": {
      "command": "npx",
      "args": ["pot-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key",
        "XAI_API_KEY": "your-key",
        "DEEPSEEK_API_KEY": "your-key"
      }
    }
  }
}
```

## Setup: OpenClaw

Add to your OpenClaw config:

```json
{
  "mcp": {
    "servers": {
      "pot-verify": {
        "command": "npx pot-mcp",
        "env": {
          "ANTHROPIC_API_KEY": "your-key",
          "XAI_API_KEY": "your-key"
        }
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Used for critic (Opus) + synthesizer (Sonnet) |
| `XAI_API_KEY` | One of these | xAI Grok generator |
| `DEEPSEEK_API_KEY` | One of these | DeepSeek generator |
| `MOONSHOT_API_KEY` | One of these | Moonshot Kimi generator |

At least 2 generator keys + ANTHROPIC_API_KEY required.

## Tools

### `pot_verify`
Fast verification (Tier 1 basic ~200ms, Tier 2 pro ~2-4s).

```
output   — The AI output to verify
question — The original prompt
tier     — "basic" | "pro" (default: "basic")
apiKeys  — Optional key overrides
```

Returns: `{ verified, confidence, flags, mdi, sas, dissent, synthesis }`

### `pot_deep`
Deep analysis with rotating synthesizers and full dissent documentation.

```
output   — The AI output to analyze
question — The original prompt
apiKeys  — Optional key overrides
```

## Example

```
User: Use pot_verify to check this output: "The Eiffel Tower is 330 meters tall"
      Question: "How tall is the Eiffel Tower?"

Agent calls: pot_verify({ output: "The Eiffel Tower is 330 meters tall", question: "How tall is the Eiffel Tower?", tier: "basic" })

Returns: { verified: true, confidence: 0.91, flags: [], mdi: 0.72, sas: 0.88, synthesis: "..." }
```

## Links

- pot-sdk: https://npmjs.com/package/pot-sdk
- Protocol spec: https://thoughtproof.ai
- GitHub: https://github.com/ThoughtProof/pot-mcp

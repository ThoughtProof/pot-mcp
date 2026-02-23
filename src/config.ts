export interface ApiKeys {
  anthropic?: string;
  xai?: string;
  deepseek?: string;
  moonshot?: string;
}

export function resolveKeys(override?: ApiKeys): ApiKeys {
  return {
    anthropic: override?.anthropic ?? process.env.ANTHROPIC_API_KEY,
    xai: override?.xai ?? process.env.XAI_API_KEY,
    deepseek: override?.deepseek ?? process.env.DEEPSEEK_API_KEY,
    moonshot: override?.moonshot ?? process.env.MOONSHOT_API_KEY,
  };
}

export function buildApiKeyRecord(keys: ApiKeys): Record<string, string> {
  const record: Record<string, string> = {};
  if (keys.anthropic) record['ANTHROPIC_API_KEY'] = keys.anthropic;
  if (keys.xai) record['XAI_API_KEY'] = keys.xai;
  if (keys.deepseek) record['DEEPSEEK_API_KEY'] = keys.deepseek;
  if (keys.moonshot) record['MOONSHOT_API_KEY'] = keys.moonshot;
  return record;
}

export function validateConfig(keys: ApiKeys): string | null {
  if (!keys.anthropic) {
    return 'ANTHROPIC_API_KEY required for critic and synthesizer.';
  }
  const totalProviders = [keys.anthropic, keys.xai, keys.deepseek, keys.moonshot].filter(Boolean).length;
  if (totalProviders < 2) {
    return 'At least 2 API keys required for multi-model verification. Set XAI_API_KEY, DEEPSEEK_API_KEY, or MOONSHOT_API_KEY in addition to ANTHROPIC_API_KEY.';
  }
  return null;
}

import { verify, deepAnalysis } from 'pot-sdk';
import { resolveKeys, buildApiKeyRecord, validateConfig } from './config.js';
import type { ApiKeys } from './config.js';

export async function runVerify(params: {
  output: string;
  question: string;
  tier?: 'basic' | 'pro';
  apiKeys?: ApiKeys;
}) {
  const keys = resolveKeys(params.apiKeys);
  const error = validateConfig(keys);
  if (error) throw new Error(error);

  const apiKeys = buildApiKeyRecord(keys);

  const result = await verify(params.output, {
    tier: params.tier ?? 'basic',
    apiKeys,
    question: params.question,
  });

  return result;
}

export async function runDeep(params: {
  output: string;
  question: string;
  apiKeys?: ApiKeys;
}) {
  const keys = resolveKeys(params.apiKeys);
  const error = validateConfig(keys);
  if (error) throw new Error(error);

  const apiKeys = buildApiKeyRecord(keys);

  const result = await deepAnalysis(params.question, {
    apiKeys,
    question: params.question,
    output: params.output,
  });

  return result;
}

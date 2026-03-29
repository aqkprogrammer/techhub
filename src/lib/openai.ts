type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionOptions = {
  messages: ChatMessage[];
  temperature?: number;
  requireJson?: boolean;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    } | null;
  }>;
  error?: {
    message?: string;
  };
};

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY ?? '';
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}

export async function createOpenAiChatCompletion({
  messages,
  temperature = 0.3,
  requireJson = false,
}: ChatCompletionOptions): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const payload: Record<string, unknown> = {
    model: getOpenAiModel(),
    messages,
    temperature,
  };

  if (requireJson) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json().catch(() => null)) as OpenAiChatResponse | null;
  if (!response.ok) {
    const message = json?.error?.message ?? 'OpenAI request failed.';
    throw new Error(message);
  }

  const text = json?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) {
    throw new Error('OpenAI returned an empty response.');
  }

  return text;
}

export function parseJsonObject<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1)) as T;
    }
    throw new Error('Failed to parse JSON response.');
  }
}

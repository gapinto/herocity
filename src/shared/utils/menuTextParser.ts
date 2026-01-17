export interface ParsedMenuItemRequest {
  name: string;
  quantity: number;
}

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function stripLeadingWords(text: string): string {
  let cleaned = text;
  const patterns = [
    /^quero\s+/,
    /^queria\s+/,
    /^gostaria\s+de\s+/,
    /^gostaria\s+/,
    /^me\s+ve\s+/,
    /^me\s+da\s+/,
    /^por\s+favor\s+/,
    /^adicionar\s+/,
    /^adicione\s+/,
    /^adiciona\s+/,
    /^pedir\s+/,
    /^pedido\s+/,
  ];

  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

function stripArticles(text: string): string {
  return text.replace(/^(um|uma|uns|umas|o|a|os|as)\s+/, '').trim();
}

export function parseMenuItemRequests(text: string): ParsedMenuItemRequest[] {
  const normalized = normalizeText(text);
  const segments = normalized
    .replace(/\s+e\s+/g, ',')
    .split(',')
    .map((segment) => stripLeadingWords(segment).trim())
    .filter(Boolean);

  const requests: ParsedMenuItemRequest[] = [];
  for (const segment of segments) {
    let quantity = 1;
    let name = segment;

    const leadingMatch = segment.match(/^(\d+)\s*x?\s*(.+)$/);
    const trailingMatch = segment.match(/^(.+?)\s*x?\s*(\d+)$/);

    if (leadingMatch) {
      quantity = parseInt(leadingMatch[1], 10);
      name = leadingMatch[2];
    } else if (trailingMatch) {
      quantity = parseInt(trailingMatch[2], 10);
      name = trailingMatch[1];
    }

    name = stripArticles(name);
    if (!name) {
      continue;
    }

    requests.push({ name, quantity: Number.isNaN(quantity) ? 1 : quantity });
  }

  return requests;
}

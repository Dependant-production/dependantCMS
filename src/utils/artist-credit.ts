/**
 * Strapi only links published entries to published relations, so a published
 * project loses its artist while the artist portfolio is still a draft. These
 * helpers add the artist name to project responses, read from the published
 * artist when there is one and from the draft otherwise. No other draft field
 * is returned.
 */

type Entry = Record<string, unknown> & { documentId: string };

export type ArtistCredit = {
  documentId: string;
  name?: string | null;
  published: boolean;
};

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Entry).documentId === 'string'
  );
}

export function namesByProject(credits: ArtistCredit[]) {
  const names = new Map<string, string>();
  const publishedFirst = [...credits].sort(
    (a, b) => Number(b.published) - Number(a.published),
  );

  for (const { documentId, name, published } of publishedFirst) {
    if (name?.trim() && !names.has(documentId)) names.set(documentId, name);
  }

  return names;
}

export async function withArtistName(
  response: unknown,
  field: string,
  findCredits: (documentIds: string[]) => Promise<ArtistCredit[]>,
) {
  if (typeof response !== 'object' || response === null) return response;

  const { data } = response as { data?: unknown };
  const entries = (Array.isArray(data) ? data : [data]).filter(isEntry);
  if (!entries.length) return response;

  const names = namesByProject(
    await findCredits([...new Set(entries.map(({ documentId }) => documentId))]),
  );
  const credit = (entry: unknown) =>
    isEntry(entry)
      ? { ...entry, [field]: names.get(entry.documentId) ?? null }
      : entry;

  return {
    ...response,
    data: Array.isArray(data) ? data.map(credit) : credit(data),
  };
}

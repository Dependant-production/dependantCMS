/**
 * Strapi only links published entries to published relations, so a published
 * project loses its artist while the artist portfolio is still a draft. These
 * helpers add the artist name to project responses, read from the published
 * artist when there is one and from the draft otherwise. No other draft field
 * is returned.
 */

import type { Core } from '@strapi/strapi';

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

export async function findPhotographerCredits(
  strapi: Core.Strapi,
  documentIds: string[],
): Promise<ArtistCredit[]> {
  if (!documentIds.length) return [];

  // The relation is only stored on the photographer side.
  const photographers = await strapi.db
    .query('api::photographer.photographer')
    .findMany({
      where: { projects: { documentId: { $in: documentIds } } },
      select: ['name', 'publishedAt'],
      populate: { projects: { select: ['documentId'] } },
    });

  return photographers.flatMap((photographer) =>
    (photographer.projects ?? [])
      .filter((project) => documentIds.includes(project.documentId))
      .map((project) => ({
        documentId: project.documentId,
        name: photographer.name,
        published: Boolean(photographer.publishedAt),
      })),
  );
}

export async function findDirectorCredits(
  strapi: Core.Strapi,
  documentIds: string[],
): Promise<ArtistCredit[]> {
  if (!documentIds.length) return [];

  // The draft version links to the draft director, the published version to
  // the published one.
  const versions = await strapi.db
    .query('api::project-video.project-video')
    .findMany({
      where: { documentId: { $in: documentIds } },
      select: ['documentId', 'publishedAt'],
      populate: { director: { select: ['name'] } },
    });

  return versions.map((version) => ({
    documentId: version.documentId,
    name: version.director?.name,
    published: Boolean(version.publishedAt),
  }));
}

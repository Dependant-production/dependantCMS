/**
 * Lists every project of the site's Projects tab in one place for the admin
 * panel (src/admin/pages/ProjectsOverview.tsx), photos and videos together.
 * Mirrors the site's rules (dependant.tv src/helpers/projects.ts): the
 * published version must have showInProjects, a video needs a playable Mux
 * asset, and projects with an order come first, then the others
 * alphabetically.
 */

import type { Core } from '@strapi/strapi';
import {
  findDirectorCredits,
  findPhotographerCredits,
  namesByProject,
} from './artist-credit';

type Category = 'photos' | 'videos';

// published: on the site. modified: on the site, with unpublished changes.
// draft: ticked in the draft only, so the tick is not published yet.
// no-video: published, but the video has no playable Mux asset, so the site
// skips it.
export type OverviewState = 'published' | 'modified' | 'draft' | 'no-video';

export type OverviewRow = {
  documentId: string;
  category: Category;
  title: string;
  creatorName: string;
  projectsOrder: number | null;
  state: OverviewState;
};

export type ProjectVersion = {
  documentId: string;
  title?: string | null;
  showInProjects?: boolean | null;
  projectsOrder?: number | null;
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  mux_video_uploader_mux_assets?: { playback_id?: string | null }[] | null;
};

const time = (date?: string | Date | null) =>
  date ? new Date(date).getTime() : 0;

// Empty or 0 (the former default) means the project has no set order.
const toProjectsOrder = (order?: number | null) =>
  order && order > 0 ? order : null;

export function compareRows(a: OverviewRow, b: OverviewRow) {
  if (a.projectsOrder !== b.projectsOrder) {
    if (a.projectsOrder === null) return 1;
    if (b.projectsOrder === null) return -1;
    return a.projectsOrder - b.projectsOrder;
  }

  return (
    a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }) ||
    a.creatorName.localeCompare(b.creatorName, 'fr')
  );
}

export function toRows(
  category: Category,
  versions: ProjectVersion[],
  names: Map<string, string>,
): OverviewRow[] {
  const byDocument = new Map<string, ProjectVersion[]>();
  for (const version of versions) {
    byDocument.set(version.documentId, [
      ...(byDocument.get(version.documentId) ?? []),
      version,
    ]);
  }

  const rows: OverviewRow[] = [];
  for (const [documentId, documentVersions] of byDocument) {
    const published = documentVersions.find(({ publishedAt }) => publishedAt);
    const draft = documentVersions.find(({ publishedAt }) => !publishedAt);
    let version: ProjectVersion;
    let state: OverviewState;

    if (published?.showInProjects === true) {
      version = published;
      if (
        category === 'videos' &&
        !published.mux_video_uploader_mux_assets?.some(
          ({ playback_id }) => playback_id,
        )
      ) {
        state = 'no-video';
      } else {
        // Same rule as the Content Manager's "Modified" status.
        state =
          time(draft?.updatedAt) > time(published.updatedAt)
            ? 'modified'
            : 'published';
      }
    } else if (draft?.showInProjects === true) {
      version = draft;
      state = 'draft';
    } else {
      continue;
    }

    rows.push({
      documentId,
      category,
      title: version.title ?? '',
      creatorName: names.get(documentId) ?? '',
      projectsOrder: toProjectsOrder(version.projectsOrder),
      state,
    });
  }

  return rows;
}

// Every version of the documents ticked in their draft or published version.
async function findVersions(
  strapi: Core.Strapi,
  uid: 'api::project.project' | 'api::project-video.project-video',
  populate?: Record<string, unknown>,
) {
  const ticked = await strapi.db.query(uid).findMany({
    where: { showInProjects: true },
    select: ['documentId'],
  });
  const documentIds: string[] = [
    ...new Set(ticked.map(({ documentId }) => documentId as string)),
  ];
  if (!documentIds.length) return { documentIds, versions: [] };

  const versions: ProjectVersion[] = await strapi.db.query(uid).findMany({
    where: { documentId: { $in: documentIds } },
    select: [
      'documentId',
      'title',
      'showInProjects',
      'projectsOrder',
      'publishedAt',
      'updatedAt',
    ],
    populate,
  });

  return { documentIds, versions };
}

export async function getProjectsOverview(strapi: Core.Strapi) {
  const [photos, videos] = await Promise.all([
    findVersions(strapi, 'api::project.project'),
    findVersions(strapi, 'api::project-video.project-video', {
      mux_video_uploader_mux_assets: { select: ['playback_id'] },
    }),
  ]);
  const [photographers, directors] = await Promise.all([
    findPhotographerCredits(strapi, photos.documentIds),
    findDirectorCredits(strapi, videos.documentIds),
  ]);

  const rows = [
    ...toRows('photos', photos.versions, namesByProject(photographers)),
    ...toRows('videos', videos.versions, namesByProject(directors)),
  ].sort(compareRows);

  return {
    onSite: rows.filter(
      ({ state }) => state === 'published' || state === 'modified',
    ),
    pending: rows.filter(
      ({ state }) => state === 'draft' || state === 'no-video',
    ),
  };
}

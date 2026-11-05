/**
 * Lists every photo, video and homepage video in one place for the admin panel
 * (src/admin/pages/ProjectsOverview.tsx) and saves the section and order chosen
 * there. Mirrors the site's rules (dependant.tv src/helpers/projects.ts): the
 * published version must have a section, a video needs a playable Mux asset,
 * and projects with an order come first, then the others alphabetically.
 */

import type { Core } from '@strapi/strapi';
import {
  findDirectorCredits,
  findPhotographerCredits,
  namesByProject,
} from './artist-credit';

const CONTENT_TYPES = {
  photos: 'api::project.project',
  videos: 'api::project-video.project-video',
  homepage: 'api::homepage-video.homepage-video',
} as const;

type Category = keyof typeof CONTENT_TYPES;

const PROJECT_SECTIONS = [
  'commercials',
  'music-videos',
  'photography',
  'unscripted',
] as const;

type ProjectSection = (typeof PROJECT_SECTIONS)[number];

// published: on the site. modified: on the site, with unpublished changes.
// draft: in a section in the draft only, so it is not published yet.
// no-video: published, but the video has no playable Mux asset, so the site
// skips it.
// to-classify: ticked with the former showInProjects checkbox, no section yet.
// hidden: not in the Projects tab.
export type OverviewState =
  | 'published'
  | 'modified'
  | 'draft'
  | 'no-video'
  | 'to-classify'
  | 'hidden';

export type OverviewRow = {
  documentId: string;
  category: Category;
  title: string;
  creatorName: string;
  projectsSection: ProjectSection | null;
  projectsOrder: number | null;
  state: OverviewState;
};

export type ProjectVersion = {
  documentId: string;
  title?: string | null;
  showInProjects?: boolean | null;
  directorNameBIS?: string | null;
  projectsSection?: ProjectSection | null;
  projectsOrder?: number | null;
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  mux_video_uploader_mux_assets?: { playback_id?: string | null }[] | null;
};

export type Placement = Pick<OverviewRow, 'projectsSection' | 'projectsOrder'>;

const time = (date?: string | Date | null) =>
  date ? new Date(date).getTime() : 0;

// Empty or 0 (the former default) means the project has no set order.
const toProjectsOrder = (order?: number | null) =>
  order && order > 0 ? order : null;

export function compareRows(a: OverviewRow, b: OverviewRow) {
  const toClassify =
    Number(b.state === 'to-classify') - Number(a.state === 'to-classify');
  if (toClassify) return toClassify;

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

    if (published?.projectsSection) {
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
    } else if (draft?.projectsSection) {
      version = draft;
      state = 'draft';
    } else {
      version = draft ?? documentVersions[0];
      state = documentVersions.some(({ showInProjects }) => showInProjects)
        ? 'to-classify'
        : 'hidden';
    }

    rows.push({
      documentId,
      category,
      title: version.title ?? '',
      creatorName: names.get(documentId) ?? '',
      projectsSection: version.projectsSection ?? null,
      projectsOrder: toProjectsOrder(version.projectsOrder),
      state,
    });
  }

  return rows;
}

function findVersions(
  strapi: Core.Strapi,
  category: Category,
  fields: string[],
  populate?: Record<string, unknown>,
): Promise<ProjectVersion[]> {
  return strapi.db.query(CONTENT_TYPES[category]).findMany({
    select: [
      'documentId',
      'title',
      'projectsSection',
      'projectsOrder',
      'publishedAt',
      'updatedAt',
      ...fields,
    ],
    populate,
  });
}

const documentIdsOf = (versions: ProjectVersion[]) => [
  ...new Set(versions.map(({ documentId }) => documentId)),
];

export async function getProjectsOverview(strapi: Core.Strapi) {
  const [photos, videos, homepage] = await Promise.all([
    findVersions(strapi, 'photos', ['showInProjects']),
    findVersions(strapi, 'videos', ['showInProjects'], {
      mux_video_uploader_mux_assets: { select: ['playback_id'] },
    }),
    findVersions(strapi, 'homepage', ['directorNameBIS']),
  ]);
  const [photographers, directors, homepageDirectors] = await Promise.all([
    findPhotographerCredits(strapi, documentIdsOf(photos)),
    findDirectorCredits(strapi, documentIdsOf(videos)),
    findDirectorCredits(strapi, documentIdsOf(homepage), CONTENT_TYPES.homepage),
  ]);
  // Same priority as the homepage: the director, then the free text name.
  const homepageCredits = [
    ...homepageDirectors,
    ...homepage.map(({ documentId, directorNameBIS }) => ({
      documentId,
      name: directorNameBIS,
      published: false,
    })),
  ];

  return {
    rows: [
      ...toRows('photos', photos, namesByProject(photographers)),
      ...toRows('videos', videos, namesByProject(directors)),
      ...toRows('homepage', homepage, namesByProject(homepageCredits)),
    ].sort(compareRows),
  };
}

export const isCategory = (value: string): value is Category =>
  Object.keys(CONTENT_TYPES).includes(value);

export function toPlacement(body: unknown): Placement | null {
  const { projectsSection, projectsOrder } = (body ?? {}) as Partial<Placement>;
  const validSection =
    projectsSection === null || PROJECT_SECTIONS.includes(projectsSection);
  const validOrder =
    projectsOrder === null ||
    (Number.isInteger(projectsOrder) && projectsOrder >= 0);

  return validSection && validOrder ? { projectsSection, projectsOrder } : null;
}

// Written on the draft and published versions alike, so the choice goes live
// without publishing other draft changes. updateMany leaves updatedAt alone,
// so the project keeps its "modified" state.
export async function updatePlacement(
  strapi: Core.Strapi,
  category: Category,
  documentId: string,
  placement: Placement,
) {
  const { count } = await strapi.db.query(CONTENT_TYPES[category]).updateMany({
    where: { documentId },
    data: placement,
  });

  return count > 0;
}

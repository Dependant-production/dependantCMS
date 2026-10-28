/**
 * project-video controller
 *
 * Adds `directorName` so a published video keeps its credit while the
 * director is still a draft (see src/utils/artist-credit.ts).
 */

import { factories } from '@strapi/strapi';
import { withArtistName } from '../../../utils/artist-credit';

export default factories.createCoreController(
  'api::project-video.project-video',
  ({ strapi }) => {
    const addDirectorName = (response: unknown) =>
      withArtistName(response, 'directorName', async (documentIds) => {
        // The draft version links to the draft director, the published
        // version to the published one.
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
      });

    return {
      async find(ctx) {
        return addDirectorName(await super.find(ctx));
      },
      async findOne(ctx) {
        return addDirectorName(await super.findOne(ctx));
      },
    };
  },
);

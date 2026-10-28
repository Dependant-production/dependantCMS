/**
 * project controller
 *
 * Adds `photographerName` so a published photo project keeps its credit while
 * the photographer is still a draft (see src/utils/artist-credit.ts).
 */

import { factories } from '@strapi/strapi';
import { withArtistName } from '../../../utils/artist-credit';

export default factories.createCoreController(
  'api::project.project',
  ({ strapi }) => {
    const addPhotographerName = (response: unknown) =>
      withArtistName(response, 'photographerName', async (documentIds) => {
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
      });

    return {
      async find(ctx) {
        return addPhotographerName(await super.find(ctx));
      },
      async findOne(ctx) {
        return addPhotographerName(await super.findOne(ctx));
      },
    };
  },
);

/**
 * project controller
 *
 * Adds `photographerName` so a published photo project keeps its credit while
 * the photographer is still a draft (see src/utils/artist-credit.ts).
 */

import { factories } from '@strapi/strapi';
import {
  findPhotographerCredits,
  withArtistName,
} from '../../../utils/artist-credit';

export default factories.createCoreController(
  'api::project.project',
  ({ strapi }) => {
    const addPhotographerName = (response: unknown) =>
      withArtistName(response, 'photographerName', (documentIds) =>
        findPhotographerCredits(strapi, documentIds),
      );

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

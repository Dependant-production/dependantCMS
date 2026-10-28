/**
 * project-video controller
 *
 * Adds `directorName` so a published video keeps its credit while the
 * director is still a draft (see src/utils/artist-credit.ts).
 */

import { factories } from '@strapi/strapi';
import {
  findDirectorCredits,
  withArtistName,
} from '../../../utils/artist-credit';

export default factories.createCoreController(
  'api::project-video.project-video',
  ({ strapi }) => {
    const addDirectorName = (response: unknown) =>
      withArtistName(response, 'directorName', (documentIds) =>
        findDirectorCredits(strapi, documentIds),
      );

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

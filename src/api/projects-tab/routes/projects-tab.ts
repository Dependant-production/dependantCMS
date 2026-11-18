/**
 * projects-tab router
 *
 * The site reads these numbers without a token, so reading is public here
 * rather than through each environment's Public role. They are only changed
 * from the admin panel.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::projects-tab.projects-tab', {
  only: ['find'],
  config: { find: { auth: false } },
});

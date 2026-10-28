import type { Core } from '@strapi/strapi';
import { getProjectsOverview } from './utils/projects-overview';

const readProjects = [
  'api::project.project',
  'api::project-video.project-video',
].map((subject) => ['plugin::content-manager.explorer.read', subject]);

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Feeds the admin's "Onglet Projets" page (src/admin/pages/ProjectsOverview.tsx).
    strapi.server.routes({
      type: 'admin',
      prefix: '/dependant',
      routes: [
        {
          method: 'GET',
          path: '/projects-overview',
          handler: async (ctx) => {
            ctx.body = await getProjectsOverview(strapi);
          },
          // Strapi fills in the route type when registering it.
          info: {},
          config: {
            policies: [
              'admin::isAuthenticatedAdmin',
              {
                name: 'admin::hasPermissions',
                config: { actions: readProjects },
              },
            ],
          },
        },
      ],
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};

import type { Core } from '@strapi/strapi';
import {
  getProjectsOverview,
  isCategory,
  toPlacement,
  updatePlacement,
} from './utils/projects-overview';

const projectTypes = [
  'api::project.project',
  'api::project-video.project-video',
  'api::homepage-video.homepage-video',
];

const allowed = (action: string) => [
  'admin::isAuthenticatedAdmin',
  {
    name: 'admin::hasPermissions',
    config: {
      actions: projectTypes.map((subject) => [
        `plugin::content-manager.explorer.${action}`,
        subject,
      ]),
    },
  },
];

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
          config: { policies: allowed('read') },
        },
        {
          method: 'PUT',
          path: '/projects-overview/:category/:documentId',
          handler: async (ctx) => {
            const { category, documentId } = ctx.params;
            const placement = toPlacement(ctx.request.body);
            if (!isCategory(category) || !placement) return ctx.badRequest();

            const updated = await updatePlacement(
              strapi,
              category,
              documentId,
              placement,
            );
            if (!updated) return ctx.notFound();

            ctx.body = await getProjectsOverview(strapi);
          },
          info: {},
          config: { policies: allowed('update') },
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

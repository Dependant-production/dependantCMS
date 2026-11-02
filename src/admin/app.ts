import type { StrapiApp } from '@strapi/strapi/admin';
import { BulletList } from '@strapi/icons';

const projectTypes = [
  'api::project.project',
  'api::project-video.project-video',
  'api::homepage-video.homepage-video',
];

const readProjects = projectTypes.map((subject) => ({
  action: 'plugin::content-manager.explorer.read',
  subject,
}));

const projectsLink = {
  uid: 'projects-overview',
  name: 'projects-overview',
  title: 'projects',
  to: '/projects-overview',
  kind: 'collectionType',
  search: null,
  isDisplayed: true,
  permissions: readProjects,
};

export default {
  register(app: Pick<StrapiApp, 'addMenuLink'>) {
    app.addMenuLink({
      to: 'projects-overview',
      icon: BulletList,
      intlLabel: {
        id: 'projects-overview.menu',
        defaultMessage: 'Onglet Projets',
      },
      Component: () => import('./pages/ProjectsOverview'),
      permissions: readProjects,
    });
  },

  bootstrap(app: Pick<StrapiApp, 'getPlugin' | 'registerHook'>) {
    // The main menu only shows an icon, so the page is also listed with the
    // content types. ctLinks only holds the types this user may read.
    app.registerHook(
      'Admin/CM/pages/App/mutate-collection-types-links',
      ({ ctLinks, models }: { ctLinks: { uid: string }[]; models: unknown }) => ({
        ctLinks: projectTypes.every((uid) =>
          ctLinks.some((link) => link.uid === uid),
        )
          ? [...ctLinks, projectsLink]
          : ctLinks,
        models,
      }),
    );

    // The initializers of Mux 3.0.1 and Strapi Cloud only mark their plugin as
    // ready. In Strapi 5.4.1, that change mutates a Plugin class inside an Immer
    // reducer without triggering a React render, leaving the authenticated admin
    // on its loader unless something else renders it again. Mark them ready
    // before the admin mounts, retaining all their functionality.
    for (const id of ['mux-video-uploader', 'cloud']) {
      const plugin = app.getPlugin(id);

      if (plugin) plugin.isReady = true;
    }
  },
};

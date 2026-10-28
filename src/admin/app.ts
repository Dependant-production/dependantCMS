import type { StrapiApp } from '@strapi/strapi/admin';
import { BulletList } from '@strapi/icons';

const readProjects = [
  'api::project.project',
  'api::project-video.project-video',
].map((subject) => ({
  action: 'plugin::content-manager.explorer.read',
  subject,
}));

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

  bootstrap(app: Pick<StrapiApp, 'getPlugin'>) {
    const mux = app.getPlugin('mux-video-uploader');

    if (mux) {
      // Mux 3.0.1's initializer only marks the plugin as ready. In Strapi 5.4.1,
      // that change mutates a Plugin class inside an Immer reducer without
      // triggering a React render, leaving the authenticated admin on its loader.
      // Mark it ready before the admin mounts, retaining all Mux functionality.
      mux.isReady = true;
    }
  },
};

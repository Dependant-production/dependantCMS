import type { StrapiApp } from '@strapi/strapi/admin';

export default {
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

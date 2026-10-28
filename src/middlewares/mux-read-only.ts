export default () => async (ctx, next) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(ctx.method) &&
    decodeURIComponent(ctx.path).includes('mux-video-uploader')
  ) {
    return ctx.forbidden(
      'Les vidéos sont en lecture seule en préproduction. L’ajout, la modification et la suppression de vidéos sont désactivés.',
    );
  }

  return next();
};

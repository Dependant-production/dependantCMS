export default ({ env }) => {
  const bucket = env('AWS_BUCKET');
  const region = env('AWS_REGION');
  const cdnUrl = env('CDN_URL');
  const mediaSources = [
    "'self'",
    'data:',
    'blob:',
    'dl.airtable.com',
    ...(bucket && region
      ? [`https://${bucket}.s3.${region}.amazonaws.com`]
      : []),
    ...(cdnUrl ? [cdnUrl] : []),
  ];

  return [
    'strapi::logger',
    'strapi::errors',
    ...(env('MUX_UPLOADS_ENABLED', 'true') === 'false'
      ? ['global::mux-read-only']
      : []),
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': [
              "'self'",
              'https:',
              'https://dependant.tv',
              'https://www.dependant.tv',
            ],
            'img-src': mediaSources,
            'media-src': mediaSources,
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    {
      name: 'strapi::cors',
      config: {
        enabled: true,
        origin: env.array('CORS_ORIGINS', [
          'https://dependant.tv',
          'https://www.dependant.tv',
        ]),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    {
      name: 'strapi::body',
      config: {
        jsonLimit: '1gb',
        formLimit: '1gb',
        textLimit: '1gb',
        formidable: {
          maxFileSize: 1024 * 1024 * 1024, // 1GB en octets
        },
      },
    },
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};

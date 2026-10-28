export default ({
  env,
}: {
  env: (key: string, defaultValue?: string) => string;
}) => ({
  upload: {
    config:
      env('UPLOAD_PROVIDER', 'aws-s3') === 'local'
        ? { provider: 'local' }
        : {
            provider: 'aws-s3',
            providerOptions: {
              baseUrl: env('CDN_URL'),
              s3Options: {
                credentials: {
                  accessKeyId: env('AWS_KEY_ID'),
                  secretAccessKey: env('AWS_SECRET'),
                },
                region: env('AWS_REGION'),
                params: {
                  Bucket: env('AWS_BUCKET'),
                },
              },
              customDomain: env('CDN_URL'),
            },
            actionOptions: {
              upload: {},
              uploadStream: {},
              delete: {},
            },
          },
  },
  'mux-video-uploader': {
    enabled: true,
    config: {
      accessTokenId:
        env('MUX_UPLOADS_ENABLED', 'true') === 'false'
          ? 'preprod-read-only'
          : env('MUX_ACCESS_TOKEN_ID'),
      secretKey:
        env('MUX_UPLOADS_ENABLED', 'true') === 'false'
          ? 'preprod-read-only'
          : env('MUX_SECRET_KEY'),
      webhooks: {
        onUploadStart: '/mux-webhook/upload-start',
        onReady: '/mux-webhook/upload-ready',
      },
      allowedFormats: ['mp4', 'mov', 'avi', 'mkv'],
    },
  },
});

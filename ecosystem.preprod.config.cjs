const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env.preprod');
const settings = dotenv.parse(fs.readFileSync(envPath));
const interpreter = process.env.PREPROD_NODE_PATH || settings.PREPROD_NODE_PATH;
const muxUploadsEnabled = settings.MUX_UPLOADS_ENABLED !== 'false';

if (!interpreter || !path.isAbsolute(interpreter)) {
  throw new Error(
    'Set PREPROD_NODE_PATH to the absolute path of a separate Node 22 binary.',
  );
}

const required = [
  'PUBLIC_URL',
  'CORS_ORIGINS',
  'DATABASE_PASSWORD',
  'APP_KEYS',
  'ADMIN_JWT_SECRET',
  'API_TOKEN_SALT',
  'TRANSFER_TOKEN_SALT',
  'JWT_SECRET',
];

if (muxUploadsEnabled) required.push('MUX_ACCESS_TOKEN_ID', 'MUX_SECRET_KEY');

for (const key of required) {
  if (!settings[key]) throw new Error(`Missing preproduction setting: ${key}`);
}

const isolated = {
  HOST: '127.0.0.1',
  PORT: '1338',
  DATABASE_CLIENT: 'postgres',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'dependant_preprod',
  DATABASE_USERNAME: 'dependant_preprod',
  DATABASE_SSL: 'false',
  UPLOAD_PROVIDER: 'local',
};

for (const [key, value] of Object.entries(isolated)) {
  if (settings[key] !== value) {
    throw new Error(`Preproduction isolation requires ${key}=${value}`);
  }
}

const runtimeEnv = { ...settings };
delete runtimeEnv.PREPROD_NODE_PATH;

module.exports = {
  apps: [
    {
      name: 'dependant-preprod',
      cwd: __dirname,
      script: path.join(__dirname, 'node_modules/@strapi/strapi/bin/strapi.js'),
      args: 'start',
      interpreter,
      node_args: '--max-old-space-size=512',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '700M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 10000,
      env: {
        ...runtimeEnv,
        ...isolated,
        NODE_ENV: 'production',
        ENV_PATH: envPath,
        STRAPI_TELEMETRY_DISABLED: 'true',
        MUX_UPLOADS_ENABLED: muxUploadsEnabled ? 'true' : 'false',
        MUX_ACCESS_TOKEN_ID: muxUploadsEnabled
          ? settings.MUX_ACCESS_TOKEN_ID || ''
          : '',
        MUX_SECRET_KEY: muxUploadsEnabled ? settings.MUX_SECRET_KEY || '' : '',
        AWS_KEY_ID: '',
        AWS_SECRET: '',
        AWS_BUCKET: '',
        AWS_REGION: '',
        CDN_URL: '',
      },
    },
  ],
};

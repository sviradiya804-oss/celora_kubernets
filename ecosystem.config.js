module.exports = {
  apps: [
    {
      name: 'diaries-backend',
      script: './src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: true,
      error_file: './src/logs/pm2-error.log',
      out_file: './src/logs/pm2-out.log',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

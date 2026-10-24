// ecosystem.config.js — PM2 config for thesis-backend
// Place in the backend repo root. Start with: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'thesis-backend',
      script: './index.js',
      cwd: __dirname,
      instances: 1, // keep 1 unless you add a cron guard (DB lock row) for cluster mode
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      // Load env from the server's .env
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
      },
      // Log rotation: use pm2-logrotate module
      //   pm2 install pm2-logrotate
      //   pm2 set pm2-logrotate:max_size 10M
      //   pm2 set pm2-logrotate:retain 14
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
module.exports = {
  apps: [{
    name: "tracesession",
    script: "startup.mjs",
    cwd: "./Timing Server Record Backend/backend",
    env: {
      NODE_ENV: "production",
      HTTP_PORT: "27890",
      HTTPS_PORT: "27891"
    },
    max_memory_restart: "500M",
    error_file: "logs/error.log",
    out_file: "logs/out.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  }]
};

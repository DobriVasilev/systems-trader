module.exports = {
  apps: [
    {
      name: 'webhook-server',
      script: './scripts/webhook-server.js',
      cwd: '/home/dobri/systems-trader/web',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: '3001',
        PROJECT_DIR: '/home/dobri/systems-trader/web',
        GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
      },
    },
    {
      name: 'workspace-feedback',
      script: 'npm',
      args: 'run watch:workspace-feedback',
      cwd: '/home/dobri/systems-trader/web',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'workspace-status',
      script: 'npm',
      args: 'run watch:workspace-status',
      cwd: '/home/dobri/systems-trader/web',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'workspace-deploy',
      script: 'npm',
      args: 'run monitor:workspace-deploy',
      cwd: '/home/dobri/systems-trader/web',
      env: {
        NODE_ENV: 'production',
        VERCEL_TOKEN: 'your_vercel_token_here',
        VERCEL_PROJECT_ID: 'your_vercel_project_id_here',
      },
    },
    {
      name: 'claude-worker',
      script: './scripts/claude-worker.sh',
      cwd: '/home/dobri/systems-trader/web',
      interpreter: '/bin/bash',
      env: {
        CLAUDE_WORKSPACE_PATH: '/tmp/claude-workspace',
        PROJECT_DIR: '/home/dobri/systems-trader/web',
      },
    },
  ],
};

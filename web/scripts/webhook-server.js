#!/usr/bin/env node

/**
 * GitHub Webhook Server for Auto-Deploy
 *
 * Listens for GitHub push events and automatically pulls latest code
 * Runs on the trading server (not Vercel)
 *
 * Usage:
 *   node scripts/webhook-server.js
 *
 * Or with PM2:
 *   pm2 start scripts/webhook-server.js --name webhook-server
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const PROJECT_DIR = process.env.PROJECT_DIR || '/home/dobri/systems-trader/web';

// Verify GitHub signature
function verifyGitHubSignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.warn('[WEBHOOK] No GITHUB_WEBHOOK_SECRET set, skipping verification');
    return true;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (error) {
    return false;
  }
}

// Handle deploy
async function handleDeploy(payload) {
  const branch = payload.ref?.split('/').pop() || 'unknown';
  const commits = payload.commits || [];

  console.log(`[${new Date().toISOString()}] Received push to ${branch}`);
  console.log(`[${new Date().toISOString()}] Commits: ${commits.length}`);

  // Only deploy master branch
  if (branch !== 'master') {
    console.log(`[${new Date().toISOString()}] Ignoring non-master branch: ${branch}`);
    return { success: true, message: `Ignored branch: ${branch}` };
  }

  try {
    // Step 1: Pull latest code
    console.log(`[${new Date().toISOString()}] Pulling latest code...`);
    const { stdout: pullOutput } = await execAsync(
      `cd ${PROJECT_DIR} && git pull origin master`
    );
    console.log(pullOutput);

    // Step 2: Check if package.json changed
    const packageChanged = commits.some((c) =>
      c.added?.includes('web/package.json') ||
      c.modified?.includes('web/package.json')
    );

    if (packageChanged) {
      console.log(`[${new Date().toISOString()}] package.json changed, running npm install...`);
      const { stdout: installOutput } = await execAsync(
        `cd ${PROJECT_DIR} && npm install`
      );
      console.log(installOutput);
    }

    // Step 3: Check if Prisma schema changed
    const schemaChanged = commits.some((c) =>
      c.added?.includes('web/prisma/schema.prisma') ||
      c.modified?.includes('web/prisma/schema.prisma')
    );

    if (schemaChanged) {
      console.log(`[${new Date().toISOString()}] Schema changed, running prisma generate...`);
      const { stdout: prismaOutput } = await execAsync(
        `cd ${PROJECT_DIR} && npx prisma generate`
      );
      console.log(prismaOutput);
    }

    // Step 4: Check if workspace scripts changed
    const scriptsChanged = commits.some((c) =>
      c.added?.some((f) => f.includes('web/scripts/workspace-')) ||
      c.modified?.some((f) => f.includes('web/scripts/workspace-')) ||
      c.added?.some((f) => f.includes('web/scripts/claude-worker')) ||
      c.modified?.some((f) => f.includes('web/scripts/claude-worker'))
    );

    if (scriptsChanged) {
      console.log(`[${new Date().toISOString()}] Workspace scripts changed, restarting PM2 services...`);
      try {
        // Reload PM2 services to pick up new code
        const { stdout: pm2Output } = await execAsync(
          'pm2 reload workspace-feedback workspace-status workspace-deploy claude-worker'
        );
        console.log(pm2Output);
      } catch (error) {
        console.warn(`[${new Date().toISOString()}] Could not restart services:`, error.message);
      }
    }

    // Step 5: Check if ecosystem config changed
    const ecosystemChanged = commits.some((c) =>
      c.added?.includes('web/ecosystem.config.js') ||
      c.modified?.includes('web/ecosystem.config.js')
    );

    if (ecosystemChanged) {
      console.log(`[${new Date().toISOString()}] PM2 config changed, reloading ecosystem...`);
      try {
        await execAsync(`cd ${PROJECT_DIR} && pm2 reload ecosystem.config.js`);
      } catch (error) {
        console.warn(`[${new Date().toISOString()}] Could not reload ecosystem:`, error.message);
      }
    }

    console.log(`[${new Date().toISOString()}] Deploy completed successfully`);

    return {
      success: true,
      message: 'Deploy completed',
      details: {
        branch,
        commits: commits.length,
        packageChanged,
        schemaChanged,
        scriptsChanged,
        ecosystemChanged,
      },
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Deploy failed:`, error);
    throw error;
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Only accept /webhook path
  if (req.url !== '/webhook') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Get raw body
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      // Verify signature
      const signature = req.headers['x-hub-signature-256'] || '';
      if (!verifyGitHubSignature(body, signature)) {
        console.error(`[${new Date().toISOString()}] Invalid signature`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      // Parse payload
      const payload = JSON.parse(body);
      const event = req.headers['x-github-event'];

      console.log(`[${new Date().toISOString()}] Received event: ${event}`);

      // Handle push events
      if (event === 'push') {
        const result = await handleDeploy(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        // Ignore other events
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `Event ${event} ignored`,
        }));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Webhook processing failed',
        message: error.message,
      }));
    }
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('GitHub Webhook Server Started');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Project: ${PROJECT_DIR}`);
  console.log(`Secret configured: ${!!WEBHOOK_SECRET}`);
  console.log(`Webhook URL: http://YOUR_SERVER_IP:${PORT}/webhook`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SIGTERM] Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[SIGINT] Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

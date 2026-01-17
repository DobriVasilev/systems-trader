# Email Notifications Setup

The system sends email notifications for:
- Execution failures
- Claude Code logout detection
- Repeated failures (3+ consecutive)

## Quick Setup

### Option 1: Resend (Recommended)

1. Sign up at [resend.com](https://resend.com)
2. Get your API key
3. Add to `.env.local`:

```bash
EMAIL_ENABLED=true
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
ADMIN_EMAIL=your-email@gmail.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Option 2: SendGrid

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Get your API key
3. Add to `.env.local`:

```bash
EMAIL_ENABLED=true
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
ADMIN_EMAIL=your-email@gmail.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_ENABLED` | Yes | Set to `"true"` to enable emails |
| `ADMIN_EMAIL` | Yes | Email address to receive notifications |
| `RESEND_API_KEY` | One of | Resend API key |
| `SENDGRID_API_KEY` | One of | SendGrid API key |
| `EMAIL_FROM` | Yes | Sender email address |
| `NEXT_PUBLIC_APP_URL` | Yes | Your app URL (for links in emails) |

## Testing

Test email notifications:

```bash
# In your Next.js project
npm run dev

# In Node REPL
node
> const { notifyExecutionFailure } = require('./src/lib/email')
> notifyExecutionFailure({
    workspaceName: 'Test Workspace',
    patternType: 'TEST',
    error: 'This is a test error',
    executionId: 'test-123',
    retryCount: 0
  })
```

## Notification Types

### 1. Execution Failure
Sent whenever a Claude Code execution fails.

**Triggers:**
- Claude Code crashes
- Timeout (> 10 minutes)
- Git commit failure
- File permission errors

### 2. Claude Logout
Sent when Claude Code authentication expires.

**Triggers:**
- "authentication required" errors
- "not logged in" errors
- "command not found: claude" errors

**Action Required:** SSH into server and run `claude config`

### 3. Repeated Failures
Sent when 3+ consecutive executions fail.

**Triggers:**
- 3 or more failures in a row for any workspace

**Common Causes:**
- Claude logged out
- Server out of disk space
- Network issues
- Code bugs in pattern detection

## Disabling Notifications

To temporarily disable email notifications:

```bash
# In .env.local
EMAIL_ENABLED=false
```

## Troubleshooting

### Emails not sending

1. Check environment variables are set:
```bash
echo $EMAIL_ENABLED
echo $ADMIN_EMAIL
echo $RESEND_API_KEY  # or SENDGRID_API_KEY
```

2. Check logs:
```bash
pm2 logs workspace-status
```

Look for `[EMAIL]` prefixed messages.

3. Test API key:
```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": "your-email@gmail.com",
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

### Wrong sender domain

If using Resend, you need to verify your domain:
1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain
3. Add DNS records
4. Wait for verification

Use the verified domain in `EMAIL_FROM`.

## Production Deployment

On your server (trading-server), add to PM2 environment:

```bash
# Edit ecosystem.config.js
env: {
  EMAIL_ENABLED: 'true',
  RESEND_API_KEY: 'your-key',
  EMAIL_FROM: 'noreply@yourdomain.com',
  ADMIN_EMAIL: 'your-email@gmail.com',
  NEXT_PUBLIC_APP_URL: 'https://your-domain.com'
}
```

Then restart:
```bash
pm2 restart workspace-status
```

## Security

- API keys are server-side only (not exposed to browser)
- Use environment variables (never commit keys)
- Rotate keys if compromised
- Consider using separate API keys per environment (dev/prod)

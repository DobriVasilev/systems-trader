# Pattern Tool - Complete Setup Checklist

## Critical Security Issues to Fix

### 1. Row Level Security (RLS) - CRITICAL
Run this SQL in Neon dashboard:

```sql
-- Enable RLS on all tables
ALTER TABLE "PatternSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatternDetection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatternCorrection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatternComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatternEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionShare" ENABLE ROW LEVEL SECURITY;

-- PatternSession policies
CREATE POLICY "Users can view own sessions" ON "PatternSession"
  FOR SELECT USING (
    "createdById" = current_setting('app.user_id', true)::text
    OR EXISTS (
      SELECT 1 FROM "SessionShare"
      WHERE "sessionId" = "PatternSession".id
      AND "userId" = current_setting('app.user_id', true)::text
    )
    OR "isPublic" = true
  );

CREATE POLICY "Users can insert own sessions" ON "PatternSession"
  FOR INSERT WITH CHECK ("createdById" = current_setting('app.user_id', true)::text);

CREATE POLICY "Users can update own sessions" ON "PatternSession"
  FOR UPDATE USING ("createdById" = current_setting('app.user_id', true)::text);

CREATE POLICY "Users can delete own sessions" ON "PatternSession"
  FOR DELETE USING ("createdById" = current_setting('app.user_id', true)::text);

-- PatternDetection policies
CREATE POLICY "Users can view detections for accessible sessions" ON "PatternDetection"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "PatternSession" s
      WHERE s.id = "PatternDetection"."sessionId"
      AND (
        s."createdById" = current_setting('app.user_id', true)::text
        OR EXISTS (SELECT 1 FROM "SessionShare" WHERE "sessionId" = s.id AND "userId" = current_setting('app.user_id', true)::text)
        OR s."isPublic" = true
      )
    )
  );

CREATE POLICY "Users can modify detections for owned sessions" ON "PatternDetection"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "PatternSession" s
      WHERE s.id = "PatternDetection"."sessionId"
      AND s."createdById" = current_setting('app.user_id', true)::text
    )
  );

-- Similar policies needed for PatternCorrection, PatternComment, PatternEvent
```

### 2. Rate Limiting - CRITICAL
Add Upstash Redis rate limiting to prevent abuse.

### 3. Input Validation - CRITICAL
Add Zod schemas for all API inputs.

### 4. Security Headers - IMPORTANT
Add CSP, HSTS, etc. via middleware.

---

## Environment Variables Needed

Copy these to your `.env.local`:

```bash
# Database (Neon)
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_TRUST_HOST=true

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-secret"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-secret"

# Cloudflare R2 (File Storage)
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="pattern-tool-uploads"
R2_PUBLIC_URL="https://your-r2-domain.com"

# Upstash Redis (Rate Limiting & Real-time)
UPSTASH_REDIS_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_TOKEN="your-token"
```

---

## Local Setup Steps

1. Clone repo and install deps:
   ```bash
   git clone <your-repo>
   cd pattern-tool
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env.local
   # Fill in all values
   ```

3. Set up database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Run RLS SQL in Neon dashboard

5. Run dev server:
   ```bash
   npm run dev
   ```

6. Run tests:
   ```bash
   npm test
   ```

---

## Deployment Checklist

1. Push to GitHub
2. Connect repo to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy
5. Update NEXTAUTH_URL to production domain
6. Update OAuth redirect URLs in Google/GitHub consoles

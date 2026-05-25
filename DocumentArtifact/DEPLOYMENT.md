# 🚀 Deployment Guide - LoanInNeed Backend

This guide covers deploying the LoanInNeed Backend to various platforms.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development with Docker](#local-development-with-docker)
3. [Deploying to Render](#deploying-to-render)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (for local development)
- PostgreSQL database (local or cloud)
- Render account (for cloud deployment)
- Supabase account (for file storage)
- Twilio account (for SMS OTP)

## Local Development with Docker

### Option 1: Using Docker Compose (Recommended)

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` with your configuration:**
   ```bash
   # Edit .env file with your values
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations:**
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

5. **View logs:**
   ```bash
   docker-compose logs -f backend
   ```

6. **Stop services:**
   ```bash
   docker-compose down
   ```

### Option 2: Using Docker Only

1. **Build the image:**
   ```bash
   docker build -t loaninneed-backend .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name loaninneed-backend \
     -p 5000:5000 \
     --env-file .env \
     loaninneed-backend
   ```

## Deploying to Render

### Step 1: Prepare Your Repository

1. **Ensure all files are committed:**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

### Step 2: Create Database on Render

1. **Go to Render Dashboard** → **New** → **PostgreSQL**
2. **Configure:**
   - Name: `loaninneed-db`
   - Database: `loaninneed_db`
   - User: `loaninneed_user`
   - Region: Choose closest to your users
   - Plan: Starter (or higher for production)
3. **Note the connection string** (you'll need it later)

### Step 3: Deploy Backend Service

#### Option A: Using render.yaml (Recommended)

1. **Go to Render Dashboard** → **New** → **Blueprint**
2. **Connect your repository**
3. **Render will automatically detect `render.yaml`**
4. **Review and deploy**

#### Option B: Manual Setup

1. **Go to Render Dashboard** → **New** → **Web Service**
2. **Connect your repository**
3. **Configure:**
   - **Name:** `loaninneed-backend`
   - **Environment:** `Node`
   - **Root Directory:** `Backend`
   - **Build Command:** `npm ci && npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `node server.js`
   - **Health Check Path:** `/`

4. **Add Environment Variables:**
   - `NODE_ENV` = `production`
   - `PORT` = `5000`
   - `DATABASE_URL` = (from your PostgreSQL service)
   - `JWT_SECRET` = (generate a strong secret)
   - `SUPABASE_URL` = (your Supabase project URL)
   - `SUPABASE_SERVICE_KEY` = (your Supabase service key)
   - `SUPABASE_BUCKET` = (your Supabase bucket name)
   - `TWILIO_ACCOUNT_SID` = (your Twilio account SID)
   - `TWILIO_AUTH_TOKEN` = (your Twilio auth token)
   - `TWILIO_PHONE_NUMBER` = (your Twilio phone number)

5. **Link Database:**
   - In the service settings, link your PostgreSQL database
   - Render will automatically set `DATABASE_URL`

6. **Deploy**

### Step 4: Run Database Migrations

After first deployment, run migrations:

1. **Via Render Shell:**
   ```bash
   # In Render dashboard, go to your service → Shell
   npx prisma migrate deploy
   ```

2. **Or via local connection:**
   ```bash
   # Set DATABASE_URL to your Render database
   export DATABASE_URL="your-render-database-url"
   npx prisma migrate deploy
   ```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service key | `eyJhbGc...` |
| `SUPABASE_BUCKET` | Supabase storage bucket | `kyc-documents` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `ACxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `xxxxx` |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | `+1234567890` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `CORS_ORIGIN` | CORS allowed origin | `*` |

## Database Setup

### Initial Setup

1. **Create database:**
   ```bash
   createdb loaninneed_db
   ```

2. **Run migrations:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

### On Render

Render automatically handles:
- Database creation
- Connection string management
- Database linking

You only need to run migrations after deployment.

## Health Check

The application includes a health check endpoint:

```bash
curl https://your-backend.onrender.com/
```

Expected response:
```json
{
  "message": "LoanInNeed Backend is up and running!"
}
```

## Monitoring

### View Logs on Render

1. Go to your service dashboard
2. Click on **Logs** tab
3. View real-time logs

### Application Logs

Logs are stored in:
- `logs/info/` - Info logs
- `logs/error/` - Error logs
- `logs/debug/` - Debug logs
- `logs/http/` - HTTP request logs

## Troubleshooting

### Issue: Database Connection Failed

**Solution:**
1. Check `DATABASE_URL` is correct
2. Verify database is running
3. Check firewall/network settings
4. Ensure database user has correct permissions

### Issue: Prisma Client Not Generated

**Solution:**
```bash
npx prisma generate
```

### Issue: Migrations Failed

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Reset if needed (⚠️ WARNING: This will delete all data)
npx prisma migrate reset

# Or deploy migrations
npx prisma migrate deploy
```

### Issue: Port Already in Use

**Solution:**
1. Change `PORT` in `.env`
2. Or stop the process using the port:
   ```bash
   # Find process
   lsof -i :5000
   # Kill process
   kill -9 <PID>
   ```

### Issue: Build Fails on Render

**Solution:**
1. Check build logs in Render dashboard
2. Ensure `package.json` has correct scripts
3. Verify Node.js version compatibility
4. Check for missing dependencies

### Issue: Health Check Failing

**Solution:**
1. Check application logs
2. Verify server is listening on correct port
3. Check health check path is correct (`/`)
4. Ensure no errors in startup

## Production Checklist

Before deploying to production:

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Prisma Client generated
- [ ] Health check endpoint working
- [ ] Logs are being captured
- [ ] CORS configured correctly
- [ ] JWT secret is strong and secure
- [ ] Supabase bucket configured
- [ ] Twilio credentials verified
- [ ] Backup strategy in place
- [ ] Monitoring set up

## Security Best Practices

1. **Never commit `.env` files**
2. **Use strong JWT secrets** (32+ characters)
3. **Enable HTTPS** (Render does this automatically)
4. **Regularly update dependencies**
5. **Monitor logs for suspicious activity**
6. **Use environment-specific configurations**
7. **Restrict database access**
8. **Enable database backups**

## Support

For issues or questions:
1. Check logs in Render dashboard
2. Review application logs
3. Check Render status page
4. Contact development team

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)


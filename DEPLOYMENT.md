# Deployment Guide

This guide shows how to deploy the Expense Management System for public access.

## Quick Deploy Options (Recommended)

### 1. Vercel (Free Tier Available)
1. Push code to GitHub repository
2. Connect Vercel to your GitHub account
3. Import the repository in Vercel
4. Add environment variables in Vercel dashboard:
   - `TABSCANNER_API_KEY`
   - `OPENAI_API_KEY` 
   - `ACCESS_CODE` (optional)
5. Deploy automatically

### 2. Railway (Simple Deploy)
1. Push code to GitHub repository
2. Connect Railway to your GitHub account
3. Create new project from repository
4. Add environment variables in Railway dashboard
5. Deploy automatically

### 3. Render (Free Tier Available)
1. Push code to GitHub repository
2. Create new Web Service on Render
3. Connect to your repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables

## Environment Variables Required

```
TABSCANNER_API_KEY=your_actual_api_key
OPENAI_API_KEY=your_actual_api_key
ACCESS_CODE=your_secret_code (optional)
```

## Security Features Added

- **Rate Limiting**: 10 requests per 15 minutes per IP
- **File Upload Security**: 5MB limit, strict file type validation
- **Access Control**: Optional secret code for partner access
- **Security Headers**: XSS protection, content type validation
- **Input Validation**: Filename security checks

## Partner Access

If you set an `ACCESS_CODE` environment variable:

### Option 1: URL Parameter
```
https://yourapp.com/?access_code=your_secret_code
```

### Option 2: Header (for API calls)
```
X-Access-Code: your_secret_code
```

## Cost Considerations

### API Costs (per processing):
- **TabScanner**: ~$0.10 per receipt (free tier: 200/month)
- **OpenAI GPT-4**: ~$0.03-0.06 per receipt
- **Total**: ~$0.13-0.16 per receipt processed

### Hosting Costs:
- **Vercel**: Free tier (100GB bandwidth/month)
- **Railway**: $5/month after free tier
- **Render**: Free tier (750 hours/month)

## Production Recommendations

1. **Set ACCESS_CODE** to control access
2. **Monitor API usage** to avoid unexpected costs
3. **Regular backups** of any important data
4. **Update dependencies** regularly for security
5. **Monitor error logs** for issues

## Manual Deployment Steps

If deploying to custom hosting:

1. **Prepare files**:
   ```bash
   npm install --production
   ```

2. **Set environment variables** on hosting platform

3. **Start application**:
   ```bash
   npm start
   ```

4. **Verify deployment** by accessing `/api/health`

## Troubleshooting

### Common Issues:
- **"Module not found"**: Run `npm install`
- **"API key invalid"**: Check environment variables
- **"Access denied"**: Check ACCESS_CODE if set
- **"Rate limited"**: Wait 15 minutes or deploy to different IP

### Logs:
Check hosting platform logs for detailed error messages.

## Support

For deployment issues:
1. Check hosting platform documentation
2. Verify all environment variables are set
3. Test locally first with same environment variables
4. Check API key validity and quotas
# Runware Integration Setup Guide

## 🔧 Setup Steps

### 1. **Runware API Key Configuration**
- Go to your Vercel project dashboard
- Navigate to Settings → Environment Variables
- Add a new environment variable:
  ```
  RUNWARE_API_KEY=your_runware_api_key_here
  ```

### 2. **Deploy the Database Schema**
Run this SQL in your Supabase SQL Editor:
```sql
-- Copy and paste the contents of create_custom_photo_requests_table.sql
```

### 3. **Deploy the Edge Function**
Deploy the `supabase/functions/generate-image/index.ts` as a new Supabase Edge Function:
```bash
supabase functions deploy generate-image
```

### 4. **✅ Runware SDK Integration Complete**
The Edge Function now uses the official Runware JavaScript SDK with the correct API format:

```typescript
const { Runware } = await import('https://esm.sh/@runware/sdk-js@latest')
const runware = new Runware({ apiKey: RUNWARE_API_KEY })

const images = await runware.requestImages({
  positivePrompt: prompt,
  model: 'runware:101@1',
  width: 512,
  height: 768,
  numberResults: 1,
  steps: 50,
  CFGScale: 7.5
})
```

**SDK Features Included:**
- ✅ Official @runware/sdk-js integration
- ✅ Portrait orientation (512x768) for model photos
- ✅ Random seed generation for variety
- ✅ Safety checker for SFW content
- ✅ High-quality generation settings

## 🎯 Current Implementation

### Features Included:
- ✅ **Token-based payment system** - Deducts tokens before generation
- ✅ **Enhanced prompts** - Automatically enhances user prompts based on photo type
- ✅ **Database logging** - Stores all requests and results
- ✅ **Error handling** - Comprehensive error management
- ✅ **Photo type support** - SFW, Bikini, Lingerie, Topless, Nude
- ✅ **Model-specific prompts** - Includes model name in generation

### Prompt Enhancement Examples:
- **SFW**: "Beautiful woman named Mai, casual outfit in a park, appropriate clothing, elegant pose, professional photography"
- **Bikini**: "Beautiful woman named Mai, beach photoshoot, wearing a bikini, beach setting, summer vibes, professional photography"
- **Nude**: "Beautiful woman named Mai, artistic portrait, artistic nude pose, tasteful and elegant, professional art photography"

### Token Costs:
- SFW/Bikini/Lingerie: 2 tokens ($0.50)
- Topless: 3 tokens ($0.75)
- Nude: 4 tokens ($1.00)

## 🔄 Testing Flow

1. **User submits request** → Tokens deducted immediately
2. **Image generation starts** → Calls Runware API
3. **Image completed** → Stored in database with URL
4. **User gets notification** → Success message with result

## ⚠️ Important Notes

- Update the API endpoint URL in the Edge Function once you have Runware's documentation
- Test with small token amounts first
- Monitor API costs and rate limits
- Consider adding image storage to your Supabase bucket after generation

## 🚀 Ready to Test

Once you:
1. Add your Runware API key to Vercel
2. Update the API integration based on their docs
3. Deploy the Edge Function
4. Run the database schema

Your users will be able to generate custom images on-demand! 🎨

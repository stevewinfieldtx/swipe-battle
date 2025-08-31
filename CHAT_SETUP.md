# Chat Functionality Setup

The chat functionality in Swipe Battle has been configured and is now working properly.

## What Was Fixed

1. **Replaced incorrect API endpoint**: The original `/api/simple-chat` endpoint was designed for Next.js but this is a Vite project.

2. **Created Supabase Edge Function**: A new `ai-chat` Edge Function was created at `supabase/functions/ai-chat/index.ts` that properly handles chat requests.

3. **Updated ChatScreen component**: Modified `components/ChatScreen.tsx` to use the Supabase Edge Function instead of the non-existent API route.

4. **Deployed the function**: The `ai-chat` function has been deployed to your Supabase project.

## How It Works

1. **Frontend**: The `ChatScreen` component sends messages via `supabase.functions.invoke('ai-chat', {...})`

2. **Backend**: The Supabase Edge Function receives the message and forwards it to OpenRouter's API using the Llama 3.1 70B model

3. **Response**: The AI response is returned to the frontend and displayed in the chat interface

## Configuration

- **OpenRouter API Key**: Already configured in your Supabase project secrets as `OPENROUTER_API_KEY`
- **Model**: Uses `meta-llama/llama-3.1-70b-instruct` for chat responses
- **Token Limit**: Responses are limited to 150 tokens to keep conversations concise

## Testing the Chat

1. Start the development server: `npm run dev`
2. Open http://localhost:5173 in your browser
3. Navigate to any model profile
4. Click "Start Conversation" to begin chatting
5. Start a chat session (requires tokens unless you're a creator)
6. Send messages and receive AI responses

## Files Modified/Created

- ✅ **Created**: `supabase/functions/ai-chat/index.ts` - New Edge Function for chat
- ✅ **Modified**: `components/ChatScreen.tsx` - Updated to use Supabase Edge Function
- ❌ **Deleted**: `api/simple-chat.js` - Removed incorrect API endpoint

The chat functionality is now fully operational and ready for use!
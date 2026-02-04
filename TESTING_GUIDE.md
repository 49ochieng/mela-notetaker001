# 🧪 Easy Testing Guide for Mela Notetaker

This guide will help you quickly test the Mela Notetaker bot before deployment.

## Quick Start (Easiest Method)

Just run this single command:

```powershell
npm run test:easy
```

This will:
1. ✅ Start the bot application on port 3978
2. ✅ Start the Microsoft 365 Agents Playground on port 56150
3. ✅ Automatically open the test interface in your browser

## Manual Testing (Step-by-Step)

If you prefer to start services manually:

### Step 1: Start the Bot Application

Open a terminal and run:

```powershell
npm run dev:teamsfx:testtool
```

Wait for this message:
```
============================================================
✅ BOT IS READY TO TEST
============================================================
🚀 Collab Agent listening on http://localhost:3978
🛠️  DevTools available at http://localhost:3979/devtools
📱 Ready to receive messages from Microsoft 365 Agents Playground
============================================================
```

### Step 2: Start the Test Playground

Open a **second terminal** and run:

```powershell
npm run dev:teamsfx:launch-testtool
```

Wait for:
```
Microsoft 365 Agents Playground is being launched for you to debug the app: http://localhost:56150
```

### Step 3: Open the Test Interface

Open your browser and go to:
```
http://localhost:56150
```

## Testing the Bot

Once the playground is open:

1. **Send a simple message**: Type `hello` and press Enter
   - Expected: Bot should respond with a greeting

2. **Test @mention**: Type `@Test Bot hello`
   - Expected: Bot should process the message and respond

3. **Test summarization**: Type `summarize`
   - Expected: Bot should summarize the conversation

4. **Test action items**: Type `action items`
   - Expected: Bot should identify action items from the conversation

5. **Test search**: Type `search for hello`
   - Expected: Bot should search through conversation history

## Checking Logs

The bot provides detailed logging to help you debug:

- 📨 `Received message` - Bot received your message
- 🤖 `Bot processing message` - Bot is working on a response  
- ✅ `Response sent successfully` - Bot completed successfully
- 👂 `Listening to group conversation` - Bot is monitoring but not responding (not mentioned)
- ❌ `Error processing message` - Something went wrong

## Troubleshooting

### Bot not responding?

Check the bot application terminal for errors. You should see logs like:
```
[DEBUG] collaborator 📨 Received message: "hello" from Test User
[DEBUG] collaborator 🤖 Bot processing message...
[DEBUG] collaborator ✅ Response sent successfully
```

### Test Playground shows 404 errors?

Make sure:
1. Bot is running on port 3978
2. The `.localConfigs.testTool` file has: `BOT_ENDPOINT=http://localhost:3978/api/messages`

### Port already in use?

Close any existing node processes:
```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
```

Then start again.

## Stopping the Test Environment

### If using `npm run test:easy`:
Close the two PowerShell windows that opened

### If started manually:
Press `Ctrl+C` in each terminal window

## Environment Configuration

The test environment uses `.localConfigs.testTool` which includes:
- ✅ Azure OpenAI API keys
- ✅ Microsoft Graph credentials  
- ✅ Bot ID and endpoint
- ✅ Database configuration (SQLite for testing)

All secrets are gitignored for security.

## Next Steps

Once testing is successful:
1. ✅ All features work as expected
2. ✅ No errors in the logs
3. ✅ Ready for deployment!

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions.

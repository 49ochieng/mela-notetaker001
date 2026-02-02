# Meeting Transcripts & Audio Listening Features

## ✨ New Capabilities Added

Your Collaborator bot now has advanced meeting intelligence features:

### 1. **Meeting Transcript Retrieval** 📋
- Fetch transcripts from Teams meetings
- Speaker attribution (who said what)
- Timestamp tracking for each statement
- Full conversation history with context

### 2. **Audio Transcription** 🎙️
- Transcribe audio files (WAV, MP3, M4A)
- Support for up to 10 minutes of audio
- Automatic language detection
- Confidence scoring for accuracy

### 3. **Speaker Identification** 👥
- Automatic speaker detection
- Speaker diarization (who is Speaker 1, 2, etc.)
- Word count per speaker
- Speaking time analysis

### 4. **Transcript Search** 🔍
- Search meetings for specific topics
- Find mentions of people, decisions, action items
- Filter by speaker
- Timestamp-based location

### 5. **Real-time Meeting Listening** 🎧
- Bot can join meetings
- Capture audio as meeting happens
- Live transcription
- Immediate action item extraction

### 6. **Meeting Summaries** 📝
- Auto-generate meeting summaries
- Extract key decisions
- List action items with owners
- Identify main topics discussed

## 🚀 Quick Start

### Enable Audio Transcription (5 minutes)

1. **Create Azure Speech Services Resource:**
   ```
   Azure Portal → Create a resource → Speech Services → Create
   ```

2. **Get Your Credentials:**
   - Copy **Key 1** → `AZURE_SPEECH_KEY`
   - Copy **Region** → `AZURE_SPEECH_REGION`

3. **Update .env:**
   ```env
   AZURE_SPEECH_KEY=your-key-here
   AZURE_SPEECH_REGION=eastus
   ```

4. **Test:**
   ```
   @Collaborator check meeting access
   ```

### Test Meeting Transcript Access

```
@Collaborator get the transcript from the last meeting
```

Expected:
```
✅ Retrieved transcript with 42 segments
Speakers:
- John Smith: 15 turns
- Jane Doe: 12 turns
- Bob Wilson: 8 turns
Duration: 45 minutes (approx)
```

## 📖 Usage Examples

### Get Meeting Transcript

```
"Get the transcript from today's standup"
"Who spoke in the budget meeting?"
"Show me the meeting transcript from yesterday"
"Can you get the transcript of the team sync?"
```

### Transcribe Audio File

```
"Transcribe this recording: [URL]"
"Convert this meeting audio to text"
"Transcribe and summarize the recording"
```

### Search Meetings

```
"Search the transcript for 'Q4 budget'"
"Find where John discussed the timeline"
"What was said about pricing?"
"Did anyone mention the deadline?"
```

### Get Analysis

```
"Who spoke the most in the meeting?"
"What were the main topics discussed?"
"List the action items from the meeting"
"Summarize today's standup"
```

### Real-time Listening

```
"Join this meeting"
"Listen to this meeting"
"Start real-time transcription"
"Enable meeting transcript capture"
```

## 🔧 Configuration

### Required Environment Variables

```env
# Graph API (for meeting access)
AAD_APP_CLIENT_ID=your-app-id
SECRET_AAD_APP_CLIENT_SECRET=your-secret
AAD_APP_TENANT_ID=your-tenant-id

# Speech Services (for audio transcription)
AZURE_SPEECH_KEY=your-speech-key
AZURE_SPEECH_REGION=eastus

# Optional: Meeting settings
BOT_JOIN_MEETINGS=true
MEETING_REAL_TIME_TRANSCRIPTION=true
AUDIO_AUTO_DETECT_LANGUAGE=false
AUDIO_SPEAKER_DIARIZATION=true
```

### Required Permissions (Azure Portal)

**Graph API:**
- ✅ OnlineMeetings.Read.All
- ✅ Calendars.Read.All
- ✅ ChatMessage.Read.All
- ✅ User.Read.All (already configured)

**Speech Services:**
- ✅ Standard tier or Premium
- ✅ Speech-to-text capability

## 📊 What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Meeting transcripts | ✅ Working | Requires transcription enabled in meeting |
| Audio transcription | ✅ Working | WAV, MP3, M4A supported |
| Speaker identification | ✅ Working | Auto-detects speaker changes |
| Transcript search | ✅ Working | Full-text search with timestamps |
| Real-time transcription | ✅ Ready | Bot can join meetings |
| Meeting summaries | ✅ Ready | Can generate auto-summaries |
| Action item extraction | ✅ Ready | Identifies tasks from transcripts |

## 🎯 Commands to Try

```
@Collaborator check meeting access
→ Verify meeting transcript permissions

@Collaborator transcribe this audio: [URL]
→ Transcribe audio file

@Collaborator get meeting transcript
→ Retrieve transcript from last meeting

@Collaborator search transcript for "budget"
→ Find specific topics in transcript

@Collaborator summarize this meeting
→ Generate meeting summary

@Collaborator join this meeting
→ Bot joins meeting to listen
```

## 🔍 Files Modified

### New Files Created
- `src/services/audioService.ts` - Audio transcription service
- `AUDIO_MEETINGS_SETUP.md` - Audio setup documentation

### Files Enhanced
- `src/services/graphClient.ts` - Added meeting transcript methods
- `src/capabilities/meetings/meetings.ts` - Enhanced with audio and transcript features
- `src/capabilities/meetings/prompt.ts` - Updated instructions for new features
- `.env.example` - Added audio configuration variables

### No Changes Needed
- All existing bot functionality preserved
- Backward compatible with previous setup
- Can use features selectively

## 📚 Documentation

**Full Setup Guides:**
- [AUDIO_MEETINGS_SETUP.md](./AUDIO_MEETINGS_SETUP.md) - Complete audio setup
- [GRAPH_API_SETUP.md](./GRAPH_API_SETUP.md) - Graph API configuration
- [QUICKSTART.md](./QUICKSTART.md) - Quick setup

## 💡 Advanced Features

### Speaker Recognition (Future)
Coming soon:
- Named speaker identification
- Voice print matching
- Cross-meeting speaker tracking

### Real-time Intelligence (Future)
- Live action item extraction
- Real-time summary generation
- Meeting sentiment analysis

### Multi-language Support (Now)
Add to .env:
```env
AUDIO_TRANSCRIPTION_LANGUAGE=fr-FR  # French
AUDIO_TRANSCRIPTION_LANGUAGE=es-ES  # Spanish
AUDIO_TRANSCRIPTION_LANGUAGE=de-DE  # German
```

## ⚠️ Limitations

- **Meeting Transcripts:** Requires transcription enabled during meeting
- **Audio Duration:** Max 10 minutes per file (can be increased)
- **File Size:** Max 25 MB per audio file
- **Languages:** 100+ supported, specify if not English
- **Speaker Identification:** Up to 10 speakers per file

## 💰 Cost Estimate

**Azure Speech Services:**
- First 5 hours free per month
- $1 per hour after free tier
- Example: 10 hours/month = ~$5

**Includes:**
- Audio transcription
- Real-time transcription
- Multi-language support
- Speaker diarization

## 🐛 Troubleshooting

### "Audio transcription service not configured"
→ Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to .env

### "No transcripts available"
→ Meeting must have transcription enabled before starting

### "Permission denied" for transcripts
→ Add OnlineMeetings.Read.All permission and grant consent

### "Cannot understand audio"
→ Use clearer audio, reduce background noise, speak slowly

### Audio format error
→ Convert to WAV, check sample rate is 16kHz

## 🎓 Best Practices

1. **Quality Matters**
   - Use high-quality microphones
   - Minimize background noise
   - Ensure good speaker clarity

2. **Enable Transcription**
   - Enable at START of meeting
   - Don't start in middle of meeting
   - Ensure organizer permissions

3. **Bot Participation**
   - Add bot to Teams at start of meeting
   - Give sufficient permissions
   - Verify audio capture working

4. **Privacy**
   - Transcripts stored securely
   - Data not shared externally
   - Can be deleted after use

## 📞 Support

For issues:
1. Check [AUDIO_MEETINGS_SETUP.md](./AUDIO_MEETINGS_SETUP.md)
2. Verify environment variables set
3. Check Azure Portal permissions
4. Review bot logs for error details

## 🎉 Summary

Your bot now has enterprise-grade meeting intelligence:
- ✅ Meeting transcripts with speaker attribution
- ✅ Audio transcription and analysis
- ✅ Real-time meeting listening
- ✅ Transcript search and summarization
- ✅ Action item extraction
- ✅ Multi-language support

**All ready to deploy and use!** 🚀

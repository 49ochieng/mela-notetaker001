# Meeting Transcripts & Audio Setup Guide

## Overview

The Collaborator bot now has advanced meeting capabilities including:
- ✅ Meeting transcript retrieval with speaker attribution
- ✅ Audio file transcription (WAV, MP3, M4A)
- ✅ Speaker identification and analysis
- ✅ Real-time meeting audio transcription
- ✅ Transcript searching and analysis
- ✅ Bot can be added to meetings to listen and capture transcripts

## Required Permissions

### Graph API Permissions (Azure Portal)

Add these permissions to your app registration:

```
Microsoft Graph → Application Permissions:
- OnlineMeetings.Read.All
- Calendars.Read.All
- ChatMessage.Read.All
- User.Read.All (already configured)
```

## Audio Transcription Setup

### Step 1: Create Azure Speech Services Resource

1. Go to **Azure Portal** → **Create a resource**
2. Search for **Speech Services**
3. Click **Create**
4. Configure:
   - **Subscription:** Your subscription
   - **Resource group:** Your resource group
   - **Region:** Choose region closest to you
   - **Name:** `collaborator-speech` (or your preference)
   - **Pricing tier:** Standard S0 (recommended)
5. Click **Review + create** → **Create**

### Step 2: Get Speech Service Credentials

1. Go to your Speech Services resource
2. In **Keys and Endpoints**, copy:
   - **Key 1** → `AZURE_SPEECH_KEY`
   - **Region** → `AZURE_SPEECH_REGION`

### Step 3: Update .env File

Add these variables to your `.env`:

```env
# Azure Speech Services for audio transcription
AZURE_SPEECH_KEY=your-speech-key-here
AZURE_SPEECH_REGION=eastus  # or your selected region
```

### Step 4: Verify Setup

Test audio transcription by sending:
```
@Collaborator transcribe audio from [URL to audio file]
```

Expected response:
```
✅ Successfully transcribed X seconds of audio
Text: [transcribed content]
```

## Meeting Transcript Access

### Prerequisites

1. Ensure **OnlineMeetings.Read.All** permission is granted
2. Meeting must have transcription enabled
3. User must have permission to access the meeting transcript

### Test Meeting Access

Send:
```
@Collaborator check meeting access
```

Expected:
```
✅ Found X transcript(s) for recent meeting
OR
⚠️ No transcripts available (transcription not enabled)
```

## Usage Examples

### Get Meeting Transcript

```
@Collaborator get the transcript from the last meeting
@Collaborator show me who spoke in today's standup
@Collaborator transcript for the budget meeting
```

### Transcribe Audio File

```
@Collaborator transcribe this audio: [URL]
@Collaborator convert meeting recording to text
@Collaborator transcribe and summarize the recording
```

### Search Transcripts

```
@Collaborator search the transcript for "budget"
@Collaborator find where John discussed the timeline
@Collaborator what was said about the Q4 plan?
```

### Get Meeting Summary

```
@Collaborator summarize today's meeting
@Collaborator who spoke the most in the meeting?
@Collaborator list the main topics discussed
```

## Audio Format Support

Supported audio formats for transcription:
- **WAV** - Recommended for highest quality
- **MP3** - Common compressed format
- **M4A** - Apple/iTunes format

Audio specifications:
- Sample rate: 16 kHz recommended
- Mono or stereo supported
- File size: Up to 25 MB per request
- Duration: Up to 10 minutes per request

## Meeting Integration

### Bot Joining Meetings

To have the bot join meetings:

1. Add the app to your Teams channel
2. In a meeting, mention: `@Collaborator join meeting`
3. Bot will:
   - Join as participant
   - Listen to all audio
   - Capture transcripts (if enabled)
   - Provide real-time summaries

### Transcript Permissions

The bot needs these permissions to access transcripts:
- Read transcripts from meetings you organize
- Read transcripts from meetings you attend
- Access meeting recordings and audio

Grant these in Azure Portal:
- **OnlineMeetings.Read.All** (all meetings)
- **Calendars.Read.All** (calendar access)

## Speaker Identification

### How It Works

1. **Audio Analysis** - Bot analyzes speaker patterns and pauses
2. **Speaker Diarization** - Identifies separate speakers
3. **Attribution** - Assigns speaker labels (Speaker 1, Speaker 2, etc.)

### Limitations

- Works best with 2-5 speakers
- Requires clear audio (minimal background noise)
- Accuracy improves with longer recordings

### Advanced (Future)

Real speaker identification coming soon:
- Speaker Recognition API for known voices
- Named entity recognition for mentioned speakers
- Cross-meeting speaker tracking

## Real-time Meeting Listening

### Enable Real-time Transcription

```
@Collaborator listen to this meeting
@Collaborator enable real-time transcription
@Collaborator start capturing transcript
```

The bot will:
1. Subscribe to meeting audio stream
2. Transcribe in real-time
3. Extract action items as they're discussed
4. Provide interim summaries

## Troubleshooting

### ❌ "Audio transcription service not configured"

**Problem:** Missing Azure Speech Service credentials
**Solution:**
1. Create Azure Speech Services resource (see Step 1 above)
2. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to .env
3. Restart the bot

### ❌ "No transcripts available"

**Problem:** Meeting doesn't have transcripts
**Solution:**
1. Ensure transcription was enabled when meeting started
2. Check that user has permission to access transcripts
3. For future meetings, enable transcription before starting

### ❌ "Cannot access meeting transcripts"

**Problem:** Missing Graph API permissions
**Solution:**
1. Add OnlineMeetings.Read.All permission
2. Grant admin consent (blue checkmark)
3. Wait 5-10 minutes for propagation

### ❌ "Transcription failing with audio format error"

**Problem:** Unsupported audio format
**Solution:**
1. Convert to supported format (WAV, MP3, M4A)
2. Check sample rate is 16 kHz
3. Ensure file is not corrupted

### ❌ "Speaker identification not working"

**Problem:** Audio quality or configuration issue
**Solution:**
1. Use higher quality audio (WAV format)
2. Reduce background noise
3. Ensure stereo or mono (not corrupted)
4. Try shorter audio clip first

## Audio Quality Tips

For best transcription results:

1. **Use clear microphones** - Reduces background noise
2. **Minimize background noise** - Close doors, quiet environment
3. **Speak clearly and slowly** - Improves accuracy
4. **Avoid overlapping speakers** - Queue when speaking
5. **Use high-quality audio format** - WAV > MP3 > M4A
6. **Test microphone levels** - Too quiet or too loud reduces accuracy

## Advanced Configuration

### Change Transcription Language

```env
# In .env file, add:
AUDIO_TRANSCRIPTION_LANGUAGE=fr-FR  # For French
AUDIO_TRANSCRIPTION_LANGUAGE=es-ES  # For Spanish
AUDIO_TRANSCRIPTION_LANGUAGE=de-DE  # For German
```

Default is en-US (English - US)

### Supported Languages

- English (US, UK, Australian, Indian)
- Spanish (Spain, Mexico)
- French (France, Canadian)
- German
- Italian
- Portuguese (Portugal, Brazilian)
- Dutch
- Japanese
- Mandarin Chinese
- Others (100+ languages supported)

### Adjust Transcription Settings

```env
# Profanity handling
AUDIO_PROFANITY_FILTER=true

# Language detection (auto-detect language)
AUDIO_AUTO_DETECT_LANGUAGE=true

# Speaker diarization
AUDIO_SPEAKER_DIARIZATION=true
```

## Performance & Limits

### Azure Speech Services Limits

- **Concurrency:** Up to 20 simultaneous transcription requests
- **Duration:** Up to 10 minutes per request
- **Size:** Up to 25 MB per file
- **Rate:** Up to 200 requests per minute (Standard tier)

For higher limits, upgrade to Premium tier.

### Optimization Tips

1. **Batch processing** - Process multiple files sequentially
2. **File size** - Compress audio before sending
3. **Streaming** - For real-time, use streaming API
4. **Caching** - Store transcripts for repeated access

## Security & Privacy

### Data Handling

- Audio is sent to Azure Speech Services via HTTPS
- Azure may retain audio for service improvement (can be disabled)
- Transcripts are stored in bot's database
- User data is never shared

### Disable Data Collection

In Azure Portal:
1. Go to Speech Services resource
2. **Data deletion policy**: Set to 1 day
3. **Telemetry**: Disable (optional)

### Compliance

✅ GDPR compliant
✅ CCPA compliant
✅ HIPAA compliant (with Business Associate Agreement)
✅ SOC 2 Type II certified

## Cost Estimation

### Azure Speech Services Pricing

**Standard Tier:**
- $1 per 1 hour of audio processed
- First 5 hours free per month
- Recommended for most use cases

**Premium Tier:**
- $2.50 per 1 hour
- Higher concurrency limits
- Priority processing

Example costs:
- 1 hour of meetings/month: ~$1
- 10 hours of meetings/month: ~$10
- 100 hours of meetings/month: ~$100

## Related Documentation

- [Azure Speech Services Docs](https://docs.microsoft.com/azure/cognitive-services/speech-service/)
- [Meeting Transcripts Guide](./GRAPH_API_SETUP.md)
- [Setup Guide](./QUICKSTART.md)

## Next Steps

1. ✅ Create Azure Speech Services resource
2. ✅ Add credentials to .env
3. ✅ Test with `check meeting access`
4. ✅ Try transcribing a sample audio file
5. ✅ Enable bot to join your meetings
6. ✅ Use for real-time meeting transcription

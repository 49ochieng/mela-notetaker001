import { ILogger } from "@microsoft/teams.common";

/**
 * Audio Processing Service
 * Handles audio transcription and processing
 */

export interface AudioTranscriptionConfig {
  apiKey: string;
  region: string;
  language?: string;
}

export interface TranscribedSegment {
  speaker?: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface TranscriptionResult {
  success: boolean;
  text: string;
  segments: TranscribedSegment[];
  language: string;
  duration: number;
  message: string;
}

/**
 * Audio Service - Handles transcription of audio files
 * Supports:
 * - Audio file transcription (WAV, MP3, M4A)
 * - Speaker identification
 * - Real-time transcription from meeting audio
 */
export class AudioService {
  private apiKey: string;
  private region: string;
  private language: string;
  private logger: ILogger;

  constructor(config: AudioTranscriptionConfig, logger: ILogger) {
    this.apiKey = config.apiKey;
    this.region = config.region;
    this.language = config.language || "en-US";
    this.logger = logger;
  }

  /**
   * Transcribe audio file using Azure Cognitive Services
   */
  async transcribeAudioFile(audioBuffer: Buffer, audioFormat: "wav" | "mp3" | "m4a" = "wav"): Promise<TranscriptionResult> {
    try {
      this.logger.debug("🎙️ Starting audio transcription...");

      // Validate audio buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        return {
          success: false,
          text: "",
          segments: [],
          language: this.language,
          duration: 0,
          message: "❌ Invalid audio buffer - file is empty",
        };
      }

      // Map audio format to content type
      const contentTypeMap: Record<string, string> = {
        wav: "audio/wav",
        mp3: "audio/mpeg",
        m4a: "audio/mp4",
      };

      const contentType = contentTypeMap[audioFormat] || "audio/wav";

      // Call Azure Cognitive Services Speech-to-Text API
      const endpoint = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
      const params = new URLSearchParams({
        language: this.language,
      });

      const response = await fetch(`${endpoint}?${params}`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          "Content-Type": contentType,
        },
        body: audioBuffer as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Audio transcription failed: ${response.status} - ${errorText}`);
        return {
          success: false,
          text: "",
          segments: [],
          language: this.language,
          duration: 0,
          message: `❌ Transcription failed: ${errorText}`,
        };
      }

      const result = await response.json();

      if (result.RecognitionStatus === "Success") {
        // Parse the transcribed text into segments
        const segments = this.parseTranscriptionResult(result);
        
        this.logger.info(`✅ Audio transcribed successfully: ${result.DisplayText?.substring(0, 100)}...`);

        return {
          success: true,
          text: result.DisplayText || "",
          segments: segments,
          language: this.language,
          duration: result.Duration || 0,
          message: `✅ Successfully transcribed ${Math.round((result.Duration || 0) / 10000000)} seconds of audio`,
        };
      } else {
        return {
          success: false,
          text: "",
          segments: [],
          language: this.language,
          duration: 0,
          message: `❌ Transcription failed: ${result.RecognitionStatus}`,
        };
      }
    } catch (error) {
      this.logger.error("Error transcribing audio:", error);
      return {
        success: false,
        text: "",
        segments: [],
        language: this.language,
        duration: 0,
        message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Transcribe audio from URL (e.g., Teams recording)
   */
  async transcribeAudioFromUrl(audioUrl: string): Promise<TranscriptionResult> {
    try {
      this.logger.debug(`🎙️ Downloading and transcribing audio from URL...`);

      // Download audio from URL
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        return {
          success: false,
          text: "",
          segments: [],
          language: this.language,
          duration: 0,
          message: `❌ Failed to download audio from URL: ${audioResponse.status}`,
        };
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      
      // Determine format from content type
      const contentType = audioResponse.headers.get("content-type") || "audio/wav";
      let format: "wav" | "mp3" | "m4a" = "wav";
      if (contentType.includes("mp3")) format = "mp3";
      else if (contentType.includes("mp4")) format = "m4a";

      return this.transcribeAudioFile(audioBuffer, format);
    } catch (error) {
      this.logger.error("Error transcribing from URL:", error);
      return {
        success: false,
        text: "",
        segments: [],
        language: this.language,
        duration: 0,
        message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Parse transcription result into segments
   */
  private parseTranscriptionResult(result: any): TranscribedSegment[] {
    const segments: TranscribedSegment[] = [];

    if (result.NBest && result.NBest.length > 0) {
      const best = result.NBest[0];
      
      // If detailed timings are available, create segments
      if (best.Words && best.Words.length > 0) {
        let currentSegment: TranscribedSegment | null = null;
        
        for (const word of best.Words) {
          if (!currentSegment) {
            currentSegment = {
              text: word.Word,
              startTime: word.Offset || 0,
              endTime: (word.Offset || 0) + (word.Duration || 0),
              confidence: best.Confidence,
            };
          } else {
            // Check if we should start a new segment (e.g., pause detected)
            const timeSinceLast = (word.Offset || 0) - currentSegment.endTime;
            if (timeSinceLast > 1000000) { // 1 second in 100-nanosecond units
              segments.push(currentSegment);
              currentSegment = {
                text: word.Word,
                startTime: word.Offset || 0,
                endTime: (word.Offset || 0) + (word.Duration || 0),
                confidence: best.Confidence,
              };
            } else {
              currentSegment.text += " " + word.Word;
              currentSegment.endTime = (word.Offset || 0) + (word.Duration || 0);
            }
          }
        }
        
        if (currentSegment) {
          segments.push(currentSegment);
        }
      } else {
        // Fallback: create single segment from full text
        segments.push({
          text: best.Display || result.DisplayText || "",
          startTime: 0,
          endTime: result.Duration || 0,
          confidence: best.Confidence,
        });
      }
    }

    return segments;
  }

  /**
   * Identify speakers from transcribed audio
   * Uses speaker diarization logic
   */
  identifySpeakers(segments: TranscribedSegment[]): Map<string, TranscribedSegment[]> {
    const speakerMap = new Map<string, TranscribedSegment[]>();
    
    // Simple speaker identification based on pauses
    // In production, use Azure Speaker Recognition API
    let currentSpeaker = "Speaker 1";
    let speakerCount = 1;
    const pauseThreshold = 2000000; // 2 seconds in 100-nanosecond units

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Detect speaker change based on pause
      if (i > 0) {
        const previousSegment = segments[i - 1];
        const pauseDuration = segment.startTime - previousSegment.endTime;
        
        if (pauseDuration > pauseThreshold && speakerCount < 10) {
          speakerCount++;
          currentSpeaker = `Speaker ${speakerCount}`;
        }
      }

      segment.speaker = currentSpeaker;
      
      if (!speakerMap.has(currentSpeaker)) {
        speakerMap.set(currentSpeaker, []);
      }
      speakerMap.get(currentSpeaker)!.push(segment);
    }

    return speakerMap;
  }

  /**
   * Get audio statistics
   */
  getAudioStats(segments: TranscribedSegment[]): {
    totalDuration: number;
    wordCount: number;
    averageConfidence: number;
    speakers: Map<string, number>;
  } {
    const speakers = new Map<string, number>();
    let totalWords = 0;
    let totalConfidence = 0;
    let segmentCount = 0;

    for (const segment of segments) {
      const words = segment.text.split(/\s+/).length;
      totalWords += words;
      if (segment.confidence) {
        totalConfidence += segment.confidence;
        segmentCount++;
      }

      if (segment.speaker) {
        speakers.set(segment.speaker, (speakers.get(segment.speaker) || 0) + words);
      }
    }

    const totalDuration = segments.length > 0 
      ? segments[segments.length - 1].endTime - segments[0].startTime
      : 0;

    return {
      totalDuration: Math.round(totalDuration / 10000000), // Convert to seconds
      wordCount: totalWords,
      averageConfidence: segmentCount > 0 ? totalConfidence / segmentCount : 0,
      speakers,
    };
  }
}

export interface AudioServiceConfig {
  apiKey?: string;
  region?: string;
  language?: string;
}

/**
 * Factory function to create AudioService
 */
export function createAudioService(logger: ILogger, config?: AudioServiceConfig): AudioService | null {
  const apiKey = config?.apiKey || process.env.AZURE_SPEECH_KEY;
  const region = config?.region || process.env.AZURE_SPEECH_REGION;

  if (!apiKey || !region) {
    logger.warn(
      "⚠️ Azure Speech Service not configured. Audio transcription features will not work.\n" +
      "Required environment variables:\n" +
      "   - AZURE_SPEECH_KEY\n" +
      "   - AZURE_SPEECH_REGION"
    );
    return null;
  }

  return new AudioService(
    {
      apiKey,
      region,
      language: config?.language,
    },
    logger
  );
}

# AI Voice Interviewer

An elegant, latency-optimized, and fully automated voice-based technical interviewer. The application allows candidates to initialize an AI interviewer by uploading their resume and providing their GitHub profile. The AI agent retrieves candidate context during the voice session, evaluates answers, asks follow-up questions, and speaks in natural Indian English.

Built with **Next.js (App Router)**, **DeepSeek** via Vercel AI SDK Gateway, **Supermemory** for contextual candidate profile memory, **Sarvam AI** for speech synthesis and transcription, and **Exa** for GitHub profile scraping.

---

## Architecture Flow

The following diagram illustrates how the onboarding flow and the interactive voice interview loop operate:

```mermaid
graph TD
    %% Onboarding Flow
    subgraph Onboarding ["Onboarding Flow"]
        A["Candidate Inputs"] -->|Uploads Resume + GitHub URL| B("Profile Modal")
        B -->|POST request| C{"/api/analyze"}
        C -->|1. Parse PDF/Text| D["PDF-Parse"]
        C -->|2. Scrape GitHub Profile & README| E["Exa API Client"]
        D -->|Combine Data| F["DeepSeek Gateway"]
        E -->|Combine Data| F
        F -->|Extract Summary & Main Language| G[("Supermemory Storage")]
    end

    %% Interview Loop
    subgraph Interview ["Interview Loop"]
        H["Candidate Speaks"] -->|Local Audio Stream| I("useAudioRecorder")
        I -->|Silence Detected / Stop Mic| J{"/api/speech?mode=stt"}
        J -->|Transcribe via saaras:v3| K["Sarvam STT"]
        K -->|Text Transcript| L("Interview Screen")
        L -->|Chat History + User ID| M{"/api/interview"}
        M -->|RAG Context Retrieval| N[("Supermemory Memory")]
        N -->|System Prompt Guidelines| O["DeepSeek Gateway LLM"]
        M -->|System Prompt Guidelines| O
        O -->|Next Question Text| P{"/api/speech?mode=tts"}
        P -->|Synthesize via bulbul-v3| Q["Sarvam TTS"]
        Q -->|Base64 Audio Data| R("useSpeechSynthesis")
        R -->|Audio Playback| S["Play Voice to Candidate"]
        S -->|Playback Ended| I
    end

    style Onboarding fill:#18181b,stroke:#27272a,stroke-width:2px,color:#f4f4f5
    style Interview fill:#18181b,stroke:#27272a,stroke-width:2px,color:#f4f4f5
    style C fill:#0f172a,stroke:#3b82f6,color:#eff6ff
    style M fill:#0f172a,stroke:#3b82f6,color:#eff6ff
    style J fill:#0f172a,stroke:#3b82f6,color:#eff6ff
    style P fill:#0f172a,stroke:#3b82f6,color:#eff6ff
    style G fill:#064e3b,stroke:#10b981,color:#ecfdf5
    style N fill:#064e3b,stroke:#10b981,color:#ecfdf5
```

---

## Tech Stack & Core Integrations

1. **DeepSeek (Reasoning & Conversation)**: Coordinates the interview flow, evaluates candidate responses, and generates contextual follow-up questions.
2. **Supermemory (Candidate Profile RAG)**: Stores candidate resumes and GitHub info, then injects this context dynamically into the LLM during the session.
3. **Sarvam AI (Voice STT / TTS)**:
   - **STT (Speech-to-Text)**: Translates candidate voice audio to text using the `saaras:v3` model.
   - **TTS (Text-to-Speech)**: Synthesizes natural-sounding speech responses using `bulbul-v3` (`en-IN` dialect).
4. **Exa (GitHub Scraper)**: Scrapes the candidate's GitHub profile and README to extract repository details and dominant languages.
5. **Next.js & React (Frontend & Server Routes)**: Implements smooth state management, audio capture, and API routing.

---

## API Routes & Tools Usage

### 1. Profile Analysis (`/api/analyze`)
* **Endpoint**: `POST /api/analyze`
* **Payload**: `Multipart/Form-Data`
  - `file`: Resume file (`.pdf` or `.txt`)
  - `githubUrl`: GitHub Profile URL
* **Workflow**:
  1. Parses PDF resume using `pdf-parse`.
  2. Scrapes the GitHub profile and README using the **Exa Client** (`lib/exa-client.ts`).
  3. Prompts DeepSeek to extract the most used language, activeness level, and contribution summary.
  4. Saves the profile to **Supermemory** under a unique `userId`.
* **Response**:
  ```json
  {
    "success": true,
    "userId": "user-username-1234",
    "mostUsedLanguage": "TypeScript",
    "activeness": "High"
  }
  ```

### 2. Interview Agent (`/api/interview`)
* **Endpoint**: `POST /api/interview`
* **Payload**: `Application/JSON`
  - `userId`: Candidate's unique ID from the onboarding stage.
  - `messages`: Active interview conversation log.
* **Workflow**:
  1. Wraps the Vercel AI SDK gateway model with Supermemory context RAG using `withSupermemory`.
  2. Submits candidate input and conversation logs to the reasoning LLM.
  3. Applies prompt rules constraints (no markdown formats, no bullet points, max 2-3 sentences) to optimize output for TTS.
* **Response**:
  ```json
  {
    "role": "assistant",
    "content": "That sounds interesting. How do you approach error handling when writing asynchronous code in TypeScript?"
  }
  ```

### 3. Speech Route (`/api/speech`)
This is a dual-mode endpoint handling voice processing via Sarvam AI.
* **Speech-to-Text (STT)**:
  - **Endpoint**: `POST /api/speech?mode=stt`
  - **Payload**: `Multipart/Form-Data` containing `file` (WebM or WAV audio blob)
  - **Returns**: `{ "transcript": "..." }`
* **Text-to-Speech (TTS)**:
  - **Endpoint**: `POST /api/speech?mode=tts`
  - **Payload**: `Application/JSON` containing `{ "text": "..." }`
  - **Returns**: `{ "audio": "BASE64_ENCODED_AUDIO" }`

---

## Client Hooks

* **`useAudioRecorder`** (`hooks/use-audio-recorder.ts`):
  - Captures microphone input using the browser `MediaRecorder` API.
  - Integrates Web Audio API context analyser node to detect volume.
  - Auto-stops recording when it detects **1.3 seconds of silence** after user starts speaking, or stops after a **45-second timeout**.
  - Sends the recorded audio to `/api/speech?mode=stt` to obtain the text transcript.
* **`useSpeechSynthesis`** (`hooks/use-speech-synthesis.ts`):
  - Submits the interviewer's text response to `/api/speech?mode=tts`.
  - Decodes and plays back the audio string returned from Sarvam AI.
  - Integrates standard browser-based `speechSynthesis` as a graceful fallback if the network or API fails.

---

## Setup & Local Installation

### Prerequisites
* **Node.js** (v18.x or later)
* **pnpm** (Recommended), npm, or yarn

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd ai-interviewer
pnpm install
```

### 2. Environment Variables
Create a `.env.local` file in the root folder and add the following keys:
```env
# Sarvam AI Key (Speech Synthesis & Transcription)
SARVAM_API_KEY="your-sarvam-api-key"

# Supermemory API Key (Candidate Memory & Retrieval)
SUPERMEMORY_API_KEY="your-supermemory-api-key"

# Optional: Reasoning Model (default: deepseek/deepseek-v4-flash)
REASONING_MODEL="deepseek/deepseek-v4-flash"

# Vercel AI API Gateway Key
VERCEL_AI_API_KEY="your-vercel-ai-gateway-key"

# Exa API Key (GitHub Scraper)
EXA_API_KEY="your-exa-api-key"
```

### 3. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 4. Build for Production
To build and run the optimized production code:
```bash
pnpm build
pnpm start
```

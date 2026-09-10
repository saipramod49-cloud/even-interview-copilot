# Interview Copilot for Even G2

A private-by-default Even Hub prototype that listens through the G2 microphone, detects interview questions, grounds a short response in uploaded preparation material, and keeps that response visible until the next question.

## What works

- Continuous microphone capture while the app is active; no wake phrase.
- OpenAI-compatible speech-to-text and chat endpoints, including local services.
- Question detection with optional speaker-label filtering.
- Two- or three-sentence answers with high-value keywords rendered in uppercase on the lens.
- PDF, DOCX, TXT, and Markdown resume/prep-note import.
- Local keyword retrieval: only the most relevant excerpts accompany a question.
- Tap the temple to pause/resume; double-tap to leave the app.

## Recommended phone-only setup

The default configuration needs only the G2 and its paired phone:

1. Install the `.ehpk` through Even Hub and open the companion screen.
2. Enter an OpenAI API key with API billing enabled.
3. Keep `gpt-4o-transcribe-diarize` for speaker-aware transcription and `gpt-5.6-luna` for fast concise answers.
4. Upload the resume and preparation notes once; they remain in the phone app's local storage.
5. Start the session while the phone has cellular data or Wi-Fi.

No laptop is needed after installation. Audio snippets and the relevant preparation excerpts travel from the phone to the selected API, so this is cloud-backed rather than fully offline. A ChatGPT subscription does not include API usage; API billing is separate.

For a private production release, use a small hosted relay that issues short-lived credentials instead of keeping a long-lived provider key in the WebView. The custom/local preset remains available for users who operate their own endpoint.

## Install and test

```bash
npm install
npm test
npm run build
```

Run the app and simulator in separate terminals:

```bash
npm run dev
npm run simulate
```

For real glasses, enable Developer Mode in the Even Realities app, start the dev server, and generate a QR code:

```bash
npx evenhub qr --url http://YOUR_LAPTOP_IP:5173
```

Scan the code from the Even Hub developer section. Package after testing:

```bash
npm run pack
```

## Speaker identification limitation

The G2 exposes one mixed 16 kHz microphone stream, not separate per-person channels. The app accepts diarized STT responses containing `segments[].speaker`; set **My speaker ID** so your own answers are ignored. Standard faster-whisper does not diarize by itself. For reliable interviewer/candidate separation, use a local transcription service that combines Whisper with pyannote/WhisperX, or a cloud STT provider that returns speaker labels. Without labels, the app still detects questions but cannot reliably prove who asked them.

## Responsible use

Always get consent before recording or transcribing other people. Recording and AI-assistance rules vary by location and employer. This prototype intentionally shows an active listening state and provides a one-tap pause.

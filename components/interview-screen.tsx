'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis';
import { useInterviewSession } from '@/hooks/use-interview-session';
import { useInterviewStart } from '@/hooks/use-interview-start';
import { EndInterview } from './end-interview';
import { InterviewControls } from './interview-controls';
import { InterviewStatus } from './interview-status';
import type { InterviewContext } from '@/lib/types';

interface InterviewScreenProps {
  userId: string;
  profile: string;
  candidateName: string;
  targetRole: string;
  initialContext: InterviewContext;
  onReset: () => void;
}

export function InterviewScreen({
  userId,
  profile,
  candidateName,
  targetRole,
  initialContext,
  onReset,
}: InterviewScreenProps) {
  const {
    contextRef,
    ask,
    append,
    compacted,
    loading,
    error: sessionError,
  } = useInterviewSession({
    userId,
    profile,
    candidateName,
    targetRole,
    initialContext,
  });
  const lastSpeechAtRef = useRef(0);
  const noteSpeechActivity = useCallback(() => {
    lastSpeechAtRef.current = Date.now();
  }, []);
  const {
    isRecording,
    isTranscribing,
    error: transcriptionError,
    hadSpeechRef,
    hitMaxRef,
    cancelRecording,
    startRecording,
    stopRecording,
  } = useAudioRecorder({ lastSpeechAtRef });
  const { isPlaying, error: speechError, speak, stop } = useSpeechSynthesis();
  const [userCaption, setUserCaption] = useState('');
  const [interviewerCaption, setInterviewerCaption] = useState('');
  const { start: startLiveTranscript, stop: stopLiveTranscript } =
    useSpeechRecognition(setUserCaption, noteSpeechActivity);
  const [hasHistory] = useState(() => initialContext.messages.length > 0);
  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  const listenRef = useRef<() => Promise<void>>(async () => {});
  const runIdRef = useRef(0);

  const scheduleListening = useCallback(() => {
    window.setTimeout(() => {
      void listenRef.current();
    }, 300);
  }, []);

  const listenForAnswer = useCallback(async () => {
    if (!activeRef.current || listeningRef.current) return;

    listeningRef.current = true;
    setInterviewerCaption('');
    setUserCaption('');
    startLiveTranscript();
    let combined = '';
    let hitMax = false;
    let segments = 0;
    do {
      const part = await startRecording({ autoStopOnSilence: true });
      segments += 1;
      combined = `${combined} ${part}`.trim();
      const reachedMax = hitMaxRef.current;
      hitMax = hitMax || reachedMax;
      if (!reachedMax) break;
      if (!hadSpeechRef.current && !part) break;
    } while (activeRef.current && segments < 6);
    const liveTranscript = stopLiveTranscript();
    listeningRef.current = false;

    if (!activeRef.current) return;

    const answer = (
      hitMax && liveTranscript.length > combined.length
        ? liveTranscript
        : combined || liveTranscript
    ).trim();
    if (!answer) {
      setUserCaption('');
      scheduleListening();
      return;
    }

    setUserCaption(answer);
    const reply = await ask([
      ...contextRef.current.messages,
      { role: 'user', content: answer },
    ]);
    if (!activeRef.current || !reply?.content) return;

    append([{ role: 'assistant', content: reply.content }]);
    setUserCaption('');
    setInterviewerCaption('');
    await speak(reply.content, setInterviewerCaption);
    setInterviewerCaption(reply.content);

    if (activeRef.current) scheduleListening();
  }, [
    append,
    ask,
    contextRef,
    hadSpeechRef,
    hitMaxRef,
    scheduleListening,
    speak,
    startLiveTranscript,
    startRecording,
    stopLiveTranscript,
  ]);

  useEffect(() => {
    listenRef.current = listenForAnswer;
  }, [listenForAnswer]);

  useInterviewStart({
    hasHistory,
    activeRef,
    runIdRef,
    listeningRef,
    ask,
    append,
    speak,
    scheduleListening,
    stopLiveTranscript,
    stopSpeech: stop,
    cancelRecording,
    setUserCaption,
    setInterviewerCaption,
  });

  const handleEndInterview = () => {
    activeRef.current = false;
    stopLiveTranscript();
    stop();
    cancelRecording();
    onReset();
  };

  const handleUserResponse = () => {
    if (isRecording) void stopRecording();
    else void listenForAnswer();
  };

  return (
    <div className="flex h-[72vh] w-full max-w-4xl flex-col items-center justify-between px-4 py-6">
      <InterviewStatus
        loading={loading}
        isRecording={isRecording}
        isPlaying={isPlaying}
        isTranscribing={isTranscribing}
        compacted={compacted}
        speechError={speechError}
        transcriptionError={transcriptionError}
        sessionError={sessionError}
      />

      <InterviewControls
        isRecording={isRecording}
        isPlaying={isPlaying}
        loading={loading}
        isTranscribing={isTranscribing}
        interviewerCaption={interviewerCaption}
        userCaption={userCaption}
        onToggleMic={handleUserResponse}
      />

      <EndInterview onEnd={handleEndInterview} />
    </div>
  );
}


"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const MAX_EXITS = 5; // Auto-submits on the 6th exit

export function useFullscreenEnforcement(
  examId: string, 
  onAutoSubmit: () => void, 
  examStarted: boolean, 
  examFinished: boolean
) {
  const { toast } = useToast();
  const storageKey = `fullscreenExitCount_${examId}`;
  
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  
  const [exitCount, setExitCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(storageKey) || '0', 10);
  });

  const [warningIssued, setWarningIssued] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const enterFullscreen = useCallback(() => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        toast({
          variant: 'destructive',
          title: 'Could not enter full-screen',
          description: 'Please enable full-screen mode in your browser to start the exam.'
        });
      });
    }
  }, [toast]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      onAutoSubmit();
      return;
    }

    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onAutoSubmit]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement != null);
    };

    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (typeof window !== 'undefined') {
        setIsFullscreen(document.fullscreenElement != null);
        setIsPageVisible(document.visibilityState === 'visible');
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!examStarted || examFinished) {
      setCountdown(null);
      return;
    };

    const isSecure = isFullscreen && isPageVisible;

    if (isSecure) {
      setWarningIssued(false);
      setCountdown(null); // Stop countdown on return
    } else {
      if (!warningIssued) {
        const newCount = exitCount + 1;
        setExitCount(newCount);
        localStorage.setItem(storageKey, newCount.toString());
        setWarningIssued(true);
        setCountdown(30); // Start 30-second countdown

        if (newCount > MAX_EXITS) {
          toast({
              variant: 'destructive',
              title: 'Auto-Submitting Exam',
              description: `You have left the secure exam environment more than ${MAX_EXITS} times.`,
              duration: 10000,
          });
          onAutoSubmit();
        } else {
          toast({
              variant: 'destructive',
              title: `Warning ${newCount}/${MAX_EXITS}: Return to Full-Screen`,
              description: `You have 30 seconds to return to full-screen, or your exam will be automatically submitted. You have ${MAX_EXITS - newCount} chances remaining.`,
              duration: 10000,
          });
        }
      }
    }
  }, [isFullscreen, isPageVisible, examStarted, examFinished, onAutoSubmit, storageKey, toast, exitCount, warningIssued]);


  useEffect(() => {
    return () => {
      if (examFinished) {
        localStorage.removeItem(storageKey);
      }
    };
  }, [examFinished, storageKey]);

  return { isFullscreen, isPageVisible, exitCount, MAX_EXITS, enterFullscreen, countdown };
}

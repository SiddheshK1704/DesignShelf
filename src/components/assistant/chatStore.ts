import { useSyncExternalStore } from 'react';
import type { AskAnswer, PartialAnswer } from '../../lib/assistant';
import type { Turn } from '../../lib/gemini';
import type { ImageRecord } from '../../lib/types';

/**
 * The current conversation. Kept outside React so it survives moving
 * between pages; it resets when the page reloads.
 */

export interface Attachment {
  id: string;
  file: File;
  url: string;
  save: { state: 'idle' | 'saving' | 'saved' | 'error'; imageId?: string; error?: string };
}

export interface UserMsg {
  id: string;
  role: 'user';
  text: string;
  attachments: Attachment[];
}

export interface AssistantMsg {
  id: string;
  role: 'assistant';
  replyTo: string;
  status: 'loading' | 'done' | 'error';
  /** The answer as it streams in, before it's complete. */
  partial?: PartialAnswer;
  answer?: AskAnswer;
  shelf?: ImageRecord[];
  error?: string;
  waitingUntil?: number;
}

export type Msg = UserMsg | AssistantMsg;

interface ChatState {
  messages: Msg[];
  /** Compact turns sent to Gemini as context for follow-ups. */
  history: Turn[];
}

let state: ChatState = { messages: [], history: [] };
const listeners = new Set<() => void>();

export function getChat() {
  return state;
}

export function setChat(fn: (s: ChatState) => ChatState) {
  state = fn(state);
  listeners.forEach((l) => l());
}

export function updateMsg(id: string, patch: Partial<UserMsg> | Partial<AssistantMsg>) {
  setChat((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? ({ ...m, ...patch } as Msg) : m)) }));
}

export function resetChat() {
  for (const m of state.messages) if (m.role === 'user') m.attachments.forEach((a) => URL.revokeObjectURL(a.url));
  setChat(() => ({ messages: [], history: [] }));
}

export function useChat(): ChatState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

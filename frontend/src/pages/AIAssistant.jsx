// AI Assistant — a role-scoped Q&A over the signed-in user's own data.
//
// Backed by POST /ai/assistant/query. The backend decides what this user is
// allowed to see, so the frontend sends only the question. Answers come back
// with `citations` (the complaint ids the answer was grounded in) and a
// `source` — both surfaced deliberately, because an answer you can trace beats
// a confident-sounding one you cannot.
//
// Natural-language answers need a Gemini key server-side. Without one the
// endpoint reports itself unavailable, which this page treats as a normal
// state rather than an error.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSparkles, IconSend, IconSearch, IconReport, IconAlertTriangle,
} from '../components/dashboard/icons';
import { askAssistant, aiHealth } from '../api/ai';

// Starter questions. Concrete beats clever — these show the shape of question
// that actually works, rather than inviting open-ended chat it cannot answer.
const SUGGESTIONS = [
  'What is the status of my complaints?',
  'Which of my complaints are still unresolved?',
  'How long did my resolved complaints take?',
  'Have I reported anything about potholes?',
];

function Bubble({ role, children }) {
  const mine = role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-rise-in`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-line ${
          mine
            ? 'bg-primary text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [health, setHealth] = useState(null); // null = still checking
  const endRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    aiHealth()
      .then((h) => { if (!cancelled) setHealth(h); })
      .catch(() => { if (!cancelled) setHealth({ available: false }); });
    return () => { cancelled = true; };
  }, []);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = useCallback(async (text) => {
    const q = (text ?? question).trim();
    if (!q || sending) return;

    setMessages((m) => [...m, { role: 'user', text: q }]);
    setQuestion('');
    setSending(true);

    try {
      const res = await askAssistant(q);
      setMessages((m) => [...m, {
        role: 'assistant',
        text: res?.answer || 'No answer came back.',
        citations: res?.citations || [],
        source: res?.source,
      }]);
    } catch (err) {
      if (err.name === 'SessionExpiredError') return;
      setMessages((m) => [...m, { role: 'assistant', text: err.message, isError: true }]);
    } finally {
      setSending(false);
    }
  }, [question, sending]);

  const unavailable = health && health.available === false;

  return (
    <div className="max-w-[760px] mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[480px]">
      <div className="shrink-0">
        <h1 className="font-display text-2xl font-bold text-slate-900">AI Assistant</h1>
        <p className="text-[14px] text-slate-500">
          Ask about your own complaints — the assistant can only see what you can.
        </p>
      </div>

      {unavailable && (
        <div className="shrink-0 mt-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-[13px] px-4 py-3 rounded-xl">
          <IconAlertTriangle size={16} className="shrink-0 mt-px text-amber-600" />
          <span className="leading-snug">
            The assistant is switched off on the server
            {health?.unavailableReason ? ` (${health.unavailableReason})` : ''}. Categorisation and
            duplicate detection still work — only natural-language answers need a model key.
          </span>
        </div>
      )}

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center animate-rise-in">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 mx-auto">
              <IconSparkles size={26} />
            </div>
            <h2 className="font-display font-bold text-slate-800 text-lg">Ask me about your complaints</h2>
            <p className="text-[14px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              I can only read your own records, so answers are specific to you.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 text-left">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={unavailable}
                  className="focus-ring lift text-[13px] text-slate-700 bg-slate-50 hover:bg-white hover:border-primary border border-slate-200 rounded-xl px-3.5 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <Link
                to="/nearby"
                className="focus-ring lift inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-primary transition-all"
              >
                <IconSearch size={15} /> Check nearby issues
              </Link>
              <Link
                to="/report"
                className="focus-ring lift inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-white bg-primary rounded-xl px-4 py-2.5 shadow-btn transition-all"
              >
                <IconReport size={15} /> Report an issue
              </Link>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i}>
              <Bubble role={m.role}>
                {m.isError ? <span className="text-red-600">{m.text}</span> : m.text}
              </Bubble>

              {/* Grounding. Citations are complaint ids, so link them. */}
              {m.role === 'assistant' && !m.isError && (m.citations?.length > 0 || m.source) && (
                <div className="flex items-center gap-2 flex-wrap mt-1.5 ml-1">
                  {m.citations?.map((c) => {
                    const id = typeof c === 'string' ? c : c?.complaintId;
                    if (!id) return null;
                    return (
                      <Link
                        key={id}
                        to={`/complaints/${id}`}
                        className="focus-ring text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        {id}
                      </Link>
                    );
                  })}
                  {m.source && (
                    <span className="text-[11px] text-slate-400">
                      via {m.source === 'gemini' ? 'model' : m.source}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <Bubble role="assistant">
            <span className="flex items-center gap-1.5" aria-label="Thinking">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse-dot"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </span>
          </Bubble>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="shrink-0 mt-4 flex items-end gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention people
            // already expect from every chat client.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          disabled={unavailable}
          placeholder={unavailable ? 'Assistant unavailable' : 'Ask about your complaints…'}
          aria-label="Your question"
          className="flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] text-slate-800 outline-none max-h-32 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!question.trim() || sending || unavailable}
          aria-label="Send"
          className="focus-ring shrink-0 w-9 h-9 rounded-xl bg-primary hover:bg-leaf-700 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors"
        >
          <IconSend size={16} />
        </button>
      </form>
    </div>
  );
}

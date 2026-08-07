// Floating AI assistant, available on every authenticated screen for all four
// roles.
//
// Lives in the corner rather than as a nav destination because the questions it
// answers are about whatever you are already looking at — "which of these is
// oldest", "what is overdue". Making it a page meant leaving the screen you
// wanted to ask about, which is exactly backwards.
//
// The backend scopes answers to the caller's role and data, so this sends the
// question and nothing else. Same endpoint for every role.
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { askAssistant, aiHealth } from '../../api/ai';
import {
  IconBot, IconX, IconSend, IconSparkles, IconAlertTriangle, IconArrowRight,
} from '../dashboard/icons';

// Role-appropriate openers. These demonstrate the shape of question that works
// rather than inviting open-ended chat the assistant cannot answer.
const STARTERS = {
  citizen: [
    'What is the status of my complaints?',
    'Which of my complaints is taking longest?',
  ],
  municipal_officer: [
    'Which complaints are unassigned right now?',
    'What is my department\'s oldest open complaint?',
  ],
  field_worker: [
    'What tasks are assigned to me?',
    'Which of my tasks is highest severity?',
  ],
  admin: [
    'How many complaints are unresolved city-wide?',
    'Which category has the most complaints?',
  ],
};

export default function AssistantWidget({ role = 'citizen' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Probe once, and only when first opened — no point spending a request on
  // every page load for a panel most users never open.
  useEffect(() => {
    if (!open || unavailable !== null) return;
    aiHealth()
      .then((h) => setUnavailable(h?.assistant === false ? (h.reason || 'The assistant is not configured.') : false))
      .catch(() => setUnavailable(false)); // probe failure shouldn't disable the UI
  }, [open, unavailable]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const send = async (text) => {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setQuestion('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await askAssistant(q);
      setMessages((m) => [...m, {
        role: 'assistant',
        text: res?.answer || 'No answer came back.',
        citations: res?.citations || [],
        source: res?.source || null,
      }]);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') {
        setMessages((m) => [...m, { role: 'error', text: err.message }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const starters = STARTERS[role] || STARTERS.citizen;

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
        className={`focus-ring fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center
          text-white transition-all duration-200 hover:scale-105 active:scale-95
          ${open ? 'bg-slate-800' : 'logo-gradient'}`}
      >
        {open ? <IconX size={22} /> : <IconBot size={24} />}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-white" aria-hidden="true" />
        )}
      </button>

      {/* Panel. Anchored above the launcher; on a phone it fills the width
          minus a gutter so it never runs off-screen. */}
      {open && (
        <div
          role="dialog"
          aria-label="AI assistant"
          className="fixed bottom-24 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-[380px] max-h-[min(560px,calc(100vh-8rem))]
                     bg-white rounded-2xl border border-line shadow-xl flex flex-col overflow-hidden animate-scale-in origin-bottom-right"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line bg-slate-50 shrink-0">
            <span className="w-8 h-8 rounded-lg logo-gradient text-white flex items-center justify-center">
              <IconSparkles size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink leading-tight">Assistant</div>
              <div className="text-[11px] text-ink-faint">Answers from your own data</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="focus-ring ml-auto w-7 h-7 rounded-md text-ink-faint hover:bg-slate-200 flex items-center justify-center transition"
            >
              <IconX size={15} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {unavailable && (
              <div className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{unavailable}</span>
              </div>
            )}

            {messages.length === 0 && (
              <div className="py-2">
                <p className="text-[13px] text-ink-muted mb-3">
                  Ask about your complaints. Answers come from records you already have access to.
                </p>
                <div className="space-y-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={busy || Boolean(unavailable)}
                      className="focus-ring w-full text-left text-[13px] text-ink-body bg-slate-50 hover:bg-slate-100 disabled:opacity-50
                                 border border-line rounded-lg px-3 py-2 transition flex items-center gap-2 group"
                    >
                      <span className="flex-1">{s}</span>
                      <IconArrowRight size={13} className="text-ink-faint opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`animate-rise-in ${m.role === 'user' ? 'flex justify-end' : ''}`}>
                {m.role === 'user' ? (
                  <div className="max-w-[85%] bg-primary text-white text-[13px] rounded-2xl rounded-br-sm px-3.5 py-2 leading-snug">
                    {m.text}
                  </div>
                ) : m.role === 'error' ? (
                  <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {m.text}
                  </div>
                ) : (
                  <div className="max-w-[92%]">
                    <div className="bg-slate-50 border border-line text-[13px] text-ink-body rounded-2xl rounded-bl-sm px-3.5 py-2 leading-relaxed whitespace-pre-line">
                      {m.text}
                    </div>
                    {/* Citations make the answer checkable. An answer you can
                        trace beats a confident one you cannot. */}
                    {m.citations?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {m.citations.map((c) => {
                          const id = typeof c === 'string' ? c : c.complaintId;
                          if (!id) return null;
                          return (
                            <Link
                              key={id}
                              to={`/complaints/${id}`}
                              onClick={() => setOpen(false)}
                              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white border border-line text-primary hover:border-primary transition"
                            >
                              {id}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    {m.source && (
                      <div className="text-[10px] text-ink-faint mt-1">
                        {m.source === 'rules' ? 'Rules engine' : 'Model'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-1.5 px-1" aria-label="Thinking">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse-dot"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-line p-2.5 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={busy || Boolean(unavailable)}
              placeholder={unavailable ? 'Assistant unavailable' : 'Ask a question…'}
              aria-label="Ask the assistant"
              className="focus-ring flex-1 min-w-0 text-[13px] text-ink px-3 py-2 rounded-lg border border-line outline-none disabled:bg-slate-50 transition"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy || Boolean(unavailable)}
              aria-label="Send"
              className="focus-ring shrink-0 w-9 h-9 rounded-lg bg-primary hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition"
            >
              <IconSend size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ask, shelfMatches, toHistory } from '../../lib/assistant';
import { toAiImage, ACCEPTED_TYPES } from '../../lib/image';
import { addFiles } from '../../lib/ingest';
import { prefersReducedMotion } from '../../lib/theme';
import { useSettings } from '../../lib/settings';
import { ImageDialog } from '../library/ImageDialog';
import { useLibrary } from '../library/LibraryProvider';
import { getChat, resetChat, setChat, updateMsg, useChat, type AssistantMsg, type Attachment, type UserMsg } from './chatStore';
import { LookFurther, OpenImages, ShelfMatches } from './References';

const EXAMPLES = [
  'I’m designing a rugged-but-premium dashboard for an electric scooter. What directions should I look at?',
  'Warm, calm materials for a small café counter',
  'Packaging for a tea brand that should feel handmade but premium',
  'A banking app home screen that feels calm and trustworthy',
];

const MAX_IMAGES = 4;

export function AskPanel() {
  const { messages } = useChat();
  const settings = useSettings();
  const { store, images } = useLibrary();
  const [open, setOpen] = useState<{ id: string; order: string[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = messages.some((m) => m.role === 'assistant' && m.status === 'loading');

  // Bring the newest message into view.
  const count = messages.length;
  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'end' });
  }, [count]);

  async function send(text: string, files: File[]) {
    const userMsg: UserMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      attachments: files.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), save: { state: 'idle' } })),
    };
    const reply: AssistantMsg = { id: crypto.randomUUID(), role: 'assistant', replyTo: userMsg.id, status: 'loading' };
    setChat((s) => ({ ...s, messages: [...s.messages, userMsg, reply] }));
    await run(userMsg, reply.id);
  }

  async function run(userMsg: UserMsg, replyId: string) {
    updateMsg(replyId, { status: 'loading', error: undefined });
    try {
      const inline = await Promise.all(userMsg.attachments.map((a) => toAiImage(a.file)));
      // Only the last few exchanges go along as context.
      const history = getChat().history.slice(-8);
      const answer = await ask(userMsg.text, inline, history, (ms) => updateMsg(replyId, { waitingUntil: Date.now() + ms }));
      // Show the answer straight away; shelf matches fill in when their searches finish.
      updateMsg(replyId, { status: 'done', answer, shelf: undefined, waitingUntil: undefined });
      setChat((s) => ({ ...s, history: [...s.history, ...toHistory(userMsg.text, userMsg.attachments.length, answer)] }));
      const shelf = await shelfMatches(images, userMsg.text, answer, Boolean(settings.geminiKey), 6, store).catch(() => []);
      updateMsg(replyId, { shelf });
    } catch (err) {
      updateMsg(replyId, { status: 'error', error: (err as Error).message, waitingUntil: undefined });
    }
  }

  async function saveAttachment(msgId: string, att: Attachment) {
    const setSave = (save: Attachment['save']) => {
      const msg = getChat().messages.find((m) => m.id === msgId) as UserMsg | undefined;
      if (msg) updateMsg(msgId, { attachments: msg.attachments.map((a) => (a.id === att.id ? { ...a, save } : a)) });
    };
    setSave({ state: 'saving' });
    try {
      const [imageId] = await addFiles(store, [att.file], settings.defaultLensId);
      setSave(imageId ? { state: 'saved', imageId } : { state: 'error', error: 'The image could not be saved.' });
    } catch (err) {
      setSave({ state: 'error', error: (err as Error).message });
    }
  }

  return (
    <div className="ask">
      {messages.length === 0 ? (
        <div className="ask__intro">
          <h2 className="ask__h">Ask for references.</h2>
          <p>
            Describe what you’re designing, or add images and ask about them. You’ll get directions to explore, matches
            from your shelf, open-licensed photos with credits, and links to look further.
          </p>
          <div className="demo__chips ask__examples" role="group" aria-label="Example questions">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => send(e, [])} disabled={!settings.geminiKey}>
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ask__head">
          <button type="button" className="linkbtn" onClick={resetChat} disabled={busy}>
            New conversation
          </button>
        </div>
      )}

      <ol className="ask__log" aria-label="Conversation">
        {messages.map((m) =>
          m.role === 'user' ? (
            <li key={m.id} className="ask__user">
              {m.text && <p>{m.text}</p>}
              {m.attachments.length > 0 && (
                <ul className="ask__atts">
                  {m.attachments.map((a) => (
                    <li key={a.id}>
                      <img src={a.url} alt={`Attached: ${a.file.name}`} />
                      <AttachmentSave att={a} onSave={() => saveAttachment(m.id, a)} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ) : (
            <li key={m.id} className="ask__bot">
              <Reply
                msg={m}
                libraryEmpty={images.length === 0}
                onRetry={() => {
                  const u = messages.find((x) => x.id === m.replyTo) as UserMsg | undefined;
                  if (u) void run(u, m.id);
                }}
                onOpen={(id, order) => setOpen({ id, order })}
              />
            </li>
          ),
        )}
      </ol>
      <div ref={endRef} />

      {!settings.geminiKey && (
        <p className="notice">
          The assistant uses your Gemini key. <Link to="/settings#key">Add it in Settings</Link>, then come back here.
        </p>
      )}
      <Composer disabled={!settings.geminiKey} busy={busy} onSend={send} />

      <ImageDialog
        imageId={open?.id ?? null}
        order={open?.order ?? []}
        onNavigate={(id) => setOpen((o) => (o ? { ...o, id } : o))}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function AttachmentSave({ att, onSave }: { att: Attachment; onSave: () => void }) {
  if (att.save.state === 'saved') {
    return (
      <Link className="ask__save is-saved" to={`/library?image=${att.save.imageId}`}>
        Saved · view
      </Link>
    );
  }
  return (
    <>
      <button type="button" className="ask__save" onClick={onSave} disabled={att.save.state === 'saving'}>
        {att.save.state === 'saving' ? 'Saving…' : 'Save to shelf'}
      </button>
      {att.save.state === 'error' && <span className="ask__save-err">{att.save.error}</span>}
    </>
  );
}

function Reply({
  msg,
  libraryEmpty,
  onRetry,
  onOpen,
}: {
  msg: AssistantMsg;
  libraryEmpty: boolean;
  onRetry: () => void;
  onOpen: (id: string, order: string[]) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!msg.waitingUntil) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [msg.waitingUntil]);

  if (msg.status === 'loading') {
    const wait = msg.waitingUntil && msg.waitingUntil > now ? Math.ceil((msg.waitingUntil - now) / 1000) : 0;
    return (
      <p className="ask__thinking" role="status">
        <span className="spinner" aria-hidden="true" />{' '}
        {wait ? `Gemini asked us to slow down. Trying again in ${wait}s.` : 'Thinking…'}
      </p>
    );
  }
  if (msg.status === 'error' || !msg.answer) {
    return (
      <div className="notice notice--error" role="alert">
        <p>{msg.error ?? 'Something went wrong.'}</p>
        <button type="button" className="btn btn--quiet" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const a = msg.answer;
  return (
    <article className="answer">
      <p className="answer__summary">{a.summary}</p>

      {a.directions.length > 0 && (
        <section className="answer__sec">
          <h3 className="answer__h">Directions</h3>
          <ul className="answer__dirs">
            {a.directions.map((d) => (
              <li key={d.title}>
                <strong>{d.title}</strong>
                <span>{d.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="answer__sec">
        <h3 className="answer__h">From your shelf</h3>
        {msg.shelf === undefined && !libraryEmpty ? (
          <p className="muted" role="status">
            <span className="spinner" aria-hidden="true" /> Finding matches on your shelf…
          </p>
        ) : (
          <ShelfMatches images={msg.shelf ?? []} libraryEmpty={libraryEmpty} onOpen={onOpen} />
        )}
      </section>

      {a.queries.length > 0 && (
        <>
          <section className="answer__sec">
            <h3 className="answer__h">Open images</h3>
            <p className="field__hint">Open-licensed photos from Openverse and Wikimedia Commons. Each links to its source and licence.</p>
            {a.queries.map((q) => (
              <OpenImages key={q.query} label={q.label} query={q.query} />
            ))}
          </section>
          <section className="answer__sec">
            <h3 className="answer__h">Look further</h3>
            <LookFurther queries={a.queries} />
          </section>
        </>
      )}
    </article>
  );
}

function Composer({ disabled, busy, onSend }: { disabled: boolean; busy: boolean; onSend: (text: string, files: File[]) => void }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [note, setNote] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  function addImages(list: File[]) {
    const imgs = list.filter((f) => ACCEPTED_TYPES.includes(f.type));
    const room = MAX_IMAGES - files.length;
    if (list.length && !imgs.length) setNote('Only JPEG, PNG, WebP, GIF or AVIF images can be attached.');
    else if (imgs.length > room) setNote(`You can attach up to ${MAX_IMAGES} images per question.`);
    else setNote(undefined);
    setFiles((f) => [...f, ...imgs.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (disabled || busy || (!text.trim() && !files.length)) return;
    onSend(text.trim(), files.map((f) => f.file));
    // The message makes its own preview URLs; release the composer's.
    files.forEach((f) => URL.revokeObjectURL(f.url));
    setFiles([]);
    setText('');
    setNote(undefined);
    areaRef.current?.focus();
  }

  return (
    <form
      className={`composer ${dragging ? 'is-dragging' : ''}`}
      onSubmit={submit}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addImages([...e.dataTransfer.files]);
      }}
    >
      {files.length > 0 && (
        <ul className="composer__files">
          {files.map((f, i) => (
            <li key={f.url}>
              <img src={f.url} alt={f.file.name} />
              <button
                type="button"
                aria-label={`Remove ${f.file.name}`}
                onClick={() => {
                  URL.revokeObjectURL(f.url);
                  setFiles((all) => all.filter((_, j) => j !== i));
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={id} className="visually-hidden">
        Your question
      </label>
      <textarea
        ref={areaRef}
        id={id}
        className="composer__input"
        rows={2}
        value={text}
        disabled={disabled}
        placeholder="Describe what you’re designing, or ask about attached images…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        onPaste={(e) => {
          const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
          if (imgs.length) {
            e.preventDefault();
            addImages(imgs);
          }
        }}
      />
      <div className="composer__bar">
        <button type="button" className="btn btn--quiet" onClick={() => fileRef.current?.click()} disabled={disabled || files.length >= MAX_IMAGES}>
          Attach images
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addImages([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <span className="field__hint composer__hint">Enter to send · Shift+Enter for a new line · paste or drop images</span>
        <button type="submit" className="btn btn--primary" disabled={disabled || busy || (!text.trim() && !files.length)}>
          {busy ? 'Answering…' : 'Ask'}
        </button>
      </div>
      {note && <p className="field__hint composer__note">{note}</p>}
    </form>
  );
}

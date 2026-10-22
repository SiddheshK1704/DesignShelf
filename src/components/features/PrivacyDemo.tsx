import { useState } from 'react';

function mask(key: string) {
  if (!key) return '(empty)';
  if (key.length <= 6) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(Math.min(12, key.length - 8))}${key.slice(-4)}`;
}

export function PrivacyDemo() {
  const [key, setKey] = useState('');

  return (
    <div className="demo demo--privacy">
      <ol className="demo__flow" aria-label="Where your data goes">
        <li className="demo__node">
          <span className="demo__node-name">Your browser</span>
          <span className="muted">Images, tags, boards, and your key</span>
        </li>
        <li className="demo__wire" aria-hidden="true" />
        <li className="demo__node">
          <span className="demo__node-name">Google Gemini</span>
          <span className="muted">Receives an image only when it’s tagged</span>
        </li>
      </ol>
      <p className="demo__none">
        <span aria-hidden="true" className="demo__strike">
          Design Shelf server
        </span>{' '}
        <span className="muted">There isn’t one in local mode. Nothing passes through us.</span>
      </p>

      <label className="demo__label" htmlFor="demo-key">
        Try it with a made-up key
      </label>
      <input
        id="demo-key"
        className="demo__key"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="AIza…"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="demo__stored mono">
        <span className="muted">localStorage</span> designshelf.geminiKey = {mask(key)}
      </p>
      <p className="demo__fine">This demo doesn’t save anything. Add your real key in Settings.</p>
    </div>
  );
}

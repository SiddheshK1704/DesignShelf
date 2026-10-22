import { Link } from 'react-router-dom';
import { BUILT_IN_LENSES } from '../lib/lenses';
import './app.css';

export function Help() {
  return (
    <div className="page page--narrow help">
      <header className="page__head">
        <div>
          <h1 className="page__title">How it works</h1>
          <p className="muted">Design Shelf is a reference library you search by feel. Here’s how to get the most from it.</p>
        </div>
      </header>

      <nav className="toc" aria-label="On this page">
        <a href="#start">Getting started</a>
        <a href="#lenses">Lenses</a>
        <a href="#search">Searching</a>
        <a href="#boards">Boards</a>
        <a href="#privacy">Privacy and data</a>
        <a href="#problems">When something goes wrong</a>
      </nav>

      <section id="start" className="set">
        <h2 className="set__title">Getting started</h2>
        <ol className="steps">
          <li>
            <strong>Add a Gemini key.</strong> Create a free key in{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              Google AI Studio
            </a>{' '}
            and paste it in <Link to="/settings">Settings</Link>. Without a key you can still save and tag images by hand.
          </li>
          <li>
            <strong>Add images.</strong> In the <Link to="/library">Library</Link>, drop files on the page, choose them
            with Add images, or paste with Ctrl+V (⌘V on a Mac). Batches are fine.
          </li>
          <li>
            <strong>Let them tag.</strong> Each image gets a short description and tags for form, material, colour, mood
            and details, plus whatever its lens adds. You can edit any of it.
          </li>
          <li>
            <strong>Search by feel.</strong> Type how you’d describe what you want, such as “calm, soft, premium”.
          </li>
        </ol>
      </section>

      <section id="lenses" className="set">
        <h2 className="set__title">Lenses</h2>
        <p>
          A lens tells the AI what kind of designer is looking. Pick one before adding images, or re-tag any image with a
          different lens from its detail view. You can write your own in <Link to="/settings#lenses">Settings</Link>.
        </p>
        <dl className="defs">
          {BUILT_IN_LENSES.map((l) => (
            <div key={l.id}>
              <dt>{l.name}</dt>
              <dd>Looks at {l.focus}.</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="search" className="set">
        <h2 className="set__title">Searching</h2>
        <p>
          Search compares the meaning of your words with each image’s description and tags, then gives a small extra
          boost to exact word matches. So “quiet” can find an image tagged “calm” even though the words differ.
        </p>
        <p>
          Use the filters beside the results to narrow by tag. Filters combine, so choosing “walnut” and “calm” shows
          images with both. Without a key, search matches exact words only.
        </p>
      </section>

      <section id="boards" className="set">
        <h2 className="set__title">Boards</h2>
        <p>
          Boards group references for a project. Create one on the <Link to="/boards">Boards</Link> page, or from any
          image’s detail view. An image can be on as many boards as you like, and deleting a board keeps its images.
        </p>
      </section>

      <section id="privacy" className="set">
        <h2 className="set__title">Privacy and data</h2>
        <ul className="bullets">
          <li>Your key is stored in this browser and sent only to Google, with each request.</li>
          <li>When an image is tagged, a resized copy is sent to Gemini. Nothing else leaves your browser.</li>
          <li>Without an account, your library lives in this browser. Clearing site data deletes it, so export a backup from Settings now and then.</li>
          <li>Gemini usage counts against your own Google quota. The free tier is usually enough for a personal library.</li>
        </ul>
      </section>

      <section id="problems" className="set">
        <h2 className="set__title">When something goes wrong</h2>
        <dl className="defs">
          <div>
            <dt>“Google rejected this API key”</dt>
            <dd>The key was mistyped or deleted. Paste it again in Settings, or create a new one.</dd>
          </div>
          <div>
            <dt>“Gemini asked us to slow down”</dt>
            <dd>You hit the rate limit. Design Shelf waits and retries on its own; leave the tab open.</dd>
          </div>
          <div>
            <dt>An image says “Tagging failed”</dt>
            <dd>Open it and choose Try again. If it keeps failing, try another lens or a smaller copy of the image.</dd>
          </div>
          <div>
            <dt>HEIC photos won’t add</dt>
            <dd>Most browsers can’t read HEIC. Export the photo as JPEG first.</dd>
          </div>
          <div>
            <dt>“Out of storage space”</dt>
            <dd>Your browser’s storage for this site is full. Export a backup, then delete images you no longer need.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

import type { ReactNode } from 'react';
import { AssistantDemo } from './AssistantDemo';
import { BoardsDemo } from './BoardsDemo';
import { ColourDemo } from './ColourDemo';
import { LensDemo } from './LensDemo';
import { PrivacyDemo } from './PrivacyDemo';
import { SearchDemo } from './SearchDemo';
import './Features.css';

interface RowProps {
  id: string;
  title: string;
  children: ReactNode;
  demo: ReactNode;
  flip?: boolean;
}

function Row({ id, title, children, demo, flip = false }: RowProps) {
  return (
    <section className={`feature ${flip ? 'feature--flip' : ''}`} aria-labelledby={id}>
      <div className="feature__text">
        <h3 id={id} className="feature__title">
          {title}
        </h3>
        <div className="feature__copy">{children}</div>
      </div>
      <div className="feature__demo reg-frame">{demo}</div>
    </section>
  );
}

export function Features() {
  return (
    <section className="features" aria-labelledby="features-title">
      <div className="container">
        <header className="features__head">
          <h2 id="features-title" className="features__title">
            Made for the way designers look.
          </h2>
          <p className="features__lede">
            Six things Design Shelf does. Each one has a small demo you can use right here.
          </p>
        </header>

        <Row id="f-search" title="Search the way you’d describe it." demo={<SearchDemo />}>
          <p>Type a few words, like “calm, soft, premium”. Your references are ranked by meaning, and exact tag matches get a small extra boost.</p>
          <p className="muted">You don’t need the right keyword or the original file name.</p>
        </Row>

        <Row id="f-lens" title="One image, read through different lenses." demo={<LensDemo />} flip>
          <p>A lens tells the AI what to look for. The vehicle lens notices proportion and stance. The CMF lens notices paint, trim and texture.</p>
          <p className="muted">Write your own lens for anything the built-in ones miss.</p>
        </Row>

        <Row id="f-assistant" title="Ask, and get references back." demo={<AssistantDemo />}>
          <p>Ask for references or turn a brief into a design doc, with real images and links to look further.</p>
          <p className="muted">Open images come with their author and licence. Matches from your own shelf come first.</p>
        </Row>

        <Row id="f-colour" title="Real colours, ready to copy." demo={<ColourDemo />} flip>
          <p>Each image gets a palette taken from its pixels. Click a swatch to copy the hex code.</p>
          <p className="muted">“More like this” finds references with a close palette and similar tags.</p>
        </Row>

        <Row id="f-boards" title="A board for every project." demo={<BoardsDemo />}>
          <p>Group references by project, client or idea. One reference can sit on as many boards as you need.</p>
          <p className="muted">Pick a board, then add or remove references.</p>
        </Row>

        <Row id="f-private" title="Your key stays in your browser." demo={<PrivacyDemo />} flip>
          <p>Design Shelf uses your own Gemini API key. It’s stored in this browser and sent only to Google, with each tagging request.</p>
          <p className="muted">In local mode your library lives in this browser too.</p>
        </Row>
      </div>
    </section>
  );
}

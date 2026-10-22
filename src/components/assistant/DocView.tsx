import type { ImageRecord, SavedDoc } from '../../lib/types';
import { Diagram } from './Diagram';
import { LookFurther, OpenImages, ShelfMatches } from './References';

interface Props {
  saved: SavedDoc;
  shelf: ImageRecord[];
  lensName: string;
  boardName?: string;
  libraryEmpty: boolean;
  onOpenImage: (id: string, order: string[]) => void;
}

/** The design doc, shown in full as a readable document. */
export function DocView({ saved, shelf, lensName, boardName, libraryEmpty, onOpenImage }: Props) {
  const d = saved.doc;
  return (
    <article className="doc" aria-labelledby="doc-title">
      <header className="doc__head">
        <p className="doc__meta">
          {lensName} lens{boardName ? ` · ${boardName}` : ''} · {new Date(saved.createdAt).toLocaleDateString()}
        </p>
        <h2 id="doc-title" className="doc__title">
          {d.title}
        </h2>
        <p className="doc__summary">{d.summary}</p>
      </header>

      <section className="doc__sec">
        <h3>Brief</h3>
        <p className="doc__brief">{saved.brief}</p>
      </section>

      <section className="doc__sec">
        <h3>Problem and audience</h3>
        <div className="doc__two">
          <div>
            <h4>Problem</h4>
            <p>{d.problem}</p>
          </div>
          <div>
            <h4>Audience</h4>
            <p>{d.audience}</p>
          </div>
        </div>
      </section>

      <section className="doc__sec">
        <h3>Goals and constraints</h3>
        <div className="doc__two">
          <div>
            <h4>Goals</h4>
            <ul>
              {d.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Constraints</h4>
            <ul>
              {d.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="doc__sec">
        <h3>Design principles</h3>
        <dl className="doc__items">
          {d.principles.map((p) => (
            <div key={p.title}>
              <dt>{p.title}</dt>
              <dd>{p.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="doc__sec">
        <h3>Visual direction</h3>
        <dl className="doc__visual">
          {(['form', 'material', 'colour', 'mood'] as const).map((g) => (
            <div key={g}>
              <dt>{g.charAt(0).toUpperCase() + g.slice(1)}</dt>
              <dd>
                <ul className="doc__tags">
                  {d.visual[g].map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="doc__sec">
        <h3>{d.lensSection.heading}</h3>
        <dl className="doc__items">
          {d.lensSection.items.map((i) => (
            <div key={i.title}>
              <dt>{i.title}</dt>
              <dd>{i.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="doc__sec">
        <h3>References</h3>
        <h4>From your shelf</h4>
        <ShelfMatches images={shelf} libraryEmpty={libraryEmpty} onOpen={onOpenImage} />
        {d.queries.length > 0 && (
          <>
            <h4>Open images</h4>
            {d.queries.map((q) => (
              <OpenImages key={q.query} label={q.label} query={q.query} />
            ))}
            <h4>Look further</h4>
            <LookFurther queries={d.queries} />
          </>
        )}
      </section>

      <section className="doc__sec">
        <h3>Risks and open questions</h3>
        <div className="doc__two">
          <div>
            <h4>Risks</h4>
            <ul>
              {d.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Open questions</h4>
            <ul>
              {d.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="doc__sec">
        <h3>Architecture</h3>
        {d.architecture.kind && <p className="doc__meta">{d.architecture.kind}</p>}
        <Diagram code={d.architecture.mermaid} ok={saved.diagram.ok} error={saved.diagram.error} />
        <p>{d.architecture.explanation}</p>
      </section>
    </article>
  );
}

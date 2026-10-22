import { Link } from 'react-router-dom';
import './Placeholder.css';

export function Placeholder({ title, notFound = false }: { title: string; notFound?: boolean }) {
  return (
    <section className="placeholder container">
      <h1>{title}</h1>
      {notFound ? (
        <p className="muted">
          There is no page at this address. Check the link, or <Link to="/">go back to the start</Link>.
        </p>
      ) : (
        <p className="muted">This screen is being built. Use the links above to look around in the meantime.</p>
      )}
    </section>
  );
}

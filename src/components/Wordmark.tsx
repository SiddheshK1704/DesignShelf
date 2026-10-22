import { Link } from 'react-router-dom';
import './Wordmark.css';

export function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="Design Shelf, home">
      <span className="wordmark__text">Design Shelf</span>
      <span className="wordmark__shelf" aria-hidden="true" />
    </Link>
  );
}

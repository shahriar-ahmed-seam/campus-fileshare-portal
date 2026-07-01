import { FileSharePanel } from './fileshare/FileSharePanel';

const NAV = ['Dashboard', 'Courses', 'Grades', 'Library', 'File Share'] as const;

function Crest(): JSX.Element {
  return (
    <svg className="crest" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3 6 10v11c0 11 7.6 20.4 18 24 10.4-3.6 18-13 18-24V10L24 3Z" fill="#0b3d2e" />
      <path d="M24 8 11 13v8c0 8.4 5.6 15.6 13 18.4 7.4-2.8 13-10 13-18.4v-8L24 8Z" fill="#12583f" />
      <path d="M24 15l3.2 6.5 7.2 1-5.2 5 1.2 7.1L24 31.3 17.6 34.6l1.2-7.1-5.2-5 7.2-1L24 15Z" fill="#f0ab2e" />
    </svg>
  );
}

export default function App(): JSX.Element {
  return (
    <div className="portal">
      <header className="topbar">
        <div className="brand">
          <Crest />
          <div className="brand-text">
            <span className="brand-name">Northgate University</span>
            <span className="brand-sub">Student Portal</span>
          </div>
        </div>
        <nav className="topnav">
          {NAV.map((item) => (
            <a
              key={item}
              className={`navlink ${item === 'File Share' ? 'navlink-active' : ''}`}
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="user">
          <div className="avatar">AR</div>
          <div className="user-text">
            <span className="user-name">Aisha Rahman</span>
            <span className="user-role">B.Sc. Computer Science</span>
          </div>
        </div>
      </header>

      <main className="content">
        <div className="page-head">
          <h1 className="page-title">File Share</h1>
          <p className="page-crumbs">Home / Services / File Share</p>
        </div>

        <div className="quick-stats">
          <div className="stat">
            <span className="stat-num">5</span>
            <span className="stat-label">Enrolled courses</span>
          </div>
          <div className="stat">
            <span className="stat-num">3.86</span>
            <span className="stat-label">Current GPA</span>
          </div>
          <div className="stat">
            <span className="stat-num">2</span>
            <span className="stat-label">New notices</span>
          </div>
          <div className="stat stat-accent">
            <span className="stat-num">P2P</span>
            <span className="stat-label">Direct &amp; private</span>
          </div>
        </div>

        <FileSharePanel />
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Northgate University · Campus IT Services</span>
        <span className="footer-powered">
          File sharing powered by <strong>p2p-portal-drop</strong>
        </span>
      </footer>
    </div>
  );
}

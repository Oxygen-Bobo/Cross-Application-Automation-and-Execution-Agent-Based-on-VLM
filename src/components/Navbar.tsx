import { GithubIcon, githubUrl, navItems } from "../data";

export function Navbar() {
  return (
    <header className="site-header">
      <a className="brand-mark" href="#top" aria-label="返回首页">
        <span className="brand-dot" />
        <span>
          <strong>Desktop Agent</strong>
          <small>Based on VLM</small>
        </span>
      </a>
      <nav className="nav-links" aria-label="主要导航">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <a className="nav-github" href={githubUrl} target="_blank" rel="noreferrer">
        <GithubIcon aria-hidden="true" />
        GitHub
      </a>
    </header>
  );
}

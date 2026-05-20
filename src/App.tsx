import React, { useEffect } from 'react';
import { Sidebar, tools } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TitleBar } from './components/TitleBar';
import { usePersistedState } from './hooks/useStore';

import { Notepad }           from './components/tools/Notepad';
import { RegexTester }       from './components/tools/RegexTester';
import { MarkdownPreview }   from './components/tools/MarkdownPreview';
import { JsonFormatter }     from './components/tools/JsonFormatter';
import { UrlEncoder }        from './components/tools/UrlEncoder';
import { JwtDecoder }        from './components/tools/JwtDecoder';
import { DiffTool }          from './components/tools/DiffTool';
import { ZipDiff }           from './components/tools/ZipDiff';
import { ColorConverter }    from './components/tools/ColorConverter';
import { HashGenerator }     from './components/tools/HashGenerator';
import { TimestampConverter } from './components/tools/TimestampConverter';
import { Icons }             from './components/Icons';

// Home dashboard
function Home({ onSelect }: { onSelect: (id: string) => void }) {
  const categories = Array.from(new Set(tools.map(t => t.category)));
  const iconColors: Record<string, string> = {
    'TEXT TOOLS': 'purple', 'JSON TOOLS': 'purple', 'ENCODING TOOLS': 'orange',
    'DIFF TOOLS': 'blue', 'MISC': 'blue',
  };
  return (
    <div className="home-grid">
      <div>
        <div style={{ marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            Dev Oxide <span style={{ fontSize: 12, background: 'var(--btn-secondary-bg)', border: '1px solid var(--border-light)', borderRadius: 99, padding: '2px 10px', fontWeight: 400, color: 'var(--text-muted)' }}>v0.1 beta</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>11 tools available · offline, local-first</p>
        </div>
      </div>
      {categories.map(cat => (
        <div key={cat}>
          <div className="home-section-title">
            {cat}
            <span className="home-section-count">{tools.filter(t => t.category === cat).length} tools</span>
          </div>
          <div className="home-cards">
            {tools.filter(t => t.category === cat).map(tool => {
              const Icon = Icons[tool.icon as keyof typeof Icons];
              const color = iconColors[cat] ?? 'blue';
              return (
                <div key={tool.id} className="home-card" onClick={() => onSelect(tool.id)}>
                  <div className={`home-card-icon ${color}`}>
                    <Icon />
                  </div>
                  <div className="home-card-name">{tool.name}</div>
                  <div className="home-card-desc">{tool.hint}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderTool(id: string) {
  switch (id) {
    case 'notepad':   return <Notepad />;
    case 'regex':     return <RegexTester />;
    case 'markdown':  return <MarkdownPreview />;
    case 'json':      return <JsonFormatter />;
    case 'url':       return <UrlEncoder />;
    case 'jwt':       return <JwtDecoder />;
    case 'diff':      return <DiffTool />;
    case 'zipdiff':   return <ZipDiff />;
    case 'color':     return <ColorConverter />;
    case 'hash':      return <HashGenerator />;
    case 'timestamp': return <TimestampConverter />;
    default:          return null;
  }
}

export default function App() {
  const [activeTool, setActiveTool, toolLoaded] = usePersistedState<string | null>('active_tool', null);
  const [theme, setThemeState, themeLoaded] = usePersistedState<'dark' | 'light'>('theme', 'dark');

  // Apply theme class + favicon whenever theme changes
  useEffect(() => {
    if (!themeLoaded) return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    // Update favicon
    const iconUrl = theme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg';
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = iconUrl;
  }, [theme, themeLoaded]);

  const toggleTheme = () => setThemeState(theme === 'dark' ? 'light' : 'dark');

  const toolConfig = tools.find(t => t.id === activeTool);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <TitleBar />
      <div className="app" style={{ flex: 1, height: 'auto', width: '100%' }}>
        <Sidebar active={activeTool ?? ''} onSelect={id => setActiveTool(id)} theme={theme} />
        <div className="main">
          <TopBar
            toolName={toolConfig ? toolConfig.name : 'Dev Oxide'}
            hint={toolConfig ? toolConfig.hint : 'CMD+K for commands'}
            theme={theme}
            onToggleTheme={toggleTheme}
            onGoHome={() => setActiveTool(null)}
          />
          <div className="tool-area">
            {activeTool
              ? <React.Fragment key={activeTool}>{renderTool(activeTool)}</React.Fragment>
              : <Home onSelect={setActiveTool} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}


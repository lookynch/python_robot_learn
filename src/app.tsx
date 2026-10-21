import { useEffect, useState } from 'preact/hooks';
import { PathIcon, PlayIcon, ProfileIcon, ReviewIcon, RobotIcon } from './components/icons';
import { ToastHost } from './components/Toast';
import { allCardIds } from './content/course';
import { LessonPage } from './lesson/LessonPlayer';
import { dueCards } from './learning/srs';
import { useProgress } from './learning/store';
import { ModulePage } from './pages/ModulePage';
import { PathPage } from './pages/PathPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReviewPage } from './pages/ReviewPage';
import { RobotPage } from './pages/RobotPage';
import { linkHandler, useRoute, type Route } from './router';

function Nav({ route, due }: { route: Route; due: number }) {
  const item = (
    path: string,
    label: string,
    active: boolean,
    icon: preact.JSX.Element,
    badge?: number,
  ) => (
    <a
      href={path}
      class={active ? 'active' : ''}
      onClick={linkHandler(path)}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span>{label}</span>
      {badge ? <span class="badge">{badge > 99 ? '99+' : badge}</span> : null}
    </a>
  );
  return (
    <nav class="nav" aria-label="Hauptnavigation">
      {item('/', 'Lernpfad', route.name === 'path' || route.name === 'module', <PathIcon />)}
      {item('/review', 'Wiederholen', route.name === 'review', <ReviewIcon />, due)}
      {item('/play', 'Spielwiese', route.name === 'play', <PlayIcon />)}
      {item('/robot', 'Roboter', route.name === 'robot', <RobotIcon />)}
      {item('/profile', 'Profil', route.name === 'profile', <ProfileIcon />)}
    </nav>
  );
}

function useTheme(theme: 'auto' | 'light' | 'dark') {
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
}

function UpdateBanner() {
  const [update, setUpdate] = useState<(() => void) | null>(null);
  useEffect(() => {
    const onUpdate = (event: Event) => setUpdate(() => (event as CustomEvent<() => void>).detail);
    window.addEventListener('robopy:update', onUpdate);
    return () => window.removeEventListener('robopy:update', onUpdate);
  }, []);
  if (!update) return null;
  return (
    <div class="banner" style={{ margin: '8px 16px 0' }}>
      <div class="row">
        <span style={{ flex: 1 }}>Neue Version verfügbar.</span>
        <button class="btn small primary" onClick={update}>
          Aktualisieren
        </button>
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const progress = useProgress();
  useTheme(progress.settings.theme?.value ?? 'auto');
  const due = dueCards(progress, Date.now(), allCardIds).length;
  const fullscreen = route.name === 'lesson';

  let page;
  switch (route.name) {
    case 'path':
      page = <PathPage />;
      break;
    case 'module':
      page = <ModulePage moduleId={route.moduleId} />;
      break;
    case 'lesson':
      page = <LessonPage lessonId={route.lessonId} />;
      break;
    case 'review':
      page = <ReviewPage />;
      break;
    case 'play':
      page = <PlaygroundPage />;
      break;
    case 'robot':
      page = <RobotPage />;
      break;
    case 'profile':
      page = <ProfilePage />;
      break;
    default:
      page = <div class="page empty">Seite nicht gefunden.</div>;
  }

  return (
    <div class={`app ${fullscreen ? 'fullscreen' : ''}`}>
      <UpdateBanner />
      <main>{page}</main>
      {!fullscreen && <Nav route={route} due={due} />}
      <ToastHost />
    </div>
  );
}

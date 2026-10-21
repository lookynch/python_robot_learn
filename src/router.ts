import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'path' }
  | { name: 'module'; moduleId: string }
  | { name: 'lesson'; lessonId: string }
  | { name: 'review' }
  | { name: 'play' }
  | { name: 'profile' }
  | { name: 'not-found' };

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'path' };
  const [head, id] = parts;
  if (head === 'm' && id) return { name: 'module', moduleId: id };
  if (head === 'l' && id) return { name: 'lesson', lessonId: id };
  if (head === 'review') return { name: 'review' };
  if (head === 'play') return { name: 'play' };
  if (head === 'profile') return { name: 'profile' };
  return { name: 'not-found' };
}

export function navigate(path: string, replace = false) {
  if (path === location.pathname) return;
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.pathname));
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return route;
}

export function linkHandler(path: string) {
  return (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(path);
  };
}

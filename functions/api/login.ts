export const onRequestGet: PagesFunction = ({ request }) => {
  const target = new URL(request.url).searchParams.get('back') ?? '/';
  const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/';
  return new Response(null, {
    status: 302,
    headers: { Location: safe, 'Cache-Control': 'no-store' },
  });
};

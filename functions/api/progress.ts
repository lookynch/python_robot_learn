import { handleProgress, type Env } from '../../server/progress';

export const onRequest: PagesFunction<Env> = ({ request, env }) => handleProgress(request, env);

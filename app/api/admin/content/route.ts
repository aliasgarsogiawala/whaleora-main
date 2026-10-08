import { authorize, body, json } from '@/lib/admin/http';
import { ConflictError, readDocument, saveDocument } from '@/lib/content/store';
import { validateContent } from '@/lib/content/types';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = await authorize(request, false); if (denied) return denied;
  try { return json(await readDocument()); } catch { return json({ error: 'Could not load saved content. Check storage configuration.' }, 503); }
}
export async function PUT(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  let content, data;
  try {
    // Above the 200 KB default: blog posts make this the largest document the studio saves.
    data = JSON.parse((await body(request, 600_000)).toString());
    if (!Number.isSafeInteger(data.revision) || data.revision < 0 || typeof data.publish !== 'boolean') throw new Error('Invalid save request.');
    content = validateContent(data.content);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid content.' }, 400); }
  try { return json(await saveDocument(content, data.revision, data.publish)); }
  catch (error) { return json({ error: error instanceof ConflictError ? error.message : 'Could not save content. Check storage configuration and try again.' }, error instanceof ConflictError ? 409 : 503); }
}

import seedCatalog from '../data/wallpapers.json';

export type Wallpaper = {
  id: string;
  title: string;
  creator: string;
  category: string;
  tag: string;
  width: number;
  height: number;
  previewUrl: string;
  downloadUrl: string;
};

export const fallbackCatalog = seedCatalog as Wallpaper[];
export type CatalogResult = { wallpapers: Wallpaper[]; source: 'neon' | 'sample' };
const apiBase = (process.env.EXPO_PUBLIC_API_URL ?? 'https://kiki-gold.vercel.app').replace(/\/$/, '');

type ApiWallpaper = Partial<Wallpaper> & {
  imageUrl?: string;
  thumbUrl?: string;
  tags?: string[] | string;
  resolution?: string;
  source?: string;
};

function adaptWallpaper(row: ApiWallpaper): Wallpaper | null {
  const previewUrl = row.previewUrl || row.thumbUrl || row.imageUrl;
  const downloadUrl = row.downloadUrl || row.imageUrl || row.previewUrl;
  if (!row.id || !row.title || !previewUrl || !downloadUrl) return null;
  const tags = Array.isArray(row.tags) ? row.tags : typeof row.tags === 'string' ? row.tags.split(',') : [];
  const dimensions = row.resolution?.match(/(\d{3,5})\s*[x×]\s*(\d{3,5})/i);
  return {
    id: row.id,
    title: row.title,
    creator: row.creator || row.source || 'Kiki community',
    category: row.category || 'Nature',
    tag: row.tag || tags[0]?.toUpperCase() || 'NEW',
    width: row.width || (dimensions ? Number(dimensions[1]) : 2160),
    height: row.height || (dimensions ? Number(dimensions[2]) : 3840),
    previewUrl,
    downloadUrl,
  };
}

export async function loadCatalog(): Promise<CatalogResult> {
  if (!apiBase) return { wallpapers: fallbackCatalog, source: 'sample' };
  const response = await fetch(apiBase + '/api/wallpapers');
  if (!response.ok) throw new Error('Catalog request failed');
  const payload = await response.json();
  const rows = Array.isArray(payload.wallpapers) ? payload.wallpapers : Array.isArray(payload.data?.items) ? payload.data.items : [];
  const wallpapers = (rows as ApiWallpaper[]).map(adaptWallpaper).filter((item): item is Wallpaper => item !== null);
  return {
    wallpapers: wallpapers.length ? wallpapers : fallbackCatalog,
    source: payload.source === 'neon' || payload.ok === true ? 'neon' : 'sample',
  };
}

export function subscribeToCatalog(onUpdate: () => void) {
  if (!apiBase) return () => {};
  let stopped = false;
  let request: XMLHttpRequest | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    if (stopped) return;
    request = new XMLHttpRequest();
    request.open('GET', apiBase + '/api/events');
    let cursor = 0;
    request.onprogress = () => {
      const chunk = request?.responseText.slice(cursor) ?? '';
      cursor = request?.responseText.length ?? cursor;
      if (/event: (catalog\.updated|wallpaper\.(created|updated|deleted)|category\.changed)/.test(chunk)) onUpdate();
    };
    const reconnect = () => {
      if (!stopped) reconnectTimer = setTimeout(connect, 5000);
    };
    request.onerror = reconnect;
    request.onload = reconnect;
    request.send();
  };
  connect();
  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    request?.abort();
  };
}

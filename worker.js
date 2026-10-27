const SITE_ORIGIN = 'https://steam-wishlist-ranker.vercel.app';
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// ITAD の過去最安値は、同じゲームを何度も問い合わせないよう、6時間だけ覚えておく（国ごと）
const LOW_CACHE = new Map();
const LOW_TTL = 6 * 60 * 60 * 1000;

// 国 → 通貨（GetItems は通貨コードを返さないので、appdetails で 1 本だけ調べて 6 時間覚えておく）
const CUR_CACHE = new Map();

// アプリの表示言語 → Steam の言語名
const STEAM_LANGS = { ja: 'japanese', en: 'english', zh: 'schinese', ru: 'russian', pt: 'brazilian', de: 'german' };

// 価格を取る国。?cc= があればそれ、なければアクセス元の国（Cloudflare が IP から判定）、わからなければ日本
function countryOf(request, url) {
  const q = (url.searchParams.get('cc') || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(q)) return q;
  const c = ((request.cf && request.cf.country) || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(c) && c !== 'XX') return c;
  return 'JP';
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = origin === SITE_ORIGIN || LOCAL_ORIGIN.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : SITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

async function itadPost(env, path, body) {
  const res = await fetch('https://api.isthereanydeal.com' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ITAD-API-Key': env.ITAD_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('itad ' + res.status);
  return res.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const json = (data, status = 200, extra = {}) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', ...extra },
      });

    // Steam に問い合わせて JSON を取り出す共通処理
    const callSteam = async (target, init) => {
      try {
        const res = await fetch(target, init);
        const text = await res.text();
        try {
          return { data: JSON.parse(text), res };
        } catch (e) {
          return { error: json({ error: 'Steam からの応答を読み取れませんでした', status: res.status }, 502) };
        }
      } catch (e) {
        return { error: json({ error: 'Steam に接続できませんでした' }, 502) };
      }
    };

    // ウィッシュリスト取得（キー不要。steamid だけで取得する）
    if (path === '/wishlist') {
      const steamid = url.searchParams.get('steamid');
      if (!steamid) return json({ error: 'steamid が必要です' }, 400);
      if (!/^\d{5,20}$/.test(steamid)) {
        return json({ error: 'steamid の形式が正しくありません' }, 400);
      }
      const r = await callSteam(
        `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${encodeURIComponent(steamid)}`,
        { cache: 'no-store' }
      );
      if (r.error) return r.error;
      return json(r.data);
    }

    // 名前入りの URL（/id/名前/）から SteamID64 を調べる（キー不要。プロフィールの XML を読む。1時間キャッシュ）
    if (path === '/resolve') {
      const name = url.searchParams.get('vanity') || '';
      if (!/^[A-Za-z0-9_-]{2,64}$/.test(name)) return json({ error: 'vanity の形式が正しくありません' }, 400);
      try {
        const res = await fetch(`https://steamcommunity.com/id/${name}/?xml=1`, {
          cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 3600, '300-599': 0 } },
        });
        const text = await res.text();
        const m = text.match(/<steamID64>(\d{5,20})<\/steamID64>/);
        if (!m) return json({ error: 'アカウントが見つかりません' }, 404);
        return json({ steamid: m[1] });
      } catch (e) {
        return json({ error: 'Steam に接続できませんでした' }, 502);
      }
    }

    // ゲーム詳細取得（6時間キャッシュ。国と言語が URL に入るので、キャッシュも国・言語ごとに分かれる）
    if (path === '/appdetails') {
      const appid = url.searchParams.get('appid');
      if (!appid) return json({ error: 'appid が必要です' }, 400);
      if (!/^\d{1,10}$/.test(appid)) return json({ error: 'appid の形式が正しくありません' }, 400);
      const cc = countryOf(request, url).toLowerCase();
      const lang = STEAM_LANGS[url.searchParams.get('l')] || 'japanese';
      const r = await callSteam(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${cc}&l=${lang}&filters=basic,price_overview,release_date,header_image`,
        { cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 21600, '300-599': 0 } } }
      );
      if (r.error) return r.error;
      return json(r.data, 200, { 'X-Swr-Cache': r.res.headers.get('cf-cache-status') || 'NONE' });
    }

    // ゲーム情報のまとめ取得（最大 100 本。IStoreBrowseService/GetItems、キー不要）
    // 1 本ずつの /appdetails より大幅に速く、Worker の呼び出しも少ない。取れなかったものはアプリ側で /appdetails に回す
    if (path === '/items') {
      const ids = (url.searchParams.get('appids') || '')
        .split(',')
        .filter((x) => /^\d{1,10}$/.test(x))
        .slice(0, 100);
      if (!ids.length) return json({ error: 'appids が必要です' }, 400);
      const cc = countryOf(request, url);
      const lang = STEAM_LANGS[url.searchParams.get('l')] || 'japanese';
      const input = {
        ids: ids.map((a) => ({ appid: Number(a) })),
        context: { language: lang, country_code: cc },
        data_request: { include_assets: true, include_release: true },
      };
      const cache = { cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 21600, '300-599': 0 } } };
      const r = await callSteam(
        'https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=' + encodeURIComponent(JSON.stringify(input)),
        cache
      );
      if (r.error) return r.error;
      const list = (r.data && r.data.response && r.data.response.store_items) || [];
      const items = {};
      let pricedId = null;
      for (const it of list) {
        if (!it || it.success !== 1 || !it.appid || !it.name) continue;
        const a = it.assets || {};
        const img = a.asset_url_format && a.header
          ? 'https://shared.akamai.steamstatic.com/store_item_assets/' + a.asset_url_format.replace('${FILENAME}', a.header)
          : '';
        const rel = it.release || {};
        const bp = it.best_purchase_option || null;
        let p = null;
        if (bp && bp.final_price_in_cents != null) {
          const ad = bp.active_discounts && bp.active_discounts[0];
          p = {
            final: Number(bp.final_price_in_cents),
            orig: Number(bp.original_price_in_cents || bp.final_price_in_cents),
            pct: bp.discount_pct || 0,
            ff: bp.formatted_final_price || '',
            of: bp.formatted_original_price || '',
            end: (ad && ad.discount_end_date) || 0,
          };
          if (!pricedId) pricedId = it.appid;
        }
        items[it.appid] = {
          name: it.name,
          img,
          date: rel.steam_release_date || rel.original_release_date || 0,
          soon: !!rel.is_coming_soon,
          soonText: rel.custom_release_date_message || '',
          // 発売前の日付の見せ方（date_year=年だけ / date_quarter=四半期 / date_month=年月 / date_full=日付）
          disp: rel.coming_soon_display || '',
          free: !!it.is_free,
          p,
        };
      }
      let cur = CUR_CACHE.get(cc);
      if ((!cur || Date.now() - cur.t > LOW_TTL) && pricedId) {
        const c = await callSteam(
          `https://store.steampowered.com/api/appdetails?appids=${pricedId}&cc=${cc.toLowerCase()}&filters=price_overview`,
          cache
        );
        const po = c.data && c.data[pricedId] && c.data[pricedId].data && c.data[pricedId].data.price_overview;
        if (po && po.currency) {
          cur = { t: Date.now(), v: po.currency };
          CUR_CACHE.set(cc, cur);
        }
      }
      return json({ items, cur: (cur && cur.v) || '', cc });
    }

    // Steam での過去最安値（IsThereAnyDeal API）。ITAD_KEY を設定したときだけ動く
    if (path === '/pricelow') {
      if (!env.ITAD_KEY) return json({ error: 'ITAD_KEY が設定されていません' }, 501);
      const ids = (url.searchParams.get('appids') || '')
        .split(',')
        .filter((x) => /^\d{1,10}$/.test(x))
        .slice(0, 200);
      if (!ids.length) return json({ error: 'appids が必要です' }, 400);
      const country = countryOf(request, url);
      const now = Date.now();
      const lows = {};
      const need = [];
      for (const id of ids) {
        const c = LOW_CACHE.get(country + ':' + id);
        if (c && now - c.t < LOW_TTL) {
          if (c.v) lows[id] = c.v;
        } else {
          need.push(id);
        }
      }
      if (need.length) {
        try {
          // 1) Steam の appid を ITAD のゲームIDに変換
          const map = await itadPost(env, '/lookup/id/shop/61/v1', need.map((i) => 'app/' + i));
          const gidToApp = {};
          const gids = [];
          for (const i of need) {
            const g = map['app/' + i];
            if (g) {
              gidToApp[g] = i;
              gids.push(g);
            } else {
              LOW_CACHE.set(country + ':' + i, { t: now, v: null });
            }
          }
          // 2) Steam だけの過去最安値（その国の通貨）
          if (gids.length) {
            const rows = await itadPost(env, '/games/storelow/v2?country=' + country + '&shops=61', gids);
            const got = {};
            for (const row of rows) {
              const list = row.lows || [];
              const low = list.find((l) => l.shop && l.shop.id === 61) || list[0];
              const app = gidToApp[row.id];
              if (app && low && low.price) {
                got[app] = {
                  p: low.price.amount,
                  c: low.price.currency,
                  cut: low.cut || 0,
                  ts: String(low.timestamp || '').slice(0, 10),
                };
              }
            }
            for (const g of gids) {
              const app = gidToApp[g];
              LOW_CACHE.set(country + ':' + app, { t: now, v: got[app] || null });
              if (got[app]) lows[app] = got[app];
            }
          }
        } catch (e) {
          return json({ error: '価格履歴を取得できませんでした' }, 502);
        }
      }
      return json({ lows, source: 'IsThereAnyDeal', country });
    }

    return json({ error: 'Not Found' }, 404);
  }
};

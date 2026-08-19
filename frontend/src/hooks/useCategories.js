// Categories, fetched once and shared.
//
// Every complaint form, filter dropdown and officer drawer needs this list, and
// it changes about once a year. Fetching it per component would mean a request
// per mount for data that is effectively static, so it is cached in a
// module-level promise: the first caller triggers the request, everyone else
// awaits the same one.
//
// Falls back to the static table if the request fails, so a categories outage
// degrades the labels rather than breaking every form in the app.
import { useEffect, useState } from 'react';
import { listCategories, FALLBACK_CATEGORIES } from '../api/categories';

let cache = null;
let inflight = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = listCategories()
      .then((list) => {
        cache = list;
        inflight = null;
        return list;
      })
      .catch((err) => {
        inflight = null;
        // Cache the fallback too: retrying on every mount would hammer a
        // backend that is already failing.
        cache = FALLBACK_CATEGORIES;
        if (process.env.NODE_ENV === 'development') {
          console.warn('Category fetch failed, using the built-in list.', err);
        }
        return cache;
      });
  }
  return inflight;
}

export default function useCategories() {
  const [categories, setCategories] = useState(cache || FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    load().then((list) => {
      if (alive) {
        setCategories(list);
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, []);

  return { categories, loading };
}

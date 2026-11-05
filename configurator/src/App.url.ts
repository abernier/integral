/**
 * The address bar as a projection of the configurator's state: it follows the panel, so that a reload, Back and
 * Forward, and a copied address bar all give the same part with the same values. The parameters themselves come from
 * App.query.ts (`changedParams`), the one serialisation of the state, read back by `withQueryValues`.
 *
 * Replaced, never pushed: a slider is not a page, and Back leaves the configurator instead of stepping through every
 * drag. In the docs site's iframe this matters twice: an entry pushed by the iframe joins the docs page's own history,
 * so that its Back button would rewind the sliders before leaving the page. A replace only rewrites the iframe's
 * current entry; the docs page's URL is never touched.
 * @module
 */
import { useEffect } from 'react'
import { useDebounceValue } from 'usehooks-ts'

/** How long the panel stays still before the address bar follows: a drag writes once, when it pauses. */
const URL_DEBOUNCE_MS = 250

/** The address for `params`, on the current page: its path and hash kept, its query replaced. */
export function syncedUrl(current: { pathname: string; hash: string }, params: URLSearchParams): string {
  const search = String(params)
  return `${current.pathname}${search && `?${search}`}${current.hash}`
}

/** Keeps the address bar on `params` (`changedParams`, App.query.ts), by `history.replaceState`, once they stay still. */
export function useSyncedUrl(params: URLSearchParams) {
  const [search] = useDebounceValue(String(params), URL_DEBOUNCE_MS)
  useEffect(() => {
    const url = syncedUrl(location, new URLSearchParams(search))
    if (url === `${location.pathname}${location.search}${location.hash}`) return
    history.replaceState(history.state, '', url)
  }, [search])
}

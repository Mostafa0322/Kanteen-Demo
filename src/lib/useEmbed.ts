/** `?embed=1` hides global chrome (banner, demo panel) when a view runs inside the split-screen demo. */
export function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('embed') || window.self !== window.top;
}

export const prismOpenedKey = 'dsh-prism:opened'
export const dshHome = '/?dsh=1'

export const openPrismOnLoad = `(() => {
  if (location.pathname !== '/' || location.search || location.hash ||
      performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
    return;
  }
  try {
    if (localStorage.getItem(${JSON.stringify(prismOpenedKey)}) !== '1') {
      return;
    }
  } catch {
    return;
  }
  location.replace('/prism');
})();`

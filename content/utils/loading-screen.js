/* DEPRECATED: Central LoadingScreen removed. Export a minimal no-op API for compatibility. */

const LoadingScreen = {
  init() {},
  requestShow() { return 0 },
  release() { return 0 },
  forceHide() {},
  getOwnerCount() { return 0 }
}

export default LoadingScreen
export {LoadingScreen}

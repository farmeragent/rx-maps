/**
 * Patch for luma.gl v9.2.x bug where device.limits is accessed before initialization
 *
 * Bug: WebGLCanvasContext's ResizeObserver fires before WebGLDevice.limits is initialized,
 * causing "Cannot read properties of undefined (reading 'maxTextureDimension2D')" error.
 *
 * Root cause: In webgl-device.js:
 * - Line 89: new WebGLCanvasContext() sets up ResizeObserver
 * - Line 139: this.limits = new WebGLDeviceLimits() initializes limits
 *
 * This patch intercepts ResizeObserver callbacks to defer the first call.
 */

if (typeof window !== 'undefined' && !(window as any).__lumaGLPatched) {
  console.log('[luma-gl-patch] Applying device.limits initialization fix');
  (window as any).__lumaGLPatched = true;

  const OriginalResizeObserver = window.ResizeObserver;

  window.ResizeObserver = class PatchedResizeObserver extends OriginalResizeObserver {
    private _firstCall = true;

    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        // Defer the first callback to allow device.limits to initialize
        if (this._firstCall) {
          this._firstCall = false;
          console.log('[luma-gl-patch] Deferring first ResizeObserver callback');
          setTimeout(() => {
            try {
              callback(entries, observer);
            } catch (err) {
              console.error('[luma-gl-patch] Deferred callback error:', err);
            }
          }, 0);
        } else {
          callback(entries, observer);
        }
      });
    }
  } as any;
}

export {};

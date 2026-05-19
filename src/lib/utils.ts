export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const effectiveMs = Math.max(ms, 15000);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // Swallow the original promise to avoid unhandled rejections after timeout
      promise.then(() => {}).catch(() => {});
      reject(new Error('Timeout'));
    }, effectiveMs);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}
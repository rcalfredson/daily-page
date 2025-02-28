class RequestHelper {
  static throttle(func, delay) {
    let lastCall = 0;
    let timeout = null;

    return (...args) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= delay) {
        lastCall = now;
        func(...args);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastCall = Date.now();
          func(...args);
          timeout = null;
        }, delay - timeSinceLastCall);
      }
    };
  }
}

export default RequestHelper;

const { throttle } = require('../content/webentwicklung/main.js');

describe('throttle', () => {
  jest.useFakeTimers();

  test('limits function calls to once per interval', () => {
    const callback = jest.fn();
    const throttled = throttle(callback, 100);

    throttled();
    throttled();
    throttled();
    expect(callback).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    throttled();
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

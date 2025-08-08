const { debounce } = require('../content/webentwicklung/main.js');

describe('debounce', () => {
  jest.useFakeTimers();

  test('executes the callback only after the wait time', () => {
    const callback = jest.fn();
    const debounced = debounce(callback, 100);

    debounced();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

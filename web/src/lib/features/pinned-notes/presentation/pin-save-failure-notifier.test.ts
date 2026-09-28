import { describe, expect, it, vi } from 'vitest';
import { createPinSaveFailureNotifier } from './pin-save-failure-notifier';

describe('createPinSaveFailureNotifier', () => {
	it('does not notify without a failure', () => {
		const notify = vi.fn();
		const notifyFailure = createPinSaveFailureNotifier(notify);

		notifyFailure(undefined);

		expect(notify).not.toHaveBeenCalled();
	});

	it('notifies each failure revision once regardless of stage', () => {
		const notify = vi.fn();
		const notifyFailure = createPinSaveFailureNotifier(notify);

		notifyFailure({ stage: 'fetching', error: new Error('fetch'), revision: 1 });
		expect(notify).toHaveBeenCalledTimes(1);

		notifyFailure({ stage: 'fetching', error: new Error('fetch'), revision: 1 });
		notifyFailure(undefined);
		expect(notify).toHaveBeenCalledTimes(1);

		notifyFailure({ stage: 'signing', error: new Error('sign'), revision: 2 });
		notifyFailure({ stage: 'publishing', error: new Error('publish'), revision: 3 });
		expect(notify).toHaveBeenCalledTimes(3);
		expect(notify).toHaveBeenCalledWith();
	});
});

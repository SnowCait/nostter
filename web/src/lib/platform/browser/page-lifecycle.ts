interface DiscardableDocument extends Document {
	wasDiscarded?: boolean;
}

function log(event: string, details?: unknown): void {
	if (details === undefined) {
		console.debug('[lifecycle]', new Date().toLocaleString(), event);
		return;
	}

	console.debug('[lifecycle]', new Date().toLocaleString(), event, details);
}

function wasDiscarded(): boolean | undefined {
	if (!('wasDiscarded' in document)) {
		return undefined;
	}

	return (document as DiscardableDocument).wasDiscarded;
}

export function observePageLifecycle(
	onEvent: (event: Event) => void,
	onForegroundChange?: (foreground: boolean) => void
): () => void {
	if (typeof document === 'undefined' || typeof window === 'undefined') {
		return () => {};
	}

	let foreground = document.visibilityState === 'visible';
	onForegroundChange?.(foreground);
	const notify = (event: Event) => {
		let next = foreground;
		if (event.type === 'freeze' || event.type === 'pagehide') {
			next = false;
		} else if (event.type === 'visibilitychange') {
			next = document.visibilityState === 'visible';
		} else if (document.visibilityState === 'hidden') {
			next = false;
		} else if (document.hasFocus()) {
			// Auxiliary events alone cannot establish visibility after a stop.
			next = true;
		}
		if (next !== foreground) {
			foreground = next;
			onForegroundChange?.(foreground);
		}
		// Focus is an auxiliary trigger for foreground detection only.
		if (event.type !== 'focus') {
			onEvent(event);
		}
	};
	const onFreeze = (event: Event) => {
		log('freeze');
		notify(event);
	};
	const onResume = (event: Event) => {
		log('resume');
		notify(event);
	};
	const onVisibilityChange = (event: Event) => {
		log('visibilitychange', document.visibilityState);
		notify(event);
	};
	const onPageHide = (event: PageTransitionEvent) => {
		log('pagehide', { persisted: event.persisted });
		notify(event);
	};
	const onPageShow = (event: PageTransitionEvent) => {
		log('pageshow', { persisted: event.persisted });
		notify(event);
	};

	log('init', {
		visibilityState: document.visibilityState,
		wasDiscarded: wasDiscarded()
	});

	document.addEventListener('freeze', onFreeze);
	document.addEventListener('resume', onResume);
	document.addEventListener('visibilitychange', onVisibilityChange);
	window.addEventListener('pagehide', onPageHide);
	window.addEventListener('pageshow', onPageShow);
	window.addEventListener('focus', notify);

	return () => {
		document.removeEventListener('freeze', onFreeze);
		document.removeEventListener('resume', onResume);
		document.removeEventListener('visibilitychange', onVisibilityChange);
		window.removeEventListener('pagehide', onPageHide);
		window.removeEventListener('pageshow', onPageShow);
		window.removeEventListener('focus', notify);
	};
}

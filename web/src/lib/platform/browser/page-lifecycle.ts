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

export function observePageLifecycle(onEvent: (event: Event) => void): () => void {
	const onFreeze = (event: Event) => {
		log('freeze');
		onEvent(event);
	};
	const onResume = (event: Event) => {
		log('resume');
		onEvent(event);
	};
	const onVisibilityChange = (event: Event) => {
		log('visibilitychange', document.visibilityState);
		onEvent(event);
	};
	const onPageHide = (event: PageTransitionEvent) => {
		log('pagehide', { persisted: event.persisted });
		onEvent(event);
	};
	const onPageShow = (event: PageTransitionEvent) => {
		log('pageshow', { persisted: event.persisted });
		onEvent(event);
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

	return () => {
		document.removeEventListener('freeze', onFreeze);
		document.removeEventListener('resume', onResume);
		document.removeEventListener('visibilitychange', onVisibilityChange);
		window.removeEventListener('pagehide', onPageHide);
		window.removeEventListener('pageshow', onPageShow);
	};
}

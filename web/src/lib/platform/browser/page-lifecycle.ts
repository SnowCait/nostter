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

export function observePageLifecycle(): () => void {
	const onFreeze = () => log('freeze');
	const onResume = () => log('resume');
	const onVisibilityChange = () => log('visibilitychange', document.visibilityState);
	const onPageHide = (event: PageTransitionEvent) =>
		log('pagehide', { persisted: event.persisted });
	const onPageShow = (event: PageTransitionEvent) =>
		log('pageshow', { persisted: event.persisted });

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

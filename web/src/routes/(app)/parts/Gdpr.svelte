<script lang="ts">
	import { _ } from 'svelte-i18n';
	import '@beyonk/gdpr-cookie-consent-banner/banner.css';
	import GdprBanner from '@beyonk/gdpr-cookie-consent-banner';

	const choices = {
		necessary: {
			label: $_('gdpr.necessary.label'),
			description: $_('gdpr.necessary.description'),
			value: true
		},
		tracking: false,
		analytics: {
			label: $_('gdpr.analytics.label'),
			description: $_('gdpr.analytics.description'),
			value: true
		},
		marketing: false
	};

	function initAnalytics() {
		console.debug('[analytics init]');

		window.dataLayer = window.dataLayer || [];
		function gtag() {
			dataLayer.push(arguments);
		}
		gtag('js', new Date());

		gtag('config', 'G-G1WMSV0PBP');
	}
</script>

<GdprBanner
	cookieName="beyonk_gdpr"
	heading={$_('gdpr.heading')}
	description={$_('gdpr.description')}
	acceptLabel={$_('gdpr.accept_label')}
	settingsLabel={$_('gdpr.settings_label')}
	closeLabel={$_('gdpr.close_label')}
	showEditIcon={false}
	{choices}
	on:analytics={initAnalytics}
/>

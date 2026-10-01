import { browser } from '$app/environment';
import { createWebSocketMetrics } from 'websocket-metrics';

// The collector lives for the page lifetime; SSR must not instantiate it.
const collector = browser ? createWebSocketMetrics() : undefined;

export const MetricsWebSocket = collector?.WebSocket;
export const metrics = collector?.metrics;

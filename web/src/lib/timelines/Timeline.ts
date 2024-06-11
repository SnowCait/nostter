export interface Timeline {
	subscribe(): void;
	unsubscribe(): void;
	load(): Promise<void>;
}

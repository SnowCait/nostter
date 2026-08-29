class BookmarkCopyState {
	#normalWriteInProgress = $state(false);
	#copyInProgress = $state(false);

	get inProgress(): boolean {
		return this.#copyInProgress;
	}

	get canStart(): boolean {
		return !this.#normalWriteInProgress && !this.#copyInProgress;
	}

	beginNormalWrite(): void {
		this.#normalWriteInProgress = true;
	}

	endNormalWrite(): void {
		this.#normalWriteInProgress = false;
	}

	beginCopy(): void {
		this.#copyInProgress = true;
	}

	endCopy(): void {
		this.#copyInProgress = false;
	}
}

export const bookmarkCopyState = new BookmarkCopyState();

export class Queue<T> {
	#list: T[] = [];

	get length(): number {
		return this.#list.length;
	}

	enqueue(data: T): void {
		this.#list.push(data);
	}

	dequeue(): T | undefined {
		return this.#list.shift();
	}

	dump(): T[] {
		return this.#list;
	}
}

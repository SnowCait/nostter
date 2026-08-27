import {
	createLocalAttachments,
	revokeAttachments,
	uploadLocalAttachments,
	type LocalAttachment
} from './LocalAttachment';

export class LocalAttachments {
	attachments = $state<LocalAttachment[]>([]);

	get hasAttachments(): boolean {
		return this.attachments.length > 0;
	}

	uploading = $derived(this.attachments.some(({ state }) => state === 'uploading'));

	add(files: FileList | File[]): void {
		this.attachments = [...this.attachments, ...createLocalAttachments(files)];
	}

	remove(attachment: LocalAttachment): void {
		URL.revokeObjectURL(attachment.previewUrl);
		this.attachments = this.attachments.filter((candidate) => candidate !== attachment);
	}

	clear(): void {
		revokeAttachments(this.attachments);
		this.attachments = [];
	}

	async retry(attachment: LocalAttachment): Promise<void> {
		if (attachment.state !== 'failed') return;
		await uploadLocalAttachments([attachment]);
	}

	async upload(): Promise<string[] | undefined> {
		return await uploadLocalAttachments([...this.attachments]);
	}

	dispose(): void {
		this.clear();
	}
}

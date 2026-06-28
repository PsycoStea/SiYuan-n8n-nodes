import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { NodeApiError, JsonObject, JsonValue } from 'n8n-workflow';
import { getSuggestionForError } from './errors';

import type {
	SiYuanResponse,
	SiYuanNotebookInfo,
	SiYuanNotebookConf,
	SiYuanDirEntry,
	ListedDocument,
	SiYuanChildBlockInfo,
	ExportedDocMd,
	BlockOperationResult,
	SubDocumentNode,
	FullTextSearchResult,
	AttributeViewKeyType,
	RenderedAttributeView,
	DatabaseBlockLocator,
	DatabaseFieldInput,
} from './interfaces';

/** SiYuan's default page size for /api/av/renderAttributeView rows. */
const DEFAULT_PAGE_SIZE = 50;
/** Page size used when paging through all rows of a database (issue #24). */
const ALL_ROWS_PAGE_SIZE = 100;
/** Safety cap on total rows fetched by renderDatabaseAllRows to avoid runaway paging. */
const MAX_ALL_ROWS = 100000;

/** Generate a SiYuan-style ID: YYYYMMDDhhmmss-{7 lowercase alnum}. */
function siyuanId(): string {
	const now = new Date();
	const pad = (n: number, w = 2) => String(n).padStart(w, '0');
	const ts =
		now.getFullYear().toString() +
		pad(now.getMonth() + 1) +
		pad(now.getDate()) +
		pad(now.getHours()) +
		pad(now.getMinutes()) +
		pad(now.getSeconds());
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let suffix = '';
	for (let i = 0; i < 7; i++) {
		suffix += chars[Math.floor(Math.random() * chars.length)];
	}
	return `${ts}-${suffix}`;
}

/** Extract the data-av-id attribute from a NodeAttributeView block's HTML. */
function extractAvIdFromMarkdown(markdown: string): string | null {
	const match = markdown.match(/data-av-id="([^"]+)"/);
	return match ? match[1] : null;
}

/** Build the value object SiYuan expects for a cell of the given type. */
function buildCellValue(
	cellID: string,
	keyID: string,
	rowID: string,
	keyType: string,
	rawValue: unknown,
): Record<string, unknown> {
	const base: Record<string, unknown> = { id: cellID, keyID, blockID: rowID, type: keyType };
	switch (keyType) {
		case 'block': {
			const content = rawValue === null || rawValue === undefined ? '' : String(rawValue);
			return { ...base, isDetached: true, block: { content } };
		}
		case 'text': {
			const content = rawValue === null || rawValue === undefined ? '' : String(rawValue);
			return { ...base, text: { content } };
		}
		case 'number': {
			const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
			return { ...base, number: { content: Number.isFinite(num) ? num : 0, isNotEmpty: true } };
		}
		case 'checkbox': {
			const checked = rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1';
			return { ...base, checkbox: { checked } };
		}
		case 'url': {
			return { ...base, url: { content: String(rawValue ?? '') } };
		}
		case 'email': {
			return { ...base, email: { content: String(rawValue ?? '') } };
		}
		case 'phone': {
			return { ...base, phone: { content: String(rawValue ?? '') } };
		}
		case 'date': {
			const asNumber = typeof rawValue === 'number' ? rawValue : Date.parse(String(rawValue));
			return { ...base, date: { content: Number.isFinite(asNumber) ? asNumber : 0, isNotEmpty: true } };
		}
		case 'select': {
			const content = String(rawValue ?? '');
			return { ...base, mSelect: content ? [{ content, color: '1' }] : [] };
		}
		case 'mSelect': {
			const values = Array.isArray(rawValue)
				? rawValue
				: String(rawValue ?? '')
						.split(',')
						.map((s) => s.trim())
						.filter(Boolean);
			return {
				...base,
				mSelect: values.map((v: unknown) => ({ content: String(v), color: '1' })),
			};
		}
		default:
			return { ...base, text: { content: String(rawValue ?? '') } };
	}
}

/**
 * Inverse of buildCellValue: given a typed cell value object from renderAttributeView
 * and the column type, return a plain JS scalar/array for downstream consumption.
 */
export function extractTypedCellValue(value: Record<string, unknown> | undefined, type: string): unknown {
	if (!value) return null;
	const get = (k: string): Record<string, unknown> | undefined =>
		value[k] as Record<string, unknown> | undefined;
	switch (type) {
		case 'text':
			return (get('text')?.content as string) ?? null;
		case 'block':
			return (get('block')?.content as string) ?? null;
		case 'number':
			return (get('number')?.content as number) ?? null;
		case 'checkbox':
			return Boolean(get('checkbox')?.checked);
		case 'url':
			return (get('url')?.content as string) ?? null;
		case 'email':
			return (get('email')?.content as string) ?? null;
		case 'phone':
			return (get('phone')?.content as string) ?? null;
		case 'date': {
			const ts = get('date')?.content as number | undefined;
			return typeof ts === 'number' && ts > 0 ? new Date(ts).toISOString() : null;
		}
		case 'select':
		case 'mSelect': {
			const arr = value.mSelect as Array<{ content: string }> | undefined;
			if (!arr || arr.length === 0) return type === 'select' ? null : [];
			const contents = arr.map((s) => s.content);
			return type === 'select' ? contents[0] : contents;
		}
		default:
			// Unknown type — return the raw value object so the user can extract what they need
			return value;
	}
}

export class SiYuanClient {
	private readonly client: AxiosInstance;

	constructor(baseURL: string, apiToken: string) {
		const cleanURL = baseURL.replace(/\/+$/, '');
		this.client = axios.create({
			baseURL: cleanURL,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Token ${apiToken}`,
			},
			timeout: 30000,
		});
	}

	// ---------------------------------------------------------------------------
	// Core request handler
	// ---------------------------------------------------------------------------

	/**
	 * Makes a POST request to the SiYuan API and returns the `data` field.
	 *
	 * Transient "indexing" responses are retried with exponential backoff. Right
	 * after a notebook is opened, SiYuan is still rebuilding its block index, so
	 * filetree endpoints (e.g. getPathByID, used by Get Document Tree) reject with
	 * `{ code: -1, msg: "indexing" }` until the index settles. Retrying here lets
	 * Open → Get Document Tree succeed without a manual Wait node and adapts to a
	 * loaded system (see issue #22). The retry is keyed on the message text, NOT on
	 * `code === -1`, because SiYuan also returns -1 for permanent errors such as
	 * auth failure — retrying those would mask the real error and waste time.
	 */
	private async request<T = unknown>(endpoint: string, payload: object = {}): Promise<T> {
		const maxAttempts = 10;
		let delayMs = 200;

		for (let attempt = 1; ; attempt++) {
			try {
				const response: AxiosResponse<SiYuanResponse<T>> = await this.client.post(
					endpoint,
					payload,
				);
				const body = response.data;

				if (body.code !== 0) {
					const errorMsg = body.msg || 'Unknown error';

					// Transient: SiYuan kernel is still indexing — back off and retry.
					if (/indexing/i.test(errorMsg) && attempt < maxAttempts) {
						await new Promise((resolve) => setTimeout(resolve, delayMs));
						delayMs = Math.min(delayMs * 2, 3000);
						continue;
					}

					const suggestion = getSuggestionForError(errorMsg);
					throw new NodeApiError(
						null as any,
						{
							code: body.code,
							msg: errorMsg,
							data: body.data as unknown as JsonValue,
							endpoint,
							suggestion,
							payload: payload as JsonObject,
						},
						{
							message: `SiYuan API Error (${endpoint}): ${errorMsg} (Code: ${body.code}). ${suggestion}`,
						},
					);
				}

				return body.data;
			} catch (error) {
				if (error instanceof NodeApiError) {
					throw error;
				}
				if (axios.isAxiosError(error)) {
					const msg = error.response?.data?.msg || error.message;
					const code = error.response?.data?.code || error.response?.status || 'NetworkError';
					let suggestion: string;

					if (error.code === 'ECONNREFUSED') {
						suggestion =
							'SiYuan does not appear to be running. Start SiYuan and verify the API URL in your credentials.';
					} else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
						suggestion =
							'The request timed out. Check that SiYuan is running and the API URL is correct.';
					} else if (error.response?.status === 401 || error.response?.status === 403) {
						suggestion =
							'Authentication failed. Check your API token in the SiYuan credential settings.';
					} else {
						suggestion = getSuggestionForError(msg);
					}

					throw new NodeApiError(
						null as any,
						{
							...(error.response?.data || { message: error.message }),
							endpoint,
							suggestion,
						},
						{
							message: `SiYuan Request Failed (${endpoint}): ${msg} (Code: ${code}). ${suggestion}`,
						},
					);
				}
				const errMsg = (error as Error).message;
				const suggestion = getSuggestionForError(errMsg);
				throw new NodeApiError(
					null as any,
					{ message: errMsg, endpoint, suggestion },
					{
						message: `Unexpected error (${endpoint}): ${errMsg}. ${suggestion}`,
					},
				);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Connection test
	// ---------------------------------------------------------------------------

	/** Verifies the API URL and token are valid by calling /api/system/version. */
	async testConnection(): Promise<string> {
		return this.request<string>('/api/system/version');
	}

	// ---------------------------------------------------------------------------
	// Notebook operations
	// ---------------------------------------------------------------------------

	/** Creates a new notebook and returns its metadata. */
	async createNotebook(name: string): Promise<SiYuanNotebookInfo> {
		const res = await this.request<{ notebook: SiYuanNotebookInfo }>(
			'/api/notebook/createNotebook',
			{ name },
		);
		return res.notebook;
	}

	/** Renames an existing notebook. */
	async renameNotebook(notebookId: string, newName: string): Promise<null> {
		return this.request<null>('/api/notebook/renameNotebook', {
			notebook: notebookId,
			name: newName,
		});
	}

	/** Permanently deletes a notebook and all its contents. */
	async removeNotebook(notebookId: string): Promise<null> {
		return this.request<null>('/api/notebook/removeNotebook', { notebook: notebookId });
	}

	/** Returns a list of all notebooks. */
	async listNotebooks(): Promise<SiYuanNotebookInfo[]> {
		const res = await this.request<{ notebooks: SiYuanNotebookInfo[] }>(
			'/api/notebook/lsNotebooks',
			{},
		);
		return res.notebooks || [];
	}

	/** Opens a closed notebook so its contents become accessible. */
	async openNotebook(notebookId: string): Promise<null> {
		return this.request<null>('/api/notebook/openNotebook', { notebook: notebookId });
	}

	/** Closes an open notebook, hiding its contents. */
	async closeNotebook(notebookId: string): Promise<null> {
		return this.request<null>('/api/notebook/closeNotebook', { notebook: notebookId });
	}

	/** Returns the configuration for a notebook. */
	async getNotebookConf(
		notebookId: string,
	): Promise<{ box: string; conf: SiYuanNotebookConf; name: string }> {
		return this.request<{ box: string; conf: SiYuanNotebookConf; name: string }>(
			'/api/notebook/getNotebookConf',
			{ notebook: notebookId },
		);
	}

	/** Updates the configuration for a notebook. */
	async setNotebookConf(
		notebookId: string,
		conf: Partial<SiYuanNotebookConf>,
	): Promise<SiYuanNotebookConf> {
		return this.request<SiYuanNotebookConf>('/api/notebook/setNotebookConf', {
			notebook: notebookId,
			conf,
		});
	}

	// ---------------------------------------------------------------------------
	// Document operations
	// ---------------------------------------------------------------------------

	/** Creates a document with Markdown content at the given path inside a notebook. */
	async createDocWithMd(notebookId: string, path: string, markdown: string): Promise<string> {
		return this.request<string>('/api/filetree/createDocWithMd', {
			notebook: notebookId,
			path,
			markdown,
		});
	}

	/** Renames a document by its ID. */
	async renameDocByID(docId: string, title: string): Promise<null> {
		return this.request<null>('/api/filetree/renameDocByID', { id: docId, title });
	}

	/** Permanently removes a document by its ID. */
	async removeDocByID(docId: string): Promise<null> {
		return this.request<null>('/api/filetree/removeDocByID', { id: docId });
	}

	/** Moves one or more documents to a new parent (notebook or document). */
	async moveDocsByID(fromIDs: string[], toID: string): Promise<null> {
		return this.request<null>('/api/filetree/moveDocsByID', { fromIDs, toID });
	}

	/** Finds document IDs by their human-readable path within a notebook. */
	async getIDsByHPath(path: string, notebookId: string): Promise<string[]> {
		return this.request<string[]>('/api/filetree/getIDsByHPath', {
			path,
			notebook: notebookId,
		});
	}

	/** Returns the human-readable path for a document by its ID. */
	async getHPathByID(id: string): Promise<string> {
		return this.request<string>('/api/filetree/getHPathByID', { id });
	}

	/** Exports a document's Markdown content along with its human-readable path. */
	async exportDocMd(documentId: string): Promise<ExportedDocMd> {
		return this.request<ExportedDocMd>('/api/export/exportMdContent', { id: documentId });
	}

	/** Lists documents in a notebook (enriched with titles from block attributes). */
	async listDocsInNotebook(notebookId: string): Promise<ListedDocument[]> {
		const constructedPath = `/data/${notebookId}`;
		const entries = await this.request<SiYuanDirEntry[]>('/api/file/readDir', {
			path: constructedPath,
		});

		const documents: ListedDocument[] = [];
		if (entries && Array.isArray(entries)) {
			for (const entry of entries) {
				if (!entry.isDir && entry.name.endsWith('.sy')) {
					const docId = entry.name.replace(/\.sy$/, '');
					let title = docId;
					try {
						const attrs = await this.getBlockAttrs(docId);
						if (attrs && typeof attrs.title === 'string' && attrs.title) {
							title = attrs.title;
						}
					} catch {
						// Continue with ID as title if attributes can't be fetched
					}
					documents.push({
						id: docId,
						name: entry.name,
						title,
						updated: entry.updated,
						isDir: entry.isDir,
						isSymlink: entry.isSymlink,
					});
				}
			}
		}
		return documents;
	}

	/**
	 * Returns the internal storage path + notebook for a document by its ID.
	 * SiYuan kernel returns an object — earlier versions of this client mistyped it as a string,
	 * which broke `buildDocTree` when callers tried `.replace()` on the response (see issue #9).
	 */
	async getPathByID(id: string): Promise<{ notebook: string; path: string }> {
		return this.request<{ notebook: string; path: string }>('/api/filetree/getPathByID', { id });
	}

	/** Returns block lineage (rootID, box, path, rootTitle) for a block. */
	async getBlockInfo(
		id: string,
	): Promise<{ box: string; path: string; rootID: string; rootChildID: string; rootIcon: string; rootTitle: string }> {
		return this.request('/api/block/getBlockInfo', { id });
	}

	/** Converts a storage path to a human-readable path within a notebook. */
	async getHPathByPath(notebookId: string, path: string): Promise<string> {
		return this.request<string>('/api/filetree/getHPathByPath', {
			notebook: notebookId,
			path,
		});
	}

	/** Returns a document's full content as markdown (convenience wrapper around exportDocMd). */
	async getDocContent(documentId: string): Promise<string> {
		const exported = await this.exportDocMd(documentId);
		return exported.content;
	}

	/** Returns a tree of child documents (sub-documents) nested under a document. */
	async getDocumentTree(documentId: string, maxDepth: number = 5): Promise<SubDocumentNode[]> {
		const buildDocTree = async (docId: string, depth: number): Promise<SubDocumentNode[]> => {
			if (depth >= maxDepth) return [];

			// getPathByID returns { notebook, path } where path is e.g. "/docId.sy" relative to the notebook.
			// The file system path is `/data/<notebook>/<path>` — strip the trailing .sy to get the
			// directory that holds child documents (SiYuan stores sub-docs as <parent-id>/<child-id>.sy).
			const { notebook, path } = await this.getPathByID(docId);
			const dirPath = `/data/${notebook}${path}`.replace(/\.sy$/, '');

			let entries: SiYuanDirEntry[] = [];
			try {
				entries = await this.request<SiYuanDirEntry[]>('/api/file/readDir', { path: dirPath });
			} catch {
				return []; // Document has no children
			}

			const nodes: SubDocumentNode[] = [];
			for (const entry of entries) {
				if (!entry.isDir && entry.name.endsWith('.sy')) {
					const childId = entry.name.replace(/\.sy$/, '');
					let title = childId;
					let hPath = '';
					try {
						const attrs = await this.getBlockAttrs(childId);
						if (attrs?.title) title = attrs.title;
						hPath = await this.getHPathByID(childId);
					} catch {
						// Fall back to ID as title if attributes can't be fetched
					}

					nodes.push({
						id: childId,
						title,
						hPath,
						updated: entry.updated,
						children: await buildDocTree(childId, depth + 1),
					});
				}
			}
			return nodes;
		};

		return buildDocTree(documentId, 0);
	}

	// ---------------------------------------------------------------------------
	// Block operations
	// ---------------------------------------------------------------------------

	/** Appends a block to the end of a parent block. */
	async appendBlock(
		parentID: string,
		data: string,
		dataType: 'markdown' | 'dom' = 'markdown',
	): Promise<BlockOperationResult[]> {
		return this.request<BlockOperationResult[]>('/api/block/appendBlock', {
			parentID,
			data,
			dataType,
		});
	}

	/** Prepends a block to the beginning of a parent block. */
	async prependBlock(
		parentID: string,
		data: string,
		dataType: 'markdown' | 'dom' = 'markdown',
	): Promise<BlockOperationResult[]> {
		return this.request<BlockOperationResult[]>('/api/block/prependBlock', {
			parentID,
			data,
			dataType,
		});
	}

	/** Inserts a block relative to other blocks (before/after or as child). */
	async insertBlock(
		data: string,
		dataType: 'markdown' | 'dom' = 'markdown',
		previousID?: string,
		nextID?: string,
		parentID?: string,
	): Promise<BlockOperationResult[]> {
		const payload: Record<string, string> = { data, dataType };
		if (previousID) payload.previousID = previousID;
		if (nextID) payload.nextID = nextID;
		if (parentID) payload.parentID = parentID;
		return this.request<BlockOperationResult[]>('/api/block/insertBlock', payload);
	}

	/** Replaces the content of an existing block. */
	async updateBlock(
		blockId: string,
		data: string,
		dataType: 'markdown' | 'dom' = 'markdown',
	): Promise<BlockOperationResult[]> {
		return this.request<BlockOperationResult[]>('/api/block/updateBlock', {
			id: blockId,
			data,
			dataType,
		});
	}

	/** Permanently removes a block by its ID. */
	async deleteBlock(blockId: string): Promise<BlockOperationResult[]> {
		return this.request<BlockOperationResult[]>('/api/block/deleteBlock', { id: blockId });
	}

	/** Returns a list of direct child blocks under a parent. */
	async getChildBlocks(parentBlockId: string): Promise<SiYuanChildBlockInfo[]> {
		return this.request<SiYuanChildBlockInfo[]>('/api/block/getChildBlocks', {
			id: parentBlockId,
		});
	}

	/** Returns the raw Kramdown (Markdown) source of a block. */
	async getBlockKramdown(blockId: string): Promise<{ id: string; kramdown: string }> {
		return this.request<{ id: string; kramdown: string }>('/api/block/getBlockKramdown', {
			id: blockId,
		});
	}

	/** Moves a block to a new position (after previousID or under parentID). */
	async moveBlock(blockId: string, previousID?: string, parentID?: string): Promise<null> {
		const payload: Record<string, string> = { id: blockId };
		if (previousID) payload.previousID = previousID;
		if (parentID) payload.parentID = parentID;
		return this.request<null>('/api/block/moveBlock', payload);
	}

	/** Folds (collapses) a block. */
	async foldBlock(blockId: string): Promise<null> {
		return this.request<null>('/api/block/foldBlock', { id: blockId });
	}

	/** Unfolds (expands) a block. */
	async unfoldBlock(blockId: string): Promise<null> {
		return this.request<null>('/api/block/unfoldBlock', { id: blockId });
	}

	/** Transfers block references from one block to another. */
	async transferBlockRef(fromID: string, toID: string, refIDs?: string[]): Promise<null> {
		const payload: Record<string, unknown> = { fromID, toID };
		if (refIDs && refIDs.length > 0) payload.refIDs = refIDs;
		return this.request<null>('/api/block/transferBlockRef', payload);
	}

	/** Returns a block's content as clean markdown (convenience wrapper). */
	async getBlockContentMd(blockId: string): Promise<string> {
		const result = await this.getBlockKramdown(blockId);
		return result.kramdown;
	}

	// ---------------------------------------------------------------------------
	// Attribute operations
	// ---------------------------------------------------------------------------

	/** Sets custom and/or built-in attributes on a block. */
	async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<null> {
		const validatedAttrs: Record<string, string> = {};
		const builtinKeys = ['title', 'name', 'alias', 'memo', 'bookmark', 'icon'];
		for (const key in attrs) {
			if (key.startsWith('custom-') || builtinKeys.includes(key)) {
				validatedAttrs[key] = attrs[key];
			}
		}
		return this.request<null>('/api/attr/setBlockAttrs', {
			id: blockId,
			attrs: validatedAttrs,
		});
	}

	/** Returns all attributes for a block. */
	async getBlockAttrs(blockId: string): Promise<Record<string, string>> {
		return this.request<Record<string, string>>('/api/attr/getBlockAttrs', { id: blockId });
	}

	// ---------------------------------------------------------------------------
	// Tag operations
	// ---------------------------------------------------------------------------

	/** Parses a SiYuan tag string (e.g. "tag1,tag2") into an array of trimmed tags. */
	private parseTags(tagStr: string): string[] {
		if (!tagStr) return [];
		// SiYuan stores tags as comma-separated in the 'tag' attribute
		return tagStr
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	/** Serializes an array of tags back to the comma-separated string format. */
	private serializeTags(tags: string[]): string {
		return tags.join(',');
	}

	/** Adds a tag to a block. If the tag already exists, this is a no-op. */
	async addTag(blockId: string, tag: string): Promise<string[]> {
		const attrs = await this.getBlockAttrs(blockId);
		const tags = this.parseTags(attrs.tag || '');
		if (!tags.includes(tag)) {
			tags.push(tag);
		}
		await this.request<null>('/api/attr/setBlockAttrs', {
			id: blockId,
			attrs: { tag: this.serializeTags(tags) },
		});
		return tags;
	}

	/** Removes a tag from a block. Returns the remaining tags. */
	async removeTag(blockId: string, tag: string): Promise<string[]> {
		const attrs = await this.getBlockAttrs(blockId);
		const tags = this.parseTags(attrs.tag || '').filter((t) => t !== tag);
		await this.request<null>('/api/attr/setBlockAttrs', {
			id: blockId,
			attrs: { tag: this.serializeTags(tags) },
		});
		return tags;
	}

	/** Returns the list of tags on a block. */
	async getTagsForBlock(blockId: string): Promise<string[]> {
		const attrs = await this.getBlockAttrs(blockId);
		return this.parseTags(attrs.tag || '');
	}

	/** Lists all unique tags across the workspace with their block counts. */
	async listAllTags(): Promise<Array<{ tag: string; count: number }>> {
		// Query blocks that have a non-empty tag attribute via the IAL
		const rows = (await this.sqlQuery(
			"SELECT ial FROM blocks WHERE ial LIKE '%tag=%' AND ial != ''",
		)) as Array<{ ial: string }>;

		const tagCounts: Record<string, number> = {};
		for (const row of rows) {
			// Parse the tag value from the IAL string
			const match = row.ial.match(/tag="([^"]*)"/);
			if (match && match[1]) {
				const tags = this.parseTags(match[1]);
				for (const t of tags) {
					tagCounts[t] = (tagCounts[t] || 0) + 1;
				}
			}
		}

		return Object.entries(tagCounts)
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count);
	}

	/** Renames a tag across all blocks in the workspace. Returns the number of blocks updated. */
	async renameTag(oldTag: string, newTag: string): Promise<number> {
		// Find all blocks that have the old tag
		const rows = (await this.sqlQuery(
			`SELECT id, ial FROM blocks WHERE ial LIKE '%tag=%${oldTag}%'`,
		)) as Array<{ id: string; ial: string }>;

		let updatedCount = 0;
		for (const row of rows) {
			const match = row.ial.match(/tag="([^"]*)"/);
			if (match && match[1]) {
				const tags = this.parseTags(match[1]);
				if (tags.includes(oldTag)) {
					const newTags = tags.map((t) => (t === oldTag ? newTag : t));
					// Deduplicate in case newTag already existed
					const uniqueTags = [...new Set(newTags)];
					await this.request<null>('/api/attr/setBlockAttrs', {
						id: row.id,
						attrs: { tag: this.serializeTags(uniqueTags) },
					});
					updatedCount++;
				}
			}
		}
		return updatedCount;
	}

	/** Finds all blocks that have a specific tag. */
	async findBlocksByTag(tag: string): Promise<unknown[]> {
		return this.sqlQuery(
			`SELECT * FROM blocks WHERE ial LIKE '%tag=%${tag}%' ORDER BY updated DESC`,
		);
	}

	// ---------------------------------------------------------------------------
	// Search / Query operations
	// ---------------------------------------------------------------------------

	/** Executes a SQL query against the SiYuan database. */
	async sqlQuery(stmt: string): Promise<unknown[]> {
		return this.request<unknown[]>('/api/query/sql', { stmt });
	}

	/** Performs a full-text search across blocks. */
	async fullTextSearch(query: string): Promise<FullTextSearchResult> {
		return this.request<FullTextSearchResult>('/api/search/fullTextSearchBlock', {
			query,
		});
	}

	/** Searches for blocks matching an attribute name and value via SQL. */
	async searchByAttribute(attributeName: string, attributeValue: string): Promise<unknown[]> {
		const escapedName = attributeName.replace(/'/g, "''");
		const escapedValue = attributeValue.replace(/'/g, "''");
		return this.sqlQuery(
			`SELECT b.* FROM blocks b JOIN attributes a ON b.id = a.block_id WHERE a.name = '${escapedName}' AND a.value LIKE '%${escapedValue}%' ORDER BY b.updated DESC`,
		);
	}

	/** Returns recently modified blocks/documents, ordered by most recent first. */
	async getRecentChanges(limit: number = 50, since?: string): Promise<unknown[]> {
		let stmt = `SELECT * FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT ${limit}`;
		if (since) {
			stmt = `SELECT * FROM blocks WHERE type = 'd' AND updated >= '${since.replace(/'/g, "''")}' ORDER BY updated DESC LIMIT ${limit}`;
		}
		return this.sqlQuery(stmt);
	}

	// ---------------------------------------------------------------------------
	// Template operations
	// ---------------------------------------------------------------------------

	/** Renders a Sprig template string. */
	async renderSprig(template: string): Promise<string> {
		return this.request<string>('/api/template/renderSprig', { template });
	}

	// ---------------------------------------------------------------------------
	// Notification operations
	// ---------------------------------------------------------------------------

	/** Shows an informational toast notification in SiYuan. */
	async pushMsg(msg: string, timeout: number = 7000): Promise<{ id: string }> {
		return this.request<{ id: string }>('/api/notification/pushMsg', { msg, timeout });
	}

	/** Shows an error toast notification in SiYuan. */
	async pushErrMsg(msg: string, timeout: number = 7000): Promise<{ id: string }> {
		return this.request<{ id: string }>('/api/notification/pushErrMsg', { msg, timeout });
	}

	// ---------------------------------------------------------------------------
	// System operations
	// ---------------------------------------------------------------------------

	/** Returns the SiYuan application version string. */
	async getVersion(): Promise<string> {
		return this.request<string>('/api/system/version');
	}

	/** Returns the current server time in milliseconds. */
	async getCurrentTime(): Promise<number> {
		return this.request<number>('/api/system/currentTime');
	}

	/** Exports files and folders as a zip package. */
	async exportResources(paths: string[], name?: string): Promise<{ path: string }> {
		const payload: Record<string, unknown> = { paths };
		if (name) payload.name = name;
		return this.request<{ path: string }>('/api/export/exportResources', payload);
	}

	// ---------------------------------------------------------------------------
	// File / Directory operations
	// ---------------------------------------------------------------------------

	/** Lists files and folders in a workspace directory. */
	async listFilesInDirectory(directoryPath: string): Promise<SiYuanDirEntry[]> {
		return this.request<SiYuanDirEntry[]>('/api/file/readDir', { path: directoryPath });
	}

	/** Retrieves the content of a file from the workspace. Returns raw content string. */
	async getFile(path: string): Promise<string> {
		// getFile returns raw file content (not JSON-wrapped), so we can't use this.request()
		try {
			const response = await this.client.post(
				'/api/file/getFile',
				{ path },
				{
					responseType: 'text',
					transformResponse: [(data: string) => data],
				},
			);
			return response.data as string;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const status = error.response?.status;
				if (status === 404) {
					throw new NodeApiError(
						null as any,
						{ message: 'File not found', path },
						{
							message: `File not found: ${path}. Check the file path is correct and starts with /.`,
						},
					);
				}
				// Try to parse error response as JSON (SiYuan returns JSON for errors)
				let msg = error.message;
				try {
					const parsed = JSON.parse(error.response?.data as string);
					if (parsed.msg) msg = parsed.msg;
				} catch {
					// Not JSON, use raw message
				}
				throw new NodeApiError(
					null as any,
					{ message: msg, path },
					{ message: `SiYuan getFile error: ${msg}` },
				);
			}
			throw error;
		}
	}

	/** Creates or overwrites a file in the workspace using multipart form data. */
	async putFile(path: string, fileContent: string, isDir: boolean = false): Promise<null> {
		const boundary = `----n8nSiYuanPutFile${Date.now()}`;
		const crlf = '\r\n';

		const parts: Buffer[] = [];

		// path field
		parts.push(
			Buffer.from(
				`--${boundary}${crlf}` +
					`Content-Disposition: form-data; name="path"${crlf}${crlf}` +
					`${path}${crlf}`,
			),
		);

		// isDir field
		parts.push(
			Buffer.from(
				`--${boundary}${crlf}` +
					`Content-Disposition: form-data; name="isDir"${crlf}${crlf}` +
					`${isDir}${crlf}`,
			),
		);

		// file field
		const fileBuffer = Buffer.from(fileContent, 'utf-8');
		const fileName = path.split('/').pop() || 'file';
		parts.push(
			Buffer.from(
				`--${boundary}${crlf}` +
					`Content-Disposition: form-data; name="file"; filename="${fileName}"${crlf}` +
					`Content-Type: application/octet-stream${crlf}${crlf}`,
			),
		);
		parts.push(fileBuffer);
		parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

		const body = Buffer.concat(parts);

		const response = await this.client.post('/api/file/putFile', body, {
			headers: {
				'Content-Type': `multipart/form-data; boundary=${boundary}`,
				'Content-Length': String(body.length),
			},
			maxBodyLength: Infinity,
		});

		const responseData = response.data;
		if (responseData.code !== 0) {
			throw new NodeApiError(
				null as any,
				{ code: responseData.code, msg: responseData.msg },
				{
					message: `SiYuan API Error (/api/file/putFile): ${responseData.msg || 'Unknown error'} (Code: ${responseData.code})`,
				},
			);
		}
		return null;
	}

	/** Removes a file or directory from the workspace. */
	async removeFile(path: string): Promise<null> {
		return this.request<null>('/api/file/removeFile', { path });
	}

	/** Renames/moves a file within the workspace. */
	async renameFile(path: string, newPath: string): Promise<null> {
		return this.request<null>('/api/file/renameFile', { path, newPath });
	}

	/**
	 * Uploads an asset file to SiYuan using multipart form data.
	 * Constructs the multipart body manually to avoid external dependencies.
	 */
	async uploadAsset(
		assetsDirPath: string,
		fileBuffer: Buffer,
		fileName: string,
	): Promise<Record<string, string>> {
		const boundary = `----n8nSiYuanBoundary${Date.now()}`;
		const crlf = '\r\n';

		const parts: Buffer[] = [];

		// assetsDirPath field
		parts.push(
			Buffer.from(
				`--${boundary}${crlf}` +
					`Content-Disposition: form-data; name="assetsDirPath"${crlf}${crlf}` +
					`${assetsDirPath}${crlf}`,
			),
		);

		// file[] field
		parts.push(
			Buffer.from(
				`--${boundary}${crlf}` +
					`Content-Disposition: form-data; name="file[]"; filename="${fileName}"${crlf}` +
					`Content-Type: application/octet-stream${crlf}${crlf}`,
			),
		);
		parts.push(fileBuffer);
		parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

		const body = Buffer.concat(parts);

		const response = await this.client.post('/api/asset/upload', body, {
			headers: {
				'Content-Type': `multipart/form-data; boundary=${boundary}`,
				'Content-Length': String(body.length),
			},
			maxBodyLength: Infinity,
		});

		const responseData = response.data;
		if (responseData.code !== 0) {
			throw new NodeApiError(
				null as any,
				{ code: responseData.code, msg: responseData.msg },
				{
					message: `SiYuan API Error (/api/asset/upload): ${responseData.msg || 'Unknown error'} (Code: ${responseData.code})`,
				},
			);
		}
		return responseData.data?.succMap || {};
	}

	// ---------------------------------------------------------------------------
	// Database (AttributeView) operations
	// ---------------------------------------------------------------------------

	/**
	 * Resolves the hosting block ID for a given AttributeView ID by scanning all av-typed
	 * blocks for the matching `data-av-id`. Throws if no block hosts that AV.
	 */
	async getBlockIdByAvId(avID: string): Promise<string> {
		const rows = (await this.sqlQuery(
			"SELECT id, markdown FROM blocks WHERE type = 'av'",
		)) as Array<{ id: string; markdown: string }>;

		for (const row of rows) {
			if (extractAvIdFromMarkdown(row.markdown || '') === avID) {
				return row.id;
			}
		}
		throw new Error(`No database block found for AV ID ${avID}`);
	}

	/** Lists all database (AttributeView) blocks across the workspace. */
	async listDatabaseBlocks(): Promise<DatabaseBlockLocator[]> {
		const rows = (await this.sqlQuery(
			"SELECT id, markdown, root_id, parent_id FROM blocks WHERE type = 'av'",
		)) as Array<{ id: string; markdown: string; root_id: string; parent_id: string }>;

		const out: DatabaseBlockLocator[] = [];
		for (const row of rows) {
			const avID = extractAvIdFromMarkdown(row.markdown || '');
			if (avID) {
				out.push({ blockID: row.id, avID, rootID: row.root_id, parentID: row.parent_id });
			}
		}
		return out;
	}

	/**
	 * Appends a new (empty) database block to a parent block. Returns the new block ID, av ID,
	 * the resolved root document ID and the database's display name. (Issue #10: the previous
	 * implementation hardcoded `rootID: ''` because the appendBlock response only carries the
	 * direct parent — we now resolve the real root via getBlockInfo.)
	 */
	async createDatabaseBlock(parentBlockID: string): Promise<DatabaseBlockLocator> {
		const dom = '<div data-type="NodeAttributeView" data-av-id="" data-av-type="table"></div>';
		const result = await this.appendBlock(parentBlockID, dom, 'dom');
		const newBlockID = result?.[0]?.doOperations?.[0]?.id;
		if (!newBlockID) {
			throw new Error('Failed to determine the new database block ID from the append response.');
		}

		const kramdown = await this.getBlockKramdown(newBlockID);
		const avID = extractAvIdFromMarkdown(kramdown.kramdown);
		if (!avID) {
			throw new Error('Failed to locate the av ID on the newly created database block.');
		}

		let rootID = '';
		let name = '';
		try {
			const info = await this.getBlockInfo(newBlockID);
			rootID = info.rootID || '';
		} catch {
			/* keep rootID empty if lookup fails — non-fatal */
		}
		try {
			const rendered = await this.request<{ name?: string }>(
				'/api/av/renderAttributeView',
				{ id: avID },
			);
			name = rendered?.name || '';
		} catch {
			/* keep name empty */
		}

		return { blockID: newBlockID, avID, rootID, parentID: parentBlockID, name };
	}

	/**
	 * Renders a single page of a database (AttributeView). SiYuan paginates
	 * `/api/av/renderAttributeView` (default page size 50); `rowCount` always reports the true
	 * total regardless of the page returned. Issue #24: requesting without page/pageSize only
	 * ever yields the first 50 rows — use renderDatabaseAllRows to fetch every row.
	 */
	async renderDatabasePage(
		avID: string,
		page = 1,
		pageSize = DEFAULT_PAGE_SIZE,
	): Promise<RenderedAttributeView> {
		const data = await this.request<{
			id: string;
			name: string;
			viewID: string;
			viewType: string;
			view: {
				id: string;
				name: string;
				columns: Array<{
					id: string;
					name: string;
					type: string;
					icon: string;
					hidden: boolean;
					desc: string;
				}>;
				rows: Array<{
					id: string;
					cells: Array<{
						id: string;
						value: { keyID: string; type: string } & Record<string, unknown>;
						valueType: string;
					}>;
				}>;
				rowCount: number;
			};
		}>('/api/av/renderAttributeView', { id: avID, page, pageSize });

		return {
			id: data.id,
			name: data.name,
			viewID: data.viewID,
			viewType: data.viewType,
			columns: data.view.columns.map((c) => ({
				id: c.id,
				name: c.name,
				type: c.type,
				icon: c.icon,
				hidden: c.hidden,
				desc: c.desc,
			})),
			rows: data.view.rows.map((r) => ({
				id: r.id,
				cells: r.cells.map((cell) => ({
					id: cell.id,
					keyID: cell.value.keyID,
					valueType: cell.valueType,
					value: cell.value as Record<string, unknown>,
				})),
			})),
			rowCount: data.view.rowCount,
		};
	}

	/**
	 * Renders the first page of a database — sufficient for schema lookups and single-row cell
	 * resolution. Back-compatible default; use renderDatabaseAllRows when every row is needed.
	 */
	async renderDatabase(avID: string): Promise<RenderedAttributeView> {
		return this.renderDatabasePage(avID, 1, DEFAULT_PAGE_SIZE);
	}

	/**
	 * Renders a database fetching ALL rows by paging through to `rowCount` (issue #24: Get
	 * previously returned at most 50 rows because only the first page was requested). The
	 * returned view carries the full row set; columns/name/etc come from the first page.
	 */
	async renderDatabaseAllRows(avID: string): Promise<RenderedAttributeView> {
		const first = await this.renderDatabasePage(avID, 1, ALL_ROWS_PAGE_SIZE);
		const rows = [...first.rows];
		let page = 1;
		while (rows.length < first.rowCount && rows.length < MAX_ALL_ROWS) {
			page++;
			const next = await this.renderDatabasePage(avID, page, ALL_ROWS_PAGE_SIZE);
			if (next.rows.length === 0) break;
			rows.push(...next.rows);
		}
		return { ...first, rows };
	}

	/**
	 * Adds a row (detached block) to a database and, optionally, sets its fields in a single
	 * batch call. Returns the new row ID and the number of fields written.
	 *
	 * Performance (issue #25): the previous version rendered the whole view before AND after the
	 * insert and then issued one render per field (via setDatabaseCell) — 3 + N renders per row,
	 * each of which SiYuan rebuilds server-side, so per-row cost grew with both table size and
	 * field count. This version keeps the robust before/after row-discovery diff (two bounded
	 * single-page renders, so a custom view sort can never misattribute fields to the wrong row)
	 * but collapses every field write into one batchSetAttributeViewBlockAttrs call — per-row
	 * cost is now flat in the number of fields.
	 */
	async addDatabaseRow(
		avID: string,
		databaseBlockID: string,
		primaryContent = '',
		fields: DatabaseFieldInput[] = [],
	): Promise<{ rowID: string; fieldsSet: number }> {
		const before = await this.renderDatabasePage(avID, 1, DEFAULT_PAGE_SIZE);
		const existingRowIDs = new Set(before.rows.map((r) => r.id));

		await this.request<null>('/api/av/addAttributeViewBlocks', {
			avID,
			blockID: databaseBlockID,
			srcs: [{ id: siyuanId(), isDetached: true, content: primaryContent }],
		});

		const after = await this.renderDatabasePage(avID, 1, DEFAULT_PAGE_SIZE);
		const newRow = after.rows.find((r) => !existingRowIDs.has(r.id));
		if (!newRow) {
			throw new Error('Row was added but could not be located on re-render.');
		}

		const fieldsSet = await this.applyBatchFields(avID, after.columns, newRow, fields);
		return { rowID: newRow.id, fieldsSet };
	}

	/**
	 * Updates fields on an existing row in a single batch call. Searches all rows (issue #24
	 * pagination) so it works for rows beyond the first page, then writes every field via one
	 * batchSetAttributeViewBlockAttrs call. Returns the number of fields written.
	 */
	async updateDatabaseRow(
		avID: string,
		rowID: string,
		fields: DatabaseFieldInput[],
	): Promise<{ fieldsSet: number }> {
		const view = await this.renderDatabaseAllRows(avID);
		const row = view.rows.find((r) => r.id === rowID);
		if (!row) {
			throw new Error(`Row ${rowID} not found in database ${avID}.`);
		}
		const fieldsSet = await this.applyBatchFields(avID, view.columns, row, fields);
		return { fieldsSet };
	}

	/**
	 * Resolves a list of field inputs against the rendered columns and the target row, builds
	 * the typed cell values, and writes them all in one batchSetAttributeViewBlockAttrs call.
	 * Returns the number of cells written (0 — a no-op — when there are no fields). Throws a
	 * helpful error naming the available columns when a name or key ID does not resolve.
	 */
	private async applyBatchFields(
		avID: string,
		columns: RenderedAttributeView['columns'],
		row: RenderedAttributeView['rows'][number],
		fields: DatabaseFieldInput[],
	): Promise<number> {
		if (!fields || fields.length === 0) return 0;

		const byId = new Map(columns.map((c) => [c.id, c]));
		const byName = new Map(columns.map((c) => [c.name, c]));

		const values = fields.map((f) => {
			let column;
			if (f.keyId) {
				column = byId.get(f.keyId);
				if (!column) {
					throw new Error(
						`Column id "${f.keyId}" not found in database. Existing column ids: ${[...byId.keys()].join(', ')}`,
					);
				}
			} else {
				column = byName.get(f.columnName as string);
				if (!column) {
					throw new Error(
						`Column "${f.columnName}" not found in database. Existing columns: ${[...byName.keys()].join(', ')}`,
					);
				}
			}
			const cell = row.cells.find((c) => c.keyID === column!.id);
			const cellID = cell ? cell.id : siyuanId();
			return {
				keyID: column.id,
				rowID: row.id,
				cellID,
				value: buildCellValue(cellID, column.id, row.id, column.type, f.value),
			};
		});

		await this.request<unknown>('/api/av/batchSetAttributeViewBlockAttrs', { avID, values });
		return values.length;
	}

	/** Removes one or more rows from a database. */
	async removeDatabaseRows(avID: string, rowIDs: string[]): Promise<null> {
		return this.request<null>('/api/av/removeAttributeViewBlocks', { avID, srcIDs: rowIDs });
	}

	/** Adds a column (key) to a database. Returns the generated keyID. */
	async addDatabaseColumn(
		avID: string,
		name: string,
		type: AttributeViewKeyType,
		previousKeyID = '',
		icon = '',
	): Promise<{ keyID: string }> {
		const keyID = siyuanId();
		await this.request<null>('/api/av/addAttributeViewKey', {
			avID,
			keyID,
			keyName: name,
			keyType: type,
			keyIcon: icon,
			previousKeyID,
		});
		return { keyID };
	}

	/** Removes a column (key) from a database. */
	async removeDatabaseColumn(avID: string, keyID: string): Promise<null> {
		return this.request<null>('/api/av/removeAttributeViewKey', { avID, keyID });
	}

	/**
	 * Sets a cell value in a database row. Resolves the cellID and the column type
	 * automatically via renderAttributeView, then builds a properly-typed value object.
	 */
	async setDatabaseCell(
		avID: string,
		rowID: string,
		keyID: string,
		value: unknown,
	): Promise<unknown> {
		const view = await this.renderDatabase(avID);
		const column = view.columns.find((c) => c.id === keyID);
		if (!column) {
			throw new Error(`Column ${keyID} not found in database ${avID}.`);
		}
		const row = view.rows.find((r) => r.id === rowID);
		if (!row) {
			throw new Error(`Row ${rowID} not found in database ${avID}.`);
		}
		const cell = row.cells.find((c) => c.keyID === keyID);
		if (!cell) {
			throw new Error(`Cell for row ${rowID} / column ${keyID} not found.`);
		}

		const builtValue = buildCellValue(cell.id, keyID, rowID, column.type, value);
		return this.request<unknown>('/api/av/setAttributeViewBlockAttr', {
			avID,
			keyID,
			rowID,
			cellID: cell.id,
			value: builtValue,
		});
	}
}

/** Standard SiYuan API response wrapper. */
export interface SiYuanResponse<T = unknown> {
	code: number;
	msg: string;
	data: T;
}

/** Notebook metadata returned by list/create operations. */
export interface SiYuanNotebookInfo {
	id: string;
	name: string;
	icon: string;
	sort: number;
	closed: boolean;
}

/** Notebook configuration from /api/notebook/getNotebookConf. */
export interface SiYuanNotebookConf {
	name: string;
	closed: boolean;
	refCreateSavePath: string;
	createDocNameTemplate: string;
	dailyNoteSavePath: string;
	dailyNoteTemplatePath: string;
	sortMode: number;
	icon: string;
	[key: string]: unknown;
}

/** Directory entry from /api/file/readDir. */
export interface SiYuanDirEntry {
	isDir: boolean;
	isSymlink: boolean;
	name: string;
	updated: number;
}

/** Document listing enriched with title from block attributes. */
export interface ListedDocument {
	id: string;
	name: string;
	title: string;
	updated: number;
	isDir: boolean;
	isSymlink: boolean;
}

/** Child block info from /api/block/getChildBlocks. */
export interface SiYuanChildBlockInfo {
	id: string;
	type: string;
	subType?: string;
}

/** Exported document markdown from /api/export/exportMdContent. */
export interface ExportedDocMd {
	hPath: string;
	content: string;
}

/** Block operation result (append/prepend/insert/update). */
export interface BlockOperationResult {
	doOperations: Array<{
		action: string;
		id: string;
		parentID: string;
		data: string;
		[key: string]: unknown;
	}>;
	undoOperations: Array<{
		action: string;
		id: string;
		[key: string]: unknown;
	}> | null;
}

/** A node in a document's block tree (returned by getDocumentTree). */
export interface DocumentTreeNode {
	id: string;
	type: string;
	subType?: string;
	kramdown: string;
	children: DocumentTreeNode[];
}

/** A node in a document's sub-document tree (returned by getDocumentTree). */
export interface SubDocumentNode {
	id: string;
	title: string;
	hPath: string;
	updated: number;
	children: SubDocumentNode[];
}

/** Full-text search result from /api/search/fullTextSearchBlock. */
export interface FullTextSearchResult {
	blocks: Array<{
		box: string;
		path: string;
		hPath: string;
		id: string;
		rootID: string;
		parentID: string;
		content: string;
		[key: string]: unknown;
	}>;
	matchedBlockCount: number;
	matchedRootCount: number;
	pageCount: number;
}

/** Structured error info for both humans and AI agents. */
export interface SiYuanErrorInfo {
	errorCode: number | string;
	message: string;
	operation: string;
	endpoint: string;
	suggestion: string;
}

/** SiYuan AttributeView column types. */
export type AttributeViewKeyType =
	| 'text'
	| 'number'
	| 'date'
	| 'select'
	| 'mSelect'
	| 'checkbox'
	| 'url'
	| 'email'
	| 'phone'
	| 'block';

/** One column in an attribute view. */
export interface AttributeViewColumn {
	id: string;
	name: string;
	type: AttributeViewKeyType | string;
	icon: string;
	hidden: boolean;
	desc: string;
}

/** One cell value in an attribute view row. */
export interface AttributeViewCell {
	id: string;
	keyID: string;
	valueType: string;
	value: Record<string, unknown>;
}

/** One row (block) in an attribute view. */
export interface AttributeViewRow {
	id: string;
	cells: AttributeViewCell[];
}

/** Rendered attribute view: schema + data. */
export interface RenderedAttributeView {
	id: string;
	name: string;
	viewID: string;
	viewType: string;
	columns: AttributeViewColumn[];
	rows: AttributeViewRow[];
	rowCount: number;
}

/**
 * A field to write into a database row. Resolve the target column either by its key
 * (column) ID (`keyId`, takes precedence) or by its display name (`columnName`).
 */
export interface DatabaseFieldInput {
	keyId?: string;
	columnName?: string;
	value: unknown;
}

/** Locator for a database block in the workspace. */
export interface DatabaseBlockLocator {
	blockID: string;
	avID: string;
	rootID: string;
	parentID: string;
	/**
	 * Display name of the av (empty string for freshly-created or unnamed databases).
	 * Populated by createDatabaseBlock and by the database.list handler (issue #12).
	 */
	name?: string;
}

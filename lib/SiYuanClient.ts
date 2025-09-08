import axios, { AxiosInstance, AxiosResponse } from 'axios'; // Removed AxiosRequestConfig
import { NodeApiError, JsonObject, JsonValue } from 'n8n-workflow';

// Interface for standard SiYuan API response structure
interface SiYuanResponse<T = any> {
	code: number;
	msg: string;
	data: T;
}

export class SiYuanClient {
	private readonly client: AxiosInstance;
	private readonly apiToken: string;

	constructor(baseURL: string, apiToken: string) {
		this.apiToken = apiToken;
		this.client = axios.create({
			baseURL: baseURL,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Token ${this.apiToken}`,
			},
			// Consider adding a reasonable timeout
			// timeout: 10000,
		});
	}

	/**
	 * Generic request handler for SiYuan API calls.
	 * Handles POST requests, error checking, and returns the 'data' part of the response.
	 */
	private async request<T = any>(endpoint: string, payload: object = {}): Promise<T> {
		try {
			const response: AxiosResponse<SiYuanResponse<T>> = await this.client.post(endpoint, payload);

			const responseData = response.data;

			// Check for API-level errors indicated by the 'code' field
			if (responseData.code !== 0) {
				// Use NodeApiError for better integration with n8n error handling
				throw new NodeApiError(
					// Assuming the node instance isn't directly available here,
					// we might need to pass it or use a generic owner.
					// For now, using a placeholder or omitting the owner.
					null as any, // Placeholder for INode node instance
					// Construct a JsonObject for the error details
					// Construct a JsonObject for the error details
					{
						code: responseData.code,
						msg: responseData.msg,
						// Cast data to unknown then JsonValue to satisfy type checker
						data: responseData.data as unknown as JsonValue,
						endpoint: endpoint,
						// Cast payload to JsonObject
						payload: payload as JsonObject,
					},
					{ message: `SiYuan API Error (${endpoint}): ${responseData.msg || 'Unknown error'} (Code: ${responseData.code})` }
				);
			}

			return responseData.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				// Handle network/axios specific errors
				const errorMessage = error.response?.data?.msg || error.message;
				const errorCode = error.response?.data?.code || error.response?.status || 'NetworkError';
				throw new NodeApiError(
					null as any, // Placeholder
					error.response?.data || { message: error.message },
					{ message: `SiYuan API Request Failed (${endpoint}): ${errorMessage} (Code: ${errorCode})` }
				);
			} else if (error instanceof NodeApiError) {
				// Re-throw NodeApiErrors if they were already created (e.g., API code != 0)
				throw error;
			} else {
				// Handle other unexpected errors
				throw new NodeApiError(
					null as any, // Placeholder
					// Create a simple JsonObject for the error details
					{ message: (error as Error).message },
					{ message: `Unexpected error during SiYuan API request (${endpoint}): ${(error as Error).message}` }
				);
			}
		}
	}

	// --- Document Operations ---

	async createDocWithMd(notebookId: string, path: string, markdown: string): Promise<string> {
		return this.request<string>('/api/filetree/createDocWithMd', { notebook: notebookId, path, markdown });
	}

	async renameDocByID(docId: string, title: string): Promise<null> {
		return this.request<null>('/api/filetree/renameDocByID', { id: docId, title });
	}

	async removeDocByID(docId: string): Promise<null> {
		return this.request<null>('/api/filetree/removeDocByID', { id: docId });
	}

	async moveDocsByID(fromIDs: string[], toID: string): Promise<null> {
		return this.request<null>('/api/filetree/moveDocsByID', { fromIDs, toID });
	}

	async getIDsByHPath(path: string, notebookId: string): Promise<string[]> {
		return this.request<string[]>('/api/filetree/getIDsByHPath', { path, notebook: notebookId });
	}

	async getHPathByID(id: string): Promise<string> {
		return this.request<string>('/api/filetree/getHPathByID', { id });
	}

	async exportDocMd(documentId: string): Promise<ExportedDocMd> {
		return this.request<ExportedDocMd>('/api/export/exportMdContent', { id: documentId });
	}

	// --- Block Operations ---

	async appendBlock(parentID: string, data: string, dataType: 'markdown' | 'dom' = 'markdown'): Promise<any> { // Consider defining a specific return type if needed
		return this.request('/api/block/appendBlock', { parentID, data, dataType });
	}

	async prependBlock(parentID: string, data: string, dataType: 'markdown' | 'dom' = 'markdown'): Promise<any> {
		return this.request('/api/block/prependBlock', { parentID, data, dataType });
	}

	async insertBlock(data: string, dataType: 'markdown' | 'dom' = 'markdown', previousID?: string, nextID?: string, parentID?: string): Promise<any> {
		const payload: any = { data, dataType };
		if (previousID) payload.previousID = previousID;
		if (nextID) payload.nextID = nextID;
		if (parentID) payload.parentID = parentID;
		return this.request('/api/block/insertBlock', payload);
	}

	async updateBlock(blockId: string, data: string, dataType: 'markdown' | 'dom' = 'markdown'): Promise<any> {
		return this.request('/api/block/updateBlock', { id: blockId, data, dataType });
	}

	async deleteBlock(blockId: string): Promise<any> {
		return this.request('/api/block/deleteBlock', { id: blockId });
	}

	async getChildBlocks(parentBlockId: string): Promise<SiYuanChildBlockInfo[]> {
		return this.request<SiYuanChildBlockInfo[]>('/api/block/getChildBlocks', { id: parentBlockId });
	}

	async getBlockKramdown(blockId: string): Promise<{ id: string; kramdown: string }> {
		return this.request<{ id: string; kramdown: string }>('/api/block/getBlockKramdown', { id: blockId });
	}

	// --- Attribute Operations ---

	async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<null> {
		// Ensure custom attributes start with 'custom-'
		const validatedAttrs: Record<string, string> = {};
		for (const key in attrs) {
			if (key.startsWith('custom-') || ['title', 'name', 'alias', 'memo', 'bookmark', 'icon'].includes(key)) { // Add other allowed built-in attrs if needed
				validatedAttrs[key] = attrs[key];
			} // Removed console.warn for attribute skipping
			// else {
				// Or throw an error if strict validation is preferred
				// throw new Error(`Invalid attribute key: '${key}'. Custom attributes must start with 'custom-'.`);
			// }
		}
		return this.request<null>('/api/attr/setBlockAttrs', { id: blockId, attrs: validatedAttrs });
	}

	async getBlockAttrs(blockId: string): Promise<Record<string, any>> {
		return this.request<Record<string, any>>('/api/attr/getBlockAttrs', { id: blockId });
	}

	// --- SQL Operations ---

	async sqlQuery(stmt: string): Promise<any[]> {
		return this.request<any[]>('/api/query/sql', { stmt });
	}

	// --- Database Operations ---

	/**
	 * Creates a database table block in SiYuan
	 * @param parentID The parent block ID where the database table should be created
	 * @param columns Array of column definitions for the database table
	 * @returns The created database block information
	 */
	async createDatabaseTable(parentID: string, columns: DatabaseColumn[]): Promise<any> {
		// Create the database table structure using Markdown table syntax
		const headerRow = '| ' + columns.map(col => col.name).join(' | ') + ' |';
		const separatorRow = '| ' + columns.map(() => '---').join(' | ') + ' |';
		const tableMarkdown = headerRow + '\n' + separatorRow;

		return this.appendBlock(parentID, tableMarkdown, 'markdown');
	}

	/**
	 * Inserts a new row into a database table block
	 * @param tableBlockId The ID of the table block
	 * @param rowData Object containing the data for the new row
	 * @returns The result of the insert operation
	 */
	async insertDatabaseRow(tableBlockId: string, rowData: Record<string, any>): Promise<any> {
		// Get the current table content
		const tableContent = await this.getBlockKramdown(tableBlockId);

		// Parse the table and add the new row
		const lines = tableContent.kramdown.split('\n');
		const dataRow = '| ' + Object.values(rowData).join(' | ') + ' |';

		// Add the new row to the table
		const updatedContent = lines.join('\n') + '\n' + dataRow;

		return this.updateBlock(tableBlockId, updatedContent, 'markdown');
	}

	/**
	 * Updates a row in a database table block
	 * @param tableBlockId The ID of the table block
	 * @param rowIndex The index of the row to update (0-based, excluding header)
	 * @param rowData Object containing the updated data for the row
	 * @returns The result of the update operation
	 */
	async updateDatabaseRow(tableBlockId: string, rowIndex: number, rowData: Record<string, any>): Promise<any> {
		// Get the current table content
		const tableContent = await this.getBlockKramdown(tableBlockId);

		// Parse the table and update the specified row
		const lines = tableContent.kramdown.split('\n');
		const dataRow = '| ' + Object.values(rowData).join(' | ') + ' |';

		// Update the row (skip header and separator rows, so add 2 to rowIndex)
		if (lines.length > rowIndex + 2) {
			lines[rowIndex + 2] = dataRow;
			const updatedContent = lines.join('\n');
			return this.updateBlock(tableBlockId, updatedContent, 'markdown');
		} else {
			throw new Error(`Row index ${rowIndex} is out of bounds for the table`);
		}
	}

	/**
	 * Deletes a row from a database table block
	 * @param tableBlockId The ID of the table block
	 * @param rowIndex The index of the row to delete (0-based, excluding header)
	 * @returns The result of the delete operation
	 */
	async deleteDatabaseRow(tableBlockId: string, rowIndex: number): Promise<any> {
		// Get the current table content
		const tableContent = await this.getBlockKramdown(tableBlockId);

		// Parse the table and remove the specified row
		const lines = tableContent.kramdown.split('\n');

		// Check if the row index is valid (skip header and separator rows, so add 2 to rowIndex)
		const actualRowIndex = rowIndex + 2;
		if (lines.length <= actualRowIndex || actualRowIndex < 2) {
			throw new Error(`Row index ${rowIndex} is out of bounds for the table`);
		}

		// Remove the row
		lines.splice(actualRowIndex, 1);
		const updatedContent = lines.join('\n');

		return this.updateBlock(tableBlockId, updatedContent, 'markdown');
	}

	/**
	 * Queries a database table using SQL
	 * @param query SQL query to execute
	 * @returns Query results
	 */
	async queryDatabase(query: string): Promise<any[]> {
		return this.sqlQuery(query);
	}

	/**
	 * Gets database table structure and data
	 * @param tableBlockId The ID of the table block
	 * @returns Table structure and data
	 */
	async getDatabaseTable(tableBlockId: string): Promise<DatabaseTableInfo> {
		const tableContent = await this.getBlockKramdown(tableBlockId);
		const lines = tableContent.kramdown.split('\n').filter(line => line.trim());

		if (lines.length < 2) {
			throw new Error('Invalid table format');
		}

		// Parse header row to get column names
		const headerRow = lines[0];
		const columns = headerRow.split('|').slice(1, -1).map(col => col.trim());

		// Parse data rows (skip header and separator)
		const rows: Record<string, any>[] = [];
		for (let i = 2; i < lines.length; i++) {
			const rowData = lines[i].split('|').slice(1, -1).map(cell => cell.trim());
			const rowObject: Record<string, any> = {};
			columns.forEach((col, index) => {
				rowObject[col] = rowData[index] || '';
			});
			rows.push(rowObject);
		}

		return {
			id: tableBlockId,
			columns: columns.map(name => ({ name, type: 'text' })),
			rows
		};
	}

	// --- Template Operations ---

	async renderSprig(template: string): Promise<string> {
		return this.request<string>('/api/template/renderSprig', { template });
	}

	// --- Asset Operations ---
	// Note: Upload requires multipart/form-data, which needs special handling
	// This basic client structure might need adjustment or a different approach for uploads.
	// async uploadAsset(assetsDirPath: string, file: /* ??? File data type */): Promise<any> {
	//   // Requires FormData and different request config
	//   // Placeholder - Implementation needed
	// }

	// --- Notification Operations ---

	async pushMsg(msg: string, timeout: number = 7000): Promise<{ id: string }> {
		return this.request<{ id: string }>('/api/notification/pushMsg', { msg, timeout });
	}

	async pushErrMsg(msg: string, timeout: number = 7000): Promise<{ id: string }> {
		return this.request<{ id: string }>('/api/notification/pushErrMsg', { msg, timeout });
	}

	// --- System Operations ---
	async getVersion(): Promise<string> {
		return this.request<string>('/api/system/version');
	}

	// --- File/Directory Operations ---

	async listFilesInDirectory(directoryPath: string): Promise<SiYuanDirEntry[]> {
		// Ensure the path starts with a slash if it's not already the case,
		// although the API expects paths relative to workspace (e.g. /data/, /assets/)
		// For consistency, we might enforce or assume leading slash based on API behavior.
		// The API doc for /api/file/readDir implies path is "the dir path under the workspace path"
		// e.g. { "path": "/data/notebookID" }
		return this.request<SiYuanDirEntry[]>('/api/file/readDir', { path: directoryPath });
	}

	async listDocsInNotebook(notebookId: string): Promise<ListedDocument[]> {
		const constructedPath = `/data/${notebookId}`;
		const entries = await this.request<SiYuanDirEntry[]>('/api/file/readDir', { path: constructedPath });

		const documents: ListedDocument[] = [];
		if (entries && Array.isArray(entries)) {
			for (const entry of entries) {
				if (!entry.isDir && entry.name.endsWith('.sy')) {
					const docId = entry.name.replace(/\.sy$/, '');
					let title = docId; // Default title to ID
					try {
						const attrs = await this.getBlockAttrs(docId);
						if (attrs && typeof attrs.title === 'string' && attrs.title) {
							title = attrs.title;
						}
					} catch (e) {
						// Log error or handle if needed, but continue to list the doc
						// console.warn(`Could not fetch attributes for doc ${docId}: ${(e as Error).message}`);
					}
					documents.push({
						id: docId,
						name: entry.name, // Full filename
						title: title, // Human-readable title
						updated: entry.updated,
						isDir: entry.isDir,
						isSymlink: entry.isSymlink,
					});
				}
			}
		}
		return documents;
	}

	// --- Notebook Operations ---

	async createNotebook(name: string): Promise<SiYuanNotebookInfo> {
		const response = await this.request<{ notebook: SiYuanNotebookInfo }>('/api/notebook/createNotebook', { name });
		return response.notebook;
	}

	async renameNotebook(notebookId: string, newName: string): Promise<null> {
		return this.request<null>('/api/notebook/renameNotebook', { notebook: notebookId, name: newName });
	}

	async removeNotebook(notebookId: string): Promise<null> {
		return this.request<null>('/api/notebook/removeNotebook', { notebook: notebookId });
	}

	async listNotebooks(): Promise<SiYuanNotebookInfo[]> {
		const response = await this.request<{ notebooks: SiYuanNotebookInfo[] }>('/api/notebook/lsNotebooks', {});
		return response.notebooks || []; // Ensure an array is returned even if notebooks is null/undefined
	}

	// Add other methods as needed based on SiYuan API documentation...
	// e.g., getNotebookConf, exportMdContent, etc.
}

// Helper interfaces
interface SiYuanDirEntry {
	isDir: boolean;
	isSymlink: boolean;
	name: string;
	updated: number; // Unix timestamp
}

export interface ListedDocument { // Export if it needs to be used by the node for typing return values
	id: string;
	name: string; // Filename e.g. 20230101120000-abcdefg.sy
	title: string; // Human-readable title from block attributes
	updated: number;
	isDir: boolean; // Included for completeness from SiYuanDirEntry, though will be false for docs
	isSymlink: boolean; // Included for completeness
}

export interface SiYuanNotebookInfo { // Export if it needs to be used by the node for typing return values
	id: string;
	name: string; // This is the human-readable name
	icon: string;
	sort: number;
	closed: boolean;
}

export interface SiYuanChildBlockInfo {
	id: string;
	type: string; // e.g., 'p' (paragraph), 'h' (heading), 'l' (list), 'i' (list item), 'd' (document)
	subType?: string; // e.g., 'h1'-'h6' for headings, 'u' (unordered) or 'o' (ordered) for lists
	// The API might return other fields, add them as needed
}

export interface ExportedDocMd {
	hPath: string;
	content: string;
}

export interface DatabaseColumn {
	name: string;
	type: 'text' | 'number' | 'date' | 'select' | 'multiSelect' | 'checkbox' | 'url' | 'email' | 'phone';
}

export interface DatabaseTableInfo {
	id: string;
	columns: DatabaseColumn[];
	rows: Record<string, any>[];
}

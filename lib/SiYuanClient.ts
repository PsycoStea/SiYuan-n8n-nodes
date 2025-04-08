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

	// Add other methods as needed based on SiYuan API documentation...
	// e.g., listNotebooks, getNotebookConf, exportMdContent, etc.
}
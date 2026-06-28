import type { IExecuteFunctions } from 'n8n-workflow';
import type { SiYuanClient } from '../../../../lib/SiYuanClient';
import type { SiYuanNotebookConf } from '../../../../lib/interfaces';

export async function handleNotebookOperation(
	client: SiYuanClient,
	operation: string,
	ctx: IExecuteFunctions,
	itemIndex: number,
): Promise<unknown> {
	switch (operation) {
		case 'create': {
			const name = ctx.getNodeParameter('notebookName', itemIndex) as string;
			return client.createNotebook(name);
		}
		case 'list': {
			return client.listNotebooks();
		}
		case 'rename': {
			const notebookId = ctx.getNodeParameter('notebookId', itemIndex) as string;
			const newName = ctx.getNodeParameter('newName', itemIndex) as string;
			return client.renameNotebook(notebookId, newName);
		}
		case 'remove': {
			const notebookId = ctx.getNodeParameter('notebookId', itemIndex) as string;
			// SiYuan's /api/notebook/removeNotebook is idempotent — it returns success
			// (code 0) even when the notebook is already gone, so the node would report
			// success on repeated deletes (issue #23). Pre-check existence so callers can
			// distinguish a real delete from a no-op via the `found` flag.
			const notebooks = await client.listNotebooks();
			const found = notebooks.some((n) => n.id === notebookId);
			if (!found) {
				return { success: true, found: false, notebookId };
			}
			await client.removeNotebook(notebookId);
			return { success: true, found: true, notebookId };
		}
		case 'open': {
			const notebookId = ctx.getNodeParameter('notebookId', itemIndex) as string;
			return client.openNotebook(notebookId);
		}
		case 'close': {
			const notebookId = ctx.getNodeParameter('notebookId', itemIndex) as string;
			return client.closeNotebook(notebookId);
		}
		case 'getConf': {
			const notebookId = ctx.getNodeParameter('notebookId', itemIndex) as string;
			return client.getNotebookConf(notebookId);
		}
		case 'setConf': {
			const notebookId = ctx.getNodeParameter('notebookId', itemIndex) as string;
			const confInput = ctx.getNodeParameter('notebookConf', itemIndex);
			// Parse JSON string if needed (n8n json type may return string or object)
			const confChanges: Partial<SiYuanNotebookConf> =
				typeof confInput === 'string' ? JSON.parse(confInput) : confInput;
			// Get current config first, merge changes, send back the full object
			const current = await client.getNotebookConf(notebookId);
			const mergedConf = { ...current.conf, ...confChanges };
			return client.setNotebookConf(notebookId, mergedConf);
		}
		default:
			throw new Error(`Unsupported notebook operation: ${operation}`);
	}
}

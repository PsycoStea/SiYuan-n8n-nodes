import type { IExecuteFunctions } from 'n8n-workflow';
import { SiYuanClient, extractTypedCellValue } from '../../../../lib/SiYuanClient';
import type {
	AttributeViewKeyType,
	DatabaseFieldInput,
	RenderedAttributeView,
} from '../../../../lib/interfaces';

/** Build a flat {column-name → value} record for one row plus tracing metadata. */
function flattenRow(
	view: RenderedAttributeView,
	row: RenderedAttributeView['rows'][number],
): Record<string, unknown> {
	const columnsByKeyId = new Map<string, RenderedAttributeView['columns'][number]>();
	for (const c of view.columns) columnsByKeyId.set(c.id, c);

	const flat: Record<string, unknown> = { _rowId: row.id, _avId: view.id };
	for (const cell of row.cells) {
		const col = columnsByKeyId.get(cell.keyID);
		if (!col) continue;
		flat[col.name] = extractTypedCellValue(cell.value, col.type);
	}
	return flat;
}

/**
 * Apply an equality filter to a list of flat rows.
 *
 * - Scalar value: equality match (AND across keys).
 * - Array value: any-of match for that column (OR within the column).
 *
 * Examples:
 *   {"Status":"Done","Owner":"Mike"}        // AND
 *   {"Status":["Done","WIP"]}               // OR on one column
 *   {"Status":["Done","WIP"],"Owner":"Mike"} // mixed
 */
function applyFilter(rows: Record<string, unknown>[], filter: Record<string, unknown>): Record<string, unknown>[] {
	const keys = Object.keys(filter);
	if (keys.length === 0) return rows;
	return rows.filter((row) =>
		keys.every((k) => {
			const expected = filter[k];
			if (Array.isArray(expected)) return expected.some((v) => row[k] === v);
			return row[k] === expected;
		}),
	);
}

type FieldsMode = 'byNameAndValue' | 'byColumnName' | 'byKeyId';

/**
 * Read the user's field input for the selected mode into a list of `DatabaseFieldInput`
 * pairs. This does NO API calls — column-name → key-ID resolution and cell writes happen
 * once, batched, inside the client (addDatabaseRow / updateDatabaseRow), so a row write
 * costs a fixed number of renders regardless of how many fields are set (issue #25).
 *
 * - `byNameAndValue` — fixedCollection of {columnName,value} rows. The recommended default;
 *   sidesteps JSON quoting entirely so n8n expressions work in plain string fields (issue #16).
 * - `byColumnName` — JSON object {"Name": value, ...}. Useful for payloads computed in a
 *   Code/Function node.
 * - `byKeyId` — fixedCollection of {keyId,value} rows. Power-user mode.
 */
function collectRawFieldPairs(
	ctx: IExecuteFunctions,
	itemIndex: number,
	fieldsMode: FieldsMode,
): DatabaseFieldInput[] {
	if (fieldsMode === 'byKeyId') {
		const raw = ctx.getNodeParameter(
			'fieldsByKeyId.field',
			itemIndex,
			[],
		) as Array<{ keyId: string; value: string }>;
		return raw.filter((r) => r && r.keyId).map((r) => ({ keyId: r.keyId, value: r.value }));
	}

	if (fieldsMode === 'byNameAndValue') {
		const raw = ctx.getNodeParameter(
			'fieldsByNameAndValue.field',
			itemIndex,
			[],
		) as Array<{ columnName: string; value: string }>;
		return raw
			.filter((r) => r && r.columnName)
			.map((r) => ({ columnName: r.columnName, value: r.value }));
	}

	// byColumnName — JSON object input.
	const jsonRaw = ctx.getNodeParameter('fieldsByColumnName', itemIndex, '') as string;
	if (!jsonRaw || jsonRaw.trim().length === 0) return [];
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(jsonRaw);
	} catch (e) {
		throw new Error(
			`Invalid Fields JSON: ${(e as Error).message}. Expected {"Column Name": value}. ` +
				`Tip: in n8n template syntax, string values still need outer quotes — e.g. "Name":"{{ $json.name }}". ` +
				`Switch Fields Mode to "By Column Name & Value (Collection)" to skip the quoting concern entirely.`,
		);
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('Fields JSON must be an object {"Column Name": value}.');
	}
	return Object.entries(parsed).map(([columnName, value]) => ({ columnName, value }));
}

export async function handleDatabaseOperation(
	client: SiYuanClient,
	operation: string,
	ctx: IExecuteFunctions,
	itemIndex: number,
): Promise<unknown> {
	switch (operation) {
		case 'list': {
			// Issue #12c: return one n8n item per database, including the av name.
			const locators = await client.listDatabaseBlocks();
			const enriched = await Promise.all(
				locators.map(async (loc) => {
					let name = '';
					try {
						const view = await client.renderDatabase(loc.avID);
						name = view.name || '';
					} catch {
						/* leave empty */
					}
					return {
						name,
						avID: loc.avID,
						blockID: loc.blockID,
						rootID: loc.rootID,
						parentID: loc.parentID,
					};
				}),
			);
			// Returning the array directly lets n8n's returnJsonArray split it per row.
			return enriched;
		}

		case 'create': {
			const parentBlockId = ctx.getNodeParameter('parentBlockId', itemIndex) as string;
			return client.createDatabaseBlock(parentBlockId);
		}

		case 'get': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const outputMode = ctx.getNodeParameter('getOutputMode', itemIndex, 'split') as
				| 'split'
				| 'single';
			const filterRaw = ctx.getNodeParameter('getFilter', itemIndex, '') as string;

			let filter: Record<string, unknown> = {};
			if (filterRaw && filterRaw.trim().length > 0) {
				try {
					filter = JSON.parse(filterRaw);
					if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) {
						throw new Error('Filter must be a JSON object');
					}
				} catch (e) {
					throw new Error(
						`Invalid Filter JSON: ${(e as Error).message}. Expected a JSON object like {"Done": true}.`,
					);
				}
			}

			// Issue #24: fetch every row, not just the first page (SiYuan paginates at 50).
			const view = await client.renderDatabaseAllRows(avId);
			const flatRows = view.rows.map((r) => flattenRow(view, r));
			const filteredRows = applyFilter(flatRows, filter);

			if (outputMode === 'single') {
				return {
					id: view.id,
					name: view.name,
					viewID: view.viewID,
					viewType: view.viewType,
					columns: view.columns,
					rows: filteredRows,
					rowCount: filteredRows.length,
				};
			}
			// Default: split — return the array of flat rows so n8n outputs one item per row.
			return filteredRows;
		}

		case 'getSchema': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const view = await client.renderDatabase(avId);
			return {
				id: view.id,
				name: view.name,
				viewID: view.viewID,
				viewType: view.viewType,
				columns: view.columns,
			};
		}

		case 'addRow': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const databaseBlockIdRaw = ctx.getNodeParameter('databaseBlockId', itemIndex, '') as string;
			const databaseBlockId = (databaseBlockIdRaw || '').trim().length > 0
				? databaseBlockIdRaw.trim()
				: await client.getBlockIdByAvId(avId);
			const primaryContent = ctx.getNodeParameter('primaryKeyContent', itemIndex, '') as string;
			const fieldsMode = ctx.getNodeParameter('fieldsMode', itemIndex, 'byNameAndValue') as FieldsMode;
			const fields: DatabaseFieldInput[] = collectRawFieldPairs(ctx, itemIndex, fieldsMode);

			const { rowID, fieldsSet } = await client.addDatabaseRow(
				avId,
				databaseBlockId,
				primaryContent,
				fields,
			);

			return {
				avID: avId,
				databaseBlockId,
				rowID,
				primaryKeyContent: primaryContent,
				fieldsSet,
			};
		}

		case 'updateRow': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const rowId = ctx.getNodeParameter('rowId', itemIndex) as string;
			const fieldsMode = ctx.getNodeParameter('fieldsMode', itemIndex, 'byNameAndValue') as FieldsMode;
			const fields: DatabaseFieldInput[] = collectRawFieldPairs(ctx, itemIndex, fieldsMode);
			const { fieldsSet } = await client.updateDatabaseRow(avId, rowId, fields);
			return { avID: avId, rowID: rowId, fieldsSet };
		}

		case 'removeRow': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const rowId = ctx.getNodeParameter('rowId', itemIndex) as string;
			await client.removeDatabaseRows(avId, [rowId]);
			return { avID: avId, removedRowID: rowId };
		}

		case 'addColumn': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const columnName = ctx.getNodeParameter('columnName', itemIndex) as string;
			const columnType = ctx.getNodeParameter('columnType', itemIndex) as AttributeViewKeyType;
			const previousKeyId = ctx.getNodeParameter('previousKeyId', itemIndex, '') as string;
			const { keyID } = await client.addDatabaseColumn(avId, columnName, columnType, previousKeyId);
			return { avID: avId, keyID, name: columnName, type: columnType };
		}

		case 'removeColumn': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const keyId = ctx.getNodeParameter('keyId', itemIndex) as string;
			await client.removeDatabaseColumn(avId, keyId);
			return { avID: avId, removedKeyID: keyId };
		}

		case 'setCell': {
			const avId = ctx.getNodeParameter('avId', itemIndex) as string;
			const rowId = ctx.getNodeParameter('rowId', itemIndex) as string;
			const keyId = ctx.getNodeParameter('keyId', itemIndex) as string;
			const cellValue = ctx.getNodeParameter('cellValue', itemIndex, '') as string;
			const result = await client.setDatabaseCell(avId, rowId, keyId, cellValue);
			return { avID: avId, rowID: rowId, keyID: keyId, result };
		}

		default:
			throw new Error(`Unsupported database operation: ${operation}`);
	}
}

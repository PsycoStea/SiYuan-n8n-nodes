/* eslint-disable no-console */
/**
 * Integration test for the database resource (issues #9, #10, #12, #14, #16, #17, #24, #26)
 * against a live SiYuan kernel.
 *
 * Usage:
 *   SIYUAN_URL=http://10.0.0.101:6806 SIYUAN_TOKEN=... pnpm tsx tests/integration/database.test.ts
 *
 * Creates a throwaway notebook, exercises each handler, then removes the notebook.
 * Exits 0 on success, 1 on any assertion failure (no test framework — kept self-contained).
 */
import { SiYuanClient } from '../../lib/SiYuanClient';
import { handleDatabaseOperation } from '../../nodes/SiYuan/actions/database/database.handler';
import { handleDocumentOperation } from '../../nodes/SiYuan/actions/document/document.handler';

const url = process.env.SIYUAN_URL;
const token = process.env.SIYUAN_TOKEN;
if (!url || !token) {
	console.error('Set SIYUAN_URL and SIYUAN_TOKEN env vars.');
	process.exit(2);
}

const client = new SiYuanClient(url, token);

let failures = 0;
function ok(label: string) {
	console.log(`  ✓ ${label}`);
}
function fail(label: string, detail: unknown) {
	failures += 1;
	console.log(`  ✗ ${label}`);
	console.log(`     ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}
function assert(cond: unknown, label: string, detail?: unknown) {
	if (cond) ok(label);
	else fail(label, detail);
}

/**
 * Build a minimal IExecuteFunctions stub that returns the supplied parameter map.
 * Casts as any so we don't pull in the full n8n-workflow IExecuteFunctions surface.
 */
function makeCtx(params: Record<string, unknown>): any {
	return {
		getNodeParameter(name: string, _i: number, fallback?: unknown): unknown {
			if (name in params) return params[name];
			return fallback;
		},
	};
}

async function main() {
	const notebookName = `n8n-test-${Date.now()}`;
	console.log(`\n→ creating throwaway notebook "${notebookName}"`);
	const notebook = await client.createNotebook(notebookName);
	const notebookId = notebook.id;
	console.log(`  notebookId=${notebookId}`);

	try {
		console.log('\n→ creating test doc');
		const docId = await client.createDocWithMd(notebookId, '/test', '# Test doc\n\nBody.');
		console.log(`  docId=${docId}`);

		// -------------------------------------------------------------------
		// Issue #9 — Document > Get Document Tree must not throw on a leaf doc
		// -------------------------------------------------------------------
		console.log('\n→ #9: getDocumentTree on leaf doc');
		try {
			const tree = await client.getDocumentTree(docId, 5);
			assert(Array.isArray(tree), 'returns an array', tree);
			assert(tree.length === 0, 'leaf doc has zero children', tree);
		} catch (e) {
			fail('did not throw', (e as Error).message);
		}

		// Also exercise via the document handler getStoragePath operation
		console.log('\n→ #9: document.getStoragePath handler');
		const docHandler = await handleDocumentOperation(
			client,
			'getStoragePath',
			makeCtx({ docId }) as any,
			0,
		);
		assert(typeof docHandler === 'object' && docHandler !== null, 'returns object', docHandler);
		const dh = docHandler as Record<string, unknown>;
		assert(dh.found === true, 'found:true', dh);
		assert(typeof dh.storagePath === 'string', 'storagePath is a string', dh);
		assert(typeof dh.notebook === 'string', 'notebook is a string', dh);

		// -------------------------------------------------------------------
		// Issue #10 — Create returns well-formed locator with rootID populated
		// -------------------------------------------------------------------
		console.log('\n→ #10: database.create');
		const create = (await handleDatabaseOperation(
			client,
			'create',
			makeCtx({ parentBlockId: docId }) as any,
			0,
		)) as Record<string, unknown>;
		assert(typeof create.blockID === 'string' && create.blockID.length > 0, 'blockID populated', create);
		assert(typeof create.avID === 'string' && create.avID.length > 0, 'avID populated', create);
		assert(create.rootID === docId, `rootID === docId (got ${create.rootID})`, create);
		assert(create.parentID === docId, 'parentID === docId', create);
		assert('name' in create, 'name field present', create);

		const avId = create.avID as string;
		const dbBlockId = create.blockID as string;

		// -------------------------------------------------------------------
		// Issue #12: addColumn × 3, addRow with fields (both modes), get split/single, list shape
		// -------------------------------------------------------------------
		console.log('\n→ #12: addColumn × 3 (text, number, checkbox)');
		const colText = (await handleDatabaseOperation(
			client,
			'addColumn',
			makeCtx({ avId, columnName: 'Title', columnType: 'text' }) as any,
			0,
		)) as Record<string, string>;
		const colNum = (await handleDatabaseOperation(
			client,
			'addColumn',
			makeCtx({ avId, columnName: 'Count', columnType: 'number' }) as any,
			0,
		)) as Record<string, string>;
		const colCheck = (await handleDatabaseOperation(
			client,
			'addColumn',
			makeCtx({ avId, columnName: 'Done', columnType: 'checkbox' }) as any,
			0,
		)) as Record<string, string>;
		assert(!!colText.keyID && !!colNum.keyID && !!colCheck.keyID, 'all keyIDs returned');

		console.log('\n→ #12a: addRow with fields by keyId');
		const row1 = (await handleDatabaseOperation(
			client,
			'addRow',
			makeCtx({
				avId,
				databaseBlockId: dbBlockId,
				primaryKeyContent: 'Row One',
				addRowMode: 'fields',
				fieldsMode: 'byKeyId',
				'fieldsByKeyId.field': [
					{ keyId: colText.keyID, value: 'Alpha' },
					{ keyId: colNum.keyID, value: '42' },
					{ keyId: colCheck.keyID, value: 'true' },
				],
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(row1.fieldsSet === 3, 'fieldsSet === 3 (byKeyId)', row1);
		assert(typeof row1.rowID === 'string', 'rowID present', row1);

		console.log('\n→ #12a: addRow with fields by column name (JSON)');
		const row2 = (await handleDatabaseOperation(
			client,
			'addRow',
			makeCtx({
				avId,
				databaseBlockId: dbBlockId,
				primaryKeyContent: 'Row Two',
				addRowMode: 'fields',
				fieldsMode: 'byColumnName',
				fieldsByColumnName: JSON.stringify({ Title: 'Beta', Count: 7, Done: false }),
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(row2.fieldsSet === 3, 'fieldsSet === 3 (byColumnName)', row2);

		console.log('\n→ #12a: addRow simple mode still works');
		const row3 = (await handleDatabaseOperation(
			client,
			'addRow',
			makeCtx({
				avId,
				databaseBlockId: dbBlockId,
				primaryKeyContent: 'Row Three',
				addRowMode: 'simple',
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(row3.fieldsSet === 0, 'simple mode sets no fields', row3);

		console.log('\n→ #12b: get in split mode returns flat per-row array');
		const splitRows = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: '' }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(Array.isArray(splitRows), 'split mode returns an array', splitRows);
		assert(splitRows.length === 3, 'three rows returned', splitRows.length);
		const sample = splitRows[0];
		assert('_rowId' in sample && '_avId' in sample, '_rowId + _avId present', sample);
		assert('Title' in sample && 'Count' in sample && 'Done' in sample, 'flat column keys present', sample);

		console.log('\n→ #12b: get in single mode returns nested object');
		const single = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'single', getFilter: '' }) as any,
			0,
		)) as Record<string, unknown>;
		assert(Array.isArray(single.columns), 'single mode has columns array', single);
		assert(Array.isArray(single.rows) && (single.rows as unknown[]).length === 3, 'single mode has 3 rows', single);
		assert(single.rowCount === 3, 'rowCount === 3', single);

		console.log('\n→ #12b: get with filter (Done: true) returns only matching row');
		const filtered = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: JSON.stringify({ Done: true }) }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(filtered.length === 1, 'one row matches Done:true', filtered);
		assert(filtered[0].Title === 'Alpha', 'matching row has Title=Alpha', filtered[0]);

		console.log('\n→ #12c: list returns per-row items with name (waiting 3s for SiYuan SQL index)');
		await new Promise((r) => setTimeout(r, 3000));
		const list = (await handleDatabaseOperation(
			client,
			'list',
			makeCtx({}) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(Array.isArray(list), 'list returns an array', list);
		const ours = list.find((d) => d.avID === avId);
		assert(!!ours, 'our av appears in the list', list.map((d) => d.avID));
		if (ours) {
			assert('name' in ours, 'list item has name field', ours);
			assert('avID' in ours && 'blockID' in ours, 'list item has avID + blockID', ours);
		}

		// addRow with unknown column name should throw with a clear message
		console.log('\n→ #12a: addRow with unknown column name throws clear error');
		let threw = false;
		try {
			await handleDatabaseOperation(
				client,
				'addRow',
				makeCtx({
					avId,
					databaseBlockId: dbBlockId,
					primaryKeyContent: 'Row Four',
					addRowMode: 'fields',
					fieldsMode: 'byColumnName',
					fieldsByColumnName: JSON.stringify({ Nope: 'x' }),
				}) as any,
				0,
			);
		} catch (e) {
			threw = true;
			const msg = (e as Error).message;
			assert(msg.includes('Nope'), 'error message names the bad column', msg);
		}
		assert(threw, 'threw on unknown column');

		// -------------------------------------------------------------------
		// Issue #14a — addRow with blockID omitted auto-resolves from avID
		// -------------------------------------------------------------------
		console.log('\n→ #14a: addRow with databaseBlockId blank auto-resolves');
		const row5 = (await handleDatabaseOperation(
			client,
			'addRow',
			makeCtx({
				avId,
				databaseBlockId: '',
				primaryKeyContent: 'Row Five',
				addRowMode: 'simple',
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(row5.databaseBlockId === dbBlockId, 'resolved blockID matches the original', row5);
		assert(typeof row5.rowID === 'string', 'rowID returned on auto-resolve path', row5);

		// -------------------------------------------------------------------
		// Issue #14b — Get filter with array value applies OR semantics
		// -------------------------------------------------------------------
		console.log('\n→ #14b: get with array-value filter (Title in [Alpha, Beta])');
		const orFiltered = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({
				avId,
				getOutputMode: 'split',
				getFilter: JSON.stringify({ Title: ['Alpha', 'Beta'] }),
			}) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(orFiltered.length === 2, 'two rows match OR filter', orFiltered.length);
		const titles = orFiltered.map((r) => r.Title).sort();
		assert(
			JSON.stringify(titles) === JSON.stringify(['Alpha', 'Beta']),
			'returned Alpha and Beta',
			titles,
		);

		console.log('\n→ #14b: mixed AND + OR filter ({Title:[Alpha,Beta], Done:true})');
		const mixed = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({
				avId,
				getOutputMode: 'split',
				getFilter: JSON.stringify({ Title: ['Alpha', 'Beta'], Done: true }),
			}) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(mixed.length === 1, 'one row matches mixed AND+OR', mixed.length);
		assert(mixed[0].Title === 'Alpha', 'mixed AND+OR returns the Done row only', mixed[0]);

		// -------------------------------------------------------------------
		// Issue #16 — Add Row with new "By Column Name & Value" collection mode
		// -------------------------------------------------------------------
		console.log('\n→ #16: addRow with byNameAndValue collection (Sigma row)');
		const rowSigma = (await handleDatabaseOperation(
			client,
			'addRow',
			makeCtx({
				avId,
				databaseBlockId: dbBlockId,
				primaryKeyContent: 'Row Sigma',
				fieldsMode: 'byNameAndValue',
				'fieldsByNameAndValue.field': [
					{ columnName: 'Title', value: 'Sigma' },
					{ columnName: 'Count', value: '15' },
					{ columnName: 'Done', value: 'true' },
				],
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(rowSigma.fieldsSet === 3, 'fieldsSet === 3 (byNameAndValue)', rowSigma);
		assert(typeof rowSigma.rowID === 'string', 'rowID present (byNameAndValue)', rowSigma);

		const getSigma = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: JSON.stringify({ Title: 'Sigma' }) }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(getSigma.length === 1, 'find Sigma row via get filter', getSigma);
		assert(getSigma[0].Count === 15, 'Count coerced to number 15', getSigma[0]);
		assert(getSigma[0].Done === true, 'Done coerced to boolean true', getSigma[0]);

		// -------------------------------------------------------------------
		// Issue #17 — updateRow with all three field modes
		// -------------------------------------------------------------------
		const sigmaRowID = rowSigma.rowID as string;

		console.log('\n→ #17: updateRow with byNameAndValue (Count→99, Done→false)');
		const upd1 = (await handleDatabaseOperation(
			client,
			'updateRow',
			makeCtx({
				avId,
				rowId: sigmaRowID,
				fieldsMode: 'byNameAndValue',
				'fieldsByNameAndValue.field': [
					{ columnName: 'Count', value: '99' },
					{ columnName: 'Done', value: 'false' },
				],
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(upd1.fieldsSet === 2, 'fieldsSet === 2 (byNameAndValue update)', upd1);
		assert(upd1.rowID === sigmaRowID, 'updateRow echoes the rowID', upd1);

		const verifyUpd1 = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: JSON.stringify({ Title: 'Sigma' }) }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(verifyUpd1[0].Count === 99, 'Count is now 99 after update', verifyUpd1[0]);
		assert(verifyUpd1[0].Done === false, 'Done is now false after update', verifyUpd1[0]);

		console.log('\n→ #17: updateRow with byColumnName JSON (Title→"Sigma Prime")');
		const upd2 = (await handleDatabaseOperation(
			client,
			'updateRow',
			makeCtx({
				avId,
				rowId: sigmaRowID,
				fieldsMode: 'byColumnName',
				fieldsByColumnName: JSON.stringify({ Title: 'Sigma Prime' }),
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(upd2.fieldsSet === 1, 'fieldsSet === 1 (byColumnName update)', upd2);

		const verifyUpd2 = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: JSON.stringify({ Title: 'Sigma Prime' }) }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(verifyUpd2.length === 1, 'found row by new Title after update', verifyUpd2);

		console.log('\n→ #17: updateRow with byKeyId (Count→7)');
		const upd3 = (await handleDatabaseOperation(
			client,
			'updateRow',
			makeCtx({
				avId,
				rowId: sigmaRowID,
				fieldsMode: 'byKeyId',
				'fieldsByKeyId.field': [{ keyId: colNum.keyID, value: '7' }],
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(upd3.fieldsSet === 1, 'fieldsSet === 1 (byKeyId update)', upd3);

		const verifyUpd3 = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: JSON.stringify({ Title: 'Sigma Prime' }) }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(verifyUpd3[0].Count === 7, 'Count is 7 after byKeyId update', verifyUpd3[0]);

		console.log('\n→ #17: updateRow with unknown column throws clear error');
		let updThrew = false;
		try {
			await handleDatabaseOperation(
				client,
				'updateRow',
				makeCtx({
					avId,
					rowId: sigmaRowID,
					fieldsMode: 'byNameAndValue',
					'fieldsByNameAndValue.field': [{ columnName: 'NopeColumn', value: 'x' }],
				}) as any,
				0,
			);
		} catch (e) {
			updThrew = true;
			assert(
				(e as Error).message.includes('NopeColumn'),
				'error names the missing column',
				(e as Error).message,
			);
		}
		assert(updThrew, 'threw on unknown column in updateRow');

		// -------------------------------------------------------------------
		// Issue #24 — Get must return ALL rows, not just the first page of 50
		// -------------------------------------------------------------------
		console.log('\n→ #24: count rows before bulk-adding past the 50-row page cap');
		const before24 = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: '' }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		const baseCount = before24.length;
		// Add enough rows so the total comfortably exceeds one 50-row page.
		const TARGET_EXTRA = 50;
		const expectedTotal = baseCount + TARGET_EXTRA;
		for (let i = 0; i < TARGET_EXTRA; i++) {
			await handleDatabaseOperation(
				client,
				'addRow',
				makeCtx({
					avId,
					databaseBlockId: dbBlockId,
					primaryKeyContent: `Bulk ${i}`,
					fieldsMode: 'byNameAndValue',
					'fieldsByNameAndValue.field': [{ columnName: 'Count', value: String(1000 + i) }],
				}) as any,
				0,
			);
		}
		await new Promise((r) => setTimeout(r, 1000));

		console.log(`\n→ #24: get split returns every row (>50; expecting ${expectedTotal})`);
		const allRows = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'split', getFilter: '' }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(expectedTotal > 50, 'test fixture exceeds one page', expectedTotal);
		assert(
			allRows.length === expectedTotal,
			`all ${expectedTotal} rows returned (got ${allRows.length}; capped at 50 before #24)`,
			allRows.length,
		);

		console.log('\n→ #24: get single reports the true rowCount');
		const allSingle = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId, getOutputMode: 'single', getFilter: '' }) as any,
			0,
		)) as Record<string, unknown>;
		assert((allSingle.rows as unknown[]).length === expectedTotal, `single mode carries all ${expectedTotal} rows`, (allSingle.rows as unknown[]).length);
		assert(allSingle.rowCount === expectedTotal, `rowCount === ${expectedTotal}`, allSingle.rowCount);

		console.log('\n→ #24: a row from a later page is reachable + its batched field is correct');
		const bulk49 = allRows.find((r) => r.Count === 1049);
		assert(!!bulk49, 'row with Count=1049 (the 50th bulk row) is present in the full result', allRows.length);
		assert(bulk49?.['Primary Key'] === 'Bulk 49', 'that row carries its primary content', bulk49);

		// -------------------------------------------------------------------
		// Issue #26 — grouped views. A grouped render moves every row into
		// view.groups[] and empties view.rows while leaving rowCount at the full
		// total, which used to make Add Row throw, Get return nothing, and
		// Update Row report the row as missing.
		// -------------------------------------------------------------------
		console.log('\n→ #26: fresh database for grouping');
		const gCreate = (await handleDatabaseOperation(
			client,
			'create',
			makeCtx({ parentBlockId: docId }) as any,
			0,
		)) as Record<string, unknown>;
		const gAvId = gCreate.avID as string;
		const gBlockId = gCreate.blockID as string;

		const gCol = (await handleDatabaseOperation(
			client,
			'addColumn',
			makeCtx({ avId: gAvId, columnName: 'Status', columnType: 'select' }) as any,
			0,
		)) as Record<string, string>;
		assert(!!gCol.keyID, 'Status column created', gCol);

		for (const [content, status] of [['G-One', 'Alpha'], ['G-Two', 'Beta'], ['G-Three', 'Alpha']]) {
			await handleDatabaseOperation(
				client,
				'addRow',
				makeCtx({
					avId: gAvId,
					databaseBlockId: gBlockId,
					primaryKeyContent: content,
					fieldsMode: 'byColumnName',
					fieldsByColumnName: JSON.stringify({ Status: status }),
				}) as any,
				0,
			);
		}

		console.log('\n→ #26: group the view by Status');
		const groupRes = await fetch(`${url}/api/av/setAttrViewGroup`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
			body: JSON.stringify({
				avID: gAvId,
				blockID: gBlockId,
				group: { field: gCol.keyID, method: 0, order: 0, hideEmpty: false },
			}),
		}).then((r) => r.json() as Promise<{ code: number; msg: string }>);
		assert(groupRes.code === 0, 'setAttrViewGroup succeeded', groupRes);

		// The mechanism itself, straight from the kernel — not just the symptom.
		console.log('\n→ #26: raw grouped render has empty rows but a non-zero rowCount');
		const rawGrouped = await fetch(`${url}/api/av/renderAttributeView`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
			body: JSON.stringify({ id: gAvId, page: 1, pageSize: 50 }),
		}).then((r) => r.json() as Promise<{ data: { view: Record<string, any> } }>);
		const rawView = rawGrouped.data.view;
		assert(Array.isArray(rawView.groups) && rawView.groups.length > 0, 'kernel returned groups[]', rawView.groups?.length);
		assert((rawView.rows ?? []).length === 0, 'kernel emptied view.rows on the grouped view', rawView.rows);
		assert(rawView.rowCount === 3, `kernel still reports rowCount=3 (got ${rawView.rowCount})`, rawView.rowCount);

		console.log('\n→ #26: client flattens groups back into rows');
		const flattened = await client.renderDatabaseAllRows(gAvId);
		assert(flattened.rows.length === 3, `all 3 rows recovered from groups (got ${flattened.rows.length})`, flattened.rows.length);
		assert(flattened.columns.length > 0, 'columns still resolved from the parent view', flattened.columns.length);

		console.log('\n→ #26: addRow on a grouped view (threw before the fix)');
		const gAdd = (await handleDatabaseOperation(
			client,
			'addRow',
			makeCtx({
				avId: gAvId,
				databaseBlockId: gBlockId,
				primaryKeyContent: 'G-Four',
				fieldsMode: 'byColumnName',
				fieldsByColumnName: JSON.stringify({ Status: 'Gamma' }),
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(typeof gAdd.rowID === 'string' && (gAdd.rowID as string).length > 0, 'addRow returned a rowID', gAdd);
		assert(gAdd.fieldsSet === 1, 'one field written', gAdd);

		// code 0 is not proof the write landed on the right item — read it back.
		console.log('\n→ #26: the new row is readable and carries its field');
		const afterAdd = await client.renderDatabaseAllRows(gAvId);
		const added = afterAdd.rows.find((r) => r.id === gAdd.rowID);
		assert(!!added, 'the returned rowID resolves to a real row', gAdd.rowID);
		assert(afterAdd.rows.length === 4, `grouped view now has 4 rows (got ${afterAdd.rows.length})`, afterAdd.rows.length);

		console.log('\n→ #26: get on a grouped view returns every row (returned 0 before the fix)');
		const gGet = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId: gAvId, getOutputMode: 'split', getFilter: '' }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(gGet.length === 4, `get returned all 4 rows (got ${gGet.length})`, gGet.length);
		const gFour = gGet.find((r) => r['Primary Key'] === 'G-Four');
		assert(gFour?.Status === 'Gamma', 'the added row carries Status=Gamma', gFour);

		console.log('\n→ #26: updateRow on a grouped view (threw "not found" before the fix)');
		const gUpd = (await handleDatabaseOperation(
			client,
			'updateRow',
			makeCtx({
				avId: gAvId,
				rowId: gAdd.rowID as string,
				fieldsMode: 'byColumnName',
				fieldsByColumnName: JSON.stringify({ Status: 'Delta' }),
			}) as any,
			0,
		)) as Record<string, unknown>;
		assert(gUpd.fieldsSet === 1, 'updateRow wrote one field', gUpd);
		const gGet2 = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId: gAvId, getOutputMode: 'split', getFilter: '' }) as any,
			0,
		)) as Array<Record<string, unknown>>;
		assert(
			gGet2.find((r) => r['Primary Key'] === 'G-Four')?.Status === 'Delta',
			'the update landed on the right row',
			gGet2.find((r) => r['Primary Key'] === 'G-Four'),
		);

		// A grouped view larger than one page is the case that must not be paged: asking the
		// kernel for page 2 of a grouped view returns an empty body ("Unknown error").
		console.log('\n→ #26: grouped view larger than one page (>100 rows) is not paged');
		const bigCreate = (await handleDatabaseOperation(
			client,
			'create',
			makeCtx({ parentBlockId: docId }) as any,
			0,
		)) as Record<string, unknown>;
		const bAvId = bigCreate.avID as string;
		const bBlockId = bigCreate.blockID as string;
		const bCol = (await handleDatabaseOperation(
			client,
			'addColumn',
			makeCtx({ avId: bAvId, columnName: 'Bucket', columnType: 'select' }) as any,
			0,
		)) as Record<string, string>;
		const bigTotal = 130;
		for (let i = 0; i < bigTotal; i++) {
			await client.addDatabaseRow(bAvId, bBlockId, `B-${i}`, [
				{ columnName: 'Bucket', value: `Bucket ${i % 3}` },
			]);
		}
		await fetch(`${url}/api/av/setAttrViewGroup`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
			body: JSON.stringify({
				avID: bAvId,
				blockID: bBlockId,
				group: { field: bCol.keyID, method: 0, order: 0, hideEmpty: false },
			}),
		}).then((r) => r.json());

		try {
			const bigAll = await client.renderDatabaseAllRows(bAvId);
			assert(
				bigAll.rows.length === bigTotal,
				`all ${bigTotal} rows returned from a grouped view (got ${bigAll.rows.length})`,
				bigAll.rows.length,
			);
			assert(bigAll.grouped === true, 'view reported as grouped', bigAll.grouped);
		} catch (e) {
			fail('renderDatabaseAllRows on a >1-page grouped view threw', (e as Error).message);
		}

		const bigGet = (await handleDatabaseOperation(
			client,
			'get',
			makeCtx({ avId: bAvId, getOutputMode: 'single', getFilter: '' }) as any,
			0,
		)) as Record<string, unknown>;
		assert(
			(bigGet.rows as unknown[]).length === bigTotal,
			`get returned all ${bigTotal} rows from the large grouped view`,
			(bigGet.rows as unknown[]).length,
		);
	} finally {
		console.log(`\n→ cleanup: removing notebook ${notebookId}`);
		try {
			await client.removeNotebook(notebookId);
			console.log('  cleanup ok');
		} catch (e) {
			console.log(`  cleanup failed: ${(e as Error).message}`);
		}
	}

	console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error('Unexpected error:', e);
	process.exit(1);
});

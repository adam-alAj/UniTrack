const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptSource = fs.readFileSync(
  path.join(process.cwd(), 'scripts', 'UniTrack_Gmail_Sync.gs'),
  'utf8',
);

function createWorker(responseFactory, throwFetch = false, lockAvailable = true) {
  const stored = new Map([
    ['UNITRACK_API_URL', 'https://unitrack.example/api/ingest/email'],
    ['UNITRACK_INGEST_SECRET', 'TEST_ONLY_SECRET_VALUE'],
    ['GMAIL_SEARCH_QUERY', 'from:noreply-eclass@bethlehem.edu'],
    ['LOOKBACK_DAYS', '7'],
    ['BATCH_SIZE', '20'],
  ]);
  const logs = [];
  const searches = [];
  const requests = [];
  const privateBody = 'PRIVATE BODY THAT MUST NOT BE LOGGED';
  const message = {
    id: 'test-message-id',
    threadId: 'test-thread-id',
    internalDate: String(Date.now() - 1000),
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: 'Private Sender <private@example.invalid>' },
        { name: 'Subject', value: 'Private subject' },
      ],
      body: { data: Buffer.from(privateBody).toString('base64url') },
    },
  };
  let searchCalls = 0;

  const context = {
    Date,
    URL,
    JSON,
    Math,
    Number,
    String,
    parseInt,
    isFinite,
    Logger: { log: (value) => logs.push(String(value)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => stored.get(key) ?? null,
        setProperty: (key, value) => stored.set(key, String(value)),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock: () => {} }),
    },
    Gmail: {
      Users: {
        Messages: {
          list: (_userId, options) => {
            searches.push(options);
            searchCalls += 1;
            return searchCalls === 1 ? { messages: [{ id: message.id, threadId: message.threadId }] } : { messages: [] };
          },
          get: () => message,
        },
      },
    },
    Utilities: {
      base64DecodeWebSafe: (data) => Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        requests.push({ url, options });
        if (throwFetch) throw new Error('PRIVATE BODY THAT MUST NOT BE LOGGED');
        return responseFactory();
      },
    },
  };

  vm.runInNewContext(scriptSource, context, { filename: 'UniTrack_Gmail_Sync.gs' });
  return { context, stored, logs, searches, requests };
}

function response(statusCode, body) {
  return {
    getResponseCode: () => statusCode,
    getContentText: () => body,
  };
}

test('API response contract accepts only exact successful status and message ID', () => {
  const worker = createWorker(() => response(200, '{}'));
  const parse = worker.context.parseApiResponse_;

  assert.equal(parse(response(200, JSON.stringify({ success: true, status: 'processed', gmail_message_id: 'm1' })), 'm1').confirmed, true);
  assert.equal(parse(response(200, JSON.stringify({ success: true, status: 'duplicate', gmail_message_id: 'other' })), 'm1').confirmed, false);
  assert.equal(parse(response(200, JSON.stringify({ success: true, status: 'unknown', gmail_message_id: 'm1' })), 'm1').confirmed, false);
  assert.equal(parse(response(503, JSON.stringify({ success: true, status: 'processed', gmail_message_id: 'm1' })), 'm1').confirmed, false);
  assert.equal(parse(response(200, 'not-json'), 'm1').confirmed, false);
});

test('confirmed API success advances the cursor and sends the agreed payload', () => {
  const worker = createWorker(() =>
    response(200, JSON.stringify({ success: true, status: 'processed', gmail_message_id: 'test-message-id' })),
  );
  worker.context.syncUniTrackEmails();

  assert.ok(worker.stored.has('LAST_SUCCESSFUL_SYNC_EPOCH'));
  assert.equal(worker.requests.length, 2);
  assert.equal(worker.requests[0].url, 'https://unitrack.example/api/ingest/email');
  assert.equal(worker.requests[1].url, 'https://unitrack.example/api/ingest/sync-run');
  assert.equal(worker.requests[0].options.headers.Authorization, 'Bearer TEST_ONLY_SECRET_VALUE');
  const payload = JSON.parse(worker.requests[0].options.payload);
  assert.equal(payload.schema_version, 1);
  assert.equal(payload.gmail_message_id, 'test-message-id');
  assert.equal(payload.body_text, 'PRIVATE BODY THAT MUST NOT BE LOGGED');
  const run = JSON.parse(worker.requests[1].options.payload);
  assert.equal(run.status, 'success');
  assert.equal(run.found_count, 1);
  assert.equal(run.processed_count, 1);
  assert.match(worker.searches[0].q, /^from:noreply-eclass@bethlehem\.edu after:/);
  assert.doesNotMatch(worker.logs.join('\n'), /TEST_ONLY_SECRET_VALUE|PRIVATE BODY|Private Sender|Private subject/);
});

test('duplicate is confirmed, while API and transport failures never advance the cursor', () => {
  const duplicate = createWorker(() =>
    response(200, JSON.stringify({ success: true, status: 'duplicate', gmail_message_id: 'test-message-id' })),
  );
  duplicate.context.syncUniTrackEmails();
  assert.ok(duplicate.stored.has('LAST_SUCCESSFUL_SYNC_EPOCH'));

  const failedResponse = createWorker(() => response(503, '{"success":false,"status":"failed"}'));
  failedResponse.context.syncUniTrackEmails();
  assert.equal(failedResponse.stored.has('LAST_SUCCESSFUL_SYNC_EPOCH'), false);

  const unauthorized = createWorker(() => response(401, '{"success":false,"status":"failed"}'));
  unauthorized.context.syncUniTrackEmails();
  assert.equal(unauthorized.stored.has('LAST_SUCCESSFUL_SYNC_EPOCH'), false);

  const failedTransport = createWorker(() => response(200, '{}'), true);
  failedTransport.context.syncUniTrackEmails();
  assert.equal(failedTransport.stored.has('LAST_SUCCESSFUL_SYNC_EPOCH'), false);
  assert.doesNotMatch(failedTransport.logs.join('\n'), /PRIVATE BODY/);
});

test('overlapping trigger run exits when the script lock is held', () => {
  const worker = createWorker(() => response(200, '{}'), false, false);
  worker.context.syncUniTrackEmails();

  assert.equal(worker.requests.length, 0);
  assert.equal(worker.searches.length, 0);
  assert.equal(worker.stored.has('LAST_SUCCESSFUL_SYNC_EPOCH'), false);
  assert.match(worker.logs.join('\n'), /already running/);
});

test('worker requires HTTPS endpoint and an explicit bounded search query', () => {
  const worker = createWorker(() => response(200, '{}'));
  assert.throws(() => worker.context.requireApiUrl_({ getProperty: () => 'http://unitrack.example/api/ingest/email' }));
  worker.stored.set('GMAIL_SEARCH_QUERY', '');
  assert.throws(() => worker.context.diagnoseUniTrack(), /GMAIL_SEARCH_QUERY/);
});

test('manifest uses Gmail read-only and the worker does not call GmailApp', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'appsscript.json'), 'utf8'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/gmail.readonly'));
  assert.ok(!manifest.oauthScopes.includes('https://mail.google.com/'));
  assert.doesNotMatch(scriptSource, /GmailApp\./);
});

/**
 * UniTrack — Gmail synchronization worker
 *
 * Reads matching Gmail messages and forwards them to the UniTrack ingestion API.
 *
 * REQUIRED Script Properties:
 *   UNITRACK_API_URL       e.g. https://your-domain.vercel.app/api/ingest/email
 *   UNITRACK_INGEST_SECRET long random shared secret
 *
 * OPTIONAL Script Properties:
 *   GMAIL_SEARCH_QUERY     additional Gmail filter, e.g. from:notifications@university.edu
 *   LOOKBACK_DAYS          initial lookback when no cursor exists; default 7
 *   BATCH_SIZE             threads per page; default 20
 *
 * This version only reads Gmail. It does not add labels, archive, delete,
 * mark read, or modify messages. Backend idempotency is mandatory because
 * a short overlap is intentionally re-read on subsequent runs.
 */

const UT = {
  DEFAULT_BATCH_SIZE: 20,
  DEFAULT_LOOKBACK_DAYS: 7,
  OVERLAP_SECONDS: 600,
  MAX_BODY_CHARS: 30000,
  SUCCESS_STATUSES: ['processed', 'duplicate', 'needs_review'],
  CURSOR_PROPERTY: 'LAST_SUCCESSFUL_SYNC_EPOCH'
};

/**
 * Run once manually after setting Script Properties.
 * Installs a five-minute trigger. Safe to run more than once.
 */
function setupUniTrackTrigger() {
  const props = PropertiesService.getScriptProperties();
  requireProperty_(props, 'UNITRACK_API_URL');
  requireProperty_(props, 'UNITRACK_INGEST_SECRET');

  const handler = 'syncUniTrackEmails';
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('UniTrack trigger installed: every 5 minutes.');
}

/**
 * Main scheduled worker. Can also be run manually from the Apps Script editor.
 * Advances the sync cursor only if every matching message was confirmed by API.
 */
function syncUniTrackEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('Another UniTrack sync is already running. Skipping this run.');
    return;
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = requireProperty_(props, 'UNITRACK_API_URL');
    const secret = requireProperty_(props, 'UNITRACK_INGEST_SECRET');
    const batchSize = parsePositiveInt_(
      props.getProperty('BATCH_SIZE'),
      UT.DEFAULT_BATCH_SIZE
    );
    const lookbackDays = parsePositiveInt_(
      props.getProperty('LOOKBACK_DAYS'),
      UT.DEFAULT_LOOKBACK_DAYS
    );
    const customQuery = (props.getProperty('GMAIL_SEARCH_QUERY') || '').trim();

    const nowEpoch = Math.floor(Date.now() / 1000);
    const savedCursor = parsePositiveInt_(
      props.getProperty(UT.CURSOR_PROPERTY),
      0
    );
    const initialCursor = nowEpoch - (lookbackDays * 24 * 60 * 60);
    const cursorToUse = savedCursor || initialCursor;
    const searchAfter = Math.max(0, cursorToUse - UT.OVERLAP_SECONDS);
    const query = [customQuery, 'after:' + searchAfter].filter(Boolean).join(' ');

    let offset = 0;
    let threadsFound = 0;
    let requestsSent = 0;
    let confirmed = 0;
    let failed = 0;
    let review = 0;
    let allConfirmed = true;

    while (true) {
      const threads = GmailApp.search(query, offset, batchSize);
      if (threads.length === 0) break;

      threadsFound += threads.length;

      for (let i = 0; i < threads.length; i++) {
        const messages = threads[i].getMessages();

        for (let j = 0; j < messages.length; j++) {
          const message = messages[j];
          const messageEpoch = Math.floor(message.getDate().getTime() / 1000);

          // Gmail search is thread-based; only send messages newer than the cursor window.
          if (messageEpoch <= searchAfter) continue;

          try {
            const payload = buildMessagePayload_(message);
            const response = postToUniTrack_(apiUrl, secret, payload);
            const result = parseApiResponse_(response, payload.gmail_message_id);
            requestsSent++;

            if (result.confirmed && UT.SUCCESS_STATUSES.indexOf(result.status) !== -1) {
              confirmed++;
              if (result.status === 'needs_review') review++;
            } else {
              allConfirmed = false;
              failed++;
              Logger.log(
                'Message not confirmed. HTTP=' +
                response.getResponseCode() +
                ', result=' + (result.status || 'unknown')
              );
            }
          } catch (err) {
            allConfirmed = false;
            failed++;
            Logger.log('UniTrack message processing failed: ' + safeError_(err));
          }
        }
      }

      offset += threads.length;
      if (threads.length < batchSize) break;
    }

    // Advance only after the entire result set has been handled successfully.
    // A small overlap is retained so messages arriving near the boundary are not missed.
    if (allConfirmed) {
      props.setProperty(
        UT.CURSOR_PROPERTY,
        String(Math.max(0, nowEpoch - UT.OVERLAP_SECONDS))
      );
    }

    Logger.log(JSON.stringify({
      query: query,
      threadsFound: threadsFound,
      requestsSent: requestsSent,
      confirmed: confirmed,
      failed: failed,
      needsReview: review,
      cursorAdvanced: allConfirmed,
      finishedAt: new Date().toISOString()
    }));
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lightweight diagnostic. Does not print the secret or message body.
 */
function diagnoseUniTrack() {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('UNITRACK_API_URL');
  const secret = props.getProperty('UNITRACK_INGEST_SECRET');
  const lookbackDays = parsePositiveInt_(props.getProperty('LOOKBACK_DAYS'), UT.DEFAULT_LOOKBACK_DAYS);
  const customQuery = (props.getProperty('GMAIL_SEARCH_QUERY') || '').trim();
  const cursor = parsePositiveInt_(props.getProperty(UT.CURSOR_PROPERTY), 0);
  const afterEpoch = cursor
    ? Math.max(0, cursor - UT.OVERLAP_SECONDS)
    : Math.floor(Date.now() / 1000) - (lookbackDays * 24 * 60 * 60);
  const query = [customQuery, 'after:' + afterEpoch].filter(Boolean).join(' ');

  const threads = GmailApp.search(query, 0, 5);

  Logger.log(JSON.stringify({
    hasApiUrl: Boolean(apiUrl),
    hasIngestSecret: Boolean(secret),
    query: query,
    matchingThreadsInSample: threads.length,
    account: Session.getActiveUser().getEmail() || 'Unavailable'
  }));
}

/**
 * Build the transport payload from one Gmail message.
 * The backend should treat all email content as untrusted input.
 */
function buildMessagePayload_(message) {
  const body = (message.getPlainBody() || '').slice(0, UT.MAX_BODY_CHARS);
  const messageId = message.getId();

  return {
    schema_version: 1,
    source: 'gmail_apps_script',
    gmail_message_id: messageId,
    gmail_thread_id: message.getThread().getId(),
    sender: message.getFrom() || '',
    subject: message.getSubject() || '',
    received_at: message.getDate().toISOString(),
    gmail_url: 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(messageId),
    body_text: body
  };
}

/**
 * Send a message to the protected UniTrack endpoint.
 */
function postToUniTrack_(apiUrl, secret, payload) {
  return UrlFetchApp.fetch(apiUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + secret,
      'X-UniTrack-Source': 'gmail-apps-script'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: false
  });
}

/**
 * Expected API response example:
 * {
 *   "success": true,
 *   "status": "processed" | "duplicate" | "needs_review",
 *   "gmail_message_id": "..."
 * }
 *
 * HTTP 2xx alone is not enough: require success=true and a recognized status.
 */
function parseApiResponse_(response, expectedMessageId) {
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    return { confirmed: false, status: 'http_error' };
  }

  let data;
  try {
    data = JSON.parse(response.getContentText() || '{}');
  } catch (err) {
    return { confirmed: false, status: 'invalid_json' };
  }

  const status = String(data.status || '').toLowerCase();
  const success = data.success === true;
  const returnedMessageId = data.gmail_message_id || data.source_message_id || null;
  const idMatches = !returnedMessageId || returnedMessageId === expectedMessageId;

  return {
    confirmed: success && idMatches,
    status: idMatches ? status : 'message_id_mismatch'
  };
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function requireProperty_(props, key) {
  const value = props.getProperty(key);
  if (!value || !String(value).trim()) {
    throw new Error('Missing required Script Property: ' + key);
  }
  return String(value).trim();
}

function parsePositiveInt_(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeError_(err) {
  return String(err && err.message ? err.message : err).slice(0, 500);
}

/**
 * UniTrack Gmail synchronization worker.
 *
 * This worker uses the Advanced Gmail API with gmail.readonly. It does not
 * label, archive, delete, mark read, or otherwise modify Gmail messages.
 * Message idempotency is enforced by the API/database because the overlap is
 * intentionally reread.
 *
 * Required Script Properties:
 *   UNITRACK_API_URL       HTTPS /api/ingest/email endpoint
 *   UNITRACK_INGEST_SECRET long random shared secret
 *   GMAIL_SEARCH_QUERY     verified Gmail filter (never leave blank)
 *
 * Optional Script Properties:
 *   LOOKBACK_DAYS          initial lookback when there is no cursor; default 7
 *   BATCH_SIZE             threads per Gmail page; default 20, maximum 50
 */

const UT = {
  DEFAULT_BATCH_SIZE: 20,
  MAX_BATCH_SIZE: 50,
  DEFAULT_LOOKBACK_DAYS: 7,
  MAX_LOOKBACK_DAYS: 90,
  OVERLAP_SECONDS: 600,
  MAX_BODY_CHARS: 30000,
  SUCCESS_STATUSES: ['processed', 'duplicate', 'needs_review'],
  CURSOR_PROPERTY: 'LAST_SUCCESSFUL_SYNC_EPOCH'
};

/** Run once manually after configuration and authorization. */
function setupUniTrackTrigger() {
  const props = PropertiesService.getScriptProperties();
  requireApiUrl_(props);
  requireProperty_(props, 'UNITRACK_INGEST_SECRET');
  requireProperty_(props, 'GMAIL_SEARCH_QUERY');

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

  Logger.log('UniTrack five-minute trigger installed.');
}

/** Main scheduled worker; also safe to run manually. */
function syncUniTrackEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('UniTrack sync already running; this run was skipped.');
    return;
  }

  const runStartedAt = new Date();
  let apiUrl = '';
  let secret = '';
  let messagesFound = 0;
  let requestsSent = 0;
  let confirmed = 0;
  let failed = 0;
  let review = 0;
  let allConfirmed = true;

  try {
    const props = PropertiesService.getScriptProperties();
    apiUrl = requireApiUrl_(props);
    secret = requireProperty_(props, 'UNITRACK_INGEST_SECRET');
    const customQuery = requireProperty_(props, 'GMAIL_SEARCH_QUERY');
    const batchSize = parseBoundedInt_(
      props.getProperty('BATCH_SIZE'),
      UT.DEFAULT_BATCH_SIZE,
      1,
      UT.MAX_BATCH_SIZE
    );
    const lookbackDays = parseBoundedInt_(
      props.getProperty('LOOKBACK_DAYS'),
      UT.DEFAULT_LOOKBACK_DAYS,
      1,
      UT.MAX_LOOKBACK_DAYS
    );

    const nowEpoch = Math.floor(Date.now() / 1000);
    const savedCursor = parsePositiveInt_(
      props.getProperty(UT.CURSOR_PROPERTY),
      0
    );
    const initialCursor = nowEpoch - (lookbackDays * 24 * 60 * 60);
    const cursorToUse = savedCursor || initialCursor;
    const searchAfter = Math.max(0, cursorToUse - UT.OVERLAP_SECONDS);
    const query = [customQuery, 'after:' + searchAfter].join(' ');

    let pageToken = null;
    while (true) {
      const options = {
        q: query,
        maxResults: batchSize,
        includeSpamTrash: false
      };
      if (pageToken) options.pageToken = pageToken;
      const page = Gmail.Users.Messages.list('me', options);
      const messages = page.messages || [];
      if (messages.length === 0) break;

      messagesFound += messages.length;
      for (let i = 0; i < messages.length; i++) {
        try {
          const fullMessage = Gmail.Users.Messages.get('me', messages[i].id, { format: 'full' });
          const messageEpoch = Number(fullMessage.internalDate) / 1000;
          if (!Number.isFinite(messageEpoch)) {
            allConfirmed = false;
            failed++;
            Logger.log('UniTrack message processing failed: invalid_internal_date');
            continue;
          }
          if (messageEpoch <= searchAfter) continue;

          const payload = buildMessagePayload_(fullMessage);
          const response = postToUniTrack_(apiUrl, secret, payload);
          const result = parseApiResponse_(response, payload.gmail_message_id);
          requestsSent++;

          if (result.confirmed) {
            confirmed++;
            if (result.status === 'needs_review') review++;
          } else {
            allConfirmed = false;
            failed++;
            Logger.log(
              'Message not confirmed. HTTP=' + response.getResponseCode() +
              ', result=' + (result.status || 'unknown')
            );
          }
        } catch (err) {
          allConfirmed = false;
          failed++;
          Logger.log('UniTrack message processing failed: ' + safeError_(err));
        }
      }

      pageToken = page.nextPageToken || null;
      if (!pageToken) break;
    }

    if (allConfirmed) {
      props.setProperty(
        UT.CURSOR_PROPERTY,
        String(Math.max(0, nowEpoch - UT.OVERLAP_SECONDS))
      );
    }

    Logger.log(JSON.stringify({
      searchConfigured: true,
      messagesFound: messagesFound,
      requestsSent: requestsSent,
      confirmed: confirmed,
      failed: failed,
      needsReview: review,
      cursorAdvanced: allConfirmed,
      finishedAt: new Date().toISOString()
    }));
  } catch (err) {
    allConfirmed = false;
    failed++;
    Logger.log('UniTrack sync failed: ' + safeError_(err));
  } finally {
    if (apiUrl && secret) {
      const finishedAt = new Date();
      const status = failed === 0 ? 'success' : confirmed > 0 ? 'partial' : 'failed';
      try {
        const response = postSyncRun_(apiUrl, secret, {
          started_at: runStartedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          status: status,
          found_count: messagesFound,
          processed_count: confirmed,
          failed_count: failed,
          error_summary: failed ? 'One or more messages could not be delivered.' : null
        });
        if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
          Logger.log('Sync history could not be recorded. HTTP=' + response.getResponseCode());
        }
      } catch (err) {
        Logger.log('Sync history could not be recorded: ' + safeError_(err));
      }
    }
    lock.releaseLock();
  }
}

/** Bounded diagnostic. It logs counts and configuration presence only. */
function diagnoseUniTrack() {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('UNITRACK_API_URL');
  const secret = props.getProperty('UNITRACK_INGEST_SECRET');
  const customQuery = (props.getProperty('GMAIL_SEARCH_QUERY') || '').trim();
  if (!customQuery) throw new Error('Missing required Script Property: GMAIL_SEARCH_QUERY');

  const lookbackDays = parseBoundedInt_(
    props.getProperty('LOOKBACK_DAYS'),
    UT.DEFAULT_LOOKBACK_DAYS,
    1,
    UT.MAX_LOOKBACK_DAYS
  );
  const cursor = parsePositiveInt_(props.getProperty(UT.CURSOR_PROPERTY), 0);
  const afterEpoch = cursor
    ? Math.max(0, cursor - UT.OVERLAP_SECONDS)
    : Math.floor(Date.now() / 1000) - (lookbackDays * 24 * 60 * 60);
  const query = [customQuery, 'after:' + afterEpoch].join(' ');
  const page = Gmail.Users.Messages.list('me', {
    q: query,
    maxResults: 5,
    includeSpamTrash: false
  });

  Logger.log(JSON.stringify({
    hasApiUrl: Boolean(apiUrl),
    hasIngestSecret: Boolean(secret),
    searchConfigured: true,
    matchingMessagesInSample: (page.messages || []).length
  }));
}

function buildMessagePayload_(message) {
  const messageId = message.id;
  const receivedAt = Number(message.internalDate);
  if (!messageId || !Number.isFinite(receivedAt)) {
    throw new Error('Gmail API message omitted its ID or internal date.');
  }

  return {
    schema_version: 1,
    source: 'gmail_apps_script',
    gmail_message_id: messageId,
    gmail_thread_id: message.threadId || messageId,
    sender: getHeader_(message, 'From'),
    subject: getHeader_(message, 'Subject'),
    received_at: new Date(receivedAt).toISOString(),
    gmail_url: 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(messageId),
    body_text: plainTextBody_(message.payload).slice(0, UT.MAX_BODY_CHARS)
  };
}

function getHeader_(message, wantedName) {
  const headers = message.payload && message.payload.headers || [];
  const wanted = String(wantedName).toLowerCase();
  const header = headers.find(function(item) {
    return String(item.name || '').toLowerCase() === wanted;
  });
  return header && header.value ? String(header.value) : '';
}

function plainTextBody_(payload) {
  const found = { plain: [], html: [] };
  collectBodyParts_(payload, found);
  if (found.plain.length) return found.plain.join('\n');
  if (found.html.length) return stripHtml_(found.html.join('\n'));
  return '';
}

function collectBodyParts_(part, found) {
  if (!part) return;
  const mimeType = String(part.mimeType || '').toLowerCase();
  const data = part.body && part.body.data;
  if (data && (mimeType === 'text/plain' || mimeType === 'text/html')) {
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
    found[mimeType === 'text/plain' ? 'plain' : 'html'].push(decoded);
  }
  (part.parts || []).forEach(function(child) {
    collectBodyParts_(child, found);
  });
}

function stripHtml_(html) {
  return decodeHtmlEntities_(String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' '))
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeHtmlEntities_(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

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

function postSyncRun_(apiUrl, secret, run) {
  const syncRunUrl = apiUrl.replace(/\/api\/ingest\/email\/?$/i, '/api/ingest/sync-run');
  return UrlFetchApp.fetch(syncRunUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + secret,
      'X-UniTrack-Source': 'gmail-apps-script'
    },
    payload: JSON.stringify(run),
    muteHttpExceptions: true,
    followRedirects: false
  });
}

/** Exact response contract: 2xx, success=true, recognized status, matching ID. */
function parseApiResponse_(response, expectedMessageId) {
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) return { confirmed: false, status: 'http_error' };

  let data;
  try {
    data = JSON.parse(response.getContentText() || '{}');
  } catch (err) {
    return { confirmed: false, status: 'invalid_json' };
  }

  const status = String(data.status || '').toLowerCase();
  const success = data.success === true;
  const returnedMessageId = data.gmail_message_id || data.source_message_id || null;
  const idMatches = returnedMessageId === expectedMessageId;

  return {
    confirmed: success && idMatches && UT.SUCCESS_STATUSES.indexOf(status) !== -1,
    status: !idMatches ? 'message_id_mismatch' : status
  };
}

function requireApiUrl_(props) {
  const value = requireProperty_(props, 'UNITRACK_API_URL');
  const match = value.match(/^https:\/\/([^/?#]+)\/api\/ingest\/email\/?$/i);
  if (!match || !/^[a-z0-9.-]+(?::\d+)?$/i.test(match[1]) || match[1].includes('..')) {
    throw new Error('UNITRACK_API_URL must be an HTTPS /api/ingest/email endpoint with no credentials.');
  }
  return value.replace(/\/$/, '');
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

function parseBoundedInt_(value, fallback, minimum, maximum) {
  const parsed = parsePositiveInt_(value, fallback);
  return Math.min(maximum, Math.max(minimum, parsed));
}

function safeError_(err) {
  return String(err && err.name ? err.name : 'Error').slice(0, 80);
}

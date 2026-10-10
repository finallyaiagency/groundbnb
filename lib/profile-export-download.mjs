const REVOKE_DELAY_MS = 1000;

function filenameDate(exportedAt) {
  if (typeof exportedAt !== 'string') throw new TypeError('A canonical export timestamp is required.');
  const parsed = new Date(exportedAt);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== exportedAt) {
    throw new TypeError('A canonical export timestamp is required.');
  }
  return parsed.toISOString().slice(0, 10);
}

function removeAnchor(anchor, body) {
  if (!anchor) return;
  try {
    if (typeof anchor.remove === 'function') anchor.remove();
    else body.removeChild(anchor);
  } catch {
    try { body.removeChild(anchor); } catch { /* Cleanup is best effort after the click attempt. */ }
  }
}

function scheduleRevocation(urlApi, objectUrl, schedule) {
  let revoked = false;
  const revoke = () => {
    if (revoked) return;
    revoked = true;
    try { urlApi.revokeObjectURL(objectUrl); } catch { /* Do not replace the download result with cleanup errors. */ }
  };
  try { schedule(revoke, REVOKE_DELAY_MS); }
  catch { revoke(); }
}

/** Starts a reviewed profile JSON download; this cannot confirm browser artifact completion. */
export function startProfileExportDownload({ bytes, contentType, exportedAt, documentPort, urlPort, BlobCtor, schedule }) {
  const date = filenameDate(exportedAt);
  if (!(bytes instanceof Uint8Array) || typeof contentType !== 'string' || !contentType ||
      !documentPort?.body || typeof documentPort.createElement !== 'function' ||
      typeof urlPort?.createObjectURL !== 'function' || typeof urlPort.revokeObjectURL !== 'function' ||
      typeof BlobCtor !== 'function' || typeof schedule !== 'function') {
    throw new TypeError('Profile download ports or reviewed bytes are invalid.');
  }

  const filename = `groundbnb-profile-${date}.json`;
  let objectUrl;
  let anchor;
  try {
    const ownedBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const blob = new BlobCtor([ownedBytes], { type: contentType });
    objectUrl = urlPort.createObjectURL(blob);
    if (typeof objectUrl !== 'string' || objectUrl.length === 0) throw new TypeError('Profile download URL was not created.');
    anchor = documentPort.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    documentPort.body.append(anchor);
    anchor.click();
  } finally {
    removeAnchor(anchor, documentPort.body);
    if (objectUrl) scheduleRevocation(urlPort, objectUrl, schedule);
  }
  return { filename };
}

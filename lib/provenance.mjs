/** Server policy is the only authority for a provider value's portable use. */
export function portableValue(record, policy, now = new Date()) {
  const { value, provenance } = record;
  if (value == null) return { value: null, status: 'unavailable', reason: 'missing' };
  if (!provenance || !['user', 'provider', 'import', 'calculated'].includes(provenance.origin)) {
    return { value: null, status: 'unavailable', reason: 'unverified_provenance' };
  }
  if (provenance.origin === 'user') return { value, status: 'available', provenance };
  if (provenance.origin === 'import') return provenance.rights === 'verified_authored'
    ? { value, status: 'available', provenance }
    : { value: null, status: 'unavailable', reason: 'unverified_import' };
  if (provenance.origin === 'calculated') {
    if (!provenance.dependencies?.length || provenance.dependencies.some(x => portableValue(x, policy, now).status !== 'available')) {
      return { value: null, status: 'unavailable', reason: 'restricted_dependency' };
    }
    return { value, status: 'available', provenance };
  }
  if (!provenance.sourceReference || !provenance.fetchedAt || !provenance.policyVersion) {
    return { value: null, status: 'unavailable', reason: 'incomplete_provenance' };
  }
  if (!provenance.retentionUntil && !policy?.noExpirySources?.includes(provenance.sourceReference)) {
    return { value: null, status: 'unavailable', reason: 'unknown_retention' };
  }
  if (provenance.retentionUntil && Date.parse(provenance.retentionUntil) <= now.getTime()) {
    return { value: null, status: 'unavailable', reason: 'expired' };
  }
  if (!policy?.permittedExportSources?.includes(provenance.sourceReference)) {
    return { value: null, status: 'unavailable', reason: 'export_not_permitted' };
  }
  return { value, status: 'available', provenance };
}

/** Positioning never rewrites origin, rights, or the authored coordinate. */
export function changePositioning(stop, positioning) {
  if (!['exact_gps', 'road_access', 'approximate'].includes(positioning)) throw new Error('Invalid positioning');
  return { ...stop, positioning };
}

-- M1-01U rollback-only operator acceptance for the exact 0011 baseline.
-- Synthetic membership arithmetic only. This script makes no provider calls,
-- changes no plan/catalog/policy rows, and creates no account or Auth identity.
-- Preparation only: run only under the separately approved operator window.
BEGIN;
DO $$
DECLARE
  e record;
  app_role text;
  app_oid oid;
  owner_oid oid;
  role_record record;
  function_oid oid;
  function_owner oid;
  identity_issuer text;
  identity_subject text;
  account_uuid uuid;
  result jsonb;
  free_version uuid := '10000000-0000-4000-8000-000000000101';
  plus_version uuid := '10000000-0000-4000-8000-000000000102';
  assignment_current uuid := '2a000000-0000-4000-8000-000000000001';
  assignment_expired uuid := '2a000000-0000-4000-8000-000000000002';
  assignment_overlap uuid := '2a000000-0000-4000-8000-000000000003';
  grant_tie_a uuid := '2b000000-0000-4000-8000-000000000001';
  grant_tie_b uuid := '2b000000-0000-4000-8000-000000000002';
  grant_revoked uuid := '2b000000-0000-4000-8000-000000000003';
  grant_future uuid := '2b000000-0000-4000-8000-000000000004';
  same_start timestamptz := clock_timestamp()-interval '1 hour';
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 11 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN
       ('0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
        '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
        '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity',
        '0011_membership_reader')) IS DISTINCT FROM 11 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview migration baseline 0001-0011';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  app_oid:=role_record.oid;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT p.oid,p.proowner INTO STRICT function_oid,function_owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='read_membership' AND p.proargtypes='25 25'::oidvector;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR
     role_record.rolconnlimit IS DISTINCT FROM 4 OR
     (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_function_privilege(app_oid,function_oid,'EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.oid=function_oid AND (acl.grantee=0 OR acl.grantee=app_oid OR acl.grantee<>function_owner)) OR
     NOT (SELECT prosecdef FROM pg_proc WHERE oid=function_oid) OR
     function_owner IS DISTINCT FROM owner_oid OR
     NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=function_oid AND
       proconfig @> ARRAY['search_path=pg_catalog, pg_temp']) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f')
                AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
           has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           ELSE false END) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND
         CASE WHEN c.relkind='S' THEN
           has_sequence_privilege(app_oid,c.oid,'USAGE') OR has_sequence_privilege(app_oid,c.oid,'SELECT') OR
           has_sequence_privilege(app_oid,c.oid,'UPDATE')
           ELSE false END) OR
     COALESCE((SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')),ARRAY[]::text[]) IS DISTINCT FROM
       ARRAY['groundbnb.read_profile(text,text)',
             'groundbnb.read_profile_operation(text,text,uuid)',
             'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
             'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
             'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)']::text[] OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN
         ('_protect_membership_plan','_protect_published_membership_version','_guard_base_assignment_overlap',
          '_protect_membership_policy_defaults','_protect_access_grant_history','_protect_policy_audit','_profile_account')
         AND (acl.grantee=0 OR acl.grantee=app_oid) AND acl.privilege_type='EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._profile_account(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Pinned app-role and membership-reader private ACL baseline differs';
  END IF;
  IF (SELECT mode FROM groundbnb.financial_dispatch_control WHERE singleton) IS DISTINCT FROM 'paused' OR
     EXISTS(SELECT 1 FROM groundbnb.provider_rate_versions) OR
     EXISTS(SELECT 1 FROM groundbnb.provider_financial_limit_versions) THEN
    RAISE EXCEPTION 'Dispatch must remain paused with no configured provider rates or limits';
  END IF;
  IF (SELECT count(*) FROM groundbnb.membership_policy WHERE singleton) IS DISTINCT FROM 1 OR
     (SELECT commercial_mode FROM groundbnb.membership_policy WHERE singleton) IS DISTINCT FROM 'report_only' OR
     (SELECT enforced_test_cohorts FROM groundbnb.membership_policy WHERE singleton) IS DISTINCT FROM 'explicit' OR
     (SELECT checkout_enabled FROM groundbnb.membership_policy WHERE singleton) IS DISTINCT FROM false OR
     (SELECT supplier_transactions_enabled FROM groundbnb.membership_policy WHERE singleton) IS DISTINCT FROM false OR
     NOT EXISTS(SELECT 1 FROM groundbnb.membership_plan_versions v
       JOIN groundbnb.membership_plans p ON p.plan_id=v.plan_id
       WHERE v.version_id=free_version AND p.plan_key='free' AND v.release_tier='v1' AND v.published_at IS NOT NULL) OR
     NOT EXISTS(SELECT 1 FROM groundbnb.membership_plan_versions v
       JOIN groundbnb.membership_plans p ON p.plan_id=v.plan_id
       WHERE v.version_id=plus_version AND p.plan_key='plus' AND v.release_tier='v1' AND v.published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Membership policy or pinned synthetic plan versions differ from expected baseline';
  END IF;

  SELECT issuer,subject,account_id INTO STRICT identity_issuer,identity_subject,account_uuid
    FROM groundbnb.account_identities WHERE verified_email=e.kind || '-01@example.test' AND revoked_at IS NULL;
  IF (SELECT count(*) FROM groundbnb.account_identities
      WHERE verified_email=e.kind || '-01@example.test' AND revoked_at IS NULL) IS DISTINCT FROM 1 OR
     (SELECT status FROM groundbnb.accounts WHERE id=account_uuid) IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Synthetic account mapping is not unique and active';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.membership_assignments WHERE account_id=account_uuid) OR
     EXISTS(SELECT 1 FROM groundbnb.access_grants WHERE account_id=account_uuid) OR
     EXISTS(SELECT 1 FROM groundbnb.membership_assignments WHERE assignment_id IN
       (assignment_current,assignment_expired,assignment_overlap)) OR
     EXISTS(SELECT 1 FROM groundbnb.access_grants WHERE grant_id IN
       (grant_tie_a,grant_tie_b,grant_revoked,grant_future)) THEN
    RAISE EXCEPTION 'Membership acceptance fixture is not clean';
  END IF;

  -- Missing mapping is denied without revealing whether a subject exists.
  IF EXISTS(SELECT 1 FROM groundbnb.account_identities
      WHERE issuer=identity_issuer AND subject='m1u-unmapped-subject-acceptance') THEN
    RAISE EXCEPTION 'Unmapped-subject acceptance fixture is not clean';
  END IF;
  result:=groundbnb.read_membership(identity_issuer,'m1u-unmapped-subject-acceptance');
  IF result->>'ok' IS DISTINCT FROM 'false' OR result->>'category' IS DISTINCT FROM 'auth' THEN
    RAISE EXCEPTION 'Unmapped subject was not denied';
  END IF;

  -- Missing base assignment fails closed. No default plan is inferred.
  result:=groundbnb.read_membership(identity_issuer,identity_subject);
  IF result->>'ok' IS DISTINCT FROM 'false' OR result->>'category' IS DISTINCT FROM 'membership_unavailable' THEN
    RAISE EXCEPTION 'Missing base assignment did not fail closed';
  END IF;

  -- Seed only temporary synthetic acceptance rows. Existing catalog and policy stay untouched.
  INSERT INTO groundbnb.membership_assignments
    (assignment_id,account_id,plan_version_id,effective_from,effective_until,status)
    VALUES
      (assignment_expired,account_uuid,free_version,clock_timestamp()-interval '3 days',
        clock_timestamp()-interval '2 days','active'),
      (assignment_current,account_uuid,free_version,clock_timestamp()-interval '1 hour',NULL,'active');
  INSERT INTO groundbnb.access_grants
    (grant_id,account_id,plan_version_id,grant_type,granted_by,granted_at,starts_at,reason,revoked_at,revoked_by,revocation_note)
    VALUES
      (grant_tie_a,account_uuid,plus_version,'lifetime',account_uuid,same_start,same_start,'M1-01U rollback-only overlay',NULL,NULL,NULL),
      (grant_tie_b,account_uuid,plus_version,'lifetime',account_uuid,same_start,same_start,'M1-01U rollback-only overlay',NULL,NULL,NULL),
      (grant_revoked,account_uuid,plus_version,'lifetime',account_uuid,same_start,same_start,'M1-01U rollback-only revoked overlay',
        same_start+interval '1 minute',account_uuid,'M1-01U rollback-only'),
      (grant_future,account_uuid,plus_version,'lifetime',account_uuid,clock_timestamp(),
        clock_timestamp()+interval '1 day','M1-01U rollback-only future overlay',NULL,NULL,NULL);

  result:=groundbnb.read_membership(identity_issuer,identity_subject);
  IF result->>'ok' IS DISTINCT FROM 'true' OR
     result#>>'{baseAssignment,assignmentId}' IS DISTINCT FROM assignment_current::text OR
     result#>>'{baseAssignment,planKey}' IS DISTINCT FROM 'free' OR
     result#>>'{baseAssignment,versionNumber}' IS DISTINCT FROM '1' OR
     result#>>'{policy,commercialMode}' IS DISTINCT FROM 'report_only' OR
     result#>>'{policy,enforcedTestCohorts}' IS DISTINCT FROM 'explicit' OR
     result#>>'{policy,checkoutEnabled}' IS DISTINCT FROM 'false' OR
     result#>>'{policy,supplierTransactionsEnabled}' IS DISTINCT FROM 'false' OR
     jsonb_array_length(result->'effectiveLifetimeGrants') IS DISTINCT FROM 2 OR
     result#>>'{effectiveLifetimeGrant,grantId}' IS DISTINCT FROM grant_tie_a::text OR
     result#>>'{effectiveLifetimeGrants,0,grantId}' IS DISTINCT FROM grant_tie_a::text OR
     result#>>'{effectiveLifetimeGrants,1,grantId}' IS DISTINCT FROM grant_tie_b::text OR
     EXISTS(SELECT 1 FROM jsonb_array_elements(result->'effectiveLifetimeGrants') AS g(value)
       WHERE g.value->>'grantId' IN (grant_revoked::text,grant_future::text)) THEN
    RAISE EXCEPTION 'Membership reader did not return the coherent expected base, policy, and ordered overlays';
  END IF;

  -- The database overlap trigger prevents constructing two simultaneously effective base rows.
  -- Require its exact refusal; do not disable/bypass it to fabricate the reader's defensive ambiguity branch.
  BEGIN
    INSERT INTO groundbnb.membership_assignments
      (assignment_id,account_id,plan_version_id,effective_from,effective_until,status)
      VALUES(assignment_overlap,account_uuid,plus_version,clock_timestamp()-interval '30 minutes',NULL,'active');
    RAISE EXCEPTION 'Expected base assignment overlap guard';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IS DISTINCT FROM 'Overlapping base membership assignments are not allowed' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM groundbnb.membership_assignments
      WHERE account_id=account_uuid AND status='active'
        AND effective_from<=clock_timestamp() AND (effective_until IS NULL OR effective_until>clock_timestamp())) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Overlap guard did not preserve exactly one effective synthetic base assignment';
  END IF;
END $$;
SELECT 'M1_MEMBERSHIP_READER_ACCEPTANCE_PREPARED' AS result;
ROLLBACK;

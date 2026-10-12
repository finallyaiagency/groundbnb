-- Narrow repair for the 0008 settle_provider_attempt parameter/column ambiguity.
-- Prepared only; execution requires explicit approval for this repair operation.
BEGIN;
DO $$
DECLARE
  e record;
  app_role text;
  app_oid oid;
  role_record record;
  function_oid oid;
  synthetic_account uuid;
  original_owner oid;
  original_acl aclitem[];
  original_config text[];
  function_definition text;
  old_declaration constant text := 'DECLARE account_uuid uuid; attempt_row record; operation_row record; actual_cost numeric; receipt jsonb; w record;';
  new_declaration constant text := 'DECLARE actual_units_input ALIAS FOR $4; account_uuid uuid; attempt_row record; operation_row record; actual_cost numeric; receipt jsonb; w record;';
  old_assignment constant text := 'SET status=''settled'',actual_units=actual_units,' || E'\n' || '    actual_cost_usd=actual_cost';
  new_assignment constant text := 'SET status=''settled'',actual_units=actual_units_input,' || E'\n' || '    actual_cost_usd=actual_cost';
  financial_helpers constant text[] := ARRAY[
    '_financial_version_immutable','_provider_rate_version_guard','_provider_limit_version_guard',
    '_financial_control_audit','_financial_audit_immutable','_provider_cost','reserve_provider_attempt',
    'mark_provider_attempt_dispatched','settle_provider_attempt','close_provider_operation'
  ];
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app'
  END;
  IF app_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 9 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN (
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
       '0008_provider_reservations','0009_privileged_factors')) IS DISTINCT FROM 9 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0009 baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS (
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT account_id INTO STRICT synthetic_account FROM groundbnb.account_identities
    WHERE verified_email=e.kind || '-01@example.test' AND revoked_at IS NULL;
  IF (SELECT count(*) FROM groundbnb.account_identities
        WHERE verified_email=e.kind || '-01@example.test' AND revoked_at IS NULL) IS DISTINCT FROM 1 OR
     (SELECT status FROM groundbnb.accounts WHERE id=synthetic_account) IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Requires the sole active synthetic application identity';
  END IF;
  IF (SELECT mode FROM groundbnb.financial_dispatch_control WHERE singleton) IS DISTINCT FROM 'paused' OR
     EXISTS(SELECT 1 FROM groundbnb.provider_rate_versions WHERE status='active') OR
     EXISTS(SELECT 1 FROM groundbnb.provider_financial_limit_versions WHERE status='active') THEN
    RAISE EXCEPTION 'Financial dispatch must remain paused with rates and provider limits inactive';
  END IF;

  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  app_oid:=role_record.oid;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR
     role_record.rolconnlimit IS DISTINCT FROM 4 OR
     NOT (COALESCE(role_record.rolconfig,ARRAY[]::text[]) @>
       ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m')
                 AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname=ANY(financial_helpers)
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Pinned app-role boundary or financial helper ACL differs from prepared baseline';
  END IF;

  function_oid:='groundbnb.settle_provider_attempt(text,text,uuid,jsonb,boolean)'::regprocedure;
  SELECT p.proowner,p.proacl,p.proconfig INTO STRICT original_owner,original_acl,original_config
    FROM pg_proc p WHERE p.oid=function_oid AND p.prosecdef;
  IF has_function_privilege(app_oid,function_oid,'EXECUTE') OR EXISTS(
      SELECT 1 FROM aclexplode(COALESCE(original_acl,acldefault('f',original_owner))) acl
      WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Settlement function must remain ungranted to PUBLIC and the app role';
  END IF;
  function_definition:=pg_get_functiondef(function_oid);
  IF length(function_definition)-length(replace(function_definition,old_declaration,''))<>length(old_declaration) OR
     length(function_definition)-length(replace(function_definition,old_assignment,''))<>length(old_assignment) OR
     position(new_declaration IN function_definition)>0 OR position(new_assignment IN function_definition)>0 THEN
    RAISE EXCEPTION 'Settlement function is not the exact known actual_units ambiguity version';
  END IF;

  function_definition:=replace(function_definition,old_declaration,new_declaration);
  function_definition:=replace(function_definition,old_assignment,new_assignment);
  EXECUTE function_definition;

  IF (SELECT p.proowner FROM pg_proc p WHERE p.oid=function_oid) IS DISTINCT FROM original_owner OR
     (SELECT p.proacl FROM pg_proc p WHERE p.oid=function_oid) IS DISTINCT FROM original_acl OR
     (SELECT p.proconfig FROM pg_proc p WHERE p.oid=function_oid) IS DISTINCT FROM original_config OR
     NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=function_oid) OR
     has_function_privilege(app_oid,function_oid,'EXECUTE') OR
     position(new_declaration IN pg_get_functiondef(function_oid))=0 OR
     position(new_assignment IN pg_get_functiondef(function_oid))=0 OR
     position(old_declaration IN pg_get_functiondef(function_oid))>0 OR
     position(old_assignment IN pg_get_functiondef(function_oid))>0 THEN
    RAISE EXCEPTION 'Settlement ambiguity repair or owner/ACL preservation assertion failed';
  END IF;
END $$;
COMMIT;

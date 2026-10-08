-- Prepared rollback for 0007. Refuses all membership history and any modified catalog.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with migrations 0001-0007 applied';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(SELECT 1 FROM neon_auth."user"
      WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     NOT (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth')
         AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role/function-only ACL baseline differs from approved M1 boundary';
  END IF;
  IF has_function_privilege(role_record.oid,'groundbnb._protect_membership_plan()','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._protect_published_membership_version()','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._protect_membership_policy_defaults()','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._guard_base_assignment_overlap()','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._protect_access_grant_history()','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._protect_policy_audit()','EXECUTE') THEN
    RAISE EXCEPTION 'Membership trigger helpers must remain private';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.membership_assignments) OR
     EXISTS(SELECT 1 FROM groundbnb.access_grants) OR EXISTS(SELECT 1 FROM groundbnb.policy_audit) THEN
    RAISE EXCEPTION 'Rollback refused: membership assignments, grants, or policy audit history would be lost';
  END IF;
  IF (SELECT count(*) FROM groundbnb.membership_plans)<>3 OR
     (SELECT count(*) FROM groundbnb.membership_plan_versions)<>3 OR
     (SELECT count(*) FROM groundbnb.membership_policy)<>1 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.membership_policy WHERE singleton AND commercial_mode='report_only'
       AND enforced_test_cohorts='explicit' AND NOT checkout_enabled AND NOT supplier_transactions_enabled) OR
     EXISTS(SELECT 1 FROM groundbnb.membership_plans WHERE
       (plan_key='free' AND (plan_id<>'00000000-0000-4000-8000-000000000101'::uuid OR display_name<>'Free' OR status<>'active')) OR
       (plan_key='plus' AND (plan_id<>'00000000-0000-4000-8000-000000000102'::uuid OR display_name<>'Plus' OR status<>'active')) OR
       (plan_key='pro' AND (plan_id<>'00000000-0000-4000-8000-000000000103'::uuid OR display_name<>'Pro' OR status<>'active')) OR
       plan_key NOT IN ('free','plus','pro') OR updated_at<>created_at) OR
     EXISTS(SELECT 1 FROM groundbnb.membership_plan_versions WHERE
       version_id NOT IN ('10000000-0000-4000-8000-000000000101'::uuid,
         '10000000-0000-4000-8000-000000000102'::uuid,'10000000-0000-4000-8000-000000000103'::uuid)
       OR version_number<>1 OR published_at IS NULL) THEN
    RAISE EXCEPTION 'Rollback refused: membership catalog was renamed, extended, or modified';
  END IF;
END $$;

DROP TABLE groundbnb.policy_audit;
DROP TABLE groundbnb.access_grants;
DROP TABLE groundbnb.membership_assignments;
DROP TABLE groundbnb.membership_policy;
DROP TABLE groundbnb.membership_plan_versions;
DROP TABLE groundbnb.membership_plans;
DROP FUNCTION groundbnb._protect_policy_audit();
DROP FUNCTION groundbnb._protect_access_grant_history();
DROP FUNCTION groundbnb._guard_base_assignment_overlap();
DROP FUNCTION groundbnb._protect_membership_policy_defaults();
DROP FUNCTION groundbnb._protect_published_membership_version();
DROP FUNCTION groundbnb._protect_membership_plan();
DELETE FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation';
COMMIT;

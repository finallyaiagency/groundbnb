const FACTOR_FUNCTIONS = Object.freeze([
  'groundbnb.read_factor_challenge_state(text,text,text,timestamptz)',
  'groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)',
  'groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)',
  'groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)',
  'groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)',
]);

/** Fixed, read-only factor-role catalog query. Invalid login expectations are refused. */
export function factorCredentialCatalogQuery(expectedLogin) {
  if (typeof expectedLogin !== 'boolean') return null;
  const loginAttribute = expectedLogin ? 'TRUE' : 'FALSE';
  const expectedFunctions = `ARRAY[${FACTOR_FUNCTIONS.map(signature => `to_regprocedure('${signature}')::oid`).join(',')}]::oid[]`;
  const seedGuardFunction = "to_regprocedure('groundbnb.refuse_production_synthetic_seed()')::oid";
  return `WITH expected AS (
      SELECT unnest(${expectedFunctions}) AS function_oid
    )
    SELECT current_database() AS database_name,current_user AS connected_role,r.rolname AS role_name,
      r.rolcanlogin IS ${loginAttribute} AND NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR
        r.rolbypassrls OR r.rolinherit) AND r.rolconnlimit=2 AND r.rolconfig IS NULL AS role_attributes_safe,
      (SELECT count(*) FROM pg_auth_members m WHERE m.roleid=r.oid)=1 AND
        EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles owner_role ON owner_role.rolname='neondb_owner'
          JOIN pg_roles grantor_role ON grantor_role.rolname='cloud_admin'
          WHERE m.member=owner_role.oid AND m.roleid=r.oid AND m.grantor=grantor_role.oid AND
            m.admin_option IS TRUE AND m.inherit_option IS FALSE AND m.set_option IS FALSE) AND
        NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS creator_membership_exact,
      has_database_privilege(r.oid,current_database(),'CONNECT') AND
        NOT has_database_privilege(r.oid,current_database(),'CREATE') AND
        has_schema_privilege(r.oid,'groundbnb','USAGE') AND
        NOT has_schema_privilege(r.oid,'groundbnb','CREATE') AS database_schema_boundary,
      ARRAY(SELECT function_oid FROM expected UNION SELECT ${seedGuardFunction} AS function_oid
        WHERE ${seedGuardFunction} IS NOT NULL ORDER BY function_oid) =
        ARRAY(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='groundbnb'
            AND has_function_privilege(r.oid,p.oid,'EXECUTE') ORDER BY p.oid) AS effective_function_set_exact,
      NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        JOIN expected e ON e.function_oid=p.oid JOIN pg_roles owner_role ON owner_role.rolname='neondb_owner'
        WHERE p.proowner IS DISTINCT FROM owner_role.oid OR p.prosecdef IS DISTINCT FROM true OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR (acl.grantee<>p.proowner AND acl.grantee<>r.oid) OR
              acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) AS function_acl_exact,
      (SELECT count(*)=1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles owner_role ON owner_role.rolname='neondb_owner'
        WHERE p.oid=${seedGuardFunction} AND n.nspname='groundbnb' AND p.prorettype='trigger'::regtype AND
          l.lanname='plpgsql' AND p.proowner=owner_role.oid AND p.prosecdef IS FALSE AND p.proconfig IS NULL AND
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE' AND NOT acl.is_grantable) AND
          NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE (acl.grantee<>0 AND acl.grantee<>p.proowner) OR acl.privilege_type<>'EXECUTE' OR
              (acl.grantee=0 AND acl.is_grantable)) AND
          (SELECT count(*)=1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
            JOIN pg_namespace tn ON tn.oid=c.relnamespace WHERE tn.nspname='groundbnb' AND
              c.relname='synthetic_identities' AND NOT t.tgisinternal) AND
          EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
            JOIN pg_namespace tn ON tn.oid=c.relnamespace WHERE tn.nspname='groundbnb' AND
              c.relname='synthetic_identities' AND t.tgname='synthetic_seed_guard' AND
              t.tgfoid=p.oid AND t.tgtype=23 AND t.tgenabled='O') AND
          NOT EXISTS(SELECT 1 FROM pg_proc other JOIN pg_namespace onamespace ON onamespace.oid=other.pronamespace
            WHERE onamespace.nspname='groundbnb' AND other.prorettype='trigger'::regtype AND other.oid<>p.oid AND
              has_function_privilege(r.oid,other.oid,'EXECUTE'))
      ) AS synthetic_seed_trigger_exact,
      NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f') AND
          (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
           has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) AS no_direct_table_privileges,
      NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind='S' AND
          has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE')) AS no_sequence_privileges
    FROM pg_roles r WHERE r.rolname=$1`;
}

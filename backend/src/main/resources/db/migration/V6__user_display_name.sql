ALTER TABLE app_user ADD COLUMN display_name varchar(80);
ALTER TABLE app_user ADD CONSTRAINT app_user_display_name_valid
    CHECK (display_name IS NULL OR (length(trim(display_name)) > 0 AND display_name !~ '[[:cntrl:]]'));
ALTER TABLE app_user ADD COLUMN deletion_requested_at timestamptz;
ALTER TABLE app_user ADD COLUMN identity_deleted_at timestamptz;
CREATE INDEX app_user_pending_deletion_idx ON app_user(deletion_requested_at)
    WHERE deletion_requested_at IS NOT NULL AND identity_deleted_at IS NULL;

-- Alter SftpConfigurations table to auto-generate TenantId and remove foreign key constraint
-- Run this script to update the existing table structure

-- Step 1: Drop the foreign key constraint
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SftpConfigurations_UKGTenants')
BEGIN
    ALTER TABLE dbo.SftpConfigurations 
    DROP CONSTRAINT FK_SftpConfigurations_UKGTenants;
    PRINT 'Foreign key constraint FK_SftpConfigurations_UKGTenants dropped successfully.';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_SftpConfigurations_UKGTenants does not exist.';
END

-- Step 2: Add default constraint for auto-generating TenantId
IF NOT EXISTS (SELECT * FROM sys.default_constraints 
               WHERE parent_object_id = OBJECT_ID('dbo.SftpConfigurations') 
               AND parent_column_id = (SELECT column_id FROM sys.columns 
                                      WHERE object_id = OBJECT_ID('dbo.SftpConfigurations') 
                                      AND name = 'TenantId'))
BEGIN
    ALTER TABLE dbo.SftpConfigurations 
    ADD CONSTRAINT DF_SftpConfigurations_TenantId DEFAULT NEWID() FOR TenantId;
    PRINT 'Default constraint for TenantId added successfully.';
END
ELSE
BEGIN
    PRINT 'Default constraint for TenantId already exists.';
END

-- Step 3: Update any existing records that have NULL TenantId (if any)
UPDATE dbo.SftpConfigurations 
SET TenantId = NEWID() 
WHERE TenantId IS NULL;

PRINT 'SftpConfigurations table has been successfully updated:';
PRINT '- Foreign key constraint to UKGTenants removed';
PRINT '- TenantId now auto-generates with NEWID()';
PRINT '- Existing records with NULL TenantId have been updated';
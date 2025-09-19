-- Test Data for SFTP Configurations
-- This script inserts sample SFTP configurations for testing the Mosaic Toolbox

-- First, ensure we have a test tenant
-- Check if the default tenant exists, if not, create it
IF NOT EXISTS (SELECT 1 FROM dbo.UKGTenants WHERE Id = '00000000-0000-0000-0000-000000000000')
BEGIN
    INSERT INTO dbo.UKGTenants (
        Id,
        TenantName,
        CompanyId,
        BaseUrl,
        IsActive,
        CreatedBy,
        CreatedDate,
        ModifiedBy,
        ModifiedDate,
        Description
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',  -- Default test tenant ID
        'Test Tenant',
        'TEST001',
        'https://test.ukg.com',
        1,  -- IsActive
        'system',
        GETUTCDATE(),
        'system',
        GETUTCDATE(),
        'Default test tenant for Mosaic Toolbox development'
    );
    PRINT 'Test tenant created successfully!';
END
ELSE
BEGIN
    PRINT 'Test tenant already exists.';
END

-- Insert a test SFTP configuration
-- Note: Replace the KeyVaultSecretName with an actual secret name in your Key Vault
-- TenantId will be auto-generated using NEWID()
INSERT INTO dbo.SftpConfigurations (
    Name,
    Host,
    Port,
    Username,
    AuthMethod,
    KeyVaultSecretName,
    RemotePath,
    ConfigurationJson,
    IsActive,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
    UpdatedBy
) VALUES (
    'Test SFTP Server',
    'demo.sftp.server.com',  -- Replace with actual SFTP server
    22,  -- Standard SFTP port
    'testuser',  -- Replace with actual username
    'password',  -- Auth method: 'password' or 'key'
    'sftp-test-password',  -- Key Vault secret name (create this secret)
    '/home/testuser',  -- Default remote directory
    '{"timeout": 30000, "keepaliveInterval": 10000}',  -- Additional configuration
    1,  -- IsActive
    GETUTCDATE(),  -- CreatedAt
    GETUTCDATE(),  -- UpdatedAt
    'system',  -- CreatedBy
    'system'   -- UpdatedBy
);

-- Insert a second test configuration for variety
-- TenantId will be auto-generated using NEWID()
INSERT INTO dbo.SftpConfigurations (
    Name,
    Host,
    Port,
    Username,
    AuthMethod,
    KeyVaultSecretName,
    RemotePath,
    ConfigurationJson,
    IsActive,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
    UpdatedBy
) VALUES (
    'Production SFTP Server',
    'prod.sftp.company.com',  -- Replace with actual production server
    22,
    'produser',  -- Replace with actual username
    'key',  -- Using key-based authentication
    'sftp-prod-private-key',  -- Key Vault secret containing private key
    '/data/uploads',  -- Production upload directory
    '{"timeout": 60000, "keepaliveInterval": 30000, "readyTimeout": 20000}',  -- Extended timeouts for production
    1,  -- IsActive
    GETUTCDATE(),
    GETUTCDATE(),
    'system',
    'system'
);

-- Verify the insertions
SELECT
    sc.Id,
    sc.Name,
    sc.Host,
    sc.Port,
    sc.Username,
    sc.AuthMethod,
    sc.RemotePath,
    sc.IsActive,
    sc.CreatedAt,
    t.TenantName
FROM dbo.SftpConfigurations sc
JOIN dbo.UKGTenants t ON sc.TenantId = t.Id
WHERE sc.TenantId = '00000000-0000-0000-0000-000000000000'
ORDER BY sc.CreatedAt DESC;

PRINT 'SFTP test configurations inserted successfully!';
PRINT 'Remember to create the corresponding secrets in Azure Key Vault:';
PRINT '- sftp-test-password (for password authentication)';
PRINT '- sftp-prod-private-key (for key-based authentication)';
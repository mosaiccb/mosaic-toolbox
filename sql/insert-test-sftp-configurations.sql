-- Test Data for SFTP Configurations
-- This script inserts sample SFTP configurations for testing the Mosaic Toolbox

-- Insert a test SFTP configuration
-- Note: Replace the KeyVaultSecretName with an actual secret name in your Key Vault
INSERT INTO dbo.SftpConfigurations (
    TenantId,
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
    '00000000-0000-0000-0000-000000000000',  -- Default tenant ID
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
INSERT INTO dbo.SftpConfigurations (
    TenantId,
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
    '00000000-0000-0000-0000-000000000000',  -- Default tenant ID
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
    Id,
    Name,
    Host,
    Port,
    Username,
    AuthMethod,
    RemotePath,
    IsActive,
    CreatedAt
FROM dbo.SftpConfigurations
WHERE TenantId = '00000000-0000-0000-0000-000000000000'
ORDER BY CreatedAt DESC;

PRINT 'SFTP test configurations inserted successfully!';
PRINT 'Remember to create the corresponding secrets in Azure Key Vault:';
PRINT '- sftp-test-password (for password authentication)';
PRINT '- sftp-prod-private-key (for key-based authentication)';
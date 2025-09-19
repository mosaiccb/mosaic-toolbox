-- Test Data for SharePoint Configurations
-- This script inserts sample SharePoint configurations for testing the Mosaic Toolbox

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

-- Insert test SharePoint configurations
-- Note: Replace the ClientId with actual Azure AD App Registration Client ID
-- The KeyVaultSecretName should correspond to an actual secret in your Key Vault

INSERT INTO dbo.SharePointConfigurations (
    TenantId,
    Name,
    Description,
    TenantDomain,
    ClientId,
    KeyVaultSecretName,
    IsActive,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
    UpdatedBy
) VALUES (
    '00000000-0000-0000-0000-000000000000',  -- Test tenant ID
    'Contoso SharePoint',
    'Main SharePoint environment for document management',
    'contoso.onmicrosoft.com',  -- Replace with actual tenant domain
    '12345678-1234-1234-1234-123456789012',  -- Replace with actual Client ID
    'sharepoint-test-clientsecret',  -- Key Vault secret name (create this secret)
    1,  -- IsActive
    GETUTCDATE(),  -- CreatedAt
    GETUTCDATE(),  -- UpdatedAt
    'system',  -- CreatedBy
    'system'   -- UpdatedBy
);

-- Insert a second test configuration for variety
INSERT INTO dbo.SharePointConfigurations (
    TenantId,
    Name,
    Description,
    TenantDomain,
    ClientId,
    KeyVaultSecretName,
    IsActive,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
    UpdatedBy
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Development SharePoint',
    'SharePoint development environment for testing file transfers',
    'contosodev.onmicrosoft.com',  -- Replace with actual dev tenant domain
    '87654321-4321-4321-4321-210987654321',  -- Replace with actual Client ID
    'sharepoint-dev-clientsecret',  -- Key Vault secret name (create this secret)
    1,  -- IsActive
    GETUTCDATE(),
    GETUTCDATE(),
    'system',
    'system'
);

-- Insert sample SharePoint sites (these would typically be discovered via API)
-- Get the configuration IDs we just inserted
DECLARE @Config1Id int, @Config2Id int;
SELECT @Config1Id = Id FROM dbo.SharePointConfigurations WHERE Name = 'Contoso SharePoint' AND TenantId = '00000000-0000-0000-0000-000000000000';
SELECT @Config2Id = Id FROM dbo.SharePointConfigurations WHERE Name = 'Development SharePoint' AND TenantId = '00000000-0000-0000-0000-000000000000';

-- Insert sample sites for the first configuration
INSERT INTO dbo.SharePointSites (
    SharePointConfigId,
    SiteId,
    SiteName,
    SiteUrl,
    IsActive,
    CreatedAt,
    UpdatedAt
) VALUES 
(
    @Config1Id,
    'contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,abcdef12-3456-7890-abcd-ef1234567890',  -- Sample Site ID from Graph API
    'Human Resources',
    'https://contoso.sharepoint.com/sites/HumanResources',
    1,
    GETUTCDATE(),
    GETUTCDATE()
),
(
    @Config1Id,
    'contoso.sharepoint.com,87654321-4321-4321-4321-210987654321,fedcba21-6543-0987-dcba-fe0987654321',  -- Sample Site ID from Graph API
    'Finance Department',
    'https://contoso.sharepoint.com/sites/Finance',
    1,
    GETUTCDATE(),
    GETUTCDATE()
);

-- Insert sample sites for the second configuration
INSERT INTO dbo.SharePointSites (
    SharePointConfigId,
    SiteId,
    SiteName,
    SiteUrl,
    IsActive,
    CreatedAt,
    UpdatedAt
) VALUES 
(
    @Config2Id,
    'contosodev.sharepoint.com,11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222',  -- Sample Site ID from Graph API
    'Test Site',
    'https://contosodev.sharepoint.com/sites/TestSite',
    1,
    GETUTCDATE(),
    GETUTCDATE()
);

-- Insert sample document libraries for the sites
-- Get the site IDs we just inserted
DECLARE @Site1Id int, @Site2Id int, @Site3Id int;
SELECT @Site1Id = Id FROM dbo.SharePointSites WHERE SiteName = 'Human Resources';
SELECT @Site2Id = Id FROM dbo.SharePointSites WHERE SiteName = 'Finance Department';
SELECT @Site3Id = Id FROM dbo.SharePointSites WHERE SiteName = 'Test Site';

-- Insert sample libraries
INSERT INTO dbo.SharePointLibraries (
    SharePointSiteId,
    LibraryId,
    LibraryName,
    LibraryType,
    MonitorPath,
    IsActive,
    CreatedAt,
    UpdatedAt
) VALUES 
(
    @Site1Id,
    'b!12345678123412341234123456789012_abcdef1234567890abcdef1234567890',  -- Sample Drive ID from Graph API
    'Employee Documents',
    'documentLibrary',
    '/Shared Documents/Reports',  -- Monitor specific path
    1,
    GETUTCDATE(),
    GETUTCDATE()
),
(
    @Site1Id,
    'b!12345678123412341234123456789012_fedcba0987654321fedcba0987654321',  -- Sample Drive ID from Graph API
    'HR Policies',
    'documentLibrary',
    NULL,  -- Monitor entire library
    1,
    GETUTCDATE(),
    GETUTCDATE()
),
(
    @Site2Id,
    'b!87654321432143214321210987654321_123456789abcdef0123456789abcdef0',  -- Sample Drive ID from Graph API
    'Financial Reports',
    'documentLibrary',
    '/Shared Documents/Monthly',
    1,
    GETUTCDATE(),
    GETUTCDATE()
),
(
    @Site3Id,
    'b!11111111111111111111111111111111_222222222222222222222222222222222',  -- Sample Drive ID from Graph API
    'Test Documents',
    'documentLibrary',
    NULL,
    1,
    GETUTCDATE(),
    GETUTCDATE()
);

-- Verify the insertions
SELECT 
    sc.Id as ConfigId,
    sc.Name as ConfigName,
    sc.TenantDomain,
    sc.IsActive as ConfigActive,
    ss.Id as SiteId,
    ss.SiteName,
    sl.Id as LibraryId,
    sl.LibraryName,
    sl.MonitorPath
FROM dbo.SharePointConfigurations sc
LEFT JOIN dbo.SharePointSites ss ON sc.Id = ss.SharePointConfigId AND ss.IsActive = 1
LEFT JOIN dbo.SharePointLibraries sl ON ss.Id = sl.SharePointSiteId AND sl.IsActive = 1
WHERE sc.TenantId = '00000000-0000-0000-0000-000000000000' AND sc.IsActive = 1
ORDER BY sc.Name, ss.SiteName, sl.LibraryName;

PRINT 'SharePoint test configurations inserted successfully!';
PRINT 'Remember to create the corresponding secrets in Azure Key Vault:';
PRINT '- sharepoint-test-clientsecret (for Contoso SharePoint configuration)';
PRINT '- sharepoint-dev-clientsecret (for Development SharePoint configuration)';
PRINT 'Also ensure your Azure AD App Registrations are properly configured with SharePoint permissions.';
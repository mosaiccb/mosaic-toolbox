-- Mosaic Toolbox SQL Schema for UKG Ready Integration

-- Drop tables if they exist
DROP TABLE IF EXISTS dbo.SftpConfigurations;
DROP TABLE IF EXISTS dbo.UKGTenantEndpoints;
DROP TABLE IF EXISTS dbo.UKGTenantConfigurations;
DROP TABLE IF EXISTS dbo.UKGTenants;

-- Create UKGTenants table
CREATE TABLE dbo.UKGTenants (
    Id uniqueidentifier NOT NULL,
    TenantName nvarchar(255) NULL,
    CompanyId nvarchar(50) NULL,
    BaseUrl nvarchar(500) NULL,
    ClientId nvarchar(255) NULL,
    ClientSecret nvarchar(500) NULL,  -- Added for OAuth
    KeyVaultSecretName nvarchar(400) NULL,  -- Alternative to ClientSecret
    IsActive bit NULL,
    CreatedBy nvarchar(255) NULL,
    CreatedDate datetime2 NULL,
    ModifiedBy nvarchar(255) NULL,
    ModifiedDate datetime2 NULL,
    Description nvarchar(1000) NULL,
    login_url nvarchar(500) NULL,
    shortname nvarchar(50) NULL,
    clock_url nvarchar(500) NULL,
    Timezone nvarchar(50) NULL,
    CONSTRAINT PK_UKGTenants PRIMARY KEY (Id)
);

-- Create UKGTenantConfigurations table
CREATE TABLE dbo.UKGTenantConfigurations (
    Id uniqueidentifier NOT NULL,
    TenantId uniqueidentifier NOT NULL,
    ConfigKey nvarchar(200) NOT NULL,
    ConfigValue nvarchar(max) NULL,
    ConfigType nvarchar(100) NOT NULL,
    IsEncrypted bit NOT NULL,
    Description nvarchar(1000) NULL,
    CreatedAt datetime2 NOT NULL,
    UpdatedAt datetime2 NOT NULL,
    CONSTRAINT PK_UKGTenantConfigurations PRIMARY KEY (Id),
    CONSTRAINT FK_UKGTenantConfigurations_UKGTenants FOREIGN KEY (TenantId) REFERENCES dbo.UKGTenants(Id)
);

-- Create UKGTenantEndpoints table
CREATE TABLE dbo.UKGTenantEndpoints (
    Id uniqueidentifier NOT NULL,
    EndpointId nvarchar(200) NOT NULL,
    Name nvarchar(510) NOT NULL,
    Description nvarchar(1000) NULL,
    Category nvarchar(200) NOT NULL,
    Path nvarchar(510) NOT NULL,
    Method nvarchar(20) NOT NULL,
    Version nvarchar(20) NOT NULL,
    RequestTemplate nvarchar(max) NULL,
    HeadersJson nvarchar(max) NULL,
    AuthRequired bit NOT NULL,
    Scope nvarchar(510) NULL,
    IsActive bit NOT NULL,
    CreatedAt datetime2 NOT NULL,
    scan_param bit NOT NULL,
    url_param_1 nvarchar(510) NULL,
    url_param_2 nvarchar(510) NULL,
    url_param_3 nvarchar(510) NULL,
    url_param_4 nvarchar(510) NULL,
    url_param_5 nvarchar(510) NULL,
    CONSTRAINT PK_UKGTenantEndpoints PRIMARY KEY (Id)
);

-- Create SftpConfigurations table
CREATE TABLE dbo.SftpConfigurations (
    Id int NOT NULL IDENTITY(1,1),
    TenantId uniqueidentifier NOT NULL DEFAULT NEWID(),
    Name nvarchar(200) NOT NULL,
    Host nvarchar(510) NOT NULL,
    Port int NOT NULL,
    Username nvarchar(400) NOT NULL,
    AuthMethod nvarchar(100) NOT NULL,
    KeyVaultSecretName nvarchar(400) NOT NULL,
    RemotePath nvarchar(800) NULL,
    ConfigurationJson nvarchar(max) NULL,
    IsActive bit NOT NULL,
    CreatedAt datetime2 NOT NULL,
    UpdatedAt datetime2 NOT NULL,
    CreatedBy nvarchar(200) NULL,
    UpdatedBy nvarchar(200) NULL,
    CONSTRAINT PK_SftpConfigurations PRIMARY KEY (Id)
);

-- Indexes for performance
CREATE INDEX IX_UKGTenantConfigurations_TenantId ON dbo.UKGTenantConfigurations (TenantId);
CREATE INDEX IX_UKGTenantConfigurations_ConfigKey ON dbo.UKGTenantConfigurations (ConfigKey);
CREATE INDEX IX_UKGTenantEndpoints_EndpointId ON dbo.UKGTenantEndpoints (EndpointId);
CREATE INDEX IX_UKGTenantEndpoints_Category ON dbo.UKGTenantEndpoints (Category);
CREATE INDEX IX_SftpConfigurations_TenantId ON dbo.SftpConfigurations (TenantId);
CREATE INDEX IX_SftpConfigurations_Name ON dbo.SftpConfigurations (Name);
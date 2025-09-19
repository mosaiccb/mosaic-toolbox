-- Mosaic Toolbox SQL Schema for SharePoint Integration

-- Create SharePointConfigurations table
CREATE TABLE dbo.SharePointConfigurations (
    Id int NOT NULL IDENTITY(1,1),
    TenantId uniqueidentifier NOT NULL DEFAULT NEWID(),
    Name nvarchar(200) NOT NULL,
    Description nvarchar(1000) NULL,
    TenantDomain nvarchar(255) NOT NULL,  -- e.g., 'contoso.onmicrosoft.com'
    ClientId nvarchar(255) NOT NULL,  -- Azure AD App Registration Client ID
    KeyVaultSecretName nvarchar(400) NOT NULL,  -- For client secret storage
    IsActive bit NOT NULL DEFAULT 1,
    CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy nvarchar(200) NOT NULL DEFAULT 'system',
    UpdatedBy nvarchar(200) NOT NULL DEFAULT 'system',
    CONSTRAINT PK_SharePointConfigurations PRIMARY KEY (Id)
);

-- Create SharePointSites table for configured sites
CREATE TABLE dbo.SharePointSites (
    Id int NOT NULL IDENTITY(1,1),
    SharePointConfigId int NOT NULL,
    SiteId nvarchar(255) NOT NULL,  -- SharePoint Site ID from Graph API
    SiteName nvarchar(500) NOT NULL,
    SiteUrl nvarchar(1000) NOT NULL,
    IsActive bit NOT NULL DEFAULT 1,
    CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_SharePointSites PRIMARY KEY (Id),
    CONSTRAINT FK_SharePointSites_Configuration FOREIGN KEY (SharePointConfigId) REFERENCES dbo.SharePointConfigurations(Id)
);

-- Create SharePointLibraries table for document libraries
CREATE TABLE dbo.SharePointLibraries (
    Id int NOT NULL IDENTITY(1,1),
    SharePointSiteId int NOT NULL,
    LibraryId nvarchar(255) NOT NULL,  -- SharePoint Library/Drive ID from Graph API
    LibraryName nvarchar(500) NOT NULL,
    LibraryType nvarchar(100) NOT NULL DEFAULT 'documentLibrary',  -- documentLibrary, etc.
    MonitorPath nvarchar(1000) NULL,  -- Specific path to monitor within library
    IsActive bit NOT NULL DEFAULT 1,
    CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_SharePointLibraries PRIMARY KEY (Id),
    CONSTRAINT FK_SharePointLibraries_Site FOREIGN KEY (SharePointSiteId) REFERENCES dbo.SharePointSites(Id)
);

-- Create SharePointTransferJobs table for file transfer configurations
CREATE TABLE dbo.SharePointTransferJobs (
    Id int NOT NULL IDENTITY(1,1),
    TenantId uniqueidentifier NOT NULL,
    Name nvarchar(200) NOT NULL,
    Description nvarchar(1000) NULL,
    SharePointLibraryId int NOT NULL,
    SftpConfigurationId int NOT NULL,
    SourcePath nvarchar(1000) NULL,  -- Path within SharePoint library
    DestinationPath nvarchar(1000) NULL,  -- Path on SFTP destination
    FilePattern nvarchar(200) NULL,  -- File filter pattern (e.g., *.xlsx)
    TransferMode nvarchar(50) NOT NULL DEFAULT 'copy',  -- copy, move
    ScheduleExpression nvarchar(200) NULL,  -- Cron expression for scheduled transfers
    IsActive bit NOT NULL DEFAULT 1,
    LastRunAt datetime2 NULL,
    LastRunStatus nvarchar(50) NULL,
    LastRunMessage nvarchar(max) NULL,
    CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy nvarchar(200) NOT NULL DEFAULT 'system',
    UpdatedBy nvarchar(200) NOT NULL DEFAULT 'system',
    CONSTRAINT PK_SharePointTransferJobs PRIMARY KEY (Id),
    CONSTRAINT FK_SharePointTransferJobs_Library FOREIGN KEY (SharePointLibraryId) REFERENCES dbo.SharePointLibraries(Id),
    CONSTRAINT FK_SharePointTransferJobs_Sftp FOREIGN KEY (SftpConfigurationId) REFERENCES dbo.SftpConfigurations(Id)
);

-- Create SharePointFileTransfers table for transfer history
CREATE TABLE dbo.SharePointFileTransfers (
    Id bigint NOT NULL IDENTITY(1,1),
    TransferJobId int NOT NULL,
    SharePointFileId nvarchar(255) NOT NULL,
    FileName nvarchar(500) NOT NULL,
    FilePath nvarchar(1000) NOT NULL,
    FileSize bigint NOT NULL,
    ModifiedAt datetime2 NOT NULL,
    TransferredAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
    TransferStatus nvarchar(50) NOT NULL,  -- success, failed, pending
    ErrorMessage nvarchar(max) NULL,
    SftpDestination nvarchar(1000) NOT NULL,
    CONSTRAINT PK_SharePointFileTransfers PRIMARY KEY (Id),
    CONSTRAINT FK_SharePointFileTransfers_Job FOREIGN KEY (TransferJobId) REFERENCES dbo.SharePointTransferJobs(Id)
);

-- Indexes for performance
CREATE INDEX IX_SharePointConfigurations_TenantId ON dbo.SharePointConfigurations (TenantId);
CREATE INDEX IX_SharePointConfigurations_Name ON dbo.SharePointConfigurations (Name);
CREATE INDEX IX_SharePointSites_ConfigId ON dbo.SharePointSites (SharePointConfigId);
CREATE INDEX IX_SharePointLibraries_SiteId ON dbo.SharePointLibraries (SharePointSiteId);
CREATE INDEX IX_SharePointTransferJobs_TenantId ON dbo.SharePointTransferJobs (TenantId);
CREATE INDEX IX_SharePointTransferJobs_LibraryId ON dbo.SharePointTransferJobs (SharePointLibraryId);
CREATE INDEX IX_SharePointTransferJobs_SftpConfigId ON dbo.SharePointTransferJobs (SftpConfigurationId);
CREATE INDEX IX_SharePointFileTransfers_JobId ON dbo.SharePointFileTransfers (TransferJobId);
CREATE INDEX IX_SharePointFileTransfers_TransferredAt ON dbo.SharePointFileTransfers (TransferredAt);
CREATE INDEX IX_SharePointFileTransfers_Status ON dbo.SharePointFileTransfers (TransferStatus);

-- Add unique constraints
CREATE UNIQUE INDEX UX_SharePointSites_ConfigId_SiteId ON dbo.SharePointSites (SharePointConfigId, SiteId);
CREATE UNIQUE INDEX UX_SharePointLibraries_SiteId_LibraryId ON dbo.SharePointLibraries (SharePointSiteId, LibraryId);
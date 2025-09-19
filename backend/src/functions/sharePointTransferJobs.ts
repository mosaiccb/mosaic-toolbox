import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';

// Initialize the database service
const dbService = new TenantDatabaseService();

export interface SharePointTransferJob {
  id: number;
  tenantId: string;
  name: string;
  description?: string;
  sharePointLibraryId: number;
  sftpConfigurationId: number;
  sourcePath?: string;
  destinationPath?: string;
  filePattern?: string;
  transferMode: 'copy' | 'move';
  scheduleExpression?: string;
  isActive: boolean;
  lastRunAt?: Date;
  lastRunStatus?: string;
  lastRunMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  // Joined data
  libraryName?: string;
  siteName?: string;
  sftpName?: string;
}

export interface SharePointFileTransfer {
  id: number;
  transferJobId: number;
  sharePointFileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  modifiedAt: Date;
  transferredAt: Date;
  transferStatus: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  sftpDestination: string;
}

// ===== SharePoint Transfer Job Functions =====

// Get all transfer jobs for the authenticated tenant
export async function getSharePointTransferJobs(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID is required'
        }
      };
    }

    context.log(`Getting SharePoint transfer jobs for tenant: ${tenantId}`);

    const query = `
      SELECT 
        stj.Id, stj.TenantId, stj.Name, stj.Description, 
        stj.SharePointLibraryId, stj.SftpConfigurationId,
        stj.SourcePath, stj.DestinationPath, stj.FilePattern, stj.TransferMode,
        stj.ScheduleExpression, stj.IsActive, stj.LastRunAt, stj.LastRunStatus, stj.LastRunMessage,
        stj.CreatedAt, stj.UpdatedAt, stj.CreatedBy, stj.UpdatedBy,
        sl.LibraryName, ss.SiteName, sc.Name as SftpName
      FROM dbo.SharePointTransferJobs stj
      INNER JOIN dbo.SharePointLibraries sl ON stj.SharePointLibraryId = sl.Id
      INNER JOIN dbo.SharePointSites ss ON sl.SharePointSiteId = ss.Id
      INNER JOIN dbo.SftpConfigurations sc ON stj.SftpConfigurationId = sc.Id
      WHERE stj.TenantId = @tenantId AND stj.IsActive = 1
      ORDER BY stj.Name
    `;

    const jobs = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    const result: SharePointTransferJob[] = jobs.map((row: any) => ({
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      description: row.Description,
      sharePointLibraryId: row.SharePointLibraryId,
      sftpConfigurationId: row.SftpConfigurationId,
      sourcePath: row.SourcePath,
      destinationPath: row.DestinationPath,
      filePattern: row.FilePattern,
      transferMode: row.TransferMode,
      scheduleExpression: row.ScheduleExpression,
      isActive: row.IsActive,
      lastRunAt: row.LastRunAt,
      lastRunStatus: row.LastRunStatus,
      lastRunMessage: row.LastRunMessage,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      createdBy: row.CreatedBy,
      updatedBy: row.UpdatedBy,
      libraryName: row.LibraryName,
      siteName: row.SiteName,
      sftpName: row.SftpName
    }));

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: result
      }
    };
  } catch (error) {
    context.error('Error getting SharePoint transfer jobs:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Get a specific transfer job by ID
export async function getSharePointTransferJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const jobId = request.params.id;

    if (!tenantId || !jobId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID and Job ID are required'
        }
      };
    }

    const jobIdNumber = parseInt(jobId, 10);
    if (isNaN(jobIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid job ID'
        }
      };
    }

    context.log(`Getting SharePoint transfer job ${jobId} for tenant: ${tenantId}`);

    const query = `
      SELECT 
        stj.Id, stj.TenantId, stj.Name, stj.Description, 
        stj.SharePointLibraryId, stj.SftpConfigurationId,
        stj.SourcePath, stj.DestinationPath, stj.FilePattern, stj.TransferMode,
        stj.ScheduleExpression, stj.IsActive, stj.LastRunAt, stj.LastRunStatus, stj.LastRunMessage,
        stj.CreatedAt, stj.UpdatedAt, stj.CreatedBy, stj.UpdatedBy,
        sl.LibraryName, ss.SiteName, sc.Name as SftpName
      FROM dbo.SharePointTransferJobs stj
      INNER JOIN dbo.SharePointLibraries sl ON stj.SharePointLibraryId = sl.Id
      INNER JOIN dbo.SharePointSites ss ON sl.SharePointSiteId = ss.Id
      INNER JOIN dbo.SftpConfigurations sc ON stj.SftpConfigurationId = sc.Id
      WHERE stj.Id = @jobId AND stj.TenantId = @tenantId AND stj.IsActive = 1
    `;

    const jobs = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'jobId', type: 'int', value: jobIdNumber }
    ]);

    if (jobs.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Transfer job not found'
        }
      };
    }

    const row = jobs[0];
    const result: SharePointTransferJob = {
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      description: row.Description,
      sharePointLibraryId: row.SharePointLibraryId,
      sftpConfigurationId: row.SftpConfigurationId,
      sourcePath: row.SourcePath,
      destinationPath: row.DestinationPath,
      filePattern: row.FilePattern,
      transferMode: row.TransferMode,
      scheduleExpression: row.ScheduleExpression,
      isActive: row.IsActive,
      lastRunAt: row.LastRunAt,
      lastRunStatus: row.LastRunStatus,
      lastRunMessage: row.LastRunMessage,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      createdBy: row.CreatedBy,
      updatedBy: row.UpdatedBy,
      libraryName: row.LibraryName,
      siteName: row.SiteName,
      sftpName: row.SftpName
    };

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: result
      }
    };
  } catch (error) {
    context.error('Error getting SharePoint transfer job:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Create a new transfer job
export async function createSharePointTransferJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID is required'
        }
      };
    }

    const jobData = await request.json() as any;
    
    if (!jobData.name || !jobData.sharePointLibraryId || !jobData.sftpConfigurationId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Name, SharePoint library ID, and SFTP configuration ID are required'
        }
      };
    }

    context.log('Creating SharePoint transfer job for tenant:', tenantId);

    // Validate that the SharePoint library and SFTP configuration exist and belong to the tenant
    const validateQuery = `
      SELECT 
        sl.Id as LibraryId,
        sc.Id as SftpId
      FROM dbo.SharePointLibraries sl
      INNER JOIN dbo.SharePointSites ss ON sl.SharePointSiteId = ss.Id
      INNER JOIN dbo.SharePointConfigurations spc ON ss.SharePointConfigId = spc.Id
      CROSS JOIN dbo.SftpConfigurations sc
      WHERE sl.Id = @libraryId 
        AND sc.Id = @sftpConfigId 
        AND spc.TenantId = @tenantId 
        AND sc.TenantId = @tenantId
        AND sl.IsActive = 1 
        AND sc.IsActive = 1 
        AND ss.IsActive = 1 
        AND spc.IsActive = 1
    `;

    const validation = await dbService.executeQueryWithParams(validateQuery, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'libraryId', type: 'int', value: jobData.sharePointLibraryId },
      { name: 'sftpConfigId', type: 'int', value: jobData.sftpConfigurationId }
    ]);

    if (validation.length === 0) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid SharePoint library or SFTP configuration'
        }
      };
    }

    const query = `
      INSERT INTO dbo.SharePointTransferJobs (
        TenantId, Name, Description, SharePointLibraryId, SftpConfigurationId,
        SourcePath, DestinationPath, FilePattern, TransferMode, ScheduleExpression,
        IsActive, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      )
      OUTPUT INSERTED.Id
      VALUES (
        @tenantId, @name, @description, @sharePointLibraryId, @sftpConfigurationId,
        @sourcePath, @destinationPath, @filePattern, @transferMode, @scheduleExpression,
        1, GETUTCDATE(), GETUTCDATE(), @createdBy, @updatedBy
      )
    `;

    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'name', type: 'nvarchar', value: jobData.name },
      { name: 'description', type: 'nvarchar', value: jobData.description || null },
      { name: 'sharePointLibraryId', type: 'int', value: jobData.sharePointLibraryId },
      { name: 'sftpConfigurationId', type: 'int', value: jobData.sftpConfigurationId },
      { name: 'sourcePath', type: 'nvarchar', value: jobData.sourcePath || null },
      { name: 'destinationPath', type: 'nvarchar', value: jobData.destinationPath || null },
      { name: 'filePattern', type: 'nvarchar', value: jobData.filePattern || null },
      { name: 'transferMode', type: 'nvarchar', value: jobData.transferMode || 'copy' },
      { name: 'scheduleExpression', type: 'nvarchar', value: jobData.scheduleExpression || null },
      { name: 'createdBy', type: 'nvarchar', value: 'system' },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    const result = await dbService.executeQueryWithParams(query, parameters);
    const newJobId = result[0]?.Id;

    return {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        data: { id: newJobId },
        message: 'Transfer job created successfully'
      }
    };
  } catch (error) {
    context.error('Error creating SharePoint transfer job:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Update an existing transfer job
export async function updateSharePointTransferJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const jobId = request.params.id;

    if (!tenantId || !jobId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID and Job ID are required'
        }
      };
    }

    const jobIdNumber = parseInt(jobId, 10);
    if (isNaN(jobIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid job ID'
        }
      };
    }

    const jobData = await request.json() as any;
    
    context.log(`Updating SharePoint transfer job ${jobId} for tenant: ${tenantId}`);

    // Check if job exists
    const checkQuery = `
      SELECT Id FROM dbo.SharePointTransferJobs
      WHERE Id = @jobId AND TenantId = @tenantId AND IsActive = 1
    `;

    const checkResult = await dbService.executeQueryWithParams(checkQuery, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'jobId', type: 'int', value: jobIdNumber }
    ]);

    if (checkResult.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Transfer job not found'
        }
      };
    }

    // Build dynamic update query
    const updateFields = [];
    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'jobId', type: 'int', value: jobIdNumber },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    if (jobData.name) {
      updateFields.push('Name = @name');
      parameters.push({ name: 'name', type: 'nvarchar', value: jobData.name });
    }

    if (jobData.description !== undefined) {
      updateFields.push('Description = @description');
      parameters.push({ name: 'description', type: 'nvarchar', value: jobData.description });
    }

    if (jobData.sourcePath !== undefined) {
      updateFields.push('SourcePath = @sourcePath');
      parameters.push({ name: 'sourcePath', type: 'nvarchar', value: jobData.sourcePath });
    }

    if (jobData.destinationPath !== undefined) {
      updateFields.push('DestinationPath = @destinationPath');
      parameters.push({ name: 'destinationPath', type: 'nvarchar', value: jobData.destinationPath });
    }

    if (jobData.filePattern !== undefined) {
      updateFields.push('FilePattern = @filePattern');
      parameters.push({ name: 'filePattern', type: 'nvarchar', value: jobData.filePattern });
    }

    if (jobData.transferMode) {
      updateFields.push('TransferMode = @transferMode');
      parameters.push({ name: 'transferMode', type: 'nvarchar', value: jobData.transferMode });
    }

    if (jobData.scheduleExpression !== undefined) {
      updateFields.push('ScheduleExpression = @scheduleExpression');
      parameters.push({ name: 'scheduleExpression', type: 'nvarchar', value: jobData.scheduleExpression });
    }

    if (jobData.isActive !== undefined) {
      updateFields.push('IsActive = @isActive');
      parameters.push({ name: 'isActive', type: 'bit', value: jobData.isActive });
    }

    if (updateFields.length === 0) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'No valid fields provided for update'
        }
      };
    }

    updateFields.push('UpdatedAt = GETUTCDATE()');

    const query = `
      UPDATE dbo.SharePointTransferJobs
      SET ${updateFields.join(', ')}, UpdatedBy = @updatedBy
      WHERE Id = @jobId AND TenantId = @tenantId AND IsActive = 1
    `;

    await dbService.executeQueryWithParams(query, parameters);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        message: 'Transfer job updated successfully'
      }
    };
  } catch (error) {
    context.error('Error updating SharePoint transfer job:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Delete (soft delete) a transfer job
export async function deleteSharePointTransferJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const jobId = request.params.id;

    if (!tenantId || !jobId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID and Job ID are required'
        }
      };
    }

    const jobIdNumber = parseInt(jobId, 10);
    if (isNaN(jobIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid job ID'
        }
      };
    }

    context.log(`Deleting SharePoint transfer job ${jobId} for tenant: ${tenantId}`);

    const query = `
      UPDATE dbo.SharePointTransferJobs
      SET IsActive = 0, UpdatedAt = GETUTCDATE(), UpdatedBy = @updatedBy
      WHERE Id = @jobId AND TenantId = @tenantId AND IsActive = 1
    `;

    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'jobId', type: 'int', value: jobIdNumber },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    const result = await dbService.executeQueryWithParams(query, parameters);

    if (result.length === 0 || result[0]?.rowsAffected === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Transfer job not found'
        }
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        message: 'Transfer job deleted successfully'
      }
    };
  } catch (error) {
    context.error('Error deleting SharePoint transfer job:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Get transfer history for a job
export async function getSharePointFileTransfers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const jobId = request.params.jobId;

    if (!tenantId || !jobId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID and Job ID are required'
        }
      };
    }

    const jobIdNumber = parseInt(jobId, 10);
    if (isNaN(jobIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid job ID'
        }
      };
    }

    context.log(`Getting file transfer history for job ${jobId} and tenant: ${tenantId}`);

    const query = `
      SELECT 
        sft.Id, sft.TransferJobId, sft.SharePointFileId, sft.FileName, sft.FilePath,
        sft.FileSize, sft.ModifiedAt, sft.TransferredAt, sft.TransferStatus, 
        sft.ErrorMessage, sft.SftpDestination
      FROM dbo.SharePointFileTransfers sft
      INNER JOIN dbo.SharePointTransferJobs stj ON sft.TransferJobId = stj.Id
      WHERE stj.Id = @jobId AND stj.TenantId = @tenantId
      ORDER BY sft.TransferredAt DESC
    `;

    const transfers = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'jobId', type: 'int', value: jobIdNumber }
    ]);

    const result: SharePointFileTransfer[] = transfers.map((row: any) => ({
      id: row.Id,
      transferJobId: row.TransferJobId,
      sharePointFileId: row.SharePointFileId,
      fileName: row.FileName,
      filePath: row.FilePath,
      fileSize: row.FileSize,
      modifiedAt: row.ModifiedAt,
      transferredAt: row.TransferredAt,
      transferStatus: row.TransferStatus,
      errorMessage: row.ErrorMessage,
      sftpDestination: row.SftpDestination
    }));

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: result
      }
    };
  } catch (error) {
    context.error('Error getting file transfer history:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Register HTTP routes
app.http('getSharePointTransferJobs', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/transfer-jobs/list',
  handler: getSharePointTransferJobs
});

app.http('getSharePointTransferJob', {
  methods: ['GET', 'OPTIONS'], 
  route: 'sharepoint/transfer-jobs/get/{id}',
  handler: getSharePointTransferJob
});

app.http('createSharePointTransferJob', {
  methods: ['POST', 'OPTIONS'],
  route: 'sharepoint/transfer-jobs',
  handler: createSharePointTransferJob
});

app.http('updateSharePointTransferJob', {
  methods: ['PUT', 'OPTIONS'],
  route: 'sharepoint/transfer-jobs/update/{id}',
  handler: updateSharePointTransferJob
});

app.http('deleteSharePointTransferJob', {
  methods: ['DELETE', 'OPTIONS'],
  route: 'sharepoint/transfer-jobs/delete/{id}',
  handler: deleteSharePointTransferJob
});

app.http('getSharePointFileTransfers', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/transfer-jobs/{jobId}/transfers',
  handler: getSharePointFileTransfers
});
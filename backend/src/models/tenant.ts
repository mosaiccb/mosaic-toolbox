import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Zod schemas for validation
export const TenantConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Tenant name is required'),
  description: z.string().optional(),
  ukgClientId: z.string().min(1, 'UKG Client ID is required'),
  ukgClientSecret: z.string().min(1, 'UKG Client Secret is required'),
  ukgRedirectUri: z.string().url('Valid redirect URI is required'),
  ukgScopes: z.array(z.string()).default(['read:employee', 'read:company']),
  ukgBaseUrl: z.string().url('Valid UKG base URL is required'),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastSyncAt: z.date().optional(),
  metadata: z.record(z.any()).optional()
});

export const TenantCreateSchema = TenantConfigSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  lastSyncAt: true 
}).transform(data => ({
  ...data,
  description: data.description || undefined
}));

export const TenantUpdateSchema = TenantConfigSchema.partial().omit({ 
  id: true, 
  createdAt: true 
}).transform(data => ({
  ...data,
  name: data.name || undefined,
  description: data.description || undefined
}));

export const TenantQuerySchema = z.object({
  active: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  search: z.string().optional()
}).transform(data => ({
  ...data,
  active: data.active || undefined
}));

// TypeScript interfaces
export interface TenantConfig {
  id: string;
  name: string;
  description?: string;
  ukgClientId: string;
  ukgClientSecret: string;
  ukgRedirectUri: string;
  ukgScopes: string[];
  ukgBaseUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
  metadata?: Record<string, any>;
}

export interface TenantCreate {
  name: string;
  description?: string;
  ukgClientId: string;
  ukgClientSecret: string;
  ukgRedirectUri: string;
  ukgScopes?: string[];
  ukgBaseUrl: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface TenantUpdate {
  name?: string;
  description?: string;
  ukgClientId?: string;
  ukgClientSecret?: string;
  ukgRedirectUri?: string;
  ukgScopes?: string[];
  ukgBaseUrl?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface TenantQuery {
  active?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

// Tenant metadata for public responses (without sensitive data)
export interface TenantMetadata {
  id: string;
  name: string;
  description?: string;
  ukgRedirectUri: string;
  ukgScopes: string[];
  ukgBaseUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
  metadata?: Record<string, any>;
}

// Custom error classes
export class TenantError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

export class TenantNotFoundError extends TenantError {
  constructor(tenantId: string) {
    super(`Tenant with ID '${tenantId}' not found`, 'TENANT_NOT_FOUND', 404);
  }
}

export class TenantValidationError extends TenantError {
  constructor(message: string) {
    super(message, 'TENANT_VALIDATION_ERROR', 400);
  }
}

export class TenantAlreadyExistsError extends TenantError {
  constructor(tenantName: string) {
    super(`Tenant with name '${tenantName}' already exists`, 'TENANT_ALREADY_EXISTS', 409);
  }
}

// Utility functions
export function generateTenantId(): string {
  return uuidv4();
}

export function validateTenantConfig(config: unknown): TenantConfig {
  const result = TenantConfigSchema.safeParse(config);
  if (!result.success) {
    throw new TenantValidationError(
      `Invalid tenant configuration: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }
  return result.data as TenantConfig;
}

export function validateTenantCreate(data: unknown): TenantCreate {
  const result = TenantCreateSchema.safeParse(data);
  if (!result.success) {
    throw new TenantValidationError(
      `Invalid tenant creation data: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }
  return result.data as TenantCreate;
}

export function validateTenantUpdate(data: unknown): TenantUpdate {
  const result = TenantUpdateSchema.safeParse(data);
  if (!result.success) {
    throw new TenantValidationError(
      `Invalid tenant update data: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }
  return result.data;
}

export function validateTenantQuery(query: unknown): TenantQuery {
  const result = TenantQuerySchema.safeParse(query);
  if (!result.success) {
    throw new TenantValidationError(
      `Invalid tenant query: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }
  return result.data;
}

export function toTenantMetadata(config: TenantConfig): TenantMetadata {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    ukgRedirectUri: config.ukgRedirectUri,
    ukgScopes: config.ukgScopes,
    ukgBaseUrl: config.ukgBaseUrl,
    isActive: config.isActive,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    lastSyncAt: config.lastSyncAt,
    metadata: config.metadata
  };
}

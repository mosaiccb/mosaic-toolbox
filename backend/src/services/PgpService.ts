import * as openpgp from 'openpgp';
import { TenantDatabaseService } from './TenantDatabaseService';

export interface PgpEncryptionOptions {
    data: Uint8Array;
    keyId: number;
    tenantId: string;
    filename?: string;
}

export interface PgpEncryptionResult {
    encryptedData: Uint8Array;
    originalSize: number;
    encryptedSize: number;
    keyFingerprint: string;
}

export class PgpService {
    private tenantService: TenantDatabaseService;

    constructor() {
        this.tenantService = new TenantDatabaseService();
    }

    /**
     * Encrypt data using the specified PGP key
     * @param options Encryption options including data and key ID
     * @returns Encrypted data and metadata
     */
    async encryptData(options: PgpEncryptionOptions): Promise<PgpEncryptionResult> {
        const { data, keyId, tenantId, filename } = options;

        try {
            // Get PGP key metadata from database
            const keyMetadata = await this.getPgpKeyMetadata(keyId, tenantId);
            if (!keyMetadata) {
                throw new Error(`PGP key with ID ${keyId} not found`);
            }

            // Retrieve the actual PGP key from Key Vault
            const pgpKeyArmored = await this.tenantService.getSecretByName(keyMetadata.KeyVaultSecretName);
            if (!pgpKeyArmored) {
                throw new Error(`PGP key not found in Key Vault: ${keyMetadata.KeyVaultSecretName}`);
            }

            // Read and validate the PGP key
            const publicKey = await openpgp.readKey({ armoredKey: pgpKeyArmored });
            
            // Prepare message for encryption
            const message = await openpgp.createMessage({ 
                binary: data,
                filename: filename || 'encrypted-file'
            });

            // Encrypt the message
            const encrypted = await openpgp.encrypt({
                message,
                encryptionKeys: publicKey,
                format: 'binary',
                config: {
                    allowMissingKeyFlags: true
                }
            });

            const encryptedData = new Uint8Array(encrypted as Uint8Array);

            // Update usage tracking
            await this.updateKeyUsage(keyId, tenantId);

            return {
                encryptedData,
                originalSize: data.length,
                encryptedSize: encryptedData.length,
                keyFingerprint: publicKey.getFingerprint()
            };

        } catch (error) {
            console.error('PGP encryption failed:', error);
            throw new Error(`PGP encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validate a PGP public key
     * @param armoredKey The armored PGP public key
     * @returns Key validation result with fingerprint and user info
     */
    async validatePublicKey(armoredKey: string): Promise<{
        isValid: boolean;
        fingerprint?: string;
        userIds?: string[];
        keyType?: string;
        error?: string;
    }> {
        try {
            const key = await openpgp.readKey({ armoredKey });
            
            // Check if it's a public key (not private)
            if (key.isPrivate()) {
                return {
                    isValid: false,
                    error: 'Private keys are not allowed. Please provide a public key only.'
                };
            }

            // Extract user IDs
            const userIds = key.getUserIDs();
            
            // Get key type - simplified approach
            const keyType = 'RSA'; // Most common, can be enhanced later

            return {
                isValid: true,
                fingerprint: key.getFingerprint(),
                userIds,
                keyType
            };

        } catch (error) {
            return {
                isValid: false,
                error: error instanceof Error ? error.message : 'Invalid PGP key format'
            };
        }
    }

    /**
     * Get PGP key metadata from database
     * @param keyId The PGP key ID
     * @param tenantId The tenant ID
     * @returns PGP key metadata
     */
    private async getPgpKeyMetadata(keyId: number, tenantId: string): Promise<any> {
        const query = `
            SELECT Id, Name, Description, KeyVaultSecretName, KeyFingerprint, CreatedAt
            FROM dbo.PgpKeys 
            WHERE Id = @keyId AND TenantId = @tenantId AND IsActive = 1
        `;

        const result = await this.tenantService.executeQueryWithParams(query, [
            { name: 'keyId', type: 'Int', value: keyId },
            { name: 'tenantId', type: 'NVarChar', value: tenantId }
        ]);

        return result[0] || null;
    }

    /**
     * Update key usage statistics
     * @param keyId The PGP key ID
     * @param tenantId The tenant ID
     */
    private async updateKeyUsage(keyId: number, tenantId: string): Promise<void> {
        // Note: Usage tracking not implemented in current database schema
        // Could be added later with LastUsedAt and UsageCount columns
        return Promise.resolve();
    }

    /**
     * Get encryption statistics for a key
     * @param keyId The PGP key ID
     * @param tenantId The tenant ID
     * @returns Usage statistics
     */
    async getKeyUsageStats(keyId: number, tenantId: string): Promise<{
        usageCount: number;
        lastUsedAt: Date | null;
        createdAt: Date;
    } | null> {
        const keyMetadata = await this.getPgpKeyMetadata(keyId, tenantId);
        if (!keyMetadata) {
            return null;
        }

        return {
            usageCount: 0, // Usage count not tracked in current schema
            lastUsedAt: null, // LastUsedAt not tracked in current schema
            createdAt: keyMetadata.CreatedAt
        };
    }
}

export default PgpService;
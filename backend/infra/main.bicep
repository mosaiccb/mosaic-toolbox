targetScope = 'resourceGroup'

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Id of the user or app to assign application roles')
param principalId string

// Tags that should be applied to all resources
var tags = {
  'azd-env-name': 'prod'
}

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = uniqueString(subscription().id, resourceGroup().id, location)

// Create Azure Function App
resource functionApp 'Microsoft.Web/sites@2022-03-01' = {
  name: 'mosaic-toolbox'
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('mosaic-toolbox')
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'KEY_VAULT_NAME'
          value: 'mosaic-toolbox-kv'
        }
        {
          name: 'AZURE_KEY_VAULT_ENDPOINT'
          value: 'https://mosaic-toolbox-kv.vault.azure.net/'
        }
      ]
    }
  }
  tags: union(tags, { 'azd-service-name': 'mosaic-toolbox' })
}

// App Service Plan for Function App
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${abbrs.webServerFarms}${resourceToken}'
  location: location
  sku: {
    name: 'S1'
    tier: 'Standard'
  }
  properties: {
    reserved: false
  }
  tags: tags
}

// Storage Account for Function App
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${abbrs.storageStorageAccounts}${resourceToken}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
  tags: tags
}

// Using existing Key Vault: kv-s4eh2pl2z7ipa
// Key Vault creation commented out - using existing vault

output AZURE_KEY_VAULT_ENDPOINT string = 'https://mosaic-toolbox-kv.vault.azure.net/'
output AZURE_KEY_VAULT_NAME string = 'mosaic-toolbox-kv'
output AZURE_RESOURCE_VAULT_ID string = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${resourceGroup().name}/providers/Microsoft.KeyVault/vaults/mosaic-toolbox-kv'
output AZURE_FUNCTION_APP_NAME string = functionApp.name

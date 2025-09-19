targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Id of the user or app to assign application roles')
param principalId string

// Optional parameters to override the default azd resource naming conventions.
// Add the following to main.parameters.json to set a value:
// "resourceGroupName": {
//      "value": "myGroupName"
// }
param resourceGroupName string = ''
param staticWebAppName string = ''

@description('Azure AD Tenant ID')
param azureTenantId string

@description('Azure AD Client ID')
param azureClientId string

@secure()
@description('Azure AD Client Secret')
param azureClientSecret string

// Variables
var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

// The application frontend
module web './core/host/staticwebapp.bicep' = {
  name: 'web'
  scope: rg
  params: {
    name: !empty(staticWebAppName) ? staticWebAppName : '${abbrs.webStaticSites}web-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    sku: {
      name: 'Standard'
      tier: 'Standard'
    }
    azureTenantId: azureTenantId
    azureClientId: azureClientId
    azureClientSecret: azureClientSecret
  }
}

// App outputs
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = azureTenantId
output APPLICATIONINSIGHTS_CONNECTION_STRING string = web.outputs.applicationInsightsConnectionString
output REACT_APP_WEB_BASE_URL string = web.outputs.uri

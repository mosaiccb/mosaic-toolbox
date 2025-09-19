param name string
param location string = resourceGroup().location
param tags object = {}

param sku object = {
  name: 'Standard'
  tier: 'Standard'
}

@description('Azure AD Tenant ID')
param azureTenantId string

@description('Azure AD Client ID')
param azureClientId string

@secure()
@description('Azure AD Client Secret')
param azureClientSecret string

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: name
  location: location
  tags: tags
  sku: sku
  properties: {
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
    }
  }
}

resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2022-09-01' = {
  name: 'appsettings'
  parent: staticWebApp
  properties: {
    AZURE_CLIENT_ID: azureClientId
    AZURE_CLIENT_SECRET: azureClientSecret
  }
}

// Application Insights for monitoring
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${name}-insights'
  location: location
  tags: union(tags, { 'azd-service-name': 'insights' })
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
  }
}

output uri string = 'https://${staticWebApp.properties.defaultHostname}'
output name string = staticWebApp.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString

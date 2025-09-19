# 🍕 Mosaic Operations Dashboard with Azure AD SSO

A modern React TypeScript application with Microsoft Entra ID (Azure AD) Single Sign-On for restaurant operations management. Deployed using Azure Developer CLI (`azd`) with Standard SKU for enterprise authentication.

## ⚠️ Standard SKU Required
This application requires **Azure Static Web Apps Standard SKU** ($9/month) for custom authentication with Microsoft Entra ID. The Free SKU only supports GitHub/Twitter authentication.

## 🚀 Quick Start with Azure Developer CLI (azd)

### Prerequisites
- [Azure Developer CLI (azd)](https://docs.microsoft.com/azure/developer/azure-developer-cli/install-azd)
- [Node.js 18+](https://nodejs.org/)
- Azure subscription with contributor access
- Azure AD tenant access for app registration

### 1. Clone and Setup
```bash
git clone your-repo
cd frontend-sso
npm install
```

### 2. Azure AD App Registration
1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click **New registration**:
   - **Name**: `Mosaic Dashboard SSO`
   - **Account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `Single-page application` → `http://localhost:3000`
3. After creation, note the **Application (client) ID**
4. Add production redirect URI after deployment: `https://[your-swa-name].azurestaticapps.net`

### 3. Configure Environment
Update `.azure/config` with your Azure AD details:
```env
AZURE_CLIENT_ID="your-app-registration-client-id"
AZURE_TENANT_ID="your-azure-tenant-id"
```

### 4. Deploy to Azure
```bash
# Login to Azure
azd auth login

# Initialize and deploy (first time)
azd up

# Or deploy updates
azd deploy
```

### 5. Configure Authentication
After deployment, update your Azure AD app registration with the production URL:
- Go to **Authentication** → Add redirect URI: `https://[your-swa-name].azurestaticapps.net`

That's it! 🎉 Your SWA with Standard SKU and Entra SSO is deployed.

## � Features

- ✅ **Microsoft Entra ID SSO** - Enterprise authentication with Azure AD
- ✅ **React + TypeScript** - Modern, type-safe frontend development
- ✅ **Azure Static Web Apps Standard SKU** - Custom authentication support ($9/month)
- ✅ **Azure Developer CLI** - Infrastructure as Code deployment
- ✅ **Role-based Access Control** - Admin, manager, and user roles
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **Security First** - Built-in authentication and authorization

## 💰 Cost Information
- **Standard SKU**: $9/month per Static Web App (required for Entra ID SSO)
- **Free Tier**: 100GB bandwidth included, $0.20/GB after
- **Custom Domains**: Included with Standard SKU
- **SSL Certificates**: Free and automatic

---

## 🛠️ Alternative Setup (Manual)

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click **New registration**
3. Configure:
   - **Name**: `Mosaic Dashboard SSO`
   - **Account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `Single-page application` → `http://localhost:3000`
4. Click **Register**
5. Note down the **Application (client) ID**

### 2. Configure Authentication

In your Azure AD app registration:

1. Go to **Authentication**
2. Add redirect URIs:
   - `http://localhost:3000`
   - `https://your-swa-domain.azurestaticapps.net`
3. Enable **Access tokens** and **ID tokens**
4. Set **Logout URL**: `http://localhost:3000`

### 3. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Azure AD details:
   ```env
   VITE_AZURE_CLIENT_ID=your-app-registration-client-id
   VITE_AZURE_TENANT_ID=a06810f5-b832-45e2-a50f-945ed8fae797
   VITE_BACKEND_API_URL=https://ukg-sync-clean-lmzcnwoeyto3g.azurewebsites.net
   ```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## � Azure Developer CLI Details

### Infrastructure as Code
The `azd` deployment includes:
- **Bicep Templates** - Automated resource provisioning
- **Standard SKU Configuration** - Required for custom authentication
- **Environment Management** - Dev, staging, and production environments
- **Resource Naming** - Consistent naming conventions

### Deployment Commands
```bash
# Check deployment status
azd show

# View environment settings
azd env list

# Update app settings
azd env set AZURE_TENANT_ID "a06810f5-b832-45e2-a50f-945ed8fae797"

# Redeploy specific service
azd deploy

# Clean up resources
azd down
```

### Cost Monitoring
Monitor your Standard SKU costs in Azure Portal:
- Go to **Cost Management + Billing**
- Filter by **Resource Group**: `rg-mosaic-dashboard`
- Expected cost: ~$9/month for Standard SKU

---

## 🔐 Authentication Flow

1. **Unauthenticated users** see a login screen
2. Click **"Sign in with Microsoft"** → Azure AD login
3. **Authenticated users** see the dashboard with:
   - Welcome message with user info
   - Role-based navigation
   - Sign-out functionality

## 📱 Application Structure

```
src/
├── auth/
│   └── authConfig.ts          # MSAL configuration
├── components/
│   └── Dashboard.tsx          # Main dashboard component  
├── App.tsx                    # Root component with MSAL provider
├── main.tsx                   # Application entry point
└── styles/                    # CSS files
```

## 🎯 Key Components

- **MsalProvider**: Wraps the app with Azure AD authentication context
- **AuthenticatedTemplate**: Renders content for logged-in users
- **UnauthenticatedTemplate**: Renders login screen for guests
- **Dashboard**: Main application interface with role-based features

## 🔧 Configuration Files

- `staticwebapp.config.json` - Azure SWA routing and auth rules
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration
- `.env` - Environment variables

## 🚨 Security Features

- **Enterprise SSO** - No password management needed
- **Multi-factor Authentication** - Supports Azure AD MFA
- **Role-based Access** - Different views for different user roles
- **Session Management** - Automatic token refresh
- **HTTPS Only** - Secure communication in production

## 📊 Dashboard Features

- **Sales Overview** - Real-time revenue tracking
- **Labor Management** - Staff scheduling and costs
- **Operations Metrics** - KPIs and performance data
- **User Profile** - Account settings and preferences

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Check code quality
- `npm run type-check` - Validate TypeScript

## 🔗 Integration with Backend

The app connects to your existing Azure Functions backend:
```env
VITE_BACKEND_API_URL=https://ukgsync-kv-5rrqlcuxyzlvy.azurewebsites.net
```

API calls will include Azure AD tokens for authentication.

## 📞 Support

For setup assistance or questions:
- Check Azure AD logs for authentication issues
- Review browser console for JavaScript errors  
- Verify environment variables are set correctly
- Ensure Azure AD app registration redirect URIs match your domain

---

**🎉 Your Mosaic dashboard with enterprise SSO is ready!** 

Users can now sign in with their Microsoft accounts and access role-based features securely.

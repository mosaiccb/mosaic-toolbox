# Mosaic Toolbox

A comprehensive UKG Ready integration platform with SFTP file management capabilities, built with modern web technologies and Azure cloud services.

## 🚀 Features

### Backend (Azure Functions v4)
- **UKG Ready API Integration**: Full integration with UKG Ready APIs for workforce management
- **SFTP File Operations**: Secure file transfer with configuration management
- **Multi-tenant Architecture**: Tenant-based data isolation and access control
- **Microsoft Entra ID Authentication**: SSO with role-based access control
- **Database Integration**: SQL Server with tenant-specific databases

### Frontend (React 19 + TypeScript)
- **Modern UI**: Built with React 19, TypeScript, Vite, and Tailwind CSS
- **SFTP Management**: Configuration management and file operations interface
- **Authentication**: MSAL integration for Microsoft Entra ID
- **Responsive Design**: Mobile-friendly interface with modern UX

### Key Capabilities
- SFTP server configuration management
- File browser with upload/download/delete operations
- Directory creation and file information
- Tenant-based access control
- Secure credential management via Azure Key Vault

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Azure         │    │   Database      │
│   (React)       │◄──►│   Functions     │◄──►│   (SQL Server)  │
│                 │    │                 │    │                 │
│ - SFTP Config   │    │ - SFTP Service  │    │ - Tenants       │
│ - File Browser  │    │ - UKG Ready API │    │ - SFTP Configs  │
│ - Auth (MSAL)   │    │ - Auth Service  │    │ - User Data     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Azure Key     │
                       │   Vault         │
                       │                 │
                       │ - SFTP Secrets  │
                       │ - API Keys      │
                       └─────────────────┘
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Azure Functions v4
- **Language**: TypeScript
- **Database**: SQL Server with mssql package
- **Authentication**: Microsoft Entra ID (MSAL)
- **SFTP**: ssh2 package for secure file transfers
- **Secrets**: Azure Key Vault

### Frontend
- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Authentication**: MSAL for React
- **HTTP Client**: Fetch API

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Azure CLI (`az`)
- Azure Developer CLI (`azd`)
- SQL Server instance
- Azure subscription with Key Vault access

### Backend Setup

1. **Clone and navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   - Copy `.env.example` to `.env` (if exists)
   - Set up Azure Key Vault secrets
   - Configure database connection strings

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Deploy to Azure:**
   ```bash
   azd up
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure MSAL:**
   - Update `src/config/msalConfig.ts` with your Azure AD app registration details

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
mosaic-toolbox/
├── backend/                    # Azure Functions backend
│   ├── src/
│   │   ├── functions/         # Azure Function endpoints
│   │   │   ├── sftp.ts       # SFTP file operations
│   │   │   ├── sftpConfigurations.ts
│   │   │   └── ...
│   │   ├── services/          # Business logic services
│   │   └── models/           # TypeScript interfaces
│   ├── infra/                # Azure infrastructure (Bicep)
│   └── package.json
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── sftp/        # SFTP-related components
│   │   │   └── ...
│   │   ├── api/             # API client functions
│   │   ├── config/          # Configuration files
│   │   └── contexts/        # React contexts
│   └── package.json
├── sql/                      # Database schemas
└── docs/                     # Documentation
```

## 🔧 Configuration

### SFTP Configuration Management

The application provides a complete SFTP configuration management system:

1. **Configuration Table**: View all configured SFTP servers
2. **Add/Edit Configurations**: Create or modify server connections
3. **File Operations**: Browse, upload, download, and delete files
4. **Directory Management**: Create directories and view file information

### Authentication Setup

1. Register an application in Azure Active Directory
2. Configure MSAL settings in `msalConfig.ts`
3. Set up appropriate API permissions
4. Configure tenant-specific access controls

## 🚀 Deployment

### Azure Deployment

1. **Initialize Azure Developer CLI:**
   ```bash
   azd init
   ```

2. **Deploy to Azure:**
   ```bash
   azd up
   ```

3. **Monitor deployment:**
   ```bash
   azd monitor
   ```

### Environment Variables

Create a `.env` file in the backend directory:

```env
AZURE_CLIENT_ID=your-client-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_SECRET=your-client-secret
DATABASE_CONNECTION_STRING=your-db-connection
KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📚 API Documentation

### SFTP Endpoints

- `GET /api/listSftpFiles?configId={id}&path={path}` - List files in directory
- `POST /api/uploadSftpFile` - Upload file to SFTP server
- `GET /api/downloadSftpFile` - Download file from SFTP server
- `DELETE /api/deleteSftpFile` - Delete file from SFTP server
- `POST /api/createSftpDirectory` - Create directory on SFTP server
- `GET /api/getSftpFileInfo` - Get file/directory information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `docs/` directory
- Review the troubleshooting guide

## 🔄 Recent Updates

- ✅ SFTP configuration management system
- ✅ File browser with upload/download operations
- ✅ Multi-tenant architecture with tenant-based access
- ✅ Microsoft Entra ID authentication integration
- ✅ Azure Functions v4 backend with TypeScript
- ✅ React 19 frontend with modern UI components
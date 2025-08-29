# 🚀 Google Sheets ↔ MySQL Sync Dashboard

A powerful real-time synchronization system between Google Sheets and MySQL database with smart auto-pilot features.

![Dashboard Preview](https://img.shields.io/badge/Next.js-14.0.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)
![Tailwind](https://img.shields.io/badge/Tailwind-3.3-cyan)

## ✨ Features

### 🔄 **Smart Sync System**
- **Real-time Sync Manager** - Background synchronization with configurable intervals
- **Smart Auto-Pilot** - Intelligent delta sync with change detection
- **Incremental Sync** - Efficient updates tracking only changes
- **Bulk Operations** - Sync all configurations simultaneously

### 📊 **Dashboard & Analytics**
- **Modern Glass-effect UI** with Tailwind CSS
- **Real-time Status Monitoring** - API health checks
- **Comprehensive Statistics** - Row counts, sync history, performance metrics
- **Activity Logs** - Detailed sync operation tracking
- **Responsive Design** - Mobile-friendly interface

### 🗂️ **Data Management**
- **Separate Data Viewing** - Dedicated pages for table data
- **Pagination & Search** - Efficient data browsing
- **CRUD Operations** - View, edit, delete table records
- **Multiple Sheet Support** - Manage multiple Google Sheets configurations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Google Cloud Service Account

### 1. Environment Setup

Create `.env.local`:

```bash
# Database Configuration
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=sheets_sync

# Google Sheets API - Service Account
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials.json

# NextJS Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
```

### 2. Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create Service Account credentials
5. Download credentials as `credentials.json`
6. Place `credentials.json` in project root

### 3. Installation & Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

## 🌐 Deployment on Vercel

1. **Fork/Clone** this repository
2. **Connect to Vercel** - Import your GitHub repository
3. **Environment Variables** - Add all `.env.local` variables to Vercel dashboard
4. **Service Account** - Upload `credentials.json` content as environment variable:
   ```bash
   GOOGLE_SERVICE_ACCOUNT_KEY_CONTENT={"type": "service_account", ...}
   ```
5. **Deploy** - Automatic deployment on push

### Environment Variables for Vercel:
```bash
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=sheets_sync
GOOGLE_SERVICE_ACCOUNT_KEY_CONTENT={"type": "service_account", "project_id": "..."}
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret-key-here
```

## 📋 API Reference

### Sync Operations
```bash
POST /api/sync/[configId]     # Sync specific configuration
POST /api/sync/all            # Sync all active configurations
GET  /api/sync/status         # Get sync status
GET  /api/sync/realtime       # Real-time sync status
```

### Data Operations
```bash
GET  /api/data/view           # Get paginated table data
GET  /api/stats               # Dashboard statistics
GET  /api/sync-configs        # List all configurations
```

## 🔧 Configuration

### Adding a Google Sheet

1. **Dashboard** → **Add Sheet** button
2. Provide:
   - **Sheet Name** - Display name for your configuration
   - **Google Sheet URL** - Full URL of your Google Sheet
   - **Sheet Tab Name** - Specific tab/worksheet name
   - **Table Name** - MySQL table name (auto-generated or custom)

3. **Grant Access** - Share your Google Sheet with the service account email

### Sync Options

- **Manual Sync** - On-demand synchronization
- **Real-time Sync** - Background sync every 2 minutes
- **Smart Auto-Pilot** - Intelligent sync every 30 seconds with change detection

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

---

**Made with ❤️ using Next.js, TypeScript, and Tailwind CSS**

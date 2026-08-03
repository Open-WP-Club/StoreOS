# StoreOS - Built for WooCommerce

A modern desktop application for managing multiple WooCommerce stores. Built with Electron and React, this app provides a streamlined interface for managing orders, products, and inventory across multiple WooCommerce stores.

## Features

- **Multiple Store Support** - Connect and manage multiple WooCommerce stores from a single application
- **Orders Management** - View, search, filter, and update order statuses
- **Products Management** - Full CRUD operations for products with search and filtering
- **Inventory Management** - Monitor stock levels, update quantities, and track low-stock items
- **Dashboard** - Get an overview of your store's key metrics
- **Secure Authentication** - Store credentials are saved locally using WooCommerce REST API keys
- **Smart Caching** - Intelligent data caching system that reduces API calls and improves performance
- **Manual Sync** - Quick sync buttons in the header to manually refresh data when needed

## Data Caching

The application uses an intelligent caching system to minimize API calls and improve performance:

### Cache Strategy

All data is cached locally using IndexedDB for persistent storage and in-memory caching for fast access. The cache duration varies based on how frequently each data type changes:

| Data Type | Cache Duration | Reason |
|-----------|---------------|---------|
| **Products** | 1 hour | Products rarely change |
| **Inventory** | 30 minutes | Inventory levels change moderately |
| **Recent Orders** (last 7 days) | 15 minutes | Recent orders may be updated frequently |
| **Old Orders** (7+ days) | 7 days | Old orders almost never change |

### Split Order Caching

Orders are automatically split into two separate caches based on their age:
- **Recent orders** (created/modified in the last 7 days) are cached for 15 minutes
- **Old orders** (7+ days old) are cached for 7 days

This approach dramatically reduces unnecessary API calls for historical data while ensuring recent orders stay up-to-date.

### Manual Refresh

Use the "Quick Sync" buttons in the application header to manually refresh any data type:
- **Orders** - Clears both recent and old order caches
- **Products** - Refreshes product catalog
- **Inventory** - Updates stock levels

### Benefits

- ✅ Reduced server load and API usage
- ✅ Faster page loads and data access
- ✅ Works offline with cached data
- ✅ Automatic cache invalidation based on data age
- ✅ Manual control when fresh data is needed

## Screenshots

The application includes:
- Store setup page for adding WooCommerce store credentials
- Dashboard with key metrics and quick actions
- Orders page with filtering and status updates
- Products page with grid view and detailed editing
- Inventory page with stock level monitoring

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 16 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd StoreOS
```

2. Install dependencies:
```bash
pnpm install
```

## Development

To run the application in development mode:

```bash
pnpm run dev
```

This will:
1. Start the Vite development server on port 5173
2. Launch the Electron application
3. Open developer tools automatically

The app will hot-reload as you make changes to the code.

## Building

To build the application for production:

```bash
pnpm run build:electron
```

This will create distributable packages in the `dist` folder.

## Setting Up WooCommerce API Access

Before you can connect your WooCommerce store, you need to generate API credentials:

1. Log in to your WooCommerce admin panel
2. Navigate to **WooCommerce → Settings → Advanced → REST API**
3. Click **Add key**
4. Fill in the details:
   - Description: "Desktop Manager" (or any name you prefer)
   - User: Select your admin user
   - Permissions: Select **Read/Write**
5. Click **Generate API key**
6. Copy both the **Consumer Key** and **Consumer Secret** (you won't be able to see the secret again!)

## Using the Application

### First Launch

1. When you first launch the app, you'll see the Setup page
2. Fill in your store details:
   - **Store Name**: A friendly name for your store (e.g., "My Main Store")
   - **Store URL**: Your WooCommerce store URL (e.g., https://yourstore.com)
   - **Consumer Key**: The key you generated (starts with `ck_`)
   - **Consumer Secret**: The secret you generated (starts with `cs_`)
3. Click **Add Store** to test the connection and save

### Adding Multiple Stores

1. Navigate to the **Settings** tab
2. Fill in the form with your additional store's credentials
3. Click **Add Store**
4. Switch between stores using the dropdown in the header

### Managing Orders

- **View Orders**: Click on the Orders tab to see all orders
- **Filter Orders**: Use the status dropdown to filter by order status
- **Search Orders**: Search by order ID, customer name, or email
- **Update Status**: Use the dropdown in the Actions column to change order status
- **View Details**: Click the "View" button to see full order details

### Managing Products

- **View Products**: Click on the Products tab to see all products in a grid
- **Search Products**: Use the search bar to find products by name, SKU, or ID
- **Edit Product**: Click on a product card, then click "Edit Product"
- **Update Details**: Modify name, price, stock quantity, and stock status
- **Delete Product**: Click "Delete" in the product details modal

### Managing Inventory

- **View Stock Levels**: See all products with their current stock levels
- **Filter Products**: Filter by "In Stock", "Low Stock (≤5)", or "Out of Stock"
- **Update Stock**: Enter a new quantity and click "Update" or press Enter
- **Monitor Low Stock**: Products with low stock are highlighted in yellow
- **Track Out of Stock**: Out of stock products are highlighted in red

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI framework
- **Vite** - Build tool and development server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **WooCommerce REST API** - Backend integration
- **React Router** - Navigation

## Project Structure

```
StoreOS/
├── electron/           # Electron main process
│   └── main.js
├── src/
│   ├── components/    # React components
│   │   ├── Layout.jsx
│   │   └── StoreSelector.jsx
│   ├── pages/         # Page components
│   │   ├── Dashboard.jsx
│   │   ├── OrdersPage.jsx
│   │   ├── ProductsPage.jsx
│   │   ├── InventoryPage.jsx
│   │   └── SetupPage.jsx
│   ├── services/      # API services
│   │   └── woocommerce.js
│   ├── stores/        # State management
│   │   └── useStore.js
│   ├── App.jsx        # Main app component
│   ├── main.jsx       # React entry point
│   └── index.css      # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Security Notes

- Store credentials are saved locally in your browser's localStorage
- All API communications use HTTPS
- Consumer keys and secrets are never exposed in the UI
- The application runs locally on your machine

## Troubleshooting

### Connection Failed

If you get a "Connection failed" error:
1. Verify your store URL is correct (include https://)
2. Check that your Consumer Key and Secret are correct
3. Ensure your WooCommerce REST API is enabled
4. Check if your site has SSL (WooCommerce API requires HTTPS)

### API Errors

If you encounter API errors:
1. Verify the API user has the correct permissions
2. Check your WooCommerce version (requires WooCommerce 3.0+)
3. Look at the browser console for detailed error messages

### Application Won't Start

If the application won't launch:
1. Make sure all dependencies are installed: `pnpm install`
2. Try clearing node_modules and reinstalling: `rm -rf node_modules && pnpm install`
3. Check that ports 5173 is available

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions, please open an issue on the GitHub repository.

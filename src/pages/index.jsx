import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Layout from "./Layout.jsx";
import { recims } from "@/api/recimsClient";

// Auth pages (not lazy loaded for faster initial access)
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import("./Dashboard"));
const NewShipment = lazy(() => import("./NewShipment"));
const MaterialClassification = lazy(() => import("./MaterialClassification"));
const BinManagement = lazy(() => import("./BinManagement"));
const Reports = lazy(() => import("./Reports"));
const Settings = lazy(() => import("./Settings"));
const NewBin = lazy(() => import("./NewBin"));
const SuperAdmin = lazy(() => import("./SuperAdmin"));
const ManageContainers = lazy(() => import("./ManageContainers"));
const ManageProductSKUs = lazy(() => import("./ManageProductSKUs"));
const QualityControl = lazy(() => import("./QualityControl"));
const ManageQCCriteria = lazy(() => import("./ManageQCCriteria"));
const InventoryManagement = lazy(() => import("./InventoryManagement"));
const AddToInventory = lazy(() => import("./AddToInventory"));
const CustomerManagement = lazy(() => import("./CustomerManagement"));
const NewCustomer = lazy(() => import("./NewCustomer"));
const VendorManagement = lazy(() => import("./VendorManagement"));
const NewVendor = lazy(() => import("./NewVendor"));
const PurchaseOrders = lazy(() => import("./PurchaseOrders"));
const CreatePurchaseOrder = lazy(() => import("./CreatePurchaseOrder"));
const GeneratePOBarcodes = lazy(() => import("./GeneratePOBarcodes"));
const ReceivePurchaseOrder = lazy(() => import("./ReceivePurchaseOrder"));
const ViewPurchaseOrder = lazy(() => import("./ViewPurchaseOrder"));
const AlertSettings = lazy(() => import("./AlertSettings"));
const AIInsights = lazy(() => import("./AIInsights"));
const PrintBinLabel = lazy(() => import("./PrintBinLabel"));
const PrintInboundLabel = lazy(() => import("./PrintInboundLabel"));
const EditPurchaseOrder = lazy(() => import("./EditPurchaseOrder"));
const SalesOrderManagement = lazy(() => import("./SalesOrderManagement"));
const CreateSalesOrder = lazy(() => import("./CreateSalesOrder"));
const ViewSalesOrder = lazy(() => import("./ViewSalesOrder"));
const PrintPackingSlip = lazy(() => import("./PrintPackingSlip"));
const CreateInvoice = lazy(() => import("./CreateInvoice"));
const ViewInvoice = lazy(() => import("./ViewInvoice"));
const InvoiceManagement = lazy(() => import("./InvoiceManagement"));
const UserManagement = lazy(() => import("./UserManagement"));
const MobileWarehouse = lazy(() => import("./MobileWarehouse"));
const QuickScan = lazy(() => import("./QuickScan"));
const MobileBinLookup = lazy(() => import("./MobileBinLookup"));
const MobileQC = lazy(() => import("./MobileQC"));
const MobilePicking = lazy(() => import("./MobilePicking"));
const MobilePutAway = lazy(() => import("./MobilePutAway"));
const EmailTemplates = lazy(() => import("./EmailTemplates"));
const PrintSKULabel = lazy(() => import("./PrintSKULabel"));
const ZoneManagement = lazy(() => import("./ZoneManagement"));
const ComplianceCertificates = lazy(() => import("./ComplianceCertificates"));
const CreateCertificate = lazy(() => import("./CreateCertificate"));
const ViewCertificate = lazy(() => import("./ViewCertificate"));
const AdvancedAnalytics = lazy(() => import("./AdvancedAnalytics"));
const SendCertificate = lazy(() => import("./SendCertificate"));
const ComplianceAnalytics = lazy(() => import("./ComplianceAnalytics"));
const ManageTenantContacts = lazy(() => import("./ManageTenantContacts"));
const PrintInventoryLabels = lazy(() => import("./PrintInventoryLabels"));
const InventorySorting = lazy(() => import("./InventorySorting"));
const SalesDashboard = lazy(() => import("./SalesDashboard"));
const TestPage = lazy(() => import("./TestPage"));
const CreateWaybill = lazy(() => import("./CreateWaybill"));
const ViewWaybill = lazy(() => import("./ViewWaybill"));
const CreateProformaInvoice = lazy(() => import("./CreateProformaInvoice"));
const InboundShipments = lazy(() => import("./InboundShipments"));
const ManageCarriers = lazy(() => import("./ManageCarriers"));
const StockTransfer = lazy(() => import("./StockTransfer"));
const InventoryAdjustment = lazy(() => import("./InventoryAdjustment"));
const InventoryByLocation = lazy(() => import("./InventoryByLocation"));
const InventoryBySKU = lazy(() => import("./InventoryBySKU"));
const EditShipment = lazy(() => import("./EditShipment"));
const PrintBinQR = lazy(() => import("./PrintBinQR"));
const QBOSetup = lazy(() => import("./QBOSetup"));
const PrintQuotation = lazy(() => import("./PrintQuotation"));
const PrintOrderConfirmation = lazy(() => import("./PrintOrderConfirmation"));
const SignatureComplete = lazy(() => import("./SignatureComplete"));
const EditSalesOrder = lazy(() => import("./EditSalesOrder"));
const Home = lazy(() => import("./Home"));
const ManageTenantCategories = lazy(() => import("./ManageTenantCategories"));
const TenantConsole = lazy(() => import("./TenantConsole"));
const CreateTenant = lazy(() => import("./CreateTenant"));
const ViewTenant = lazy(() => import("./ViewTenant"));
const EditTenant = lazy(() => import("./EditTenant"));
const TenantUsers = lazy(() => import("./TenantUsers"));
const EditCustomer = lazy(() => import("./EditCustomer"));
const ViewCustomer = lazy(() => import("./ViewCustomer"));
const EditVendor = lazy(() => import("./EditVendor"));
const ViewVendor = lazy(() => import("./ViewVendor"));
const EditMyTenant = lazy(() => import("./EditMyTenant"));
const ManageMaterialCategories = lazy(() => import("./ManageMaterialCategories"));
const AIInsightsModule = lazy(() => import("./AIInsightsModule"));
const CrossTenantDashboard = lazy(() => import("./CrossTenantDashboard"));

// Define all page names for route mapping
const PAGE_NAMES = [
    'Login', 'ForgotPassword',
    'Dashboard', 'NewShipment', 'MaterialClassification', 'BinManagement', 'Reports', 'Settings',
    'NewBin', 'SuperAdmin', 'ManageContainers', 'ManageProductSKUs', 'QualityControl', 
    'ManageQCCriteria', 'InventoryManagement', 'AddToInventory', 'CustomerManagement', 
    'NewCustomer', 'VendorManagement', 'NewVendor', 'PurchaseOrders', 'CreatePurchaseOrder',
    'GeneratePOBarcodes', 'ReceivePurchaseOrder', 'ViewPurchaseOrder', 'AlertSettings',
    'AIInsights', 'PrintBinLabel', 'PrintInboundLabel', 'EditPurchaseOrder', 
    'SalesOrderManagement', 'CreateSalesOrder', 'ViewSalesOrder', 'PrintPackingSlip',
    'CreateInvoice', 'ViewInvoice', 'InvoiceManagement', 'UserManagement', 'MobileWarehouse',
    'QuickScan', 'MobileBinLookup', 'MobileQC', 'MobilePicking', 'MobilePutAway',
    'EmailTemplates', 'PrintSKULabel', 'ZoneManagement', 'ComplianceCertificates',
    'CreateCertificate', 'ViewCertificate', 'AdvancedAnalytics', 'SendCertificate',
    'ComplianceAnalytics', 'ManageTenantContacts', 'PrintInventoryLabels', 'InventorySorting',
    'SalesDashboard', 'TestPage', 'CreateWaybill', 'ViewWaybill', 'CreateProformaInvoice',
    'InboundShipments', 'ManageCarriers', 'StockTransfer', 'InventoryAdjustment',
    'InventoryByLocation', 'InventoryBySKU', 'EditShipment', 'PrintBinQR', 'QBOSetup',
    'PrintQuotation', 'PrintOrderConfirmation', 'SignatureComplete', 'EditSalesOrder',
    'Home', 'ManageTenantCategories', 'TenantConsole', 'CreateTenant', 'ViewTenant',
    'EditTenant', 'TenantUsers', 'EditCustomer', 'ViewCustomer', 'EditVendor', 'ViewVendor', 'EditMyTenant',
    'ManageMaterialCategories', 'AIInsightsModule', 'CrossTenantDashboard'
];

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = PAGE_NAMES.find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || PAGE_NAMES[0];
}

// Loading fallback component
function LoadingFallback() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
            </div>
        </div>
    );
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const navigate = useNavigate();
    const normalizedPath = location.pathname.toLowerCase();
    const hasToken = recims.auth?.isAuthenticated ? recims.auth.isAuthenticated() : false;

    useEffect(() => {
        if (!hasToken && normalizedPath !== '/login' && normalizedPath !== '/forgotpassword') {
            navigate('/Login', { replace: true });
        }

        if (hasToken && (normalizedPath === '/' || normalizedPath === '/login')) {
            navigate('/Dashboard', { replace: true });
        }
    }, [hasToken, normalizedPath, navigate]);

    const currentPage = _getCurrentPage(location.pathname);

    useEffect(() => {
        if (!hasToken) return;
        const canonicalSlug = currentPage?.replace(/\s+/g, '-');
        if (!canonicalSlug) return;
        const activeSlug = location.pathname.replace(/^\/+/, '');
        if (!activeSlug) return;
        if (activeSlug === canonicalSlug) return;
        if (activeSlug.toLowerCase() !== canonicalSlug.toLowerCase()) return;

        const targetPath = `/${canonicalSlug}`;
        const composed = `${targetPath}${location.search ?? ''}${location.hash ?? ''}`;
        navigate(composed, { replace: true });
    }, [currentPage, hasToken, location.pathname, location.search, location.hash, navigate]);

    if (!hasToken) {
        return (
            <Suspense fallback={<LoadingFallback />}>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/Login" element={<Login />} />
                    <Route path="/ForgotPassword" element={<ForgotPassword />} />
                    <Route path="*" element={<Login />} />
                </Routes>
            </Suspense>
        );
    }

    return (
        <Layout currentPageName={currentPage}>
            <Suspense fallback={<LoadingFallback />}>
                <Routes>            
                    
                        <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/NewShipment" element={<NewShipment />} />
                
                <Route path="/MaterialClassification" element={<MaterialClassification />} />
                
                <Route path="/BinManagement" element={<BinManagement />} />
                
                <Route path="/Reports" element={<Reports />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/NewBin" element={<NewBin />} />
                
                <Route path="/SuperAdmin" element={<SuperAdmin />} />
                
                <Route path="/ManageContainers" element={<ManageContainers />} />
                
                <Route path="/ManageProductSKUs" element={<ManageProductSKUs />} />
                
                <Route path="/QualityControl" element={<QualityControl />} />
                
                <Route path="/ManageQCCriteria" element={<ManageQCCriteria />} />
                
                <Route path="/InventoryManagement" element={<InventoryManagement />} />
                
                <Route path="/AddToInventory" element={<AddToInventory />} />
                
                <Route path="/CustomerManagement" element={<CustomerManagement />} />
                
                <Route path="/NewCustomer" element={<NewCustomer />} />
                
                <Route path="/VendorManagement" element={<VendorManagement />} />
                
                <Route path="/NewVendor" element={<NewVendor />} />
                
                <Route path="/PurchaseOrders" element={<PurchaseOrders />} />
                
                <Route path="/CreatePurchaseOrder" element={<CreatePurchaseOrder />} />
                
                <Route path="/GeneratePOBarcodes" element={<GeneratePOBarcodes />} />
                
                <Route path="/ReceivePurchaseOrder" element={<ReceivePurchaseOrder />} />
                
                <Route path="/ViewPurchaseOrder" element={<ViewPurchaseOrder />} />
                
                <Route path="/AlertSettings" element={<AlertSettings />} />
                
                <Route path="/AIInsights" element={<AIInsights />} />
                
                <Route path="/PrintBinLabel" element={<PrintBinLabel />} />
                
                <Route path="/PrintInboundLabel" element={<PrintInboundLabel />} />
                
                <Route path="/EditPurchaseOrder" element={<EditPurchaseOrder />} />
                
                <Route path="/SalesOrderManagement" element={<SalesOrderManagement />} />
                
                <Route path="/CreateSalesOrder" element={<CreateSalesOrder />} />
                
                <Route path="/ViewSalesOrder" element={<ViewSalesOrder />} />
                
                <Route path="/PrintPackingSlip" element={<PrintPackingSlip />} />
                
                <Route path="/CreateInvoice" element={<CreateInvoice />} />
                
                <Route path="/ViewInvoice" element={<ViewInvoice />} />
                
                <Route path="/InvoiceManagement" element={<InvoiceManagement />} />
                
                <Route path="/UserManagement" element={<UserManagement />} />
                
                <Route path="/MobileWarehouse" element={<MobileWarehouse />} />
                
                <Route path="/QuickScan" element={<QuickScan />} />
                
                <Route path="/MobileBinLookup" element={<MobileBinLookup />} />
                
                <Route path="/MobileQC" element={<MobileQC />} />
                
                <Route path="/MobilePicking" element={<MobilePicking />} />
                
                <Route path="/MobilePutAway" element={<MobilePutAway />} />
                
                <Route path="/EmailTemplates" element={<EmailTemplates />} />
                
                <Route path="/PrintSKULabel" element={<PrintSKULabel />} />
                
                <Route path="/ZoneManagement" element={<ZoneManagement />} />
                
                <Route path="/ComplianceCertificates" element={<ComplianceCertificates />} />
                
                <Route path="/CreateCertificate" element={<CreateCertificate />} />
                
                <Route path="/ViewCertificate" element={<ViewCertificate />} />
                
                <Route path="/AdvancedAnalytics" element={<AdvancedAnalytics />} />
                
                <Route path="/SendCertificate" element={<SendCertificate />} />
                
                <Route path="/ComplianceAnalytics" element={<ComplianceAnalytics />} />
                
                <Route path="/ManageTenantContacts" element={<ManageTenantContacts />} />
                
                <Route path="/PrintInventoryLabels" element={<PrintInventoryLabels />} />
                
                <Route path="/InventorySorting" element={<InventorySorting />} />
                
                <Route path="/SalesDashboard" element={<SalesDashboard />} />
                
                <Route path="/TestPage" element={<TestPage />} />
                
                <Route path="/CreateWaybill" element={<CreateWaybill />} />
                
                <Route path="/ViewWaybill" element={<ViewWaybill />} />
                
                <Route path="/CreateProformaInvoice" element={<CreateProformaInvoice />} />
                
                <Route path="/InboundShipments" element={<InboundShipments />} />
                
                <Route path="/ManageCarriers" element={<ManageCarriers />} />
                
                <Route path="/StockTransfer" element={<StockTransfer />} />
                
                <Route path="/InventoryAdjustment" element={<InventoryAdjustment />} />
                
                <Route path="/InventoryByLocation" element={<InventoryByLocation />} />
                
                <Route path="/InventoryBySKU" element={<InventoryBySKU />} />
                
                <Route path="/EditShipment" element={<EditShipment />} />
                
                <Route path="/PrintBinQR" element={<PrintBinQR />} />
                
                <Route path="/QBOSetup" element={<QBOSetup />} />
                
                <Route path="/PrintQuotation" element={<PrintQuotation />} />
                
                <Route path="/PrintOrderConfirmation" element={<PrintOrderConfirmation />} />
                
                <Route path="/SignatureComplete" element={<SignatureComplete />} />
                
                <Route path="/EditSalesOrder" element={<EditSalesOrder />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/ManageTenantCategories" element={<ManageTenantCategories />} />
                
                <Route path="/TenantConsole" element={<TenantConsole />} />
                
                <Route path="/CreateTenant" element={<CreateTenant />} />
                
                <Route path="/ViewTenant" element={<ViewTenant />} />
                
                <Route path="/EditTenant" element={<EditTenant />} />
                
                <Route path="/TenantUsers" element={<TenantUsers />} />
                
                <Route path="/EditCustomer" element={<EditCustomer />} />
                <Route path="/ViewCustomer" element={<ViewCustomer />} />
                
                <Route path="/EditVendor" element={<EditVendor />} />
                <Route path="/ViewVendor" element={<ViewVendor />} />
                
                <Route path="/EditMyTenant" element={<EditMyTenant />} />
                
                <Route path="/ManageMaterialCategories" element={<ManageMaterialCategories />} />
                
                <Route path="/AIInsightsModule" element={<AIInsightsModule />} />
                
                <Route path="/CrossTenantDashboard" element={<CrossTenantDashboard />} />
                
                </Routes>
            </Suspense>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
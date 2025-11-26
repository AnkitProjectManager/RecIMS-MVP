import React, { useState, useCallback } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, FileText, AlertCircle, Package } from "lucide-react";
import { format } from "date-fns";
import TenantHeader from "@/components/TenantHeader";

export default function CreateCertificate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tenantConfig } = useTenant();
  const [error, setError] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  
  const [formData, setFormData] = useState({
    po_id: '',
    vendor_id: '',
    vendor_name: '',
    vendor_address: '',
    certificate_date: new Date().toISOString().split('T')[0],
    material_type: '',
    material_category: '',
    weight_lbs: '',
    weight_kg: '',
    diversion_rate: '95',
    destruction_method: 'recycling',
    destruction_date: new Date().toISOString().split('T')[0],
    destruction_location: '',
    certificate_details: '',
    certifying_officer: '',
    certifying_title: '',
    certifying_email: '',
    certifying_phone: '',
    contact_type: 'primary',
    notes: ''
  });

  React.useEffect(() => {
    if (user && tenantConfig) {
      const facilityAddress = [
        tenantConfig.address_line1,
        tenantConfig.address_line2,
        `${tenantConfig.city}, ${tenantConfig.state_province} ${tenantConfig.postal_code}`,
        tenantConfig.country
      ].filter(Boolean).join(', ');
      
      setFormData(prev => ({
        ...prev,
        destruction_location: facilityAddress,
        certifying_officer: user.full_name,
        certifying_email: user.email
      }));
    }
  }, [user, tenantConfig]);

  // Fetch received/partially received POs
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['receivablePOs', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const pos = await recims.entities.PurchaseOrder.filter({ 
        tenant_id: user.tenant_id,
        status: { $in: ['partially_received', 'received'] }
      });
      return pos;
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Fetch PO line items for selected PO
  const { data: poLineItems = [] } = useQuery({
    queryKey: ['poLineItems', selectedPO?.id],
    queryFn: async () => {
      if (!selectedPO?.id) return [];
      const items = await recims.entities.PurchaseOrderItem.filter({ 
        po_id: selectedPO.id,
        status: 'received'
      });
      // Filter out fully certified items
      return items.filter(item => {
        const certStatus = item.certificate_status || 'not_certified';
        return certStatus !== 'certified';
      });
    },
    enabled: !!selectedPO?.id,
    initialData: [],
  });

  // Fetch tenant contacts
  const { data: tenantContacts = [] } = useQuery({
    queryKey: ['tenantContacts', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.TenantContact.filter({ 
        tenant_id: user.tenant_id,
        is_active: true
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Vendor.filter({ tenant_id: user.tenant_id, status: 'active' });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const generateCertNumber = async () => {
    const year = new Date().getFullYear();
    const prefix = `CERT-${year}-`;
    
    const existingCerts = await recims.entities.ComplianceCertificate.filter({
      tenant_id: user.tenant_id
    });
    
    const maxNumber = existingCerts
      .filter(cert => cert.certificate_number?.startsWith(prefix))
      .reduce((max, cert) => {
        const num = parseInt(cert.certificate_number.split('-')[2]);
        return num > max ? num : max;
      }, 0);
    
    return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
  };

  const handlePOChange = async (poId) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    setSelectedPO(po);
    setSelectedItems([]);

    // Get vendor info
    const vendor = vendors.find(v => v.id === po.vendor_id);
    const address = vendor ? [
      vendor.bill_line1,
      vendor.bill_line2,
      `${vendor.bill_city}, ${vendor.bill_region} ${vendor.bill_postal_code}`,
      vendor.bill_country_code
    ].filter(Boolean).join(', ') : '';

    setFormData({
      ...formData,
      po_id: po.id,
      vendor_id: po.vendor_id,
      vendor_name: po.vendor_name,
      vendor_address: address
    });
  };

  const handleItemToggle = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const calculateTotals = () => {
    let totalLbs = 0;
    let totalKg = 0;
    let categories = new Set();
    let types = new Set();

    selectedItems.forEach(item => {
      // Calculate uncertified weight
      const uncertifiedLbs = (item.actual_weight_lbs || 0) - (item.certified_weight_lbs || 0);
      const uncertifiedKg = (item.actual_weight_kg || 0) - (item.certified_weight_kg || 0);
      
      totalLbs += uncertifiedLbs;
      totalKg += uncertifiedKg;
      
      if (item.category) categories.add(item.category);
      if (item.product_type) types.add(item.product_type);
    });

    return {
      totalLbs,
      totalKg,
      materialCategory: Array.from(categories).join(', '),
      materialType: Array.from(types).join(', ')
    };
  };

  const handleContactChange = useCallback((contactType) => {
    const contact = tenantContacts.find(c => c.contact_type === contactType);
    if (contact) {
      setFormData(prev => ({
        ...prev,
        contact_type: contactType,
        certifying_officer: contact.contact_name,
        certifying_title: contact.job_title,
        certifying_email: contact.contact_email,
        certifying_phone: contact.contact_phone
      }));
    }
  }, [tenantContacts]);

  const createCertificateMutation = useMutation({
    mutationFn: async (isDraft) => {
      setError(null);

      if (selectedPO && selectedItems.length === 0) {
        throw new Error("Please select at least one item from the purchase order");
      }

      if (!selectedPO && !formData.vendor_name) {
        throw new Error("Vendor name is required");
      }

      if (!formData.material_type && !selectedPO) {
        throw new Error("Material type is required");
      }

      const certNumber = await generateCertNumber();
      const totals = selectedPO ? calculateTotals() : {
        totalLbs: parseFloat(formData.weight_lbs),
        totalKg: parseFloat(formData.weight_kg || formData.weight_lbs * 0.453592),
        materialCategory: formData.material_category,
        materialType: formData.material_type
      };

      // Check if this is a partial certificate
      const isPartial = selectedPO && selectedItems.length < poLineItems.length;

      // Create certificate
      const certificate = await recims.entities.ComplianceCertificate.create({
        certificate_number: certNumber,
        tenant_id: user.tenant_id,
        po_id: selectedPO?.id || null,
        po_number: selectedPO?.po_number || null,
        is_partial: isPartial,
        po_line_items: selectedItems.map(item => ({
          line_id: item.id,
          line_number: item.line_number,
          skid_number: item.skid_number,
          category: item.category,
          product_type: item.product_type,
          weight_lbs: (item.actual_weight_lbs || 0) - (item.certified_weight_lbs || 0),
          weight_kg: (item.actual_weight_kg || 0) - (item.certified_weight_kg || 0)
        })),
        vendor_id: formData.vendor_id || null,
        vendor_name: formData.vendor_name,
        vendor_address: formData.vendor_address,
        certificate_date: formData.certificate_date,
        material_type: totals.materialType,
        material_category: totals.materialCategory,
        weight_lbs: totals.totalLbs,
        weight_kg: totals.totalKg,
        diversion_rate: parseFloat(formData.diversion_rate),
        destruction_method: formData.destruction_method,
        destruction_date: formData.destruction_date,
        destruction_location: formData.destruction_location,
        certificate_details: formData.certificate_details,
        certifying_officer: formData.certifying_officer,
        certifying_title: formData.certifying_title,
        certifying_email: formData.certifying_email,
        certifying_phone: formData.certifying_phone,
        contact_type: formData.contact_type,
        status: isDraft ? 'draft' : 'issued',
        issued_by: !isDraft ? user.email : null,
        issued_at: !isDraft ? new Date().toISOString() : null,
        notes: formData.notes
      });

      // Update PO line items with certificate info
      if (selectedPO) {
        for (const item of selectedItems) {
          const uncertifiedLbs = (item.actual_weight_lbs || 0) - (item.certified_weight_lbs || 0);
          const uncertifiedKg = (item.actual_weight_kg || 0) - (item.certified_weight_kg || 0);
          
          const newCertifiedLbs = (item.certified_weight_lbs || 0) + uncertifiedLbs;
          const newCertifiedKg = (item.certified_weight_kg || 0) + uncertifiedKg;
          
          const isFullyCertified = Math.abs(newCertifiedLbs - (item.actual_weight_lbs || 0)) < 0.01;
          
          await recims.entities.PurchaseOrderItem.update(item.id, {
            certificate_status: isFullyCertified ? 'certified' : 'partially_certified',
            certificate_ids: [...(item.certificate_ids || []), certificate.id],
            certified_weight_kg: newCertifiedKg,
            certified_weight_lbs: newCertifiedLbs
          });
        }

        // Check if all items in PO are now certified
        const allItems = await recims.entities.PurchaseOrderItem.filter({ po_id: selectedPO.id });
        const allCertified = allItems.every(item => item.certificate_status === 'certified');
        
        if (allCertified) {
          await recims.entities.PurchaseOrder.update(selectedPO.id, {
            status: 'completed'
          });
        }
      }

      return certificate;
    },
    onSuccess: (certificate) => {
      queryClient.invalidateQueries({ queryKey: ['complianceCertificates'] });
      queryClient.invalidateQueries({ queryKey: ['poLineItems'] });
      queryClient.invalidateQueries({ queryKey: ['receivablePOs'] });
      navigate(createPageUrl(`ViewCertificate?id=${certificate.id}`));
    },
    onError: (err) => {
      setError(err.message || "Failed to create certificate");
    }
  });

  const totals = selectedPO ? calculateTotals() : null;
  const primaryContact = tenantContacts.find(c => c.contact_type === 'primary');

  React.useEffect(() => {
    if (primaryContact && !formData.certifying_officer) {
      handleContactChange('primary');
    }
  }, [formData.certifying_officer, handleContactChange, primaryContact]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("ComplianceCertificates")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Create Destruction Certificate
          </h1>
          <p className="text-sm text-gray-600">Generate compliance documentation from purchase orders or manual entry</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Source Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Certificate Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link to Purchase Order (Recommended)</Label>
              <Select
                value={formData.po_id}
                onValueChange={handlePOChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a received purchase order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Manual Entry (No PO Link)</SelectItem>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.vendor_name} ({po.status.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select a PO to automatically populate items that have been received
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PO Items Selection */}
      {selectedPO && poLineItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Select Items for Certificate
            </CardTitle>
            <p className="text-sm text-gray-600">
              {poLineItems.length === selectedPO.total_skids_received 
                ? "All items received - Complete Certificate"
                : `Partial Receipt: ${poLineItems.length} of ${selectedPO.total_skids_expected} items available`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {poLineItems.map((item) => {
                const uncertifiedLbs = (item.actual_weight_lbs || 0) - (item.certified_weight_lbs || 0);
                const uncertifiedKg = (item.actual_weight_kg || 0) - (item.certified_weight_kg || 0);
                const isSelected = selectedItems.some(i => i.id === item.id);
                
                return (
                  <div 
                    key={item.id}
                    className={`flex items-start gap-3 p-4 border rounded-lg ${
                      isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleItemToggle(item)}
                      id={`item-${item.id}`}
                    />
                    <label htmlFor={`item-${item.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{item.skid_number || `Line ${item.line_number}`}</p>
                          <p className="text-sm text-gray-600">{item.category} - {item.product_type}</p>
                          <p className="text-xs text-gray-500">
                            Received: {format(new Date(item.received_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-700">
                            {uncertifiedLbs.toFixed(2)} lbs
                          </p>
                          <p className="text-xs text-gray-500">
                            ({uncertifiedKg.toFixed(2)} kg)
                          </p>
                          {item.certified_weight_lbs > 0 && (
                            <p className="text-xs text-orange-600 mt-1">
                              Partially certified: {item.certified_weight_lbs.toFixed(2)} lbs
                            </p>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>

            {selectedItems.length > 0 && totals && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Certificate Summary</h4>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Items Selected:</p>
                    <p className="font-bold">{selectedItems.length} of {poLineItems.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Weight:</p>
                    <p className="font-bold">{totals.totalLbs.toFixed(2)} lbs ({totals.totalKg.toFixed(2)} kg)</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Material Category:</p>
                    <p className="font-bold">{totals.materialCategory}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Material Type:</p>
                    <p className="font-bold">{totals.materialType}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedPO && poLineItems.length === 0 && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 h-4" />
          <AlertDescription>
            No uncertified items available for this purchase order. All received items have been certified.
          </AlertDescription>
        </Alert>
      )}

      {/* Manual Entry Form (only if no PO selected) */}
      {!selectedPO && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Manual Certificate Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Vendor</Label>
                  <Select
                    value={formData.vendor_id}
                    onValueChange={(vendorId) => {
                      const vendor = vendors.find(v => v.id === vendorId);
                      if (vendor) {
                        const address = [
                          vendor.bill_line1,
                          vendor.bill_line2,
                          `${vendor.bill_city}, ${vendor.bill_region} ${vendor.bill_postal_code}`,
                          vendor.bill_country_code
                        ].filter(Boolean).join(', ');
                        setFormData({...formData, vendor_id: vendor.id, vendor_name: vendor.display_name || vendor.company_name, vendor_address: address});
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.display_name || vendor.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Or Enter Vendor Name *</Label>
                  <Input
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({...formData, vendor_name: e.target.value})}
                    placeholder="Vendor/Customer name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vendor Address</Label>
                <Textarea
                  value={formData.vendor_address}
                  onChange={(e) => setFormData({...formData, vendor_address: e.target.value})}
                  placeholder="Complete vendor address"
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Material Type *</Label>
                  <Input
                    value={formData.material_type}
                    onChange={(e) => setFormData({...formData, material_type: e.target.value})}
                    placeholder="e.g., Electronic Waste, Aluminum Scrap"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Material Category</Label>
                  <Input
                    value={formData.material_category}
                    onChange={(e) => setFormData({...formData, material_category: e.target.value})}
                    placeholder="PLASTICS, FERROUS, NON-FERROUS, etc."
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weight (lbs) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.weight_lbs}
                    onChange={(e) => setFormData({...formData, weight_lbs: e.target.value, weight_kg: (parseFloat(e.target.value) * 0.453592).toFixed(2)})}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.weight_kg}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Common Fields */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Certificate Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Certificate Date *</Label>
                <Input
                  type="date"
                  value={formData.certificate_date}
                  onChange={(e) => setFormData({...formData, certificate_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Destruction Date *</Label>
                <Input
                  type="date"
                  value={formData.destruction_date}
                  onChange={(e) => setFormData({...formData, destruction_date: e.target.value})}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Destruction Method *</Label>
                <Select
                  value={formData.destruction_method}
                  onValueChange={(value) => setFormData({...formData, destruction_method: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recycling">Recycling</SelectItem>
                    <SelectItem value="shredding">Shredding</SelectItem>
                    <SelectItem value="melting">Melting</SelectItem>
                    <SelectItem value="chemical_processing">Chemical Processing</SelectItem>
                    <SelectItem value="reprocessing">Reprocessing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Diversion Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.diversion_rate}
                  onChange={(e) => setFormData({...formData, diversion_rate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Destruction Location</Label>
              <Input
                value={formData.destruction_location}
                onChange={(e) => setFormData({...formData, destruction_location: e.target.value})}
                placeholder="Facility address"
              />
            </div>

            <div className="space-y-2">
              <Label>Certificate Details</Label>
              <Textarea
                value={formData.certificate_details}
                onChange={(e) => setFormData({...formData, certificate_details: e.target.value})}
                placeholder="Additional details about the materials and processing..."
                rows={4}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certifying Officer */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Certifying Officer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Contact Person</Label>
              <Select
                value={formData.contact_type}
                onValueChange={handleContactChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenantContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.contact_type}>
                      {contact.contact_type.charAt(0).toUpperCase() + contact.contact_type.slice(1)} - {contact.contact_name} ({contact.job_title})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom (Enter Manually)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Officer Name</Label>
                <Input
                  value={formData.certifying_officer}
                  onChange={(e) => setFormData({...formData, certifying_officer: e.target.value})}
                  placeholder="Officer name"
                  disabled={formData.contact_type !== 'custom'}
                />
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formData.certifying_title}
                  onChange={(e) => setFormData({...formData, certifying_title: e.target.value})}
                  placeholder="Title"
                  disabled={formData.contact_type !== 'custom'}
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.certifying_email}
                  onChange={(e) => setFormData({...formData, certifying_email: e.target.value})}
                  placeholder="Email"
                  disabled={formData.contact_type !== 'custom'}
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.certifying_phone}
                  onChange={(e) => setFormData({...formData, certifying_phone: e.target.value})}
                  placeholder="Phone"
                  disabled={formData.contact_type !== 'custom'}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate(createPageUrl("ComplianceCertificates"))}
          variant="outline"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={() => createCertificateMutation.mutate(true)}
          disabled={createCertificateMutation.isPending}
          variant="outline"
          className="flex-1"
        >
          <Save className="w-4 h-4 mr-2" />
          {createCertificateMutation.isPending ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button
          onClick={() => createCertificateMutation.mutate(false)}
          disabled={createCertificateMutation.isPending}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          <FileText className="w-4 h-4 mr-2" />
          {createCertificateMutation.isPending ? 'Creating...' : 'Issue Certificate'}
        </Button>
      </div>
    </div>
  );
}
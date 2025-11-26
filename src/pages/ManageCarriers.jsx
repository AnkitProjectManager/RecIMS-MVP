import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Plus,
  Edit,
  Save,
  X,
  Search,
  Truck,
  Plane,
  Ship,
  TrainFront,
  ExternalLink,
  Power,
  AlertCircle,
  CheckCircle,
  Mail,
  Phone,
  Building2,
  Globe,
  User,
  Package
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CARRIER_TYPES = [
  { value: 'TRUCK', label: 'Truck', icon: Truck, color: 'text-blue-600' },
  { value: 'RAIL', label: 'Rail', icon: TrainFront, color: 'text-green-600' },
  { value: 'AIR', label: 'Air', icon: Plane, color: 'text-purple-600' },
  { value: 'SEA', label: 'Sea', icon: Ship, color: 'text-cyan-600' }
];

const SERVICE_TYPES = [
  { value: 'TRUCK', label: 'Truck (LTL/FTL)', icon: Truck, color: 'bg-blue-100 text-blue-700', iconColor: 'text-blue-700' },
  { value: 'RAIL', label: 'Rail Freight', icon: TrainFront, color: 'bg-green-100 text-green-700', iconColor: 'text-green-700' },
  { value: 'AIR', label: 'Air Freight', icon: Plane, color: 'bg-purple-100 text-purple-700', iconColor: 'text-purple-700' },
  { value: 'SEA', label: 'Ocean/Sea Freight', icon: Ship, color: 'bg-cyan-100 text-cyan-700', iconColor: 'text-cyan-700' },
  { value: 'COURIER - GROUND', label: 'Courier - Ground', icon: Package, color: 'bg-orange-100 text-orange-700', iconColor: 'text-orange-700' },
  { value: 'COURIER - AIR', label: 'Courier - Air', icon: Plane, color: 'bg-pink-100 text-pink-700', iconColor: 'text-pink-700' }
];

export default function ManageCarriers() {
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState({
    carrier_code: '',
    company_name: '',
    contact_person: '',
    phone_number: '',
    sales_rep: '',
    email: '',
    billing_address: '',
    tenant_billing_account: '',
    carrier_type: 'TRUCK',
    service_types: [],
    website_url: '',
    status: 'active'
  });



  const { data: carriers = [], isLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => recims.entities.Carrier.list('company_name'),
    initialData: [],
  });

  const createCarrierMutation = useMutation({
    mutationFn: async (carrierData) => {
      console.log('Creating carrier with data:', carrierData);
      return await recims.entities.Carrier.create(carrierData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      setSuccess("Carrier created successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      setEditingCarrier(null); // Clear editing state
      resetForm();
    },
    onError: (err) => {
      console.error('Create carrier error:', err);
      setError(err.message || "Failed to create carrier");
      setTimeout(() => setError(null), 5000); // Changed timeout
    }
  });

  const updateCarrierMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('Updating carrier ID:', id, 'with data:', data);
      const result = await recims.entities.Carrier.update(id, data);
      console.log('Update result:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('Update success, invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      setSuccess("Carrier updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      setEditingCarrier(null); // Clear editing state
      resetForm();
    },
    onError: (err) => {
      console.error('Update carrier error:', err);
      setError(err.message || "Failed to update carrier");
      setTimeout(() => setError(null), 5000); // Changed timeout
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      return await recims.entities.Carrier.update(id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      setSuccess("Carrier status updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update carrier status");
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleEdit = (carrier) => {
    console.log('Editing carrier:', carrier);
    setEditingCarrier(carrier);
    setFormData({
      carrier_code: carrier.carrier_code || '',
      company_name: carrier.company_name || '',
      contact_person: carrier.contact_person || '',
      phone_number: carrier.phone_number || '',
      sales_rep: carrier.sales_rep || '',
      email: carrier.email || '',
      billing_address: carrier.billing_address || '',
      tenant_billing_account: carrier.tenant_billing_account || '',
      carrier_type: carrier.carrier_type || 'TRUCK',
      service_types: Array.isArray(carrier.service_types) ? carrier.service_types : [],
      website_url: carrier.website_url || '',
      status: carrier.status || 'active'
    });
    setIsDialogOpen(true);
  };

  const handleServiceTypeToggle = (serviceType) => {
    setFormData(prev => {
      const current = Array.isArray(prev.service_types) ? prev.service_types : [];
      const isSelected = current.includes(serviceType);
      
      const newServiceTypes = isSelected
        ? current.filter(t => t !== serviceType)
        : [...current, serviceType];
      
      console.log('Service types updated:', newServiceTypes);
      
      return {
        ...prev,
        service_types: newServiceTypes
      };
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    setError(null);

    console.log('Form submitted with data:', formData);
    console.log('Editing carrier:', editingCarrier);

    // Validation
    if (!formData.company_name?.trim()) {
      setError("Carrier name is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.carrier_code?.trim()) {
      setError("Abbreviation is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (formData.carrier_code.length > 10) {
      setError("Abbreviation must be 10 characters or less");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.contact_person?.trim()) {
      setError("Contact name is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.email?.trim()) {
      setError("Email address is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.tenant_billing_account?.trim()) {
      setError("Tenant billing account number is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.carrier_type) {
      setError("Carrier type is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.service_types || formData.service_types.length === 0) {
      setError("Please select at least one service type");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // URL validation if provided
    if (formData.website_url && formData.website_url.trim()) {
      try {
        new URL(formData.website_url);
        if (!formData.website_url.startsWith('http://') && !formData.website_url.startsWith('https://')) {
          setError("Website URL must start with http:// or https://");
          setTimeout(() => setError(null), 3000);
          return;
        }
      } catch {
        setError("Please enter a valid website URL");
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    // Check for duplicate abbreviation (only on create or if changed)
    if (!editingCarrier || (editingCarrier.carrier_code.toUpperCase() !== formData.carrier_code.toUpperCase())) {
      const duplicate = carriers.find(c => 
        c.carrier_code.toUpperCase() === formData.carrier_code.toUpperCase() &&
        c.id !== editingCarrier?.id
      );
      if (duplicate) {
        setError(`Abbreviation "${formData.carrier_code}" is already in use. Abbreviations must be unique.`);
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    const carrierData = {
      carrier_code: formData.carrier_code.toUpperCase(),
      company_name: formData.company_name.trim(),
      contact_person: formData.contact_person.trim(),
      phone_number: formData.phone_number?.trim() || null,
      sales_rep: formData.sales_rep?.trim() || null,
      email: formData.email.trim(),
      billing_address: formData.billing_address?.trim() || null,
      tenant_billing_account: formData.tenant_billing_account.trim(),
      carrier_type: formData.carrier_type,
      service_types: formData.service_types,
      website_url: formData.website_url?.trim() || null,
      status: formData.status
    };

    console.log('Final carrier data to save:', carrierData);

    if (editingCarrier) {
      console.log('Calling update mutation for carrier ID:', editingCarrier.id);
      updateCarrierMutation.mutate({ id: editingCarrier.id, data: carrierData });
    } else {
      console.log('Calling create mutation');
      createCarrierMutation.mutate(carrierData);
    }
  };

  const handleToggleStatus = (carrier) => {
    const newStatus = carrier.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    
    if (window.confirm(`Are you sure you want to ${action} "${carrier.company_name}"?`)) {
      toggleStatusMutation.mutate({ id: carrier.id, newStatus });
    }
  };

  const resetForm = () => {
    setEditingCarrier(null);
    setFormData({
      carrier_code: '',
      company_name: '',
      contact_person: '',
      phone_number: '',
      sales_rep: '',
      email: '',
      billing_address: '',
      tenant_billing_account: '',
      carrier_type: 'TRUCK',
      service_types: [],
      website_url: '',
      status: 'active'
    });
  };

  const filteredCarriers = carriers.filter(carrier => {
    const matchesSearch = !searchQuery || 
      carrier.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      carrier.carrier_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      carrier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || carrier.carrier_type === filterType;
    const matchesStatus = filterStatus === 'all' || carrier.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-700 border-green-300' 
      : 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getCarrierTypeIcon = (type) => {
    const carrierType = CARRIER_TYPES.find(t => t.value === type);
    if (!carrierType) return { Icon: Truck, color: 'text-gray-600' };
    return { Icon: carrierType.icon, color: carrierType.color };
  };

  const getServiceTypeBadge = (serviceType) => {
    const service = SERVICE_TYPES.find(s => s.value === serviceType);
    if (!service) return null;
    const Icon = service.icon;
    return (
      <Badge key={serviceType} className={`${service.color} gap-1.5 text-xs font-semibold border`}>
        <Icon className={`w-3.5 h-3.5 ${service.iconColor}`} />
        {service.label}
      </Badge>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SuperAdmin")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-600" />
            Carrier Management
          </h1>
          <p className="text-sm text-gray-600">Manage shipping carriers and logistics partners</p>
        </div>
        <Badge className="bg-blue-600 text-white">
          {filteredCarriers.length} Carrier{filteredCarriers.length !== 1 ? 's' : ''}
        </Badge>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Carrier
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Info Box */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Service Types:</strong> Configure what services each carrier provides (TRUCK, RAIL, AIR, SEA, COURIER - GROUND, COURIER - AIR). 
          Carriers can provide multiple service types. For example, FedEx and UPS should be flagged as both COURIER - GROUND and COURIER - AIR.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, abbreviation, or contact..."
                className="pl-10"
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CARRIER_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Carriers List */}
      <Card>
        <CardHeader>
          <CardTitle>Carriers ({filteredCarriers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredCarriers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No carriers found</p>
              <p className="text-sm">
                {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first carrier to get started'}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCarriers.map((carrier) => {
                const { Icon, color } = getCarrierTypeIcon(carrier.carrier_type);
                return (
                  <Card key={carrier.id} className={`hover:shadow-lg transition-shadow ${
                    carrier.status === 'inactive' ? 'opacity-60' : ''
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-lg bg-gray-100`}>
                            <Icon className={`w-6 h-6 ${color}`} />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{carrier.carrier_code}</p>
                            <Badge className={getStatusColor(carrier.status)} size="sm">
                              {carrier.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <h3 className="font-semibold text-gray-900 mb-3">{carrier.company_name}</h3>

                      {/* Service Types with Icons */}
                      {carrier.service_types && carrier.service_types.length > 0 && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Services Provided:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {carrier.service_types.map(serviceType => getServiceTypeBadge(serviceType))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{carrier.contact_person}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="truncate">{carrier.email}</span>
                        </div>
                        {carrier.phone_number && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{carrier.phone_number}</span>
                          </div>
                        )}
                        {carrier.website_url && (
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-gray-400" />
                            <a
                              href={carrier.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              Portal <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          onClick={() => handleEdit(carrier)}
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleToggleStatus(carrier)}
                          variant="outline"
                          size="sm"
                          className={`gap-2 ${
                            carrier.status === 'active'
                              ? 'border-red-300 text-red-600 hover:bg-red-50'
                              : 'border-green-300 text-green-600 hover:bg-green-50'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {carrier.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          resetForm();
          setEditingCarrier(null); // Ensure editingCarrier is reset when dialog closes
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              {editingCarrier ? `Edit Carrier: ${editingCarrier.carrier_code}` : 'Create New Carrier'}
            </DialogTitle>
            {editingCarrier && (
              <p className="text-sm text-gray-600">
                Editing: {editingCarrier.company_name}
              </p>
            )}
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6">
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General Info</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="billing">Billing & Portal</TabsTrigger>
              </TabsList>

              {/* General Info Tab */}
              <TabsContent value="general" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">
                      Carrier Name * <span className="text-xs text-gray-500">(Full legal or operational name)</span>
                    </Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                      placeholder="e.g., Canadian National Railway"
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="carrier_code">
                      Abbreviation * <span className="text-xs text-gray-500">(Unique, max 10 chars)</span>
                    </Label>
                    <Input
                      id="carrier_code"
                      value={formData.carrier_code}
                      onChange={(e) => setFormData({...formData, carrier_code: e.target.value.toUpperCase()})}
                      placeholder="e.g., CN"
                      maxLength={10}
                      required
                      disabled={!!editingCarrier}
                      className={editingCarrier ? 'bg-gray-100' : ''}
                    />
                    {editingCarrier && (
                      <p className="text-xs text-gray-500">Abbreviation cannot be changed after creation</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="carrier_type">Primary Carrier Type *</Label>
                    <Select
                      value={formData.carrier_type}
                      onValueChange={(value) => setFormData({...formData, carrier_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARRIER_TYPES.map(type => {
                          const Icon = type.icon;
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${type.color}`} />
                                {type.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({...formData, status: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Service Types Selection */}
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <Label className="text-base font-semibold">Service Types Provided * (Select at least one)</Label>
                  <p className="text-xs text-gray-600 mb-3">
                    Select all services this carrier provides. For couriers like FedEx/UPS, select both COURIER - GROUND and COURIER - AIR.
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    {SERVICE_TYPES.map(service => {
                      const Icon = service.icon;
                      const isChecked = formData.service_types?.includes(service.value) || false;
                      
                      return (
                        <div key={service.value} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-white transition-colors">
                          <Checkbox
                            id={`service-${service.value}`}
                            checked={isChecked}
                            onCheckedChange={() => handleServiceTypeToggle(service.value)}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={`service-${service.value}`}
                              className="flex items-center gap-2 cursor-pointer font-medium text-sm"
                            >
                              <Icon className={`w-4 h-4 ${service.iconColor}`} />
                              {service.label}
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {formData.service_types?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 p-3 bg-white rounded border">
                      <p className="text-xs text-gray-600 w-full mb-1">Selected Services ({formData.service_types.length}):</p>
                      {formData.service_types.map(st => getServiceTypeBadge(st))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Contact Name *</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                      placeholder="e.g., Michael Roberts"
                      maxLength={50}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="info@carrier.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">1-800 Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      placeholder="1-800-555-0172"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sales_rep">Sales Account Representative</Label>
                    <Input
                      id="sales_rep"
                      value={formData.sales_rep}
                      onChange={(e) => setFormData({...formData, sales_rep: e.target.value})}
                      placeholder="e.g., Jane Collins"
                      maxLength={50}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Billing & Portal Tab */}
              <TabsContent value="billing" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant_billing_account">Tenant Billing Account Number *</Label>
                    <Input
                      id="tenant_billing_account"
                      value={formData.tenant_billing_account}
                      onChange={(e) => setFormData({...formData, tenant_billing_account: e.target.value})}
                      placeholder="e.g., ACCT-2024-1182"
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Unique number used for billing the tenant through this carrier
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing_address">Billing Address</Label>
                    <Textarea
                      id="billing_address"
                      value={formData.billing_address}
                      onChange={(e) => setFormData({...formData, billing_address: e.target.value})}
                      placeholder="123 Freight Lane, Toronto, ON M1A 2B3"
                      rows={3}
                      maxLength={255}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website_url">Website / Portal Link</Label>
                    <Input
                      id="website_url"
                      type="url"
                      value={formData.website_url}
                      onChange={(e) => setFormData({...formData, website_url: e.target.value})}
                      placeholder="https://portal.carrier.com/login"
                    />
                    <p className="text-xs text-gray-500">
                      URL for document uploads (BOLs, manifests). Must start with http:// or https://
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingCarrier(null); // Ensure editingCarrier is reset
                  resetForm();
                }}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCarrierMutation.isPending || updateCarrierMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {createCarrierMutation.isPending || updateCarrierMutation.isPending
                  ? 'Saving...'
                  : editingCarrier ? 'Update Carrier' : 'Create Carrier'}
              </Button>
            </div>
            
            {/* Debug Info */}
            {editingCarrier && (
              <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded border mt-4">
                <p>Debug: Editing carrier ID: {editingCarrier.id}</p>
                <p>Service types selected: {formData.service_types?.length || 0}</p>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
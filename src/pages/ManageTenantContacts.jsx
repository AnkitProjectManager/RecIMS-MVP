import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  Users,
  AlertCircle,
  Upload,
  FileSignature
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TenantHeader from "@/components/TenantHeader";
import { useTenant } from "@/components/TenantContext";

export default function ManageTenantContacts() {
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  
  const [formData, setFormData] = useState({
    tenant_id: '',
    contact_type: 'primary',
    contact_name: '',
    first_name: '',
    last_name: '',
    contact_email: '',
    contact_phone: '',
    job_title: '',
    signature_type: 'none',
    signature_url: '',
    signature_font: 'Allura',
    is_active: true
  });



  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['tenantContacts'],
    queryFn: async () => {
      return await recims.entities.TenantContact.list('-created_date');
    },
    initialData: [],
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      return await recims.entities.Tenant.list();
    },
    initialData: [],
  });

  const tenantOptions = React.useMemo(() => {
    return [...tenants].sort((a, b) => {
      const nameA = (a.display_name || a.name || '').toString().toLowerCase();
      const nameB = (b.display_name || b.name || '').toString().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [tenants]);

  React.useEffect(() => {
    if (!formData.tenant_id) {
      const fallbackTenantId = user?.tenant_id || tenantOptions[0]?.tenant_id;
      if (fallbackTenantId) {
        setFormData((prev) => ({ ...prev, tenant_id: fallbackTenantId }));
      }
    }
  }, [formData.tenant_id, tenantOptions, user?.tenant_id]);

  const contactsByTenant = React.useMemo(() => {
    const map = tenantOptions.reduce((acc, tenant) => {
      acc[tenant.tenant_id] = [];
      return acc;
    }, {});

    contacts.forEach((contact) => {
      if (contact.is_active === false) return;
      const key = contact.tenant_id || '';
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(contact);
    });

    return map;
  }, [contacts, tenantOptions]);

  const accentClasses = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-orange-600', 'bg-sky-600', 'bg-amber-600'];

  const createContactMutation = useMutation({
    mutationFn: async (data) => {
      if (editingContact) {
        return await recims.entities.TenantContact.update(editingContact.id, data);
      }
      return await recims.entities.TenantContact.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenantContacts'] });
      setSuccess(editingContact ? "Contact updated successfully" : "Contact created successfully");
      setShowDialog(false);
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to save contact");
      setTimeout(() => setError(null), 5000);
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id) => {
      return await recims.entities.TenantContact.update(id, { is_active: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenantContacts'] });
      setSuccess("Contact deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      tenant_id: contact.tenant_id,
      contact_type: contact.contact_type,
      contact_name: contact.contact_name,
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      contact_email: contact.contact_email,
      contact_phone: contact.contact_phone || '',
      job_title: contact.job_title,
      signature_type: contact.signature_type || 'none',
      signature_url: contact.signature_url || '',
      signature_font: contact.signature_font || 'Allura',
      is_active: contact.is_active !== false
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    const fallbackTenantId = user?.tenant_id || tenantOptions[0]?.tenant_id || '';
    setFormData({
      tenant_id: fallbackTenantId,
      contact_type: 'primary',
      contact_name: '',
      first_name: '',
      last_name: '',
      contact_email: '',
      contact_phone: '',
      job_title: '',
      signature_type: 'none',
      signature_url: '',
      signature_font: 'Allura',
      is_active: true
    });
    setEditingContact(null);
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError("Please upload a JPG or PNG file");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setUploadingSignature(true);
    setError(null);

    try {
      const result = await recims.integrations.Core.UploadFile({ file });
      setFormData({
        ...formData,
        signature_type: 'upload',
        signature_url: result.file_url
      });
      setSuccess("Signature uploaded successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to upload signature");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.contact_name || !formData.contact_email || !formData.job_title) {
      setError("Please fill in all required fields");
      return;
    }

    if (!formData.tenant_id) {
      setError('Please select a tenant for this contact');
      return;
    }

    createContactMutation.mutate(formData);
  };

  const getContactTypeBadge = (type) => {
    const colors = {
      primary: 'bg-blue-100 text-blue-700',
      secondary: 'bg-green-100 text-green-700',
      backup: 'bg-orange-100 text-orange-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SuperAdmin")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-purple-600" />
            Tenant Contact Management
          </h1>
          <p className="text-sm text-gray-600">Manage tenant contact persons and signatures</p>
        </div>
        <Badge className="bg-purple-600 text-white">PHASE III</Badge>
        <Button 
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Contact
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
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {tenantOptions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tenants available. Create a tenant first to manage contacts.</p>
          </CardContent>
        </Card>
      ) : (
        tenantOptions.map((tenant, index) => {
          const tenantContacts = contactsByTenant[tenant.tenant_id] || [];
          const tenantName = tenant.display_name || tenant.name || `Tenant ${index + 1}`;
          const accentClass = accentClasses[index % accentClasses.length];

          return (
            <Card key={tenant.tenant_id} className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${accentClass}`}></div>
                  {tenantName} Contacts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tenantContacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No contacts configured for {tenantName}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tenantContacts.map((contact) => (
                      <div key={contact.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg">{contact.contact_name}</h3>
                              <Badge className={getContactTypeBadge(contact.contact_type)}>
                                {contact.contact_type.toUpperCase()}
                              </Badge>
                              {contact.signature_type !== 'none' && (
                                <Badge variant="outline" className="gap-1">
                                  <FileSignature className="w-3 h-3" />
                                  Signature
                                </Badge>
                              )}
                            </div>
                            <div className="grid md:grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-600">Title:</span>
                                <span className="ml-2 font-medium">{contact.job_title}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Email:</span>
                                <span className="ml-2">{contact.contact_email}</span>
                              </div>
                              {contact.contact_phone && (
                                <div>
                                  <span className="text-gray-600">Phone:</span>
                                  <span className="ml-2">{contact.contact_phone}</span>
                                </div>
                              )}
                              {contact.signature_type === 'generated' && (
                                <div>
                                  <span className="text-gray-600">Signature Font:</span>
                                  <span className="ml-2 italic">{contact.signature_font}</span>
                                </div>
                              )}
                            </div>
                            {contact.signature_url && contact.signature_type === 'upload' && (
                              <div className="mt-3">
                                <img
                                  src={contact.signature_url}
                                  alt="Signature"
                                  className="h-16 border border-gray-200 rounded px-2 bg-white"
                                />
                              </div>
                            )}
                            {contact.signature_type === 'generated' && contact.first_name && contact.last_name && (
                              <div className="mt-3">
                                <div className="text-3xl" style={{ fontFamily: contact.signature_font }}>
                                  {contact.first_name} {contact.last_name}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(contact)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteContactMutation.mutate(contact.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Create New Contact'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tenant *</Label>
                <Select
                  value={formData.tenant_id}
                  onValueChange={(value) => setFormData({...formData, tenant_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TNT-001">MIN-TECH</SelectItem>
                    <SelectItem value="TNT-002">Connecticut Metals</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contact Type *</Label>
                <Select
                  value={formData.contact_type}
                  onValueChange={(value) => setFormData({...formData, contact_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="secondary">Secondary Contact</SelectItem>
                    <SelectItem value="backup">Backup Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                  placeholder="John Smith"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>First Name (for signature)</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <Label>Last Name (for signature)</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  placeholder="Smith"
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                  placeholder="+1 555-0100"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Job Title *</Label>
                <Input
                  value={formData.job_title}
                  onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                  placeholder="Operations Manager"
                  required
                />
              </div>
            </div>

            {/* Signature Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Signature</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Signature Type</Label>
                  <Select
                    value={formData.signature_type}
                    onValueChange={(value) => setFormData({...formData, signature_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Signature</SelectItem>
                      <SelectItem value="upload">Upload Image (JPG/PNG)</SelectItem>
                      <SelectItem value="generated">Generate from Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.signature_type === 'upload' && (
                  <div className="space-y-2">
                    <Label>Upload Signature Image</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleSignatureUpload}
                        disabled={uploadingSignature}
                      />
                      {uploadingSignature && (
                        <div className="text-sm text-gray-600">Uploading...</div>
                      )}
                    </div>
                    {formData.signature_url && (
                      <div className="mt-2">
                        <img 
                          src={formData.signature_url} 
                          alt="Signature preview" 
                          className="h-20 border border-gray-200 rounded px-2 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.signature_type === 'generated' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Signature Font</Label>
                      <Select
                        value={formData.signature_font}
                        onValueChange={(value) => setFormData({...formData, signature_font: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Allura">Allura - Smooth, flowing script</SelectItem>
                          <SelectItem value="Great Vibes">Great Vibes - Elegant calligraphic</SelectItem>
                          <SelectItem value="Dancing Script">Dancing Script - Playful sophisticated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.first_name && formData.last_name && (
                      <div className="p-4 bg-gray-50 rounded-lg border">
                        <p className="text-sm text-gray-600 mb-2">Preview:</p>
                        <div 
                          className="text-4xl"
                          style={{ fontFamily: formData.signature_font }}
                        >
                          {formData.first_name} {formData.last_name}
                        </div>
                      </div>
                    )}

                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 text-sm">
                        Generated signatures use web fonts. Make sure First Name and Last Name are filled.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createContactMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {createContactMutation.isPending ? 'Saving...' : editingContact ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Load Google Fonts for signature preview */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Allura&family=Great+Vibes&family=Dancing+Script&display=swap');
      `}</style>
    </div>
  );
}
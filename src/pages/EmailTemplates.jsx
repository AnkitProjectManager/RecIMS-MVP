
import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  ArrowLeft,
  Plus,
  Edit,
  Save,
  X,
  FileText,
  AlertCircle,
  Copy
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TenantHeader from "@/components/TenantHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Default templates
const DEFAULT_TEMPLATES = {
  purchase_order: {
    template_name: "purchase_order",
    template_type: "purchase_order",
    subject_line: "Purchase Order " + "{{po_number}}" + " - " + "{{company_name}}",
    email_body: "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">" +
  "<div style=\"background-color: #388E3C; color: white; padding: 20px; text-align: center;\">" +
    "<h1 style=\"margin: 0;\">Purchase Order</h1>" +
    "<p style=\"margin: 5px 0 0 0; font-size: 24px; font-weight: bold;\">" + "{{po_number}}" + "</p>" +
  "</div>" +
  "<div style=\"padding: 20px; background-color: #f9f9f9;\">" +
    "<p style=\"font-size: 16px;\">Dear " + "{{vendor_name}}" + ",</p>" +
    "<p>Please find our purchase order attached for the materials listed below.</p>" +
    "<div style=\"background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #388E3C;\">" +
      "<h3 style=\"margin-top: 0; color: #388E3C;\">Order Details</h3>" +
      "<table style=\"width: 100%; border-collapse: collapse;\">" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">PO Number:</td><td style=\"padding: 8px 0;\">" + "{{po_number}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Vendor:</td><td style=\"padding: 8px 0;\">" + "{{vendor_name}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Expected Delivery:</td><td style=\"padding: 8px 0;\">" + "{{expected_delivery_date}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Total Weight:</td><td style=\"padding: 8px 0;\">" + "{{total_weight_kg}}" + " kg</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Total Amount:</td><td style=\"padding: 8px 0; font-size: 18px; font-weight: bold; color: #388E3C;\">" + "{{currency}}" + " \\$" + "{{total_amount}}" + "</td></tr>" +
      "</table>" +
    "</div>" +
    "<p><strong>Please confirm:</strong></p><ul><li>Acceptance of this purchase order</li><li>Material availability and lead time</li><li>Any changes or adjustments needed</li></ul>" +
    "<p>If any modifications are required, please reply with reference to PO number <strong>" + "{{po_number}}" + "</strong> so we can issue an updated copy.</p>" +
    "<p style=\"margin-top: 30px;\">Best regards,</p><p style=\"margin: 5px 0;\"><strong>" + "{{company_name}}" + "</strong></p>" +
    "<p style=\"margin: 0; color: #666;\">" + "{{company_address}}" + "</p><p style=\"margin: 0; color: #666;\">Phone: " + "{{company_phone}}" + "</p>" +
  "</div>" +
  "<div style=\"background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;\">" +
    "<p style=\"margin: 0;\">This is an automated email from " + "{{company_name}}" + ". Please do not reply directly to this email.</p>" +
  "</div>" +
"</div>",
    from_name: "Purchasing Department",
    include_attachment: true,
    status: "active"
  },
  invoice: {
    template_name: "invoice",
    template_type: "invoice",
    subject_line: "Invoice " + "{{invoice_number}}" + " from " + "{{company_name}}",
    email_body: "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">" +
  "<div style=\"background-color: #1e40af; color: white; padding: 20px; text-align: center;\">" +
    "<h1 style=\"margin: 0;\">Invoice</h1>" +
    "<p style=\"margin: 5px 0 0 0; font-size: 24px; font-weight: bold;\">" + "{{invoice_number}}" + "</p>" +
  "</div>" +
  "<div style=\"padding: 20px; background-color: #f9f9f9;\">" +
    "<p style=\"font-size: 16px;\">Dear " + "{{customer_name}}" + ",</p>" +
    "<p>Thank you for your business. Please find your invoice details below.</p>" +
    "<div style=\"background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #1e40af;\">" +
      "<h3 style=\"margin-top: 0; color: #1e40af;\">Invoice Details</h3>" +
      "<table style=\"width: 100%; border-collapse: collapse;\">" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Invoice Number:</td><td style=\"padding: 8px 0;\">" + "{{invoice_number}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Invoice Date:</td><td style=\"padding: 8px 0;\">" + "{{invoice_date}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Sales Order:</td><td style=\"padding: 8px 0;\">" + "{{so_number}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Payment Terms:</td><td style=\"padding: 8px 0;\">" + "{{payment_terms}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Total Amount:</td><td style=\"padding: 8px 0; font-size: 18px; font-weight: bold; color: #1e40af;\">" + "{{currency}}" + " \\$" + "{{total_amount}}" + "</td></tr>" +
      "</table>" +
    "</div>" +
    "<p><strong>Payment Instructions:</strong></p>" +
    "<p>Please remit payment according to the terms specified above. If you have any questions regarding this invoice, please contact our accounts receivable department.</p>" +
    "<p style=\"margin-top: 30px;\">Thank you for your business,</p><p style=\"margin: 5px 0;\"><strong>" + "{{company_name}}" + "</strong></p>" +
    "<p style=\"margin: 0; color: #666;\">" + "{{company_address}}" + "</p><p style=\"margin: 0; color: #666;\">Phone: " + "{{company_phone}}" + "</p>" +
  "</div>" +
  "<div style=\"background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;\">" +
    "<p style=\"margin: 0;\">This is an automated email from " + "{{company_name}}" + ". Please do not reply directly to this email.</p>" +
  "</div>" +
"</div>",
    from_name: "Accounts Receivable",
    include_attachment: true,
    status: "active"
  },
  shipment_notification: {
    template_name: "shipment_notification",
    template_type: "shipment_notification",
    subject_line: "Shipment Notification - Order " + "{{so_number}}",
    email_body: "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">" +
  "<div style=\"background-color: #f59e0b; color: white; padding: 20px; text-align: center;\">" +
    "<h1 style=\"margin: 0;\">Shipment Notification</h1>" +
    "<p style=\"margin: 5px 0 0 0; font-size: 18px;\">Your order is on the way!</p>" +
  "</div>" +
  "<div style=\"padding: 20px; background-color: #f9f9f9;\">" +
    "<p style=\"font-size: 16px;\">Dear " + "{{customer_name}}" + ",</p>" +
    "<p>Great news! Your order has shipped and is on its way to you.</p>" +
    "<div style=\"background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;\">" +
      "<h3 style=\"margin-top: 0; color: #f59e0b;\">Shipment Details</h3>" +
      "<table style=\"width: 100%; border-collapse: collapse;\">" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Sales Order:</td><td style=\"padding: 8px 0;\">" + "{{so_number}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Ship Date:</td><td style=\"padding: 8px 0;\">" + "{{ship_date}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Carrier:</td><td style=\"padding: 8px 0;\">" + "{{carrier_name}}" + "</td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Tracking Number:</td><td style=\"padding: 8px 0;\"><strong>" + "{{tracking_number}}" + "</strong></td></tr>" +
        "<tr><td style=\"padding: 8px 0; font-weight: bold;\">Estimated Delivery:</td><td style=\"padding: 8px 0;\">" + "{{estimated_delivery_date}}" + "</td></tr>" +
      "</table>" +
    "</div>" +
    "<p>If you have any questions about your shipment, please don't hesitate to contact us.</p>" +
    "<p style=\"margin-top: 30px;\">Best regards,</p><p style=\"margin: 5px 0;\"><strong>" + "{{company_name}}" + "</strong></p>" +
    "<p style=\"margin: 0; color: #666;\">" + "{{company_address}}" + "</p><p style=\"margin: 0; color: #666;\">Phone: " + "{{company_phone}}" + "</p>" +
  "</div>" +
  "<div style=\"background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;\">" +
    "<p style=\"margin: 0;\">This is an automated email from " + "{{company_name}}" + ". Please do not reply directly to this email.</p>" +
  "</div>" +
"</div>",
    from_name: "Shipping Department",
    include_attachment: false,
    status: "active"
  }
};

export default function EmailTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({});

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await recims.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("User not authenticated");
      }
    };
    loadUser();
  }, []);

  const { data: templates = [] } = useQuery({
    queryKey: ['emailTemplates', user?.tenant],
    queryFn: async () => {
      if (!user?.tenant) return [];
      return await recims.entities.EmailTemplate.filter({ tenant: user.tenant });
    },
    enabled: !!user?.tenant,
    initialData: [],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData) => {
      return await recims.entities.EmailTemplate.create({
        ...templateData,
        tenant: user.tenant
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setEditingTemplate(null);
      setFormData({});
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await recims.entities.EmailTemplate.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setEditingTemplate(null);
      setFormData({});
    },
  });

  const handleCreateDefault = (templateKey) => {
    const template = DEFAULT_TEMPLATES[templateKey];
    createTemplateMutation.mutate({
      ...template,
      tenant: user.tenant
    });
  };

  const handleEdit = (template) => {
    setEditingTemplate(template.id);
    setFormData(template);
  };

  const handleSave = () => {
    if (editingTemplate === 'new') {
      createTemplateMutation.mutate(formData);
    } else {
      updateTemplateMutation.mutate({ id: editingTemplate, data: formData });
    }
  };

  const getTemplateBadge = (type) => {
    switch(type) {
      case 'purchase_order': return 'bg-green-100 text-green-700';
      case 'invoice': return 'bg-blue-100 text-blue-700';
      case 'shipment_notification': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const availableVariables = {
    purchase_order: ['po_number', 'vendor_name', 'expected_delivery_date', 'total_weight_kg', 'total_amount', 'currency', 'company_name', 'company_address', 'company_phone'],
    invoice: ['invoice_number', 'invoice_date', 'so_number', 'customer_name', 'payment_terms', 'total_amount', 'currency', 'company_name', 'company_address', 'company_phone'],
    shipment_notification: ['so_number', 'ship_date', 'carrier_name', 'tracking_number', 'estimated_delivery_date', 'customer_name', 'company_name', 'company_address', 'company_phone'],
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-2">
        <Link to={createPageUrl("Settings")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-600" />
            Email Templates
          </h1>
          <p className="text-sm text-gray-600">Manage email templates for automated communications</p>
        </div>
        <Badge className="bg-purple-600 text-white">PHASE IV</Badge>
      </div>

      {/* Available Variables Helper */}
      {editingTemplate && formData.template_type && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Available Variables:</strong> 
            <div className="flex flex-wrap gap-2 mt-2">
              {availableVariables[formData.template_type]?.map((variable) => (
                <Badge 
                  key={variable} 
                  variant="outline" 
                  className="bg-white cursor-pointer hover:bg-blue-100"
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${variable}}}`);
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  {`{{${variable}}}`}
                </Badge>
              ))}
            </div>
            <p className="text-xs mt-2">Click to copy variable. Paste into subject or body.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Setup */}
      {templates.length === 0 && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900">Quick Setup - Create Default Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700">Get started quickly by creating default templates for common scenarios:</p>
            <div className="grid md:grid-cols-3 gap-3">
              <Button
                onClick={() => handleCreateDefault('purchase_order')}
                disabled={createTemplateMutation.isPending}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                <FileText className="w-4 h-4" />
                Purchase Orders
              </Button>
              <Button
                onClick={() => handleCreateDefault('invoice')}
                disabled={createTemplateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <FileText className="w-4 h-4" />
                Invoices
              </Button>
              <Button
                onClick={() => handleCreateDefault('shipment_notification')}
                disabled={createTemplateMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 gap-2"
              >
                <FileText className="w-4 h-4" />
                Shipment Notifications
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Editor */}
      {editingTemplate && (
        <Card className="mb-6 border-2 border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editingTemplate === 'new' ? 'Create New Template' : 'Edit Template'}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingTemplate(null);
                  setFormData({});
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={formData.template_name || ''}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  placeholder="e.g., purchase_order"
                />
              </div>

              <div className="space-y-2">
                <Label>Template Type *</Label>
                <Select
                  value={formData.template_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, template_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase_order">Purchase Order</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="packing_slip">Packing Slip</SelectItem>
                    <SelectItem value="shipment_notification">Shipment Notification</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From Name</Label>
                <Input
                  value={formData.from_name || ''}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  placeholder="e.g., Purchasing Department"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status || 'active'}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject Line * (use {`{{variable}}`} for dynamic content)</Label>
              <Input
                value={formData.subject_line || ''}
                onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
                placeholder="e.g., Purchase Order {{po_number}} - {{company_name}}"
              />
            </div>

            <div className="space-y-2">
              <Label>Email Body (HTML) * (use {`{{variable}}`} for dynamic content)</Label>
              <Textarea
                value={formData.email_body || ''}
                onChange={(e) => setFormData({ ...formData, email_body: e.target.value })}
                rows={12}
                placeholder="HTML email body with {{variables}}"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Internal notes about this template..."
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setEditingTemplate(null);
                  setFormData({});
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Save className="w-4 h-4" />
                {editingTemplate === 'new' ? 'Create Template' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email Templates ({templates.length})</CardTitle>
            <Button
              onClick={() => {
                setEditingTemplate('new');
                setFormData({ status: 'active', include_attachment: true });
              }}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No email templates created yet</p>
              <p className="text-sm mt-2">Use quick setup above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{template.template_name}</p>
                        <Badge className={getTemplateBadge(template.template_type)}>
                          {template.template_type.replace('_', ' ')}
                        </Badge>
                        <Badge variant={template.status === 'active' ? 'default' : 'outline'}>
                          {template.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1"><strong>Subject:</strong> {template.subject_line}</p>
                      {template.from_name && (
                        <p className="text-xs text-gray-500">From: {template.from_name}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleEdit(template)}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  </div>
                  {template.notes && (
                    <p className="text-xs text-gray-500 mt-2 italic">{template.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

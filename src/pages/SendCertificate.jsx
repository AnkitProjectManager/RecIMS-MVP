import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Mail, Send, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import TenantHeader from "@/components/TenantHeader";

export default function SendCertificate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tenantConfig } = useTenant();
  const urlParams = new URLSearchParams(window.location.search);
  const certId = urlParams.get('id');
  
  const [recipientEmail, setRecipientEmail] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const { data: certificate, isLoading } = useQuery({
    queryKey: ['certificate', certId],
    queryFn: async () => {
      const certs = await recims.entities.ComplianceCertificate.filter({ id: certId });
      return certs[0];
    },
    enabled: !!certId,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const updateCertificateMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.ComplianceCertificate.update(certId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceCertificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate', certId] });
    }
  });

  const getTenantInfo = () => {
    if (!tenantConfig) return {};
    
    return {
      name: tenantConfig.company_name || tenantConfig.display_name,
      address: tenantConfig.address_line1,
      city: `${tenantConfig.city}, ${tenantConfig.state_province} ${tenantConfig.postal_code}, ${tenantConfig.country}`,
      phone: tenantConfig.phone,
      email: tenantConfig.email,
      website: tenantConfig.website
    };
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      setError("Please enter a recipient email address");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const tenantInfo = getTenantInfo();
      const certificateUrl = `${window.location.origin}${createPageUrl(`ViewCertificate?id=${certId}`)}`;

      // Build email body
      const emailBody = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 650px; margin: 0 auto; font-size: 14px; color: #333;">
          <p>Hi ${certificate.vendor_name},</p>
          
          <p>Please find attached the Certificate of Destruction for the materials destroyed as requested.</p>

          ${additionalMessage ? `
            <div style="margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-left: 4px solid #388E3C;">
              <p style="margin: 0 0 10px 0;"><strong>Additional Message:</strong></p>
              <p style="margin: 0;">${additionalMessage}</p>
            </div>
          ` : ''}

          <h3 style="color: #333; margin-top: 25px;">Details</h3>

          <table width="100%" cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse; border: 1px solid #ddd; margin-bottom: 20px;">
            <tr style="background: #f6f8fa;">
              <th align="left" style="border-bottom: 1px solid #ddd; font-weight: 600; padding: 10px;">Field</th>
              <th align="left" style="border-bottom: 1px solid #ddd; font-weight: 600; padding: 10px;">Value</th>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Tenant</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">${tenantInfo.name}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Customer Email</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">${recipientEmail}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Contact Person</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">${certificate.vendor_name}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Material Type</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">${certificate.material_type}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Destruction Location</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">${certificate.destruction_location}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Certificate #</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;"><strong>${certificate.certificate_number}</strong></td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Date of Destruction</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">${format(new Date(certificate.destruction_date), 'yyyy-MM-dd')}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">Total Weight</td>
              <td style="border-bottom: 1px solid #eee; padding: 8px;">${certificate.weight_lbs.toLocaleString()} lbs (${certificate.weight_kg.toFixed(2)} kg)</td>
            </tr>
            ${certificate.diversion_rate ? `
            <tr>
              <td style="padding: 8px;">Diversion Rate</td>
              <td style="padding: 8px;"><strong style="color: #16a34a;">${certificate.diversion_rate}%</strong></td>
            </tr>
            ` : ''}
          </table>

          <div style="text-align: center; margin: 25px 0;">
            <a href="${certificateUrl}" 
               style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; font-weight: 600;">
              View Certificate Online
            </a>
          </div>

          <p>If you have any questions or need additional documentation, please let me know.</p>

          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>${certificate.certifying_officer || user.full_name}</strong><br>
            ${certificate.certifying_title || 'Operations Manager'}<br>
            ${tenantInfo.name}<br>
            ${tenantInfo.phone} | ${tenantInfo.email}
          </p>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 5px 0;">${tenantInfo.name}</p>
            <p style="margin: 5px 0;">${tenantInfo.address}, ${tenantInfo.city}</p>
            <p style="margin: 5px 0;">Tel: ${tenantInfo.phone} | Email: ${tenantInfo.email} | Web: ${tenantInfo.website}</p>
          </div>
        </div>
      `;

      // Send email
      await recims.integrations.Core.SendEmail({
        from_name: tenantInfo.name,
        to: recipientEmail,
        subject: `Certificate of Destruction — ${certificate.certificate_number} — ${tenantInfo.name}`,
        body: emailBody
      });

      // Update certificate status
      await updateCertificateMutation.mutateAsync({
        status: 'sent',
        sent_to_email: recipientEmail,
        sent_at: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => {
        navigate(createPageUrl("ComplianceCertificates"));
      }, 2000);

    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to send email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Certificate not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <TenantHeader />
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Sent Successfully!</h2>
            <p className="text-gray-600 mb-4">
              Certificate has been sent to {recipientEmail}
            </p>
            <p className="text-sm text-gray-500">Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("ComplianceCertificates"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-600" />
            Send Certificate via Email
          </h1>
          <p className="text-sm text-gray-600">Send destruction certificate to vendor</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Certificate Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Certificate Number</p>
                <p className="font-semibold text-gray-900">{certificate.certificate_number}</p>
              </div>
              <div>
                <p className="text-gray-600">Vendor</p>
                <p className="font-semibold text-gray-900">{certificate.vendor_name}</p>
              </div>
              <div>
                <p className="text-gray-600">Material Type</p>
                <p className="font-semibold text-gray-900">{certificate.material_type}</p>
              </div>
              <div>
                <p className="text-gray-600">Weight</p>
                <p className="font-semibold text-gray-900">
                  {certificate.weight_lbs.toLocaleString()} lbs ({certificate.weight_kg.toFixed(2)} kg)
                </p>
              </div>
              <div>
                <p className="text-gray-600">Certificate Date</p>
                <p className="font-semibold text-gray-900">
                  {format(new Date(certificate.certificate_date), 'MMM dd, yyyy')}
                </p>
              </div>
              {certificate.diversion_rate && (
                <div>
                  <p className="text-gray-600">Diversion Rate</p>
                  <p className="font-semibold text-green-700">{certificate.diversion_rate}%</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email *</Label>
              <Input
                id="email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="vendor@example.com"
                required
              />
              <p className="text-xs text-gray-500">
                The certificate will be sent to this email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Additional Message (Optional)</Label>
              <Textarea
                id="message"
                value={additionalMessage}
                onChange={(e) => setAdditionalMessage(e.target.value)}
                placeholder="Add a custom message to include in the email..."
                rows={4}
              />
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                The certificate will be sent with a professional email template including certificate details and a link to view the full certificate online.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 mt-6">
        <Button
          onClick={() => navigate(createPageUrl("ComplianceCertificates"))}
          variant="outline"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSendEmail}
          disabled={sending || !recipientEmail}
          className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Certificate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
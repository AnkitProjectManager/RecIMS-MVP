import React from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function ViewCertificate() {
  const navigate = useNavigate();
  const { user, tenantConfig } = useTenant();
  const urlParams = new URLSearchParams(window.location.search);
  const certId = urlParams.get('id');
  const autoPrint = urlParams.get('print') === 'true';

  const { data: certificate, isLoading, error } = useQuery({
    queryKey: ['certificate', certId],
    queryFn: async () => {
      if (!certId) return null;
      const certs = await recims.entities.ComplianceCertificate.filter({ id: certId });
      if (!certs || certs.length === 0) return null;
      return certs[0];
    },
    enabled: !!certId,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const { data: tenantContacts = [] } = useQuery({
    queryKey: ['tenantContacts', certificate?.tenant_id],
    queryFn: async () => {
      if (!certificate?.tenant_id) return [];
      return await recims.entities.TenantContact.filter({
        tenant_id: certificate.tenant_id,
        is_active: true
      });
    },
    enabled: !!certificate?.tenant_id,
    initialData: [],
  });

  React.useEffect(() => {
    if (autoPrint && certificate && !isLoading) {
      setTimeout(() => window.print(), 500);
    }
  }, [autoPrint, certificate, isLoading]);

  const getTenantLogo = () => {
    if (!tenantConfig) return null;
    return tenantConfig.logo_url || null;
  };

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

  const getSignatureForContact = () => {
    if (!certificate || !tenantContacts.length) return null;

    // Find contact based on certificate's contact_type or certifying_officer
    let contact = null;

    if (certificate.contact_type && certificate.contact_type !== 'custom') {
      contact = tenantContacts.find(c => c.contact_type === certificate.contact_type);
    }

    if (!contact && certificate.certifying_officer) {
      contact = tenantContacts.find(c => c.contact_name === certificate.certifying_officer);
    }

    if (!contact) {
      contact = tenantContacts.find(c => c.contact_type === 'primary');
    }

    return contact;
  };

  const handlePrint = () => {
    window.print();
  };

  if (!certId) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>No certificate ID provided</AlertDescription>
        </Alert>
        <Button
          onClick={() => navigate(createPageUrl("ComplianceCertificates"))}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Certificates
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>
            {error ? `Error loading certificate: ${error.message}` : 'Certificate not found'}
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => navigate(createPageUrl("ComplianceCertificates"))}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Certificates
        </Button>
      </div>
    );
  }

  const tenantInfo = getTenantInfo();
  const tenantLogo = getTenantLogo();
  const signatureContact = getSignatureForContact();

  return (
    <div>
      {/* Screen UI */}
      <div className="screen-only p-4 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("ComplianceCertificates"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Destruction Certificate</h1>
            <p className="text-sm text-gray-600">{certificate.certificate_number}</p>
          </div>
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Printer className="w-4 h-4" />
            Print PDF
          </Button>
          <Button
            onClick={() => navigate(createPageUrl(`SendCertificate?id=${certId}`))}
            variant="outline"
            className="gap-2"
          >
            <Mail className="w-4 h-4" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Print Content */}
      <div className="print-only">
        <div className="certificate-page">
          {/* Header */}
          <div className="cert-header">
            <div className="header-left">
              {tenantLogo && (
                <img src={tenantLogo} alt={tenantInfo.name} className="company-logo" />
              )}
              <div className="company-info">
                <h1 className="company-name">{tenantInfo.name}</h1>
                <p>{tenantInfo.address}</p>
                <p>{tenantInfo.city}</p>
                <p>Tel: {tenantInfo.phone}</p>
                <p>Email: {tenantInfo.email}</p>
                <p>Web: {tenantInfo.website}</p>
              </div>
            </div>
            <div className="header-right">
              <div className="cert-badge">
                <h2>DESTRUCTION</h2>
                <h2>CERTIFICATE</h2>
              </div>
            </div>
          </div>

          {/* Certificate Details */}
          <div className="cert-body">
            <div className="cert-meta">
              <div className="meta-item">
                <span className="label">Certificate No:</span>
                <span className="value">{certificate.certificate_number}</span>
              </div>
              <div className="meta-item">
                <span className="label">Date Issued:</span>
                <span className="value">{format(new Date(certificate.certificate_date), 'MMMM dd, yyyy')}</span>
              </div>
            </div>

            <div className="cert-content">
              <p className="cert-intro">This is to certify that the following materials have been received, processed, and recycled in accordance with environmental regulations:</p>

              <div className="vendor-section">
                <h3>MATERIAL SOURCE</h3>
                <p className="vendor-name">{certificate.vendor_name}</p>
                {certificate.vendor_address && (
                  <p className="vendor-address">{certificate.vendor_address}</p>
                )}
              </div>

              <div className="material-section">
                <h3>MATERIAL SPECIFICATIONS</h3>
                <table className="details-table">
                  <tbody>
                    <tr>
                      <td className="detail-label">Material Type:</td>
                      <td className="detail-value">{certificate.material_type}</td>
                    </tr>
                    {certificate.material_category && (
                      <tr>
                        <td className="detail-label">Category:</td>
                        <td className="detail-value">{certificate.material_category}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="detail-label">Total Weight:</td>
                      <td className="detail-value">
                        {certificate.weight_lbs.toLocaleString()} lbs
                        ({certificate.weight_kg.toFixed(2)} kg)
                      </td>
                    </tr>
                    <tr>
                      <td className="detail-label">Destruction Method:</td>
                      <td className="detail-value">
                        {certificate.destruction_method.replace('_', ' ').toUpperCase()}
                      </td>
                    </tr>
                    <tr>
                      <td className="detail-label">Destruction Date:</td>
                      <td className="detail-value">
                        {format(new Date(certificate.destruction_date), 'MMMM dd, yyyy')}
                      </td>
                    </tr>
                    <tr>
                      <td className="detail-label">Processing Location:</td>
                      <td className="detail-value">{certificate.destruction_location}</td>
                    </tr>
                    {certificate.diversion_rate && (
                      <tr>
                        <td className="detail-label">Diversion Rate:</td>
                        <td className="detail-value">{certificate.diversion_rate}%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {certificate.certificate_details && (
                <div className="additional-details">
                  <h3>ADDITIONAL DETAILS</h3>
                  <p>{certificate.certificate_details}</p>
                </div>
              )}

              <div className="certification-statement">
                <p>We hereby certify that the above-mentioned materials have been processed in compliance with all applicable federal, state, and local environmental regulations. All materials have been responsibly recycled and diverted from landfill disposal.</p>
              </div>
            </div>

            <div className="cert-signature">
              <div className="signature-line">
                <div className="signature-box">
                  {signatureContact && signatureContact.signature_type === 'upload' && signatureContact.signature_url && (
                    <div className="signature-image-container">
                      <img
                        src={signatureContact.signature_url}
                        alt="Signature"
                        className="signature-image"
                      />
                    </div>
                  )}
                  {signatureContact && signatureContact.signature_type === 'generated' && signatureContact.first_name && signatureContact.last_name && (
                    <div
                      className="signature-generated"
                      style={{ fontFamily: signatureContact.signature_font }}
                    >
                      {signatureContact.first_name} {signatureContact.last_name}
                    </div>
                  )}
                  {certificate.certifying_officer && (
                    <p className="officer-name">{certificate.certifying_officer}</p>
                  )}
                  <div className="underline"></div>
                  <p className="signature-label">Authorized Signature</p>
                  {certificate.certifying_title && (
                    <p className="signature-title">{certificate.certifying_title}</p>
                  )}
                </div>
                <div className="date-box">
                  <p className="date-value">{format(new Date(certificate.certificate_date), 'MMMM dd, yyyy')}</p>
                  <div className="underline"></div>
                  <p className="signature-label">Date</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="cert-footer">
            <p className="footer-company">{tenantInfo.name}</p>
            <p className="footer-address">{tenantInfo.address}, {tenantInfo.city}</p>
            <p className="footer-contact">Tel: {tenantInfo.phone} | Email: {tenantInfo.email}</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Allura&family=Great+Vibes&family=Dancing+Script&display=swap');

        @media screen {
          .print-only {
            display: none !important;
          }
        }

        @media print {
          .screen-only {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            margin: 0;
            padding: 0;
          }

          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .certificate-page {
            width: 7.5in;
            font-family: Arial, sans-serif;
            font-size: 11pt;
            color: #000;
          }

          .cert-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 0.3in;
            border-bottom: 3px solid #000;
            margin-bottom: 0.4in;
          }

          .header-left {
            display: flex;
            align-items: start;
            gap: 0.2in;
          }

          .company-logo {
            width: 1.2in;
            height: 1.2in;
            object-fit: contain;
          }

          .company-info {
            font-size: 9pt;
            line-height: 1.4;
          }

          .company-name {
            font-size: 11pt;
            font-weight: bold;
            margin: 0 0 0.05in 0;
            color: #000;
          }

          .company-info p {
            margin: 0.02in 0;
            color: #000;
          }

          .header-right {
            text-align: center;
          }

          .cert-badge {
            background-color: #1e40af;
            color: white;
            padding: 0.3in 0.4in;
            border-radius: 0.1in;
          }

          .cert-badge h2 {
            margin: 0;
            font-size: 18pt;
            font-weight: bold;
            line-height: 1.2;
          }

          .cert-body {
            margin: 0.4in 0;
          }

          .cert-meta {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.3in;
            padding: 0.15in;
            background-color: #f3f4f6;
            border-radius: 0.05in;
          }

          .meta-item {
            display: flex;
            gap: 0.1in;
          }

          .meta-item .label {
            font-weight: bold;
            color: #374151;
          }

          .meta-item .value {
            color: #000;
          }

          .cert-content {
            line-height: 1.6;
          }

          .cert-intro {
            font-size: 10pt;
            color: #374151;
            margin-bottom: 0.3in;
            line-height: 1.5;
          }

          .vendor-section {
            margin-bottom: 0.3in;
            padding: 0.2in;
            background-color: #eff6ff;
            border-left: 4px solid #1e40af;
          }

          .vendor-section h3 {
            font-size: 10pt;
            font-weight: bold;
            margin: 0 0 0.1in 0;
            color: #1e40af;
            letter-spacing: 0.05em;
          }

          .vendor-name {
            font-size: 13pt;
            font-weight: bold;
            margin: 0 0 0.05in 0;
            color: #000;
          }

          .vendor-address {
            font-size: 10pt;
            color: #374151;
            margin: 0;
          }

          .material-section {
            margin-bottom: 0.3in;
          }

          .material-section h3 {
            font-size: 10pt;
            font-weight: bold;
            margin: 0 0 0.15in 0;
            color: #1e40af;
            letter-spacing: 0.05em;
          }

          .details-table {
            width: 100%;
            border-collapse: collapse;
          }

          .details-table td {
            padding: 0.08in 0.1in;
            border-bottom: 1px solid #e5e7eb;
          }

          .detail-label {
            font-weight: 600;
            color: #374151;
            width: 2in;
          }

          .detail-value {
            color: #000;
            font-weight: 500;
          }

          .additional-details {
            margin-bottom: 0.3in;
            padding: 0.2in;
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
          }

          .additional-details h3 {
            font-size: 10pt;
            font-weight: bold;
            margin: 0 0 0.1in 0;
            color: #f59e0b;
            letter-spacing: 0.05em;
          }

          .additional-details p {
            margin: 0;
            font-size: 10pt;
            color: #000;
            line-height: 1.5;
          }

          .certification-statement {
            margin: 0.3in 0;
            padding: 0.2in;
            background-color: #f0fdf4;
            border: 2px solid #16a34a;
            border-radius: 0.05in;
          }

          .certification-statement p {
            margin: 0;
            font-size: 10pt;
            font-style: italic;
            color: #000;
            line-height: 1.5;
          }

          .cert-signature {
            margin: 0.4in 0;
          }

          .signature-line {
            display: flex;
            justify-content: space-between;
            gap: 1in;
          }

          .signature-box,
          .date-box {
            flex: 1;
          }

          .signature-image-container {
            margin: 0 0 0.1in 0;
            height: 0.8in;
          }

          .signature-image {
            max-height: 0.8in;
            max-width: 3in;
            object-fit: contain;
            display: block;
          }

          .signature-generated {
            font-size: 32pt;
            margin: 0 0 0.05in 0;
            color: #000;
          }

          .officer-name {
            font-size: 12pt;
            font-weight: bold;
            margin: 0 0 0.05in 0;
            color: #000;
          }

          .underline {
            border-bottom: 2px solid #000;
            margin: 0.3in 0 0.05in 0;
          }

          .signature-label {
            font-size: 9pt;
            font-weight: 600;
            margin: 0;
            color: #374151;
          }

          .signature-title {
            font-size: 9pt;
            margin: 0.03in 0 0 0;
            color: #6b7280;
          }

          .date-value {
            font-size: 11pt;
            font-weight: 600;
            margin: 0 0 0.05in 0;
            color: #000;
          }

          .cert-footer {
            text-align: center;
            padding-top: 0.2in;
            border-top: 2px solid #000;
            font-size: 9pt;
            color: #374151;
          }

          .footer-company {
            font-weight: bold;
            font-size: 10pt;
            margin: 0 0 0.05in 0;
            color: #000;
          }

          .footer-address,
          .footer-contact {
            margin: 0.02in 0;
          }
        }
      `}</style>
    </div>
  );
}
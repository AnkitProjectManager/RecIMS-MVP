import React, { useState } from 'react';
import { recims } from "@/api/recimsClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EmailSender({ 
  templateType, 
  recipientEmail, 
  data, 
  onSuccess,
  onError 
}) {
  const [sending, setSending] = useState(false);
  const [customEmail, setCustomEmail] = useState(recipientEmail || '');
  const [additionalMessage, setAdditionalMessage] = useState('');

  const sendEmail = async () => {
    setSending(true);
    
    try {
      // Fetch template
      const templates = await recims.entities.EmailTemplate.filter({
        template_type: templateType,
        status: 'active'
      });

      const template = templates[0];
      
      if (!template) {
        throw new Error(`No active email template found for ${templateType}`);
      }

      // Replace variables in subject and body
      let subject = template.subject_line;
      let body = template.email_body;

      Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value || '');
        body = body.replace(regex, value || '');
      });

      // Add additional message if provided
      if (additionalMessage) {
        body += `\n\n<div style="margin-top: 20px; padding: 15px; background-color: #f0f0f0; border-left: 4px solid #388E3C;">
          <p><strong>Additional Message:</strong></p>
          <p>${additionalMessage}</p>
        </div>`;
      }

      // Send email using Core integration
      await recims.integrations.Core.SendEmail({
        from_name: template.from_name || data.company_name,
        to: customEmail,
        subject: subject,
        body: body
      });

      if (onSuccess) onSuccess();
      
    } catch (err) {
      console.error(err);
      if (onError) onError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Recipient Email *</Label>
        <Input
          type="email"
          value={customEmail}
          onChange={(e) => setCustomEmail(e.target.value)}
          placeholder="recipient@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Additional Message (Optional)</Label>
        <Textarea
          value={additionalMessage}
          onChange={(e) => setAdditionalMessage(e.target.value)}
          placeholder="Add a custom message to this email..."
          rows={3}
        />
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Mail className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Email will be sent using your configured template for <strong>{templateType.replace('_', ' ')}</strong>
        </AlertDescription>
      </Alert>

      <Button
        onClick={sendEmail}
        disabled={sending || !customEmail}
        className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
      >
        {sending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Email
          </>
        )}
      </Button>
    </div>
  );
}
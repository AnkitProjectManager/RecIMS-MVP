import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  ArrowLeft, 
  Plus,
  Trash2,
  User,
  Package,
  Save,
  Calculator,
  Building2,
  ArrowRightLeft,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TenantHeader from "@/components/TenantHeader";
import TaxSummary from "@/components/sales/TaxSummary";

/**
 * Canada Sales Tax Calculator (Inline)
 */
const HST_PROVINCES = {
  ON: 0.13, NB: 0.15, NS: 0.15, PE: 0.15, NL: 0.15
};
const GST_ONLY_PROVINCES = ['AB', 'NT', 'NU', 'YT'];
const PST_PROVINCES = {
  BC: 0.07, SK: 0.06, MB: 0.07
};
const GST_RATE = 0.05;
const QST_RATE = 0.09975;

function isCategoryTaxableInProvince(category) {
  if (category === 'tangible_goods') return true;
  if (category === 'labor') return false;
  if (category === 'exempt') return false;
  if (category === 'digital_goods') return true;
  if (category === 'shipping') return true;
  return true;
}

function getProvinceRates(province) {
  if (!province) return [];
  const prov = province.toUpperCase();
  
  if (HST_PROVINCES[prov] != null) {
    return [{ name: 'HST', rate: HST_PROVINCES[prov] }];
  }
  if (GST_ONLY_PROVINCES.includes(prov)) {
    return [{ name: 'GST', rate: GST_RATE }];
  }
  if (prov === 'QC') {
    return [
      { name: 'GST', rate: GST_RATE },
      { name: 'QST', rate: QST_RATE }
    ];
  }
  if (PST_PROVINCES[prov] != null) {
    return [
      { name: 'GST', rate: GST_RATE },
      { name: 'PST', rate: PST_PROVINCES[prov] }
    ];
  }
  return [];
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function calculateLineNet(line) {
  const gross = (line.quantity_ordered || 0) * (line.unit_price || 0);
  return Math.max(0, gross - (line.discount_amount || 0));
}

function calculateCanadaSalesTax(orderData) {
  const {
    shipToProvince,
    customerExempt = false,
    lineItems = [],
    shippingAmount = 0
  } = orderData;

  const province = shipToProvince?.toUpperCase();
  const taxByType = { GST: 0, HST: 0, PST: 0, QST: 0 };
  let subtotal = 0;
  
  if (!province || customerExempt) {
    const orderSubtotal = lineItems.reduce((sum, line) => sum + calculateLineNet(line), 0) + shippingAmount;
    return {
      perLine: lineItems.map(line => ({
        sku: line.sku_snapshot || line.product_id,
        basis: round2(calculateLineNet(line)),
        taxes: [],
        lineTaxTotal: 0,
        lineTotalWithTax: round2(calculateLineNet(line))
      })),
      shipping: shippingAmount > 0 ? {
        basis: round2(shippingAmount),
        taxes: [],
        taxTotal: 0,
        totalWithTax: round2(shippingAmount)
      } : null,
      totals: {
        taxByType,
        totalTax: 0,
        subtotal: round2(orderSubtotal),
        grandTotal: round2(orderSubtotal)
      }
    };
  }
  
  const rates = getProvinceRates(province);
  
  const perLine = lineItems.map(line => {
    const lineNet = calculateLineNet(line);
    const isTaxable = isCategoryTaxableInProvince(line.product_tax_category || 'tangible_goods');
    const basis = isTaxable ? lineNet : 0;
    
    const taxes = basis > 0
      ? rates.map(r => ({
          name: r.name,
          rate: r.rate,
          amount: round2(basis * r.rate)
        }))
      : [];
    
    const lineTaxTotal = round2(taxes.reduce((sum, t) => sum + t.amount, 0));
    taxes.forEach(t => {
      taxByType[t.name] = round2(taxByType[t.name] + t.amount);
    });
    
    subtotal += lineNet;
    
    return {
      sku: line.sku_snapshot || line.product_id,
      basis: round2(basis),
      taxes,
      lineTaxTotal,
      lineTotalWithTax: round2(lineNet + lineTaxTotal)
    };
  });
  
  let shipping = null;
  if (shippingAmount > 0) {
    const shipTaxable = isCategoryTaxableInProvince('shipping');
    const basis = shipTaxable ? shippingAmount : 0;
    
    const taxes = shipTaxable
      ? rates.map(r => ({
          name: r.name,
          rate: r.rate,
          amount: round2(basis * r.rate)
        }))
      : [];
    
    const taxTotal = round2(taxes.reduce((sum, t) => sum + t.amount, 0));
    taxes.forEach(t => {
      taxByType[t.name] = round2(taxByType[t.name] + t.amount);
    });
    
    shipping = {
      basis: round2(shippingAmount),
      taxes,
      taxTotal,
      totalWithTax: round2(shippingAmount + taxTotal)
    };
    
    subtotal += shippingAmount;
  }
  
  const totalTax = round2(Object.values(taxByType).reduce((sum, val) => sum + val, 0));
  const grandTotal = round2(subtotal + totalTax);
  
  return {
    perLine,
    shipping,
    totals: {
      taxByType,
      totalTax,
      subtotal: round2(subtotal),
      grandTotal
    }
  };
}

export default function EditSalesOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [taxBreakdown, setTaxBreakdown] = useState(null);
  const [calculatingTax, setCalculatingTax] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const soId = urlParams.get('id');

  const [headerData, setHeaderData] = useState({
    customer_id: '',
    customer_name: '',
    po_number: '',
    ship_date: '',
    carrier_code: '',
    terms: 'Net 30',
    ship_method: 'TRUCK',
    bill_line1: '', bill_line2: '', bill_line3: '',
    bill_city: '', bill_region: '', bill_postal_code: '', bill_country: '',
    bill_contact_person: '', bill_phone: '', bill_email: '',
    ship_line1: '', ship_line2: '', ship_line3: '',
    ship_city: '', ship_region: '', ship_postal_code: '', ship_country: '',
    ship_contact_person: '', ship_phone: '', ship_email: '',
    shipping_amount: '0',
    total_cubic_feet: '',
    comments_internal: ''
  });

  const [lineItems, setLineItems] = useState([]);

  React.useEffect(() => {
    if (tenantConfig) {
      setUseMetric(tenantConfig.measurement_system === 'metric');
    }
  }, [tenantConfig]);

  const { data: so, isLoading: loadingSO } = useQuery({
    queryKey: ['salesOrder', soId],
    queryFn: async () => {
      const sos = await recims.entities.SalesOrder.filter({ id: soId });
      return sos[0];
    },
    enabled: !!soId,
  });

  const { data: existingLines = [] } = useQuery({
    queryKey: ['soLineItems', soId],
    queryFn: async () => {
      return await recims.entities.SalesOrderLine.filter({ so_id: soId }, 'line_number');
    },
    enabled: !!soId,
    initialData: [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Customer.filter({ tenant_id: user.tenant_id, status: 'active' });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: products = [] } = useQuery({
    queryKey: ['productSKUs', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ProductSKU.filter({ tenant_id: user.tenant_id, status: 'active' });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const companyAddress = React.useMemo(() => {
    if (!tenantConfig) return null;
    
    return {
      country: tenantConfig.country,
      state: tenantConfig.state_province,
      province: tenantConfig.state_province,
      city: tenantConfig.city,
      zip: tenantConfig.postal_code,
      street: tenantConfig.address_line1
    };
  }, [tenantConfig]);

  // Load SO data into form
  React.useEffect(() => {
    if (so) {
      setHeaderData({
        customer_id: so.customer_id || '',
        customer_name: so.customer_name || '',
        po_number: so.po_number || '',
        ship_date: so.ship_date || '',
        carrier_code: so.carrier_code || '',
        terms: so.terms || 'Net 30',
        ship_method: so.ship_method || 'TRUCK',
        bill_line1: so.bill_line1 || '',
        bill_line2: so.bill_line2 || '',
        bill_line3: so.bill_line3 || '',
        bill_city: so.bill_city || '',
        bill_region: so.bill_region || '',
        bill_postal_code: so.bill_postal_code || '',
        bill_country: so.bill_country || '',
        bill_contact_person: so.bill_contact_person || '',
        bill_phone: so.bill_phone || '',
        bill_email: so.bill_email || '',
        ship_line1: so.ship_line1 || '',
        ship_line2: so.ship_line2 || '',
        ship_line3: so.ship_line3 || '',
        ship_city: so.ship_city || '',
        ship_region: so.ship_region || '',
        ship_postal_code: so.ship_postal_code || '',
        ship_country: so.ship_country || '',
        ship_contact_person: so.ship_contact_person || '',
        ship_phone: so.ship_phone || '',
        ship_email: so.ship_email || '',
        shipping_amount: String(so.shipping_amount || 0),
        total_cubic_feet: String(so.total_cubic_feet || ''),
        comments_internal: so.comments_internal || ''
      });

      if (so.tax_breakdown) {
        setTaxBreakdown(so.tax_breakdown);
      }
    }
  }, [so]);

  // Load existing line items
  React.useEffect(() => {
    if (existingLines.length > 0 && lineItems.length === 0) {
      const loadedLines = existingLines.map(line => ({
        id: line.id,
        existing: true,
        product_id: line.product_id || '',
        sku_snapshot: line.sku_snapshot || '',
        description_snapshot: line.description_snapshot || '',
        category: line.category || '',
        sub_category: line.sub_category || '',
        product_type: line.product_type || '',
        product_tax_category: line.product_tax_category || 'tangible_goods',
        taxjar_product_tax_code: line.taxjar_product_tax_code || '',
        quantity_ordered: String(line.quantity_ordered || ''),
        unit_price: String(line.unit_price || ''),
        discount_amount: String(line.discount_amount || 0),
        uom: line.uom || 'kg',
        hts_code: line.hts_code || '',
        packaging_instructions: line.packaging_instructions || '',
        cubic_feet: String(line.cubic_feet || ''),
        ship_method_line: line.ship_method_line || '',
        requested_ship_date: line.requested_ship_date || ''
      }));
      setLineItems(loadedLines);
    }
  }, [existingLines, lineItems.length]);

  const selectedCustomer = customers.find(c => c.id === headerData.customer_id);

  const isPOBox = (line1, line2, line3) => {
    const poBoxPattern = /\b(P\.?\s*O\.?\s*BOX|POST\s*OFFICE\s*BOX|POBOX)\b/i;
    return poBoxPattern.test(line1 || '') || 
           poBoxPattern.test(line2 || '') || 
           poBoxPattern.test(line3 || '');
  };

  const copyBillToShip = () => {
    if (isPOBox(headerData.bill_line1, headerData.bill_line2, headerData.bill_line3)) {
      setError("Cannot use PO Box as shipping address. Please enter a valid street address for shipping.");
      return;
    }

    setHeaderData(prev => ({
      ...prev,
      ship_line1: prev.bill_line1,
      ship_line2: prev.bill_line2,
      ship_line3: prev.bill_line3,
      ship_city: prev.bill_city,
      ship_region: prev.bill_region,
      ship_postal_code: prev.bill_postal_code,
      ship_country: prev.bill_country,
      ship_contact_person: prev.bill_contact_person,
      ship_phone: prev.bill_phone,
      ship_email: prev.bill_email
    }));
    
    setTaxBreakdown(null);
  };

  const calculateTax = async () => {
    setCalculatingTax(true);
    setError(null);
    
    try {
      if (!headerData.ship_country || !headerData.ship_region || !headerData.ship_line1 || !headerData.ship_city || !headerData.ship_postal_code) {
        setError("Please enter complete shipping address (Street, City, State/Province, Zip/Postal Code, Country required)");
        setCalculatingTax(false);
        return;
      }

      if (isPOBox(headerData.ship_line1, headerData.ship_line2, headerData.ship_line3)) {
        setError("Cannot ship to PO Box address. Please enter a valid street address for shipping.");
        setCalculatingTax(false);
        return;
      }

      const validLines = lineItems.filter(item => item.product_id && item.unit_price && item.quantity_ordered);
      if (validLines.length === 0) {
        setError("Please add line items with prices and quantities first");
        setCalculatingTax(false);
        return;
      }

      const isCanada = headerData.ship_country === 'CA';
      
      if (isCanada) {
        const breakdown = calculateCanadaSalesTax({
          shipToProvince: headerData.ship_region,
          customerExempt: selectedCustomer?.is_tax_exempt || false,
          lineItems: validLines,
          shippingAmount: parseFloat(headerData.shipping_amount) || 0
        });
        
        setTaxBreakdown(breakdown);
      } else {
        const { data } = await recims.functions.invoke('calculateUSTax', {
          orderData: {
            fromAddress: {
              country: companyAddress.country,
              state: companyAddress.state,
              city: companyAddress.city,
              zip: companyAddress.zip,
              street: companyAddress.street
            },
            toAddress: {
              country: headerData.ship_country,
              state: headerData.ship_region,
              city: headerData.ship_city,
              zip: headerData.ship_postal_code,
              street: headerData.ship_line1
            },
            lineItems: validLines.map(item => ({
              id: item.sku_snapshot || item.product_id,
              sku: item.sku_snapshot,
              quantity: parseFloat(item.quantity_ordered),
              unit_price: parseFloat(item.unit_price),
              discount: parseFloat(item.discount_amount) || 0,
              taxjar_product_tax_code: item.taxjar_product_tax_code || undefined
            })),
            shipping: parseFloat(headerData.shipping_amount) || 0,
            customerExemptionType: selectedCustomer?.is_tax_exempt ? 
              (selectedCustomer.tax_exemption_reason_code?.toLowerCase() || 'other') : undefined
          }
        });

        if (data.fallback) {
          setError(data.taxCalculation.message || 'Tax calculation unavailable');
          setTaxBreakdown(null);
        } else {
          const usTaxBreakdown = {
            perLine: validLines.map(line => {
              const lineNet = (parseFloat(line.quantity_ordered) * parseFloat(line.unit_price)) - (parseFloat(line.discount_amount) || 0);
              const lineTaxItem = data.breakdown?.line_items?.find(li => li.id === (line.sku_snapshot || line.product_id));
              const lineTax = lineTaxItem?.tax_collectable || 0;
              
              return {
                sku: line.sku_snapshot || line.product_id,
                basis: lineNet,
                taxes: lineTax > 0 ? [{
                  name: 'Sales Tax',
                  rate: data.combinedRate || 0,
                  amount: lineTax
                }] : [],
                lineTaxTotal: lineTax,
                lineTotalWithTax: lineNet + lineTax
              };
            }),
            shipping: (parseFloat(headerData.shipping_amount) || 0) > 0 ? {
              basis: parseFloat(headerData.shipping_amount),
              taxes: data.shippingTax > 0 ? [{
                name: 'Sales Tax',
                rate: data.combinedRate || 0,
                amount: data.shippingTax
              }] : [],
              taxTotal: data.shippingTax || 0,
              totalWithTax: (parseFloat(headerData.shipping_amount) || 0) + (data.shippingTax || 0)
            } : null,
            totals: {
              taxByType: { GST: 0, HST: 0, PST: 0, QST: 0 },
              totalTax: data.totalTax || 0,
              subtotal: data.taxableAmount || 0,
              grandTotal: (data.taxableAmount || 0) + (data.totalTax || 0)
            },
            hasNexus: data.hasNexus,
            combinedRate: data.combinedRate,
            jurisdiction: data.jurisdiction
          };
          
          setTaxBreakdown(usTaxBreakdown);
        }
      }
    } catch (err) {
      console.error('Tax calculation error:', err);
      setError(err.message || 'Failed to calculate tax');
      setTaxBreakdown(null);
    } finally {
      setCalculatingTax(false);
    }
  };

  const updateSOMutation = useMutation({
    mutationFn: async (data) => {
      const subtotal = data.lineItems.reduce((sum, item) => {
        const lineTotal = (parseFloat(item.quantity_ordered) * parseFloat(item.unit_price)) - (parseFloat(item.discount_amount) || 0);
        return sum + lineTotal;
      }, 0);
      
      const shippingAmount = parseFloat(data.shipping_amount) || 0;
      const taxTotal = taxBreakdown?.totals?.totalTax || 0;
      const totalAmount = subtotal + shippingAmount + taxTotal;
      
      // Update SO header
      await recims.entities.SalesOrder.update(soId, {
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        po_number: data.po_number || 'TBD',
        ship_date: data.ship_date || null,
        carrier_code: data.carrier_code || null,
        terms: data.terms,
        ship_method: data.ship_method,
        bill_line1: data.bill_line1,
        bill_line2: data.bill_line2,
        bill_line3: data.bill_line3,
        bill_city: data.bill_city,
        bill_region: data.bill_region,
        bill_postal_code: data.bill_postal_code,
        bill_country: data.bill_country,
        bill_contact_person: data.bill_contact_person,
        bill_phone: data.bill_phone,
        bill_email: data.bill_email,
        ship_line1: data.ship_line1,
        ship_line2: data.ship_line2,
        ship_line3: data.ship_line3,
        ship_city: data.ship_city,
        ship_region: data.ship_region,
        ship_postal_code: data.ship_postal_code,
        ship_country: data.ship_country,
        ship_contact_person: data.ship_contact_person,
        ship_phone: data.ship_phone,
        ship_email: data.ship_email,
        total_cubic_feet: data.total_cubic_feet ? parseFloat(data.total_cubic_feet) : null,
        comments_internal: data.comments_internal,
        subtotal: round2(subtotal),
        shipping_amount: round2(shippingAmount),
        tax_total: round2(taxTotal),
        tax_gst: taxBreakdown?.totals?.taxByType?.GST || 0,
        tax_hst: taxBreakdown?.totals?.taxByType?.HST || 0,
        tax_pst: taxBreakdown?.totals?.taxByType?.PST || 0,
        tax_qst: taxBreakdown?.totals?.taxByType?.QST || 0,
        tax_breakdown: taxBreakdown || null,
        total_amount: round2(totalAmount)
      });

      // Delete removed lines, update existing, create new
      const existingLineIds = existingLines.map(l => l.id);
      const currentLineIds = data.lineItems.filter(l => l.existing).map(l => l.id);
      const linesToDelete = existingLineIds.filter(id => !currentLineIds.includes(id));

      for (const id of linesToDelete) {
        await recims.entities.SalesOrderLine.delete(id);
      }

      for (let i = 0; i < data.lineItems.length; i++) {
        const item = data.lineItems[i];
        if (!item.product_id) continue;

        const lineNet = (parseFloat(item.quantity_ordered) * parseFloat(item.unit_price)) - (parseFloat(item.discount_amount) || 0);
        const lineTaxData = taxBreakdown?.perLine?.[i];
        
        const lineData = {
          so_id: soId,
          so_number: so.so_number,
          tenant_id: user.tenant_id,
          line_number: (i + 1) * 10,
          product_id: item.product_id,
          sku_snapshot: item.sku_snapshot,
          description_snapshot: item.description_snapshot,
          category: item.category,
          sub_category: item.sub_category,
          product_type: item.product_type,
          product_tax_category: item.product_tax_category,
          taxjar_product_tax_code: item.taxjar_product_tax_code || null,
          quantity_ordered: parseFloat(item.quantity_ordered),
          unit_price: parseFloat(item.unit_price),
          discount_amount: parseFloat(item.discount_amount) || 0,
          line_subtotal: round2(lineNet),
          line_tax_amount: round2(lineTaxData?.lineTaxTotal || 0),
          line_total: round2(lineNet + (lineTaxData?.lineTaxTotal || 0)),
          uom: item.uom,
          hts_code: item.hts_code,
          packaging_instructions: item.packaging_instructions,
          cubic_feet: item.cubic_feet ? parseFloat(item.cubic_feet) : null,
          ship_method_line: item.ship_method_line || null,
          requested_ship_date: item.requested_ship_date || null,
          status: 'active'
        };

        if (item.existing) {
          await recims.entities.SalesOrderLine.update(item.id, lineData);
        } else {
          await recims.entities.SalesOrderLine.create(lineData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['salesOrder', soId] });
      queryClient.invalidateQueries({ queryKey: ['soLineItems', soId] });
      navigate(createPageUrl(`ViewSalesOrder?id=${soId}`));
    },
    onError: (err) => {
      setError(err.message || "Failed to update sales order");
    }
  });

  const handleProductChange = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updatedItems = [...lineItems];
      updatedItems[index] = {
        ...updatedItems[index],
        product_id: productId,
        sku_snapshot: product.sku_number,
        description_snapshot: product.description || `${product.category} - ${product.sub_category} - ${product.product_type}`,
        category: product.category,
        sub_category: product.sub_category,
        product_type: product.product_type,
        hts_code: product.hts_code || '',
        unit_price: String(product.price_per_kg || ''),
        uom: product.primary_unit || (useMetric ? 'kg' : 'lbs')
      };
      setLineItems(updatedItems);
      setTaxBreakdown(null);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: Date.now(),
      existing: false,
      product_id: '',
      sku_snapshot: '',
      description_snapshot: '',
      category: '',
      sub_category: '',
      product_type: '',
      product_tax_category: 'tangible_goods',
      taxjar_product_tax_code: '',
      quantity_ordered: '',
      unit_price: '',
      discount_amount: '0',
      uom: useMetric ? 'kg' : 'lb',
      hts_code: '',
      packaging_instructions: '',
      cubic_feet: '',
      ship_method_line: '',
      requested_ship_date: ''
    }]);
    setTaxBreakdown(null);
  };

  const removeLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
    setTaxBreakdown(null);
  };

  const updateLineItem = (index, field, value) => {
    const updatedItems = [...lineItems];
    updatedItems[index][field] = value;
    setLineItems(updatedItems);
    
    if (['quantity_ordered', 'unit_price', 'discount_amount'].includes(field)) {
      setTaxBreakdown(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!headerData.customer_id) {
      setError("Please select a customer");
      return;
    }

    if (!headerData.ship_line1 || !headerData.ship_city || !headerData.ship_region || !headerData.ship_postal_code || !headerData.ship_country) {
      setError("Please enter complete shipping address: Street, City, State/Province, Zip/Postal Code, and Country are required.");
      return;
    }

    if (isPOBox(headerData.ship_line1, headerData.ship_line2, headerData.ship_line3)) {
      setError("Cannot ship to PO Box address. Please enter a valid street address.");
      return;
    }

    const validLines = lineItems.filter(item => item.product_id && item.quantity_ordered && item.unit_price);
    if (validLines.length === 0) {
      setError("Please add at least one line item with quantity and price");
      return;
    }

    if (!taxBreakdown) {
      setError("Please calculate tax before updating the sales order");
      return;
    }

    updateSOMutation.mutate({
      ...headerData,
      lineItems: validLines
    });
  };

  if (loadingSO) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!so) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Sales order not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Only allow editing in certain statuses
  if (!['QUOTATION', 'DRAFT', 'NEEDS_UPDATE'].includes(so.status)) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Cannot edit sales order in {so.status} status. Only QUOTATION, DRAFT, and NEEDS_UPDATE orders can be edited.
          </AlertDescription>
        </Alert>
        <Link to={createPageUrl(`ViewSalesOrder?id=${soId}`)}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sales Order
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl(`ViewSalesOrder?id=${soId}`)}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Edit Sales Order: {so.so_number}
          </h1>
          <p className="text-sm text-gray-600">Update order details and recalculate tax</p>
        </div>
        <Badge className={
          so.status === 'QUOTATION' ? 'bg-purple-100 text-purple-700' :
          so.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
          'bg-orange-100 text-orange-700'
        }>
          {so.status}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer & Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer (Cannot Change)</Label>
                <Input value={headerData.customer_name} disabled className="bg-gray-50" />
              </div>

              <div className="space-y-2">
                <Label>Customer PO Number</Label>
                <Input
                  value={headerData.po_number}
                  onChange={(e) => setHeaderData({ ...headerData, po_number: e.target.value })}
                  placeholder="Customer's PO number"
                />
              </div>

              <div className="space-y-2">
                <Label>Ship Date</Label>
                <Input
                  type="date"
                  value={headerData.ship_date}
                  onChange={(e) => setHeaderData({ ...headerData, ship_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Ship Method *</Label>
                <Select value={headerData.ship_method} onValueChange={(value) => setHeaderData({ ...headerData, ship_method: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRUCK">TRUCK</SelectItem>
                    <SelectItem value="RAIL">RAIL</SelectItem>
                    <SelectItem value="SEA">SEA</SelectItem>
                    <SelectItem value="AIR">AIR</SelectItem>
                    <SelectItem value="COURIER">COURIER</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={headerData.terms} onValueChange={(value) => setHeaderData({ ...headerData, terms: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Net 10">Net 10 days</SelectItem>
                    <SelectItem value="Net 30">Net 30 days</SelectItem>
                    <SelectItem value="Net 45">Net 45 days</SelectItem>
                    <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                    <SelectItem value="ACH">{headerData.bill_country === 'CA' ? 'EFT' : 'ACH'}</SelectItem>
                    <SelectItem value="QBO Payment Link">Payment Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Shipping Amount ({tenantConfig?.default_currency || 'USD'})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={headerData.shipping_amount}
                  onChange={(e) => {
                    setHeaderData({ ...headerData, shipping_amount: e.target.value });
                    setTaxBreakdown(null);
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bill To Address */}
        <Card className="mb-6 border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Bill To Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Person *</Label>
                <Input
                  value={headerData.bill_contact_person}
                  onChange={(e) => setHeaderData({ ...headerData, bill_contact_person: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={headerData.bill_phone}
                  onChange={(e) => setHeaderData({ ...headerData, bill_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={headerData.bill_email}
                  onChange={(e) => setHeaderData({ ...headerData, bill_email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Address Line 1 *</Label>
                <Input
                  value={headerData.bill_line1}
                  onChange={(e) => setHeaderData({ ...headerData, bill_line1: e.target.value })}
                  placeholder="Street address or PO Box"
                />
              </div>
              <div className="space-y-2">
                <Label>Address Line 2</Label>
                <Input
                  value={headerData.bill_line2}
                  onChange={(e) => setHeaderData({ ...headerData, bill_line2: e.target.value })}
                  placeholder="Suite, unit, building, floor, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Address Line 3</Label>
                <Input
                  value={headerData.bill_line3}
                  onChange={(e) => setHeaderData({ ...headerData, bill_line3: e.target.value })}
                  placeholder="Additional address info"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  value={headerData.bill_city}
                  onChange={(e) => setHeaderData({ ...headerData, bill_city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>State/Province *</Label>
                <Input
                  value={headerData.bill_region}
                  onChange={(e) => setHeaderData({ ...headerData, bill_region: e.target.value.toUpperCase() })}
                  placeholder="e.g., ON, CA, NY"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP/Postal Code *</Label>
                <Input
                  value={headerData.bill_postal_code}
                  onChange={(e) => setHeaderData({ ...headerData, bill_postal_code: e.target.value })}
                  placeholder="ZIP or Postal Code"
                />
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <Select 
                  value={headerData.bill_country} 
                  onValueChange={(value) => setHeaderData({ ...headerData, bill_country: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPOBox(headerData.bill_line1, headerData.bill_line2, headerData.bill_line3) && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900 text-sm">
                  <strong>Note:</strong> Billing address contains PO Box. You must enter a valid street address for shipping.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Ship To Address */}
        <Card className="mb-6 border-2 border-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Ship To Address
              </CardTitle>
              <Button
                type="button"
                onClick={copyBillToShip}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!headerData.bill_line1 || isPOBox(headerData.bill_line1, headerData.bill_line2, headerData.bill_line3)}
              >
                <ArrowRightLeft className="w-4 h-4" />
                Copy from Billing
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Person *</Label>
                <Input
                  value={headerData.ship_contact_person}
                  onChange={(e) => setHeaderData({ ...headerData, ship_contact_person: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={headerData.ship_phone}
                  onChange={(e) => setHeaderData({ ...headerData, ship_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={headerData.ship_email}
                  onChange={(e) => setHeaderData({ ...headerData, ship_email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Address Line 1 * (Street Address - No PO Box)</Label>
                <Input
                  value={headerData.ship_line1}
                  onChange={(e) => {
                    setHeaderData({ ...headerData, ship_line1: e.target.value });
                    setTaxBreakdown(null);
                  }}
                  placeholder="Street address (no PO Box)"
                />
                {isPOBox(headerData.ship_line1, headerData.ship_line2, headerData.ship_line3) && (
                  <p className="text-xs text-red-600 font-semibold">
                    ⚠️ Cannot ship to PO Box - please enter a valid street address
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Address Line 2</Label>
                <Input
                  value={headerData.ship_line2}
                  onChange={(e) => {
                    setHeaderData({ ...headerData, ship_line2: e.target.value });
                    setTaxBreakdown(null);
                  }}
                  placeholder="Suite, unit, building, floor, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Address Line 3</Label>
                <Input
                  value={headerData.ship_line3}
                  onChange={(e) => {
                    setHeaderData({ ...headerData, ship_line3: e.target.value });
                    setTaxBreakdown(null);
                  }}
                  placeholder="Additional address info"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  value={headerData.ship_city}
                  onChange={(e) => {
                    setHeaderData({ ...headerData, ship_city: e.target.value });
                    setTaxBreakdown(null);
                  }}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>State/Province *</Label>
                <Input
                  value={headerData.ship_region}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setHeaderData({ ...headerData, ship_region: value });
                    setTaxBreakdown(null);
                  }}
                  placeholder="e.g., ON, CA, NY"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP/Postal Code *</Label>
                <Input
                  value={headerData.ship_postal_code}
                  onChange={(e) => {
                    setHeaderData({ ...headerData, ship_postal_code: e.target.value });
                    setTaxBreakdown(null);
                  }}
                  placeholder="ZIP or Postal Code"
                />
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <Select 
                  value={headerData.ship_country} 
                  onValueChange={(value) => {
                    setHeaderData({ ...headerData, ship_country: value });
                    setTaxBreakdown(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Line Items ({lineItems.filter(item => item.product_id).length})
              </CardTitle>
              <Button type="button" onClick={addLineItem} variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline">Line {index + 1}</Badge>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Product SKU *</Label>
                    <Select value={item.product_id} onValueChange={(value) => handleProductChange(index, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.sku_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity * ({item.uom || (useMetric ? 'kg' : 'lbs')})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.quantity_ordered}
                      onChange={(e) => updateLineItem(index, 'quantity_ordered', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unit Price * (per {item.uom || (useMetric ? 'kg' : 'lbs')})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Discount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.discount_amount}
                      onChange={(e) => updateLineItem(index, 'discount_amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tax Category</Label>
                    <Select value={item.product_tax_category} onValueChange={(value) => updateLineItem(index, 'product_tax_category', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tangible_goods">Tangible Goods</SelectItem>
                        <SelectItem value="digital_goods">Digital Goods</SelectItem>
                        <SelectItem value="labor">Labor/Service</SelectItem>
                        <SelectItem value="exempt">Tax Exempt</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {headerData.ship_country === 'US' && (
                    <div className="space-y-2">
                      <Label>TaxJar Code</Label>
                      <Input
                        value={item.taxjar_product_tax_code}
                        onChange={(e) => updateLineItem(index, 'taxjar_product_tax_code', e.target.value)}
                        placeholder="e.g., 20010"
                      />
                    </div>
                  )}
                </div>

                {item.quantity_ordered && item.unit_price && (
                  <div className="p-2 bg-gray-50 rounded text-sm">
                    <strong>Line Total:</strong> ${round2((parseFloat(item.quantity_ordered) * parseFloat(item.unit_price)) - (parseFloat(item.discount_amount) || 0)).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Calculate Tax Button */}
        {headerData.customer_id && lineItems.some(item => item.product_id && item.unit_price && item.quantity_ordered) && (
          <Card className="mb-6 border-2 border-purple-500">
            <CardContent className="p-6">
              <Button
                type="button"
                onClick={calculateTax}
                disabled={calculatingTax || isPOBox(headerData.ship_line1, headerData.ship_line2, headerData.ship_line3)}
                className="w-full bg-purple-600 hover:bg-purple-700 gap-2 h-14 text-lg"
              >
                <Calculator className="w-5 h-5" />
                {calculatingTax ? 'Recalculating Tax...' : 'Recalculate Tax (Required Before Saving)'}
              </Button>

              {isPOBox(headerData.ship_line1, headerData.ship_line2, headerData.ship_line3) && (
                <p className="text-center text-sm text-red-600 mt-3 font-semibold">
                  ⚠️ Cannot calculate tax - shipping address contains PO Box
                </p>
              )}

              {taxBreakdown && (
                <div className="mt-4">
                  <TaxSummary 
                    breakdown={taxBreakdown}
                    country={headerData.ship_country}
                    province={headerData.ship_country === 'CA' ? headerData.ship_region : null}
                    state={headerData.ship_country === 'US' ? headerData.ship_region : null}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={headerData.comments_internal}
              onChange={(e) => setHeaderData({ ...headerData, comments_internal: e.target.value })}
              placeholder="Add internal notes..."
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${soId}`))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateSOMutation.isPending || !taxBreakdown}
            className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {updateSOMutation.isPending ? 'Updating...' : 'Update Sales Order'}
          </Button>
        </div>
        
        {!taxBreakdown && headerData.customer_id && lineItems.some(item => item.product_id) && (
          <p className="text-center text-sm text-orange-600 mt-3">
            ⚠️ Please recalculate tax before updating the sales order
          </p>
        )}
      </form>
    </div>
  );
}
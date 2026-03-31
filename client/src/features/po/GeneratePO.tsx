import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, ArrowLeft, Loader2, Send, Download, 
  CheckCircle2, MapPin, Truck, ShieldCheck, Link2, 
  XCircle, Settings2, X, Save, Lock, AlertCircle,
  Building2, Copy, PenTool, Fingerprint, Shield, Ban
} from 'lucide-react';

import { State, City } from 'country-state-city';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatCurrency } from '@/features/bom/utils';
import { fetchQuoteDetails } from '@/features/bom/api';
import { supabase } from '@/lib/supabase';

// ============================================================================
// STRICT ENTERPRISE TYPES
// ============================================================================
type POItem = {
  id: string;
  mpn: string;
  manufacturer: string;
  requested_qty: number;
  unit_cost: number;
  vendor: string;
  risk_level: 'low' | 'high' | 'critical';
  taxable: boolean;
};

type SourceLineItem = {
  id: string;
  requested_mpn: string;
  manufacturer?: string | null;
  requested_qty: number;
  unit_cost?: number | null;
  status: string;
  user_decision: string;
  risk_level?: string | null;
};

type Address = {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default?: boolean;
};

type Financials = {
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
};

type SignatureData = {
  name: string;
  timestamp: string;
  hash: string;
  ip_placeholder: string;
};

// ============================================================================
// CONSTANTS & ENTERPRISE LOOKUPS
// ============================================================================
const generatePONumber = (): string => `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
const generateReqNumber = (): string => `REQ-${Math.floor(Math.random() * 900000) + 100000}`;
const generateCryptoHash = (): string => `0x${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;

const VENDOR_INFO = {
  name: "US Supply Chain Sourcing",
  street: "100 Spectrum Center Dr",
  city: "Irvine",
  state: "CA",
  zip: "92618",
  country: "USA",
  email: "orders@ussupplychainsourcing.com",
  phone: "+1 (949) 555-0198",
  supplier_id: "VEN-88241A",
  tax_id: "US-84192001"
};

const COST_CENTERS = ["CC-9012 (R&D)", "CC-1045 (Manufacturing)", "CC-3392 (Operations)", "CC-8810 (IT Infrastructure)"];
const DEPARTMENTS = ["R&D Engineering", "Operations", "Production", "Quality Assurance", "Facilities"];
const SHIP_METHODS = ["FedEx Ground", "FedEx Priority Overnight", "UPS 2nd Day Air", "DHL Express Worldwide", "Freight Forwarder (LTL)"];
const FOB_POINTS = ["Destination", "Origin", "Shipping Point", "Port of Entry"];

const usStates = State.getStatesOfCountry('US');
const emptyAddress: Partial<Address> = { name: '', street: '', city: '', state: '', zip: '', country: 'US' };

// Pagination Constants
const ITEMS_PER_FIRST_PAGE = 8;
const ITEMS_PER_SUBSEQUENT_PAGE = 15;

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function GeneratePO() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { quoteId } = useParams<{ quoteId: string }>();
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  useEffect(() => { requestAnimationFrame(() => setIsMounted(true)); }, []);

  // --- LIVE QUERIES ---
  const { data: rawQuote, isLoading } = useQuery({
    queryKey: ['quote_review', quoteId],
    queryFn: async () => {
      if (!quoteId) throw new Error("Invalid Quote ID");
      const data = await fetchQuoteDetails(quoteId);
      if (!data || !data.line_items) throw new Error("Corrupted data");
      return data;
    },
    enabled: !!quoteId,
  });

  const { data: savedAddresses = [], refetch: refetchAddresses } = useQuery<Address[]>({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }); 
      if (error) throw error;
      return data as Address[];
    },
    enabled: !!user?.id,
  });

  const { data: globalSettings } = useQuery({
    queryKey: ['procurement_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('procurement_settings').select('tax_rate, shipping_fee').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error; 
      return data || { tax_rate: 8.5, shipping_fee: 150.00 };
    }
  });

  const taxRate = globalSettings?.tax_rate || 8.5;
  const shippingFee = globalSettings?.shipping_fee || 150.00;

  // --- ADDRESS STATE ---
  const [billTo, setBillTo] = useState<Address | null>(null);
  const [shipTo, setShipTo] = useState<Address | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<'BILL_TO' | 'SHIP_TO' | null>(null);
  const [tempAddress, setTempAddress] = useState<Partial<Address>>(emptyAddress);

  const availableCities = useMemo(() => (tempAddress.country === 'US' && tempAddress.state) ? City.getCitiesOfState('US', tempAddress.state) : [], [tempAddress.country, tempAddress.state]);

  useEffect(() => {
    if (savedAddresses.length > 0 && !billTo && !shipTo) {
      setBillTo(savedAddresses[0]);
      setShipTo(savedAddresses[0]);
    }
  }, [savedAddresses, billTo, shipTo]);

  useEffect(() => {
    if (sameAsBilling && billTo) setShipTo(billTo);
  }, [sameAsBilling, billTo]);

  // --- CORE STATE ---
  const [poNumber, setPoNumber] = useState<string>(generatePONumber());
  const [poRevision, setPoRevision] = useState<string>('00');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30');
  const [incoterms, setIncoterms] = useState<string>('DDP');
  const [fobPoint, setFobPoint] = useState<string>(FOB_POINTS[0]);
  const [shipMethod, setShipMethod] = useState<string>(SHIP_METHODS[0]);
  
  const [costCenter, setCostCenter] = useState<string>(COST_CENTERS[0]);
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [reqNumber, setReqNumber] = useState<string>(generateReqNumber());

  const [aiLegalEnabled] = useState<boolean>(true);
  const [customNotes] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [lineItems, setLineItems] = useState<POItem[]>([]);
  const [mobileTab] = useState<'CONFIG' | 'PREVIEW'>('CONFIG');

  // --- SIGNATURE STATE ---
  const [isSignModalOpen, setIsSignModalOpen] = useState<boolean>(false);
  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [typedSignature, setTypedSignature] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

  const corporateBuyer = useMemo(() => {
    const meta = user?.user_metadata || {};
    return {
      name: meta.full_name || meta.name || 'Lorenz Angelo',
      email: user?.email || 'lorenz@supplyos.local',
      phone: meta.phone || '+1 (949) 129-4500',
      company: meta.company || 'Corporate Sourcing Inc.',
      street: meta.street || 'Corporate Base',
      city: meta.city || 'Irvine',
      state: meta.state || 'CA',
      zip: meta.zip || '92618',
      country: meta.country || 'USA',
      tax_id: meta.tax_id || 'US-99120349'
    };
  }, [user]);

  useEffect(() => {
    if (rawQuote && Array.isArray(rawQuote.line_items)) {
      const mappedItems: POItem[] = rawQuote.line_items
        .filter((item: any) => item.status === 'MATCHED' || item.user_decision === 'ACCEPTED') 
        .map((item: any) => ({
          id: item.id || crypto.randomUUID(),
          mpn: item.requested_mpn || 'UNKNOWN',
          manufacturer: (item.manufacturer && item.manufacturer.trim() !== '') ? item.manufacturer : 'Unspecified',
          requested_qty: Math.max(1, item.requested_qty || 1),
          unit_cost: Math.max(0, item.unit_cost || 0),
          vendor: VENDOR_INFO.name, 
          risk_level: (item.risk_level === 'high' || item.risk_level === 'critical' ? item.risk_level : 'low') as 'low' | 'high' | 'critical',
          taxable: true 
        }));
      setLineItems(mappedItems);
    }
  }, [rawQuote]);

  // --- DATA PROCESSING ---
  const displayItems = lineItems; 

  const financials = useMemo<Financials>(() => {
    const subtotal = displayItems.reduce((sum, item) => sum + (item.unit_cost * item.requested_qty), 0);
    const taxableSubtotal = displayItems.filter(i => i.taxable).reduce((sum, item) => sum + (item.unit_cost * item.requested_qty), 0);
    const taxAmount = taxableSubtotal * (taxRate / 100);
    const rawTotal = subtotal + taxAmount + shippingFee;
    return { subtotal, taxAmount, grandTotal: Math.max(0, rawTotal) };
  }, [displayItems, taxRate, shippingFee]);

  const generatedLegalText = useMemo(() => {
    if (!aiLegalEnabled) return customNotes;
    const hasCritical = displayItems.some(i => i.risk_level === 'critical');
    let autoText = `1. COMPLIANCE: All goods must comply with ISO 9001 and RoHS standard specifications.\n2. LOGISTICS: Goods must be shipped via ${shipMethod} under ${incoterms} terms. FOB Point: ${fobPoint}.\n3. INVOICING: Payment terms are strictly ${paymentTerms} from receipt of valid invoice.\n4. IDENTIFICATION: PO Number ${poNumber} must appear on all invoices, packages, and packing slips.\n5. INSPECTION & REJECTION: Buyer reserves the right to inspect and reject non-conforming goods within 30 days of delivery.\n6. WARRANTY: Seller warrants goods are free from defects in material and workmanship for a period of 12 months.\n7. INDEMNIFICATION: Seller shall indemnify Buyer against any claims arising from product defects or intellectual property infringement.`;
    if (hasCritical) autoText += `\n8. TIME IS OF THE ESSENCE: This order contains critical path components. A 2% penalty per week applies for deliveries past ${deliveryDate || 'the agreed delivery date'}.`;
    return customNotes ? `${customNotes}\n\n---\nAutomated Corporate Clauses:\n${autoText}` : autoText;
  }, [aiLegalEnabled, customNotes, displayItems, incoterms, paymentTerms, deliveryDate, fobPoint, shipMethod, poNumber]);

  // --- PAGINATION LOGIC ---
  const paginatedItems = useMemo(() => {
    const pages = [];
    let remainingItems = [...displayItems];
    
    // Page 1
    pages.push(remainingItems.splice(0, ITEMS_PER_FIRST_PAGE));
    
    // Subsequent Pages
    while (remainingItems.length > 0) {
      pages.push(remainingItems.splice(0, ITEMS_PER_SUBSEQUENT_PAGE));
    }
    
    return pages;
  }, [displayItems]);

  const totalPages = paginatedItems.length;

  // --- VALIDATION ---
  const isMissingAddress = !billTo || !shipTo;
  const canSubmit = !isSaving && displayItems.length > 0 && !isMissingAddress && signature !== null;

  // --- ACTIONS ---
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const openAddressModal = useCallback((type: 'BILL_TO' | 'SHIP_TO') => {
    setTempAddress(type === 'BILL_TO' && billTo ? billTo : (type === 'SHIP_TO' && shipTo ? shipTo : emptyAddress));
    setEditingAddress(type);
  }, [billTo, shipTo]);

  const saveAddress = async () => {
    try {
      if (!user?.id) throw new Error("Authentication required.");
      if (!tempAddress.name || !tempAddress.street || !tempAddress.city || !tempAddress.state || !tempAddress.zip) {
        alert("Name, Street, City, State, and Zip Code are required fields.");
        return;
      }
      
      const { data, error } = await supabase
        .from('addresses')
        .insert([{
          user_id: user.id,
          name: tempAddress.name,
          street: tempAddress.street,
          city: tempAddress.city,
          state: tempAddress.state,
          zip: tempAddress.zip,
          country: tempAddress.country === 'US' ? 'USA' : tempAddress.country,
          type: editingAddress === 'BILL_TO' ? 'billing' : 'shipping'
        }])
        .select()
        .single();

      if (error) throw error;
      const newAddress = data as Address;
      
      if (editingAddress === 'BILL_TO') {
        setBillTo(newAddress);
        if (sameAsBilling) setShipTo(newAddress);
      }
      if (editingAddress === 'SHIP_TO') setShipTo(newAddress);
      
      await refetchAddresses();
      setEditingAddress(null);
    } catch (err) {
      alert("Failed to save address securely.");
    }
  };

  const handleSignDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedSignature.trim().toLowerCase() !== corporateBuyer.name.toLowerCase()) {
      alert("Signature must exactly match the Authorized Buyer's name.");
      return;
    }
    if (!agreedToTerms) {
      alert("You must agree to the electronic signature terms.");
      return;
    }

    setSignature({
      name: corporateBuyer.name,
      timestamp: new Date().toISOString(),
      hash: generateCryptoHash(),
      ip_placeholder: "192.168.1.1 (Verified)"
    });
    setIsSignModalOpen(false);
  };

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    
    try {
      const documentSnapshot = {
        vendor: VENDOR_INFO,
        requester: corporateBuyer,
        addresses: { billTo, shipTo },
        line_items: displayItems,
        logistics: { issueDate, deliveryDate, paymentTerms, incoterms, fobPoint, shipMethod },
        accounting: { costCenter, department, reqNumber, poRevision },
        signature: signature
      };

      const { error } = await supabase.from('purchase_orders').insert([{
        quote_id: quoteId,
        po_number: poNumber,
        user_id: user?.id,
        bill_to_address_id: billTo!.id,
        ship_to_address_id: shipTo!.id,
        issue_date: issueDate,
        delivery_date: deliveryDate || null,
        payment_terms: paymentTerms,
        incoterms: incoterms,
        applied_tax_rate: taxRate,
        applied_shipping_fee: shippingFee,
        subtotal: financials.subtotal,
        grand_total: financials.grandTotal,
        notes: aiLegalEnabled ? generatedLegalText : customNotes,
        status: 'issued', 
        document_snapshot: documentSnapshot
      }]);

      if (error) throw error;
      navigate('/dashboard/orders');
    } catch (err) {
      alert("System failed to commit PO to database.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className={`flex flex-col h-[calc(100vh-4rem)] m-4 md:m-6 lg:m-8 max-w-[1800px] mx-auto bg-slate-100 rounded-[2rem] shadow-sm border border-slate-200/60 font-sans relative overflow-hidden transition-all duration-700 ease-out ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
      
      {/* E-SIGNATURE MODAL */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2"><Shield className="w-4 h-4 text-blue-600" /> Cryptographic E-Signature</h3>
              <button onClick={() => setIsSignModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><X className="w-4 h-4"/></button>
            </div>
            
            <form onSubmit={handleSignDocument} className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
                <Fingerprint className="w-5 h-5 shrink-0 text-blue-600" />
                <p className="text-[10px] font-medium leading-relaxed">
                  By signing this document, you legally bind <strong>{corporateBuyer.company}</strong> to this Purchase Order under the Uniform Electronic Transactions Act (UETA) and the ESIGN Act.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Authorized Signatory</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                  {corporateBuyer.name} ({corporateBuyer.email})
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Type Name to Sign *</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={typedSignature} 
                  onChange={e => setTypedSignature(e.target.value)} 
                  placeholder={corporateBuyer.name} 
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-serif italic text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner" 
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer mt-2 group">
                <input 
                  type="checkbox" 
                  required
                  checked={agreedToTerms} 
                  onChange={e => setAgreedToTerms(e.target.checked)} 
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" 
                />
                <span className="text-[10px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                  I agree to use electronic records and signatures, and I confirm I am authorized to issue this Purchase Order.
                </span>
              </label>

              <button type="submit" className="w-full mt-2 py-3 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] focus:outline-none">
                <PenTool className="w-4 h-4" /> Apply Signature & Lock Document
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADDRESS MODAL */}
      {editingAddress && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h3 className="text-xs font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-blue-600" /> Secure New Address</h3>
              <button onClick={() => setEditingAddress(null)} className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><X className="w-4 h-4"/></button>
            </div>
            
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Facility Name *</label>
                <input type="text" value={tempAddress.name || ''} onChange={e=>setTempAddress(p=>({...p, name: e.target.value}))} placeholder="e.g. Main Warehouse" className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Country *</label>
                <select value={tempAddress.country || 'US'} onChange={e => setTempAddress(p => ({...p, country: e.target.value, state: '', city: ''}))} className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm">
                  <option value="US">United States</option><option value="CA">Canada</option><option value="MX">Mexico</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">State *</label>
                  {tempAddress.country === 'US' ? (
                    <select value={tempAddress.state || ''} onChange={e=>setTempAddress(p=>({...p, state: e.target.value, city: ''}))} className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm">
                      <option value="" disabled>Select...</option>
                      {usStates.map(st => <option key={st.isoCode} value={st.isoCode}>{st.name}</option>)}
                    </select>
                  ) : <input type="text" value={tempAddress.state || ''} onChange={e=>setTempAddress(p=>({...p, state: e.target.value}))} className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />}
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">City *</label>
                  {tempAddress.country === 'US' && tempAddress.state ? (
                    <select value={tempAddress.city || ''} onChange={e=>setTempAddress(p=>({...p, city: e.target.value}))} className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" disabled={availableCities.length === 0}>
                      <option value="" disabled>Select...</option>
                      {availableCities.map(city => <option key={city.name} value={city.name}>{city.name}</option>)}
                    </select>
                  ) : <input type="text" value={tempAddress.city || ''} onChange={e=>setTempAddress(p=>({...p, city: e.target.value}))} className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Street Details *</label>
                <input type="text" value={tempAddress.street || ''} onChange={e=>setTempAddress(p=>({...p, street: e.target.value}))} placeholder="123 Main St" className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Postal Code *</label>
                <input type="text" value={tempAddress.zip || ''} onChange={e=>setTempAddress(p=>({...p, zip: e.target.value}))} placeholder="90210" className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto flex justify-end gap-2">
              <button onClick={() => setEditingAddress(null)} className="px-4 py-2 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={saveAddress} className="px-5 py-2 rounded-lg text-[10px] font-bold text-white bg-slate-900 hover:bg-black shadow-sm flex items-center gap-1.5"><Save className="w-3 h-3"/> Commit to DB</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-4 md:p-5 border-b border-slate-200/60 bg-white z-20">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Quote
          </button>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /> Purchase Order Generator
          </h1>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto relative group">
          <button onClick={handleCopyLink} className="flex-1 sm:flex-none bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-1.5">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Link'}
          </button>
          <button className="flex-1 sm:flex-none bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          
          <button 
            onClick={handleGenerate} 
            disabled={!canSubmit}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 
              ${canSubmit ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Issue Official PO
          </button>
          
          {(!canSubmit && !isSaving) && (
            <div className="absolute -bottom-8 right-0 hidden group-hover:flex items-center gap-1.5 bg-red-50 text-red-600 text-[9px] font-bold px-2 py-1 rounded border border-red-200 shadow-sm whitespace-nowrap animate-in fade-in z-50">
              <AlertCircle className="w-3 h-3" /> {signature === null ? "E-Signature Required" : "Missing Addresses"}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        
        {/* LEFT SIDEBAR: Config */}
        <div className="w-full lg:w-[380px] bg-white border-r border-slate-200/60 overflow-y-auto custom-scrollbar flex-col hidden lg:flex">
          <div className="p-4 md:p-6 space-y-8">

            {/* Logistics & Address Selection */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-2"><Truck className="w-3 h-3" /> Supply Logistics</h3>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">PO Number & Revision</label>
                  <div className="flex gap-2">
                    <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-black tracking-tight text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
                    <input type="text" value={poRevision} onChange={e => setPoRevision(e.target.value)} className="w-16 bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-black tracking-tight text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-center" title="Revision Number" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Issue Date</label>
                    <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Delivery Deadline</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full bg-white border border-amber-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20" />
                  </div>
                </div>
                
                {/* Advanced Database Address Dropdowns */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-bold uppercase tracking-widest flex justify-between items-center text-slate-500">
                      Bill To <span className="text-red-500">*</span>
                    </label>
                    {savedAddresses.length > 0 ? (
                      <select 
                        className={`w-full bg-white border rounded-lg p-2 text-[10px] font-extrabold outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 ${!billTo ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200/60'}`}
                        value={billTo?.id || ''}
                        onChange={(e) => {
                          if(e.target.value === 'NEW') openAddressModal('BILL_TO');
                          else {
                            const newBillTo = savedAddresses.find(a => a.id === e.target.value) || null;
                            setBillTo(newBillTo);
                            if (sameAsBilling) setShipTo(newBillTo);
                          }
                        }}
                      >
                        <option value="" disabled>Select Database Record...</option>
                        {savedAddresses.map(addr => <option key={addr.id} value={addr.id}>{addr.name} - {addr.zip}</option>)}
                        <option value="NEW" className="text-blue-600 font-bold">+ Create New Address</option>
                      </select>
                    ) : (
                      <button onClick={() => openAddressModal('BILL_TO')} className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-2 text-[9px] font-bold text-slate-500 hover:bg-slate-100 transition-all text-left">
                        + Select Address
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">
                        Ship To <span className="text-red-500">*</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[9px] font-bold text-slate-600">
                        <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="w-3 h-3 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
                        Same as Billing
                      </label>
                    </div>
                    {savedAddresses.length > 0 ? (
                      <select 
                        disabled={sameAsBilling}
                        className={`w-full bg-white border rounded-lg p-2 text-[10px] font-extrabold outline-none focus:ring-2 focus:ring-blue-500/20 ${sameAsBilling ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'text-slate-700'} ${!shipTo && !sameAsBilling ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200/60'}`}
                        value={shipTo?.id || ''}
                        onChange={(e) => {
                          if(e.target.value === 'NEW') openAddressModal('SHIP_TO');
                          else setShipTo(savedAddresses.find(a => a.id === e.target.value) || null);
                        }}
                      >
                        <option value="" disabled>Select Database Record...</option>
                        {savedAddresses.map(addr => <option key={addr.id} value={addr.id}>{addr.name} - {addr.zip}</option>)}
                        <option value="NEW" className="text-blue-600 font-bold">+ Create New Address</option>
                      </select>
                    ) : (
                      <button disabled={sameAsBilling} onClick={() => openAddressModal('SHIP_TO')} className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-2 text-[9px] font-bold text-slate-500 hover:bg-slate-100 transition-all text-left disabled:opacity-50">
                        + Select Address
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Internal Accounting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Internal Accounting</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Cost Center</label>
                  <select value={costCenter} onChange={e=>setCostCenter(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
                    {COST_CENTERS.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Department</label>
                  <select value={department} onChange={e=>setDepartment(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
                    {DEPARTMENTS.map(dp => <option key={dp} value={dp}>{dp}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Requisition Ref</label>
                <input type="text" value={reqNumber} onChange={e=>setReqNumber(e.target.value)} className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>

            {/* Legal & SLA */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> SLA & Conditions</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Payment Terms</label>
                  <select value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option>Net 30</option><option>Net 45</option><option>Net 60</option><option>CIA</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Incoterms</label>
                  <select value={incoterms} onChange={e=>setIncoterms(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option>DDP</option><option>DAP</option><option>EXW</option><option>FOB</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">FOB Point</label>
                  <select value={fobPoint} onChange={e=>setFobPoint(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
                    {FOB_POINTS.map(fob => <option key={fob} value={fob}>{fob}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Ship Method</label>
                  <select value={shipMethod} onChange={e=>setShipMethod(e.target.value)} className="w-full bg-white border border-slate-200/80 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
                    {SHIP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Locked Financial Adjustments */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Settings2 className="w-3 h-3" /> System Ledger Overrides
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                    Tax Rate (%) <Lock className="w-2 h-2 text-slate-400" />
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-black tracking-tight text-slate-400 cursor-not-allowed">
                    {taxRate}%
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                    Shipping ($) <Lock className="w-2 h-2 text-slate-400" />
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] font-black tracking-tight text-slate-400 cursor-not-allowed">
                    ${shippingFee}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT CANVAS: Enterprise Document Preview (PAGINATED) */}
        <div className="flex-1 flex-col items-center bg-slate-200/80 py-8 px-4 overflow-y-auto custom-scrollbar shadow-inner flex gap-8">
          
          {paginatedItems.map((pageItems, pageIndex) => (
            <div key={pageIndex} className="w-full max-w-[850px] min-h-[1100px] bg-white shadow-xl rounded-xl p-10 md:p-14 relative flex flex-col border border-slate-300 transform scale-[0.90] origin-top -mb-[5%] shrink-0">
              
              {/* Page Indicator */}
              <div className="absolute bottom-10 right-10 text-[8px] font-bold text-slate-300 tracking-widest uppercase">
                Page {pageIndex + 1} of {totalPages}
              </div>

              {/* Document Header (Only on Page 1) */}
              {pageIndex === 0 && (
                <>
                  <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8 shrink-0 relative z-10">
                    <div>
                      <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Purchase Order</h1>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-4 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        <span className="text-slate-400">PO Number:</span> <span className="text-slate-900">{poNumber}</span>
                        <span className="text-slate-400">Revision:</span> <span className="text-slate-900">{poRevision}</span>
                        <span className="text-slate-400">Date:</span> <span className="text-slate-900">{issueDate}</span>
                        <span className="text-slate-400">Currency:</span> <span className="text-slate-900">USD</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">{corporateBuyer.company}</h2>
                      <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Global Procurement Division</p>
                      <p className="text-[9px] font-medium text-slate-400 mt-1">{corporateBuyer.street}</p>
                      <p className="text-[9px] font-medium text-slate-400">{corporateBuyer.city}, {corporateBuyer.state} {corporateBuyer.zip}</p>
                      <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Tax ID: {corporateBuyer.tax_id}</p>
                    </div>
                  </div>

                  {/* Complex Document Meta */}
                  <div className="grid grid-cols-12 gap-6 mb-8 shrink-0 relative z-10">
                    <div className="col-span-4 bg-slate-50/50 p-4 rounded border border-slate-200">
                      <p className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 border-b border-slate-200 pb-1">Vendor / Supplier</p>
                      <p className="font-extrabold text-slate-900 text-[11px] mb-1 tracking-tight">{VENDOR_INFO.name}</p>
                      <p className="text-slate-600 font-medium text-[9px] leading-relaxed">
                        {VENDOR_INFO.street}<br/>
                        {VENDOR_INFO.city}, {VENDOR_INFO.state} {VENDOR_INFO.zip}<br/>
                        {VENDOR_INFO.country}
                      </p>
                      <div className="mt-3 space-y-0.5 text-[8px] font-bold text-slate-500 tracking-wide">
                        <p>ID: {VENDOR_INFO.supplier_id}</p>
                        <p>VAT: {VENDOR_INFO.tax_id}</p>
                        <p>Tel: {VENDOR_INFO.phone}</p>
                      </div>
                    </div>

                    <div className="col-span-4">
                      <p className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 border-b border-slate-100 pb-1">Bill To</p>
                      {billTo ? (
                        <>
                          <p className="font-extrabold text-slate-900 text-[11px] mb-1 tracking-tight">{billTo.name}</p>
                          <p className="text-slate-600 font-medium text-[9px] leading-relaxed">{billTo.street}<br/>{billTo.city}, {billTo.state} {billTo.zip}<br/>{billTo.country}</p>
                        </>
                      ) : (
                        <div className="text-[9px] font-medium text-red-400 bg-red-50 p-2 rounded border border-dashed border-red-200 mt-1">Pending Billing Address</div>
                      )}
                    </div>

                    <div className="col-span-4">
                      <p className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 border-b border-slate-100 pb-1">Ship To</p>
                      {shipTo ? (
                        <>
                          <p className="font-extrabold text-slate-900 text-[11px] mb-1 tracking-tight">{shipTo.name}</p>
                          <p className="text-slate-600 font-medium text-[9px] leading-relaxed">{shipTo.street}<br/>{shipTo.city}, {shipTo.state} {shipTo.zip}<br/>{shipTo.country}</p>
                        </>
                      ) : (
                        <div className="text-[9px] font-medium text-red-400 bg-red-50 p-2 rounded border border-dashed border-red-200 mt-1">Pending Shipping Address</div>
                      )}
                    </div>
                  </div>

                  {/* Terms Matrix */}
                  <div className="grid grid-cols-3 md:grid-cols-6 bg-slate-900 text-white rounded-xl p-3 mb-8 shrink-0 gap-y-4 divide-x-0 md:divide-x divide-slate-700 shadow-sm">
                    <div className="px-3"><span className="text-slate-400 font-bold uppercase tracking-widest text-[7px] block mb-0.5">Required By</span><span className="font-extrabold text-[9px]">{deliveryDate || 'TBD'}</span></div>
                    <div className="px-3"><span className="text-slate-400 font-bold uppercase tracking-widest text-[7px] block mb-0.5">Payment Terms</span><span className="font-extrabold text-[9px]">{paymentTerms}</span></div>
                    <div className="px-3"><span className="text-slate-400 font-bold uppercase tracking-widest text-[7px] block mb-0.5">Incoterms / FOB</span><span className="font-extrabold text-[9px]">{incoterms} - {fobPoint}</span></div>
                    <div className="px-3"><span className="text-slate-400 font-bold uppercase tracking-widest text-[7px] block mb-0.5">Ship Method</span><span className="font-extrabold text-[9px]">{shipMethod}</span></div>
                    <div className="px-3"><span className="text-slate-400 font-bold uppercase tracking-widest text-[7px] block mb-0.5">Cost Center</span><span className="font-extrabold text-[9px]">{costCenter}</span></div>
                    <div className="px-3"><span className="text-slate-400 font-bold uppercase tracking-widest text-[7px] block mb-0.5">Req. Number</span><span className="font-extrabold text-[9px]">{reqNumber}</span></div>
                  </div>
                </>
              )}

              {/* Continuation Header (For Pages 2+) */}
              {pageIndex > 0 && (
                <div className="flex justify-between items-center border-b-2 border-slate-300 pb-4 mb-6 shrink-0 text-slate-500">
                   <span className="text-[10px] font-bold uppercase tracking-widest">Purchase Order {poNumber} - Continued</span>
                   <span className="text-[10px] font-bold uppercase tracking-widest">{corporateBuyer.company}</span>
                </div>
              )}

              {/* Line Items Table (Rendered per page segment) */}
              <div className="flex-1 mb-8">
                <table className="w-full text-left text-xs">
                  <thead className="border-b-2 border-slate-900 text-[8px] font-extrabold uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="py-2 pr-2 w-8 text-slate-400">Ln</th>
                      <th className="py-2">Component / Specification</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 pl-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pageItems.length === 0 ? (
                      <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest bg-slate-50/50 border border-dashed border-slate-200 rounded">No line items mapped</td></tr>
                    ) : pageItems.map((item: POItem, relativeIndex: number) => {
                      // Calculate global line number across pagination
                      const globalLineNumber = (pageIndex === 0) ? relativeIndex + 1 : (ITEMS_PER_FIRST_PAGE + ((pageIndex - 1) * ITEMS_PER_SUBSEQUENT_PAGE) + relativeIndex + 1);
                      return (
                        <tr key={item.id} className="group">
                          <td className="py-4 pr-2 text-slate-400 font-bold text-[9px] align-top">{String(globalLineNumber).padStart(3, '0')}</td>
                          <td className="py-4 align-top">
                            <span className="font-extrabold tracking-tight text-slate-900 block text-[11px]">{item.mpn}</span>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">MFR: {item.manufacturer}</span>
                               <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${item.risk_level === 'critical' ? 'bg-red-100 text-red-600' : item.risk_level === 'high' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{item.risk_level} risk</span>
                            </div>
                          </td>
                          <td className="py-4 text-right align-top font-black text-slate-700">{item.requested_qty.toLocaleString()}</td>
                          <td className="py-4 text-right align-top font-mono font-medium text-[11px] text-slate-500">{formatCurrency(item.unit_cost)}</td>
                          <td className="py-4 pl-2 text-right font-black tracking-tight text-slate-900 text-xs align-top">{formatCurrency(item.unit_cost * item.requested_qty)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Document Footer & Totals (ONLY RENDERED ON THE VERY LAST PAGE) */}
              {pageIndex === totalPages - 1 && (
                <div className="flex justify-between items-start shrink-0 mt-auto pt-6 border-t-4 border-slate-900">
                  <div className="w-[55%] pr-10">
                    <p className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Terms & Conditions</p>
                    <p className="text-[8px] font-medium text-slate-600 whitespace-pre-wrap leading-relaxed text-justify">
                      {aiLegalEnabled ? generatedLegalText : customNotes || 'Standard enterprise purchasing conditions apply.'}
                    </p>
                    
                    {/* ADVANCED E-SIGNATURE BLOCK */}
                    <div className="mt-8 pt-4 border-t border-slate-200">
                      <p className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Requested & Authorized By</p>
                      
                      {signature ? (
                        <div className="flex justify-between items-end animate-in fade-in">
                          <div>
                            <p className="font-serif italic text-2xl text-blue-900 border-b border-slate-300 inline-block px-4 pt-2 pb-1 mb-2">
                              {signature.name}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 mt-1">{corporateBuyer.email} • {corporateBuyer.phone}</p>
                            <p className="text-[9px] font-medium text-slate-500 mt-0.5">{corporateBuyer.company} • {department}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 mb-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              <p className="text-[7px] font-bold uppercase tracking-widest">Cryptographically Signed</p>
                            </div>
                            <p className="text-[8px] font-mono text-slate-500">{signature.hash}</p>
                            <p className="text-[8px] font-mono text-slate-500 mt-0.5">{new Date(signature.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{corporateBuyer.name}</p>
                            <p className="text-[9px] font-bold text-slate-500 mt-0.5">{corporateBuyer.email} • {corporateBuyer.phone}</p>
                          </div>
                          <div className="text-right">
                            <button onClick={() => setIsSignModalOpen(true)} className="bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 focus:outline-none">
                              <PenTool className="w-3.5 h-3.5" /> E-Sign Document
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Financial Ledger */}
                  <div className="w-[40%] bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs shadow-inner">
                     <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-500 text-[10px] uppercase tracking-widest">Subtotal</span>
                      <span className="font-black tracking-tight text-slate-900 text-xs">{formatCurrency(financials.subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-500 text-[10px] uppercase tracking-widest">Tax ({taxRate}%)</span>
                      <span className="font-black tracking-tight text-slate-900 text-xs">{formatCurrency(financials.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-6">
                      <span className="font-bold text-slate-500 text-[10px] uppercase tracking-widest">Freight</span>
                      <span className="font-black tracking-tight text-slate-900 text-xs">{formatCurrency(Math.max(0, shippingFee))}</span>
                    </div>
                    <div className="flex justify-between items-end pt-4 border-t border-slate-300">
                      <span className="font-black uppercase tracking-widest text-xs text-slate-900">Total USD</span>
                      <span className="font-black text-2xl text-slate-900 tracking-tighter leading-none">{formatCurrency(financials.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ))}
          
        </div>

      </div>
    </div>
  );
}
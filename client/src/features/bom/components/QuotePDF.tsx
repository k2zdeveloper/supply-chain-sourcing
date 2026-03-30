import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { QuoteDetails } from '../types'; // Centralized import

// ============================================================================
// STRICT TYPES
// ============================================================================
type FinancialSummary = {
  subtotal: number;
  shipping: number;
  tax_amount: number;
  discount: number;
  final_total: number;
};

type QuotePDFProps = {
  quote: QuoteDetails;
  calculations: FinancialSummary;
};

// ============================================================================
// STYLES & COMPONENT
// ============================================================================
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 10 },
  brandTitle: { fontSize: 24, fontWeight: 'extrabold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 1 },
  documentType: { fontSize: 12, color: '#64748b', marginTop: 4 },
  metaData: { textAlign: 'right' },
  metaText: { fontSize: 9, color: '#475569', marginBottom: 2 },
  bold: { fontWeight: 'bold', color: '#0f172a' },
  
  table: { width: '100%', marginBottom: 30 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', padding: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', padding: 8, alignItems: 'center' },
  
  colMpn: { width: '35%', fontWeight: 'bold' },
  colQty: { width: '15%', textAlign: 'right' },
  colStatus: { width: '20%', textAlign: 'center' },
  colUnit: { width: '15%', textAlign: 'right' },
  colExt: { width: '15%', textAlign: 'right', fontWeight: 'bold' },

  summaryBox: { alignSelf: 'flex-end', width: 250, borderTopWidth: 1, borderTopColor: '#0f172a', paddingTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalText: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' },
  
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#94a3b8', fontSize: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }
});

const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

export const QuoteDocument = ({ quote, calculations }: QuotePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>SupplyOS</Text>
          <Text style={styles.documentType}>Commercial Quotation Manifest</Text>
        </View>
        <View style={styles.metaData}>
          <Text style={styles.metaText}><Text style={styles.bold}>Date:</Text> {new Date().toLocaleDateString()}</Text>
          <Text style={styles.metaText}><Text style={styles.bold}>Quote Ref:</Text> QT-{quote.id.split('-')[0].toUpperCase()}</Text>
          <Text style={styles.metaText}><Text style={styles.bold}>Status:</Text> {quote.status.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.colMpn}>Part Number (MPN)</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colStatus}>Status</Text>
          <Text style={styles.colUnit}>Unit Price</Text>
          <Text style={styles.colExt}>Ext. Price</Text>
        </View>
        
        {quote.line_items.map((item) => (
          <View style={styles.tableRow} key={item.id}>
            <Text style={styles.colMpn}>{item.requested_mpn}</Text>
            <Text style={styles.colQty}>{item.requested_qty.toLocaleString()}</Text>
            <Text style={styles.colStatus}>{item.status}</Text>
            <Text style={styles.colUnit}>{item.unit_cost ? formatCurrency(item.unit_cost) : 'TBD'}</Text>
            <Text style={styles.colExt}>{item.unit_cost ? formatCurrency(item.unit_cost * item.requested_qty) : 'TBD'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.summaryBox}>
        <View style={styles.summaryRow}>
          <Text>Subtotal</Text>
          <Text>{formatCurrency(calculations.subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text>Shipping & Handling</Text>
          <Text>{calculations.shipping === 0 ? 'Free' : formatCurrency(calculations.shipping)}</Text>
        </View>
        {calculations.discount > 0 && (
          <View style={styles.summaryRow}>
            <Text>Volume Discount</Text>
            <Text>-{formatCurrency(calculations.discount)}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text>Estimated Tax</Text>
          <Text>{formatCurrency(calculations.tax_amount)}</Text>
        </View>
        <View style={styles.summaryTotal}>
          <Text style={styles.bold}>Total Purchase</Text>
          <Text style={styles.totalText}>{formatCurrency(calculations.final_total)}</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Generated securely by SupplyOS Enterprise Procurement Engine • {new Date().getFullYear()}
      </Text>
    </Page>
  </Document>
);
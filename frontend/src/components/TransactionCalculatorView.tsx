import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Building2,
  TrendingUp,
  Landmark,
  Receipt,
  Scale,
  Percent,
  Sparkles,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowUpRight,
  FileText,
  Users,
  Wallet,
  ShieldCheck,
  Maximize2,
  RotateCcw,
  Layers,
  Briefcase,
  PieChart,
  Key,
  Tag,
  Coins,
  DollarSign,
  UserCheck,
  Sliders,
} from 'lucide-react';
import { PropertyUnit, LeaseContract } from '../types';
import { FormattedNumberInput, formatSysNumber } from './FormattedNumberInput';
import {
  getLocalFinancialSettings,
  subscribeFinancialSettings,
  computeCustomFeesBreakdown,
  lookupProjectCamFee,
  FinancialSettings,
} from '../utils/financialSettingsStore';

export interface SavedDealScenario {
  id: string;
  createdAt: string;
  unitCode: string;
  projectName: string;
  dealType: 'SALE' | 'RENT_AND_SALE';
  sizeSqm: number;
  salePrice: number;
  salePerSqm: number;
  monthlyRent: number;
  rentPerSqm: number;
  totalTaxesAndGovFees: number;
  totalLegalFees: number;
  sellerNetProceeds: number;
  buyerTotalCost: number;
  grossAgencyRevenue: number;
  coBrokePayout: number;
  internalAgentPayout: number;
  agencyAbsorbedCosts: number;
  netAgencyProfit: number;
  profitMarginPct: number;
}

interface TransactionCalculatorViewProps {
  units: PropertyUnit[];
  leases: LeaseContract[];
  initialUnit?: PropertyUnit | null;
  onSelectUnit?: (unitId: number) => void;
}

export const TransactionCalculatorView: React.FC<TransactionCalculatorViewProps> = ({
  units,
  leases,
  initialUnit,
  onSelectUnit,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'profit_report'>('calculator');
  const [reportDisplayMode, setReportDisplayMode] = useState<'SPLIT' | 'SALE' | 'RENT'>('SPLIT');
  const [globalSettings, setGlobalSettings] = useState<FinancialSettings>(getLocalFinancialSettings);

  // Sync with Global Financial Settings Store
  useEffect(() => {
    return subscribeFinancialSettings(() => {
      const updated = getLocalFinancialSettings();
      setGlobalSettings(updated);
      setTransferFeeRate(updated.taxes.transfer_fee_rate);
      setTransferFeeSplit(updated.taxes.default_transfer_split);
      setSaleCommissionRate(updated.commissions.sale_commission_rate);
      setCoBrokeSplitPct(updated.commissions.sale_co_broke_split_pct);
      setInternalAgentSharePct(updated.commissions.sale_internal_agent_share_pct);
      setLeaseCommissionMonths(updated.commissions.rental_1yr_months);
    });
  }, []);

  // Selected Unit or Custom Property
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    initialUnit ? String(initialUnit.id) : 'CUSTOM'
  );
  const [dealMode, setDealMode] = useState<'SALE' | 'RENT_AND_SALE'>('SALE');

  // Core Property & Price-Per-Sqm State
  const [unitCode, setUnitCode] = useState<string>(initialUnit?.unit_code || 'CONDO-3M');
  const [projectName, setProjectName] = useState<string>(
    initialUnit?.project_name || 'Prime Residence Sukhumvit'
  );
  const [sizeSqm, setSizeSqm] = useState<number>(initialUnit?.size_sqm || 30.0);
  const [salePrice, setSalePrice] = useState<number>(
    initialUnit?.target_sale_price || 3000000
  );
  const [appraisedValue, setAppraisedValue] = useState<number>(
    initialUnit?.target_sale_price || 3000000
  );
  const [monthlyRent, setMonthlyRent] = useState<number>(
    initialUnit?.target_rent_price || 15000
  );

  // Taxes & Government Transfer Fees Configuration
  const [transferFeeRate, setTransferFeeRate] = useState<number>(
    globalSettings.taxes.transfer_fee_rate || 2.0
  );
  const [transferFeeSplit, setTransferFeeSplit] = useState<'50_50' | 'SELLER_100' | 'BUYER_100'>(
    globalSettings.taxes.default_transfer_split || '50_50'
  );

  // SBT (3.3% if held < 5 yrs / corporate) vs Stamp Duty (0.5% if held >= 5 yrs)
  const [taxRegime, setTaxRegime] = useState<'SBT_3_3' | 'STAMP_0_5'>('SBT_3_3');
  const [sbtOrStampPayer, setSbtOrStampPayer] = useState<'SELLER_100' | '50_50' | 'BUYER_100'>('SELLER_100');

  // Withholding Tax (WHT)
  const [sellerEntityType, setSellerEntityType] = useState<'INDIVIDUAL' | 'CORPORATE'>('INDIVIDUAL');
  const [yearsOwned, setYearsOwned] = useState<number>(3);
  const [whtRate, setWhtRate] = useState<number>(globalSettings.taxes.wht_individual_rate || 2.2);
  const [whtPayer, setWhtPayer] = useState<'SELLER_100' | '50_50' | 'BUYER_100'>('SELLER_100');

  // Optional Buyer Mortgage Registration (1%)
  const [includeBuyerMortgage, setIncludeBuyerMortgage] = useState<boolean>(false);
  const [buyerLoanLtvPct, setBuyerLoanLtvPct] = useState<number>(70);
  const [mortgageFeeRate, setMortgageFeeRate] = useState<number>(1.0);

  // Commission & Agency Revenue Configuration
  const [saleCommissionRate, setSaleCommissionRate] = useState<number>(
    globalSettings.commissions.sale_commission_rate || 3.0
  );
  const [hasSellerNetMarkup, setHasSellerNetMarkup] = useState<boolean>(false);
  const [sellerNetTargetPrice, setSellerNetTargetPrice] = useState<number>(2910000);
  const [includeLeaseRevenueInCalc, setIncludeLeaseRevenueInCalc] = useState<boolean>(false);
  const [leaseCommissionMonths, setLeaseCommissionMonths] = useState<number>(
    globalSettings.commissions.rental_1yr_months || 1.0
  );
  const [monthlyRentSpread, setMonthlyRentSpread] = useState<number>(2000);
  const [leaseTermMonths, setLeaseTermMonths] = useState<number>(12);

  // Commission VAT & WHT & Splits
  const [chargeVatOnCommission, setChargeVatOnCommission] = useState<boolean>(false);
  const [coBrokeSplitPct, setCoBrokeSplitPct] = useState<number>(
    globalSettings.commissions.sale_co_broke_split_pct || 0
  );
  const [internalAgentSharePct, setInternalAgentSharePct] = useState<number>(
    globalSettings.commissions.sale_internal_agent_share_pct || 25
  );

  // Legal Fees, Due Diligence & Admin Costs
  const [legalDraftingFee, setLegalDraftingFee] = useState<number>(15000);
  const [titleDueDiligenceFee, setTitleDueDiligenceFee] = useState<number>(8000);
  const [fetForeignQuotaFee, setFetForeignQuotaFee] = useState<number>(5000);
  const [legalFeeAllocation, setLegalFeeAllocation] = useState<
    '50_50' | 'BUYER_100' | 'SELLER_100' | 'AGENCY_ABSORBED'
  >('50_50');
  const [agencyAdminCoordinationFee, setAgencyAdminCoordinationFee] = useState<number>(10000); // Charged to client
  const [agencyMarketingAndRebateCost, setAgencyMarketingAndRebateCost] = useState<number>(5000);

  // Saved Deal Scenarios for the Agency Profit Report
  const [savedDeals, setSavedDeals] = useState<SavedDealScenario[]>(() => {
    const sampleUnits = units.slice(0, 3);
    if (sampleUnits.length === 0) return [];
    return sampleUnits.map((u, idx) => {
      const sz = u.size_sqm || 45;
      const sp = u.target_sale_price || 6500000;
      const rn = u.target_rent_price || 30000;
      const comm = Math.round(sp * 0.03);
      const taxes = Math.round(sp * 0.065);
      const legal = 25000;
      const agentShare = Math.round(comm * 0.25);
      const coBroke = idx === 1 ? Math.round(comm * 0.3) : 0;
      const mktCost = 5000;
      const netProfit = comm + 10000 - coBroke - agentShare - mktCost;
      return {
        id: `deal-seed-${u.id}`,
        createdAt: new Date().toISOString().split('T')[0],
        unitCode: u.unit_code,
        projectName: u.project_name,
        dealType: 'SALE',
        sizeSqm: sz,
        salePrice: sp,
        salePerSqm: Math.round(sp / sz),
        monthlyRent: rn,
        rentPerSqm: Math.round(rn / sz),
        totalTaxesAndGovFees: taxes,
        totalLegalFees: legal,
        sellerNetProceeds: sp - Math.round(taxes * 0.85) - comm - Math.round(legal * 0.5),
        buyerTotalCost: sp + Math.round(taxes * 0.15) + Math.round(legal * 0.5),
        grossAgencyRevenue: comm + 10000,
        coBrokePayout: coBroke,
        internalAgentPayout: agentShare,
        agencyAbsorbedCosts: mktCost,
        netAgencyProfit: netProfit,
        profitMarginPct: Math.round((netProfit / (comm + 10000)) * 100),
      };
    });
  });
  const [justSavedBanner, setJustSavedBanner] = useState(false);

  // Sync when initialUnit prop changes
  useEffect(() => {
    if (initialUnit) {
      setSelectedUnitId(String(initialUnit.id));
      setUnitCode(initialUnit.unit_code);
      setProjectName(initialUnit.project_name);
      setSizeSqm(initialUnit.size_sqm || 30.0);
      setSalePrice(initialUnit.target_sale_price || 3000000);
      setAppraisedValue(initialUnit.target_sale_price || 3000000);
      setSellerNetTargetPrice(Math.round((initialUnit.target_sale_price || 3000000) * 0.97));
      setMonthlyRent(initialUnit.target_rent_price || 15000);
      setActiveSubTab('calculator');
    }
  }, [initialUnit]);

  const handleSelectUnitChange = (val: string) => {
    setSelectedUnitId(val);
    if (val === 'CUSTOM') return;
    const found = units.find((u) => String(u.id) === val);
    if (found) {
      setUnitCode(found.unit_code);
      setProjectName(found.project_name);
      setSizeSqm(found.size_sqm || 30.0);
      const sp = found.target_sale_price || 3000000;
      const rn = found.target_rent_price || 15000;
      setSalePrice(sp);
      setAppraisedValue(sp);
      setSellerNetTargetPrice(Math.round(sp * 0.97));
      setMonthlyRent(rn);
    }
  };

  // Auto-calculated Price per Sqm & Rental Yield
  const selectedUnitObj = useMemo(() => {
    return units.find((u) => String(u.id) === selectedUnitId);
  }, [units, selectedUnitId]);

  const resolvedCam = useMemo(() => {
    return lookupProjectCamFee(
      globalSettings.project_cam_directory,
      projectName,
      selectedUnitObj?.property_type,
      globalSettings.cam_fees.default_cam_per_sqm_month || 55,
      globalSettings.cam_fees.sinking_fund_per_sqm || 500
    );
  }, [
    globalSettings.project_cam_directory,
    projectName,
    selectedUnitObj,
    globalSettings.cam_fees,
  ]);

  const salePerSqm = sizeSqm > 0 ? salePrice / sizeSqm : 0;
  const rentPerSqm = sizeSqm > 0 ? monthlyRent / sizeSqm : 0;
  const grossRentalYieldPct = salePrice > 0 ? ((monthlyRent * 12) / salePrice) * 100 : 0;
  const paybackYears = monthlyRent > 0 ? salePrice / (monthlyRent * 12) : 0;

  // Comprehensive Transaction Calculation Engine
  const calc = useMemo(() => {
    // 1. Transfer Fee (typically based on Appraised Value)
    const totalTransferFee = Math.round(appraisedValue * (transferFeeRate / 100));
    const sellerTransferFee =
      transferFeeSplit === 'SELLER_100'
        ? totalTransferFee
        : transferFeeSplit === '50_50'
        ? Math.round(totalTransferFee * 0.5)
        : 0;
    const buyerTransferFee = totalTransferFee - sellerTransferFee;

    // 2. Specific Business Tax (3.3%) OR Stamp Duty (0.5%) — based on higher of Sale Price or Appraised Value
    const taxBase = Math.max(salePrice, appraisedValue);
    const sbtOrStampRate = taxRegime === 'SBT_3_3' ? 3.3 : 0.5;
    const totalSbtOrStamp = Math.round(taxBase * (sbtOrStampRate / 100));
    const sellerSbtOrStamp =
      sbtOrStampPayer === 'SELLER_100'
        ? totalSbtOrStamp
        : sbtOrStampPayer === '50_50'
        ? Math.round(totalSbtOrStamp * 0.5)
        : 0;
    const buyerSbtOrStamp = totalSbtOrStamp - sellerSbtOrStamp;

    // 3. Withholding Tax (WHT)
    const effectiveWhtRate = sellerEntityType === 'CORPORATE' ? 1.0 : whtRate;
    const totalWht = Math.round(taxBase * (effectiveWhtRate / 100));
    const sellerWht =
      whtPayer === 'SELLER_100'
        ? totalWht
        : whtPayer === '50_50'
        ? Math.round(totalWht * 0.5)
        : 0;
    const buyerWht = totalWht - sellerWht;

    // 4. Optional Buyer Mortgage Registration Fee
    const loanAmount = includeBuyerMortgage ? Math.round(salePrice * (buyerLoanLtvPct / 100)) : 0;
    const buyerMortgageFee = includeBuyerMortgage
      ? Math.round(loanAmount * (mortgageFeeRate / 100))
      : 0;

    const totalGovTaxesAndFees =
      totalTransferFee + totalSbtOrStamp + totalWht + buyerMortgageFee;
    const sellerTotalTaxes = sellerTransferFee + sellerSbtOrStamp + sellerWht;
    const buyerTotalTaxes = buyerTransferFee + buyerSbtOrStamp + buyerWht + buyerMortgageFee;

    // 5. Legal, Due Diligence & FET Fees
    const totalLegalFees = legalDraftingFee + titleDueDiligenceFee + fetForeignQuotaFee;
    const sellerLegalFees =
      legalFeeAllocation === 'SELLER_100'
        ? totalLegalFees
        : legalFeeAllocation === '50_50'
        ? Math.round(totalLegalFees * 0.5)
        : 0;
    const buyerLegalFees =
      legalFeeAllocation === 'BUYER_100'
        ? totalLegalFees
        : legalFeeAllocation === '50_50'
        ? totalLegalFees - sellerLegalFees
        : 0;
    const agencyAbsorbedLegal =
      legalFeeAllocation === 'AGENCY_ABSORBED' ? totalLegalFees : 0;

    // 6. Agency Commission, Price Spread & Lease Revenue
    const baseSaleCommission = Math.round(salePrice * (saleCommissionRate / 100));
    const salePriceSpread = hasSellerNetMarkup
      ? Math.max(0, salePrice - sellerNetTargetPrice)
      : 0;
    const commissionVat = chargeVatOnCommission ? Math.round(baseSaleCommission * 0.07) : 0;

    // Optional Lease Revenue (if Rent + Sale or Lease package)
    const leaseUpfrontComm =
      includeLeaseRevenueInCalc || dealMode === 'RENT_AND_SALE'
        ? Math.round(monthlyRent * leaseCommissionMonths)
        : 0;
    const leaseSpreadTotal =
      includeLeaseRevenueInCalc || dealMode === 'RENT_AND_SALE'
        ? Math.round(monthlyRentSpread * leaseTermMonths)
        : 0;

    const grossAgencyRevenue =
      baseSaleCommission +
      salePriceSpread +
      agencyAdminCoordinationFee +
      leaseUpfrontComm +
      leaseSpreadTotal;

    // Agency Deductions (Co-Broke, Internal Agent Split, Absorbed Legal & Marketing)
    const coBrokePayout = Math.round(
      (baseSaleCommission + leaseUpfrontComm) * (coBrokeSplitPct / 100)
    );
    const netCommissionAfterCoBroke =
      baseSaleCommission + leaseUpfrontComm - coBrokePayout;
    const internalAgentPayout = Math.round(
      netCommissionAfterCoBroke * (internalAgentSharePct / 100)
    );
    const totalAgencyCosts =
      coBrokePayout +
      internalAgentPayout +
      agencyAbsorbedLegal +
      agencyMarketingAndRebateCost;

    const netAgencyProfit = grossAgencyRevenue - totalAgencyCosts;
    const profitMarginPct =
      grossAgencyRevenue > 0 ? Math.round((netAgencyProfit / grossAgencyRevenue) * 100) : 0;

    // 7. Seller Net Proceeds & Buyer Total Acquisition Cost
    const sellerCommissionOutflow =
      baseSaleCommission + commissionVat + salePriceSpread + agencyAdminCoordinationFee;
    const sellerNetProceeds =
      salePrice - sellerTotalTaxes - sellerLegalFees - sellerCommissionOutflow;
    const sellerNetPerSqm = sizeSqm > 0 ? Math.round(sellerNetProceeds / sizeSqm) : 0;

    const buyerTotalAcquisitionCost = salePrice + buyerTotalTaxes + buyerLegalFees;
    const buyerEffectivePerSqm =
      sizeSqm > 0 ? Math.round(buyerTotalAcquisitionCost / sizeSqm) : 0;

    // 8. Dedicated Rental & Yield Analysis
    const annualGrossRent = monthlyRent * 12;
    const securityDeposit = monthlyRent * 2;
    const advanceRent = monthlyRent * 1;
    const tenantTotalMoveInCash = securityDeposit + advanceRent;
    const agencyRentalComm = monthlyRent;
    const estimatedAnnualCam = Math.round(sizeSqm * resolvedCam.camFeePerSqmMonth * 12);
    const estimatedRentalTax = Math.round(annualGrossRent * 0.05);
    const landlordFirstYearNet = Math.max(
      0,
      annualGrossRent - agencyRentalComm - estimatedAnnualCam - estimatedRentalTax
    );
    const landlordMonthlyNet = Math.round(landlordFirstYearNet / 12);
    const landlordOngoingMonthlyNet = Math.round(landlordFirstYearNet / 11);
    const netRentalYieldPct = salePrice > 0 ? (landlordFirstYearNet / salePrice) * 100 : 0;

    return {
      totalTransferFee,
      sellerTransferFee,
      buyerTransferFee,
      sbtOrStampRate,
      totalSbtOrStamp,
      sellerSbtOrStamp,
      buyerSbtOrStamp,
      effectiveWhtRate,
      totalWht,
      sellerWht,
      buyerWht,
      loanAmount,
      buyerMortgageFee,
      totalGovTaxesAndFees,
      sellerTotalTaxes,
      buyerTotalTaxes,
      totalLegalFees,
      sellerLegalFees,
      buyerLegalFees,
      agencyAbsorbedLegal,
      baseSaleCommission,
      salePriceSpread,
      commissionVat,
      leaseUpfrontComm,
      leaseSpreadTotal,
      grossAgencyRevenue,
      coBrokePayout,
      internalAgentPayout,
      totalAgencyCosts,
      netAgencyProfit,
      profitMarginPct,
      sellerCommissionOutflow,
      sellerNetProceeds,
      sellerNetPerSqm,
      buyerTotalAcquisitionCost,
      buyerEffectivePerSqm,
      annualGrossRent,
      securityDeposit,
      advanceRent,
      tenantTotalMoveInCash,
      agencyRentalComm,
      estimatedAnnualCam,
      estimatedRentalTax,
      landlordFirstYearNet,
      landlordMonthlyNet,
      landlordOngoingMonthlyNet,
      netRentalYieldPct,
    };
  }, [
    appraisedValue,
    transferFeeRate,
    transferFeeSplit,
    salePrice,
    taxRegime,
    sbtOrStampPayer,
    sellerEntityType,
    whtRate,
    whtPayer,
    includeBuyerMortgage,
    buyerLoanLtvPct,
    mortgageFeeRate,
    legalDraftingFee,
    titleDueDiligenceFee,
    fetForeignQuotaFee,
    legalFeeAllocation,
    saleCommissionRate,
    hasSellerNetMarkup,
    sellerNetTargetPrice,
    chargeVatOnCommission,
    includeLeaseRevenueInCalc,
    dealMode,
    monthlyRent,
    leaseCommissionMonths,
    monthlyRentSpread,
    leaseTermMonths,
    agencyAdminCoordinationFee,
    coBrokeSplitPct,
    internalAgentSharePct,
    agencyMarketingAndRebateCost,
    sizeSqm,
  ]);

  const handleSaveDealToReport = () => {
    const newDeal: SavedDealScenario = {
      id: `deal-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      unitCode: unitCode || 'CUSTOM-UNIT',
      projectName: projectName || 'Custom Property',
      dealType: dealMode,
      sizeSqm,
      salePrice,
      salePerSqm: Math.round(salePerSqm),
      monthlyRent,
      rentPerSqm: Math.round(rentPerSqm),
      totalTaxesAndGovFees: calc.totalGovTaxesAndFees,
      totalLegalFees: calc.totalLegalFees,
      sellerNetProceeds: calc.sellerNetProceeds,
      buyerTotalCost: calc.buyerTotalAcquisitionCost,
      grossAgencyRevenue: calc.grossAgencyRevenue,
      coBrokePayout: calc.coBrokePayout,
      internalAgentPayout: calc.internalAgentPayout,
      agencyAbsorbedCosts: calc.agencyAbsorbedLegal + agencyMarketingAndRebateCost,
      netAgencyProfit: calc.netAgencyProfit,
      profitMarginPct: calc.profitMarginPct,
    };
    setSavedDeals((prev) => [newDeal, ...prev]);
    setJustSavedBanner(true);
    setTimeout(() => setJustSavedBanner(false), 5000);
  };

  // Portfolio-Wide Agency Profit Aggregation (Active Leases + Saved Sale Transactions)
  const agencyProfitReportStats = useMemo(() => {
    const leaseUpfrontCommTotal = leases.reduce(
      (acc, l) => acc + (l.agent_commission || 0),
      0
    );
    const leaseTotalProfit = leases.reduce(
      (acc, l) => acc + (l.total_agency_profit || 0),
      0
    );
    const leaseRecurringSpreadAndMgmt = Math.max(0, leaseTotalProfit - leaseUpfrontCommTotal);

    const salesGrossRevenue = savedDeals.reduce((acc, d) => acc + d.grossAgencyRevenue, 0);
    const salesCoBrokeCost = savedDeals.reduce((acc, d) => acc + d.coBrokePayout, 0);
    const salesAgentSplits = savedDeals.reduce((acc, d) => acc + d.internalAgentPayout, 0);
    const salesLegalAndMktCosts = savedDeals.reduce((acc, d) => acc + d.agencyAbsorbedCosts, 0);
    const salesNetProfit = savedDeals.reduce((acc, d) => acc + d.netAgencyProfit, 0);

    const combinedAgencyNetProfit = leaseTotalProfit + salesNetProfit;
    const combinedGrossRevenue = leaseTotalProfit + salesGrossRevenue;

    return {
      leaseUpfrontCommTotal,
      leaseRecurringSpreadAndMgmt,
      leaseTotalProfit,
      salesGrossRevenue,
      salesCoBrokeCost,
      salesAgentSplits,
      salesLegalAndMktCosts,
      salesNetProfit,
      combinedAgencyNetProfit,
      combinedGrossRevenue,
    };
  }, [leases, savedDeals]);

  return (
    <div className="space-y-6">
      {/* Top Sub-Navigation & Mode Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSubTab('calculator')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'calculator'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>1. Transaction Calculator (Taxes, Commission & Legal Fees)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('profit_report')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'profit_report'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>2. Executive Agency Profit Report</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeSubTab === 'profit_report'
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              ฿{agencyProfitReportStats.combinedAgencyNetProfit.toLocaleString()}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            <span>Print / Export PDF Report</span>
          </button>
        </div>
      </div>

      {justSavedBanner && (
        <div className="bg-emerald-950 text-white px-5 py-3.5 rounded-2xl flex items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Saved deal calculation for <strong>{unitCode} — {projectName}</strong> (Net Agency Profit:{' '}
              <strong className="text-emerald-300">฿{calc.netAgencyProfit.toLocaleString()}</strong>) to the
              Executive Agency Profit Report.
            </span>
          </div>
          <button
            onClick={() => setActiveSubTab('profit_report')}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shrink-0 cursor-pointer"
          >
            View Agency Profit Report →
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: INTERACTIVE TRANSACTION CALCULATOR (TAXES, COMM, LEGAL & PROFIT) */}
      {/* ===================================================================== */}
      {activeSubTab === 'calculator' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLUMNS: INPUTS (UNIT, SQM PRICING, TAXES, COMMISSION, LEGAL) */}
          <div className="xl:col-span-7 space-y-5">
            {/* SECTION A: Property Selection & Auto Price-Per-Sqm Generator */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Property Valuation & Auto Price-Per-Sqm Generator
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Key in Sale Price, Monthly Rent, or Size (sqm) — Rent/sqm and Sale/sqm are auto-generated instantly.
                  </p>
                </div>

                <select
                  value={selectedUnitId}
                  onChange={(e) => handleSelectUnitChange(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CUSTOM">-- Custom Property Input --</option>
                  {units.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.unit_code} — {u.project_name} ({u.size_sqm} sqm)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Code</label>
                  <input
                    type="text"
                    value={unitCode}
                    onChange={(e) => {
                      setUnitCode(e.target.value);
                      setSelectedUnitId('CUSTOM');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Building / Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      setSelectedUnitId('CUSTOM');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-indigo-900 block mb-1">
                    Unit Size (Sqm) *
                  </label>
                  <div className="relative">
                    <FormattedNumberInput
                      value={sizeSqm}
                      maxDecimals={2}
                      onValueChange={(val) => setSizeSqm(Math.max(0.5, val))}
                      className="w-full px-3 py-2 pr-10 rounded-xl border border-indigo-300 bg-indigo-50/40 font-extrabold text-indigo-950"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-indigo-600 pointer-events-none">
                      sqm
                    </span>
                  </div>
                </div>
              </div>

              {/* Sale Price + Auto Sale/Sqm AND Rent Price + Auto Rent/Sqm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Sale Box */}
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900">
                      Sale Price & Auto Sale / Sqm
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                      Auto-Calculated
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Sale Price (THB)
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Standard Benchmark: ฿3,000,000
                      </span>
                    </div>
                    <FormattedNumberInput
                      value={salePrice}
                      maxDecimals={2}
                      onValueChange={(nextSale) => {
                        setSalePrice(nextSale);
                        setAppraisedValue(nextSale);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white font-extrabold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Presets:</span>
                      {[
                        { label: '฿1.5M', val: 1500000 },
                        { label: '฿3.0M (Standard)', val: 3000000 },
                        { label: '฿5.0M', val: 5000000 },
                        { label: '฿10.0M', val: 10000000 },
                        { label: '฿28.5M', val: 28500000 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => {
                            setSalePrice(p.val);
                            setAppraisedValue(p.val);
                            setSellerNetTargetPrice(Math.round(p.val * 0.97));
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                            salePrice === p.val
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Auto Sale Price per Sqm
                      </span>
                      <span className="text-base font-extrabold text-indigo-700">
                        ฿{formatSysNumber(salePerSqm, 2)}
                        <span className="text-xs font-semibold text-slate-500"> / sqm</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] text-slate-400 block">Edit ฿/sqm directly</label>
                      <FormattedNumberInput
                        value={Math.round(salePerSqm * 100) / 100}
                        maxDecimals={2}
                        onValueChange={(perSqm) => {
                          const nextTotal = Math.round(perSqm * sizeSqm);
                          setSalePrice(nextTotal);
                          setAppraisedValue(nextTotal);
                        }}
                        className="w-32 px-2 py-1 text-right rounded-lg border border-slate-200 text-xs font-bold text-indigo-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Rent Box */}
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">
                      Monthly Rent & Auto Rent / Sqm
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      Gross Yield: {formatSysNumber(grossRentalYieldPct, 2, 2)}% p.a.
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Rent (THB/mo)
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Standard: ฿15,000 / mo
                      </span>
                    </div>
                    <FormattedNumberInput
                      value={monthlyRent}
                      maxDecimals={2}
                      onValueChange={(val) => setMonthlyRent(val)}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-extrabold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Presets:</span>
                      {[
                        { label: '฿12K', val: 12000 },
                        { label: '฿15K (Standard)', val: 15000 },
                        { label: '฿25K', val: 25000 },
                        { label: '฿35K', val: 35000 },
                        { label: '฿145K', val: 145000 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setMonthlyRent(p.val)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                            monthlyRent === p.val
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-emerald-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Auto Rent per Sqm
                      </span>
                      <span className="text-base font-extrabold text-emerald-700">
                        ฿{formatSysNumber(rentPerSqm, 2)}
                        <span className="text-xs font-semibold text-slate-500"> / sqm / mo</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] text-slate-400 block">Edit ฿/sqm/mo</label>
                      <FormattedNumberInput
                        value={Math.round(rentPerSqm * 100) / 100}
                        maxDecimals={2}
                        onValueChange={(perSqm) => {
                          setMonthlyRent(Math.round(perSqm * sizeSqm));
                        }}
                        className="w-28 px-2 py-1 text-right rounded-lg border border-slate-200 text-xs font-bold text-emerald-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION B: Property Transfer Taxes & Government Fees */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-amber-600" />
                    Property Transaction Taxes & Land Department Fees
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure Transfer Fee, Specific Business Tax (SBT) / Stamp Duty, Withholding Tax & Buyer/Seller Split
                  </p>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
                  Total Taxes: ฿{calc.totalGovTaxesAndFees.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Land Dept. Appraised Valuation (THB)
                  </label>
                  <div className="flex gap-2">
                    <FormattedNumberInput
                      value={appraisedValue}
                      maxDecimals={2}
                      onValueChange={(val) => setAppraisedValue(val)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setAppraisedValue(salePrice)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 shrink-0"
                    >
                      Match Sale
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    1. Transfer Fee Rate (%) & Payer Split
                  </label>
                  <div className="flex gap-2">
                    <FormattedNumberInput
                      value={transferFeeRate}
                      maxDecimals={2}
                      onValueChange={(val) => setTransferFeeRate(val)}
                      className="w-20 px-2.5 py-2 rounded-xl border border-slate-300 font-bold"
                    />
                    <select
                      value={transferFeeSplit}
                      onChange={(e) => setTransferFeeSplit(e.target.value as any)}
                      className="flex-1 px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="50_50">50% Seller / 50% Buyer (฿{(calc.totalTransferFee / 2).toLocaleString()} ea)</option>
                      <option value="SELLER_100">100% Paid by Seller</option>
                      <option value="BUYER_100">100% Paid by Buyer</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                {/* SBT vs Stamp Duty */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      2. Specific Business Tax vs. Stamp Duty
                    </span>
                    <span className="font-extrabold text-amber-800">
                      ฿{calc.totalSbtOrStamp.toLocaleString()}
                    </span>
                  </div>
                  <select
                    value={taxRegime}
                    onChange={(e) => setTaxRegime(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="SBT_3_3">
                      Specific Business Tax 3.3% (Held &lt; 5 yrs or Corporate)
                    </option>
                    <option value="STAMP_0_5">
                      Stamp Duty 0.5% (Held ≥ 5 yrs / SBT Exempt)
                    </option>
                  </select>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">Allocated to:</span>
                    <select
                      value={sbtOrStampPayer}
                      onChange={(e) => setSbtOrStampPayer(e.target.value as any)}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold"
                    >
                      <option value="SELLER_100">100% Seller</option>
                      <option value="50_50">50% Seller / 50% Buyer</option>
                      <option value="BUYER_100">100% Buyer</option>
                    </select>
                  </div>
                </div>

                {/* Withholding Tax (WHT) */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      3. Withholding Tax (WHT)
                    </span>
                    <span className="font-extrabold text-amber-800">
                      ฿{calc.totalWht.toLocaleString()} ({calc.effectiveWhtRate}%)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={sellerEntityType}
                      onChange={(e) => {
                        const nextType = e.target.value as 'INDIVIDUAL' | 'CORPORATE';
                        setSellerEntityType(nextType);
                        if (nextType === 'CORPORATE') setWhtRate(1.0);
                        else setWhtRate(2.2);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                    >
                      <option value="INDIVIDUAL">Individual Seller</option>
                      <option value="CORPORATE">Corporate (1.0% WHT)</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <FormattedNumberInput
                        disabled={sellerEntityType === 'CORPORATE'}
                        value={sellerEntityType === 'CORPORATE' ? 1.0 : whtRate}
                        maxDecimals={2}
                        onValueChange={(val) => setWhtRate(val)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-bold disabled:bg-slate-100"
                        title="Effective Withholding Tax %"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">Allocated to:</span>
                    <select
                      value={whtPayer}
                      onChange={(e) => setWhtPayer(e.target.value as any)}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold"
                    >
                      <option value="SELLER_100">100% Seller</option>
                      <option value="50_50">50% Seller / 50% Buyer</option>
                      <option value="BUYER_100">100% Buyer</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION C: Agency Commission, Price Spread & Co-Broke / Agent Split */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    Agency Commission, Price Spread & Co-Broke Split
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure sale commission %, confidential price markup, co-broke partner share & internal agent split
                  </p>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Gross Comm: ฿{calc.grossAgencyRevenue.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Sale Commission Rate (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <FormattedNumberInput
                      value={saleCommissionRate}
                      maxDecimals={2}
                      onValueChange={(val) => setSaleCommissionRate(val)}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 font-extrabold text-indigo-900"
                    />
                    <span className="text-slate-500 font-bold">%</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 font-bold mt-1">
                    = ฿{calc.baseSaleCommission.toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Co-Broke Partner Split (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <FormattedNumberInput
                      value={coBrokeSplitPct}
                      maxDecimals={2}
                      onValueChange={(val) => setCoBrokeSplitPct(val)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                    />
                    <span className="text-slate-500 font-bold">%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Payout: -฿{calc.coBrokePayout.toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Internal Agent Share (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <FormattedNumberInput
                      value={internalAgentSharePct}
                      maxDecimals={2}
                      onValueChange={(val) => setInternalAgentSharePct(val)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                    />
                    <span className="text-slate-500 font-bold">%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Agent Cut: -฿{calc.internalAgentPayout.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Optional Seller Net Markup / Price Spread & Lease Package Add-on */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                  <label className="inline-flex items-center gap-2 font-bold text-indigo-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasSellerNetMarkup}
                      onChange={(e) => setHasSellerNetMarkup(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Enable Confidential Sale Price Spread</span>
                  </label>
                  {hasSellerNetMarkup && (
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1">
                        Seller Notified Net Price (THB)
                      </label>
                      <FormattedNumberInput
                        value={sellerNetTargetPrice}
                        maxDecimals={2}
                        onValueChange={(val) => setSellerNetTargetPrice(val)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white font-bold"
                      />
                      <div className="text-[11px] font-extrabold text-emerald-700 mt-1">
                        Agency Spread Gain: +฿{calc.salePriceSpread.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-2">
                  <label className="inline-flex items-center gap-2 font-bold text-emerald-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLeaseRevenueInCalc}
                      onChange={(e) => setIncludeLeaseRevenueInCalc(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Include Lease Commission & Rent Spread</span>
                  </label>
                  {includeLeaseRevenueInCalc && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-600 block">Comm (Months)</label>
                        <FormattedNumberInput
                          value={leaseCommissionMonths}
                          maxDecimals={2}
                          onValueChange={(val) => setLeaseCommissionMonths(val)}
                          className="w-full px-2 py-1 rounded-lg border border-emerald-200 bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block">Rent Spread/mo</label>
                        <FormattedNumberInput
                          value={monthlyRentSpread}
                          maxDecimals={2}
                          onValueChange={(val) => setMonthlyRentSpread(val)}
                          className="w-full px-2 py-1 rounded-lg border border-emerald-200 bg-white font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION D: Legal Fees, Due Diligence & Agency Coordination Fees */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    Legal Fees, Contract Drafting & Due Diligence
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Calculate legal contract drafting, title search, foreign quota FET handling, and agency coordination fees
                  </p>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-slate-100 text-slate-800">
                  Legal Total: ฿{calc.totalLegalFees.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    SPA Contract & Legal Fee (THB)
                  </label>
                  <FormattedNumberInput
                    value={legalDraftingFee}
                    maxDecimals={2}
                    onValueChange={(val) => setLegalDraftingFee(val)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Title Search & Land Dept Filing
                  </label>
                  <FormattedNumberInput
                    value={titleDueDiligenceFee}
                    maxDecimals={2}
                    onValueChange={(val) => setTitleDueDiligenceFee(val)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    FET / Foreign Quota / Escrow
                  </label>
                  <FormattedNumberInput
                    value={fetForeignQuotaFee}
                    maxDecimals={2}
                    onValueChange={(val) => setFetForeignQuotaFee(val)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Who Pays Legal Fees?
                  </label>
                  <select
                    value={legalFeeAllocation}
                    onChange={(e) => setLegalFeeAllocation(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="50_50">50% Seller / 50% Buyer</option>
                    <option value="BUYER_100">100% Buyer</option>
                    <option value="SELLER_100">100% Seller</option>
                    <option value="AGENCY_ABSORBED">Absorbed by Agency (Promo)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-emerald-800 block mb-1">
                    Agency Legal/Admin Fee Charged
                  </label>
                  <FormattedNumberInput
                    value={agencyAdminCoordinationFee}
                    maxDecimals={2}
                    onValueChange={(val) => setAgencyAdminCoordinationFee(val)}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/30 font-bold text-emerald-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-rose-800 block mb-1">
                    Agency Marketing / Rebate Cost
                  </label>
                  <FormattedNumberInput
                    value={agencyMarketingAndRebateCost}
                    maxDecimals={2}
                    onValueChange={(val) => setAgencyMarketingAndRebateCost(val)}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/30 font-bold text-rose-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: LIVE AGENCY PROFIT STATEMENT & BUYER/SELLER SETTLEMENT SHEET */}
          <div className="xl:col-span-5 space-y-5">
            {/* HERO CARD: AGENCY PROFIT STATEMENT ON THIS DEAL */}
            <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Agency Deal Profit Statement
                  </span>
                  <h3 className="text-2xl font-extrabold mt-1">
                    ฿{calc.netAgencyProfit.toLocaleString()}
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Net Retained Agency Profit ({calc.profitMarginPct}% Net Margin) • {unitCode}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-extrabold">
                  {calc.profitMarginPct}% Margin
                </span>
              </div>

              {/* Revenue vs Deductions Breakdown */}
              <div className="bg-white/10 rounded-xl p-4 space-y-2 text-xs border border-white/10">
                <div className="flex items-center justify-between text-indigo-100">
                  <span>Sale Commission ({saleCommissionRate}%):</span>
                  <span className="font-bold text-white">
                    +฿{calc.baseSaleCommission.toLocaleString()}
                  </span>
                </div>
                {calc.salePriceSpread > 0 && (
                  <div className="flex items-center justify-between text-emerald-300">
                    <span>Confidential Sale Price Spread:</span>
                    <span className="font-bold">+฿{calc.salePriceSpread.toLocaleString()}</span>
                  </div>
                )}
                {agencyAdminCoordinationFee > 0 && (
                  <div className="flex items-center justify-between text-indigo-100">
                    <span>Agency Legal / Admin Coordination Fee:</span>
                    <span className="font-bold text-white">
                      +฿{agencyAdminCoordinationFee.toLocaleString()}
                    </span>
                  </div>
                )}
                {(calc.leaseUpfrontComm > 0 || calc.leaseSpreadTotal > 0) && (
                  <div className="flex items-center justify-between text-emerald-300">
                    <span>Lease Commission & 12m Rent Spread:</span>
                    <span className="font-bold">
                      +฿{(calc.leaseUpfrontComm + calc.leaseSpreadTotal).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-white/15 flex items-center justify-between font-bold text-white">
                  <span>Gross Agency Deal Revenue:</span>
                  <span>฿{calc.grossAgencyRevenue.toLocaleString()}</span>
                </div>

                {calc.coBrokePayout > 0 && (
                  <div className="flex items-center justify-between text-rose-300">
                    <span>Less Co-Broke Partner Split ({coBrokeSplitPct}%):</span>
                    <span>-฿{calc.coBrokePayout.toLocaleString()}</span>
                  </div>
                )}
                {calc.internalAgentPayout > 0 && (
                  <div className="flex items-center justify-between text-amber-200">
                    <span>Less Internal Sales Agent Split ({internalAgentSharePct}%):</span>
                    <span>-฿{calc.internalAgentPayout.toLocaleString()}</span>
                  </div>
                )}
                {(calc.agencyAbsorbedLegal > 0 || agencyMarketingAndRebateCost > 0) && (
                  <div className="flex items-center justify-between text-rose-300">
                    <span>Less Agency Absorbed Legal & Marketing:</span>
                    <span>
                      -฿
                      {(
                        calc.agencyAbsorbedLegal + agencyMarketingAndRebateCost
                      ).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-white/20 flex items-center justify-between text-sm font-extrabold text-emerald-300">
                  <span>Net House Profit (Agency Retained):</span>
                  <span>฿{calc.netAgencyProfit.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveDealToReport}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Deal to Executive Agency Profit Report</span>
              </button>
            </div>

            {/* CARD 2: AUTO SQM & YIELD BENCHMARK SUMMARY */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Auto Sqm Valuation & Yield Summary</span>
                <span className="text-indigo-600 font-bold">{sizeSqm} sqm</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100">
                  <div className="text-[10px] font-bold uppercase text-indigo-500">Sale / Sqm</div>
                  <div className="text-sm font-extrabold text-indigo-950 mt-0.5">
                    ฿{Math.round(salePerSqm).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">per sqm</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <div className="text-[10px] font-bold uppercase text-emerald-600">Rent / Sqm</div>
                  <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                    ฿{rentPerSqm.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                  <div className="text-[10px] text-slate-500">per sqm / mo</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Gross Yield</div>
                  <div className="text-sm font-extrabold text-amber-950 mt-0.5">
                    {grossRentalYieldPct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {paybackYears.toFixed(1)} yrs payback
                  </div>
                </div>
              </div>
            </div>

            {/* REPORT VIEW SEGMENTED CONTROLLER (SPLIT RENT & SALE) */}
            <div className="flex items-center justify-between p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setReportDisplayMode('SPLIT')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reportDisplayMode === 'SPLIT'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Dual Split</span>
              </button>
              <button
                type="button"
                onClick={() => setReportDisplayMode('SALE')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reportDisplayMode === 'SALE'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Sale Report</span>
              </button>
              <button
                type="button"
                onClick={() => setReportDisplayMode('RENT')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reportDisplayMode === 'RENT'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Rental Report</span>
              </button>
            </div>

            {/* CARD 3A: SALE REPORT (SELLER NET PROCEEDS & BUYER ACQUISITION BREAKDOWN) */}
            {(reportDisplayMode === 'SPLIT' || reportDisplayMode === 'SALE') && (
              <div className="bg-white rounded-2xl border border-indigo-100 shadow-2xs space-y-4 p-5 text-xs">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                  <h4 className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    Sale Transaction Report (Seller Net vs. Buyer Cost)
                  </h4>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    ฿{calc.sellerNetPerSqm.toLocaleString()} / sqm Net
                  </span>
                </div>

                {/* Seller Net Box */}
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>Gross Contract Sale Price:</span>
                    <span>฿{salePrice.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Less Seller Transfer Fee, {taxRegime === 'SBT_3_3' ? 'SBT (3.3%)' : 'Stamp (0.5%)'} & WHT:</span>
                    <span className="text-rose-600 font-semibold">
                      -฿{calc.sellerTotalTaxes.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Less Seller Share of Legal & Filing Fees:</span>
                    <span className="text-rose-600 font-semibold">
                      -฿{calc.sellerLegalFees.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Less Agency Commission & Admin/Spread:</span>
                    <span className="text-rose-600 font-semibold">
                      -฿{calc.sellerCommissionOutflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-emerald-950 block">
                        Net Proceeds to Seller (Landlord)
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        Effective Net: ฿{calc.sellerNetPerSqm.toLocaleString()} / sqm
                      </span>
                    </div>
                    <span className="text-base font-black text-emerald-900">
                      ฿{calc.sellerNetProceeds.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Buyer Total Cost Box */}
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>Contract Purchase Price:</span>
                    <span>฿{salePrice.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Plus Buyer Share of Transfer & Taxes:</span>
                    <span className="text-indigo-700 font-semibold">
                      +฿{calc.buyerTotalTaxes.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Plus Buyer Share of Legal & FET Due Diligence:</span>
                    <span className="text-indigo-700 font-semibold">
                      +฿{calc.buyerLegalFees.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-indigo-200 flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-indigo-950 block">
                        Total Buyer Acquisition Cost
                      </span>
                      <span className="text-[10px] text-indigo-700">
                        All-In Buyer Rate: ฿{calc.buyerEffectivePerSqm.toLocaleString()} / sqm
                      </span>
                    </div>
                    <span className="text-base font-black text-indigo-900">
                      ฿{calc.buyerTotalAcquisitionCost.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 3B: RENTAL REPORT (LANDLORD CASHFLOW & TENANT MOVE-IN PACKAGE) */}
            {(reportDisplayMode === 'SPLIT' || reportDisplayMode === 'RENT') && (
              <div className="bg-white rounded-2xl border border-emerald-100 shadow-2xs space-y-4 p-5 text-xs">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                  <h4 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" />
                    Property Rental & Yield Report
                  </h4>
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {grossRentalYieldPct.toFixed(2)}% Gross Yield
                  </span>
                </div>

                {/* Landlord Rental Cashflow Box */}
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>1-Year Gross Rental Income:</span>
                    <span>฿{calc.annualGrossRent.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <div>
                      <span>Agency Broker Commission (1st Mo):</span>
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        100% Month 1 Advance Retained
                      </span>
                    </div>
                    <span className="text-rose-600 font-semibold">
                      -฿{calc.agencyRentalComm.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>Less Est. CAM Juristic Fee (~฿{resolvedCam.camFeePerSqmMonth}/sqm/mo):</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        {resolvedCam.matchedProfile
                          ? `${resolvedCam.matchedProfile.projectName} (${resolvedCam.matchedProfile.propertyType})`
                          : resolvedCam.description}
                      </span>
                    </div>
                    <span className="text-rose-600 font-semibold">
                      -฿{formatSysNumber(calc.estimatedAnnualCam)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Less Est. Rental Tax / Withholding (5%):</span>
                    <span className="text-rose-600 font-semibold">
                      -฿{calc.estimatedRentalTax.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-emerald-950 block">
                        Landlord Net Annual Income
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        Month 1: ฿0 (Advance covers Comm) • Mos 2-12 (11 Mos): ฿{calc.landlordOngoingMonthlyNet.toLocaleString()} / mo • {calc.netRentalYieldPct.toFixed(2)}% Net Yield
                      </span>
                    </div>
                    <span className="text-base font-black text-emerald-900">
                      ฿{calc.landlordFirstYearNet.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Tenant Move-In Cashflow Outlay */}
                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-teal-950">
                    <span>Tenant Move-In Cash Required:</span>
                    <span className="font-black text-teal-900">฿{calc.tenantTotalMoveInCash.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[11px]">
                    <span>Refundable Security Deposit (2 months):</span>
                    <span>฿{calc.securityDeposit.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[11px]">
                    <span>First Month Advance Rent (1 month):</span>
                    <span>฿{calc.advanceRent.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: EXECUTIVE AGENCY PROFIT REPORT (LEASES + SALE TRANSACTIONS)    */}
      {/* ===================================================================== */}
      {activeSubTab === 'profit_report' && (
        <div className="space-y-6">
          {/* Top 4 Executive Agency Profit KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Total Agency Net Profit
              </span>
              <div className="text-2xl font-extrabold mt-1">
                ฿{agencyProfitReportStats.combinedAgencyNetProfit.toLocaleString()}
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/10 text-xs text-indigo-200 flex justify-between">
                <span>Combined Gross Revenue:</span>
                <span className="font-bold text-white">
                  ฿{agencyProfitReportStats.combinedGrossRevenue.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Net Profit from Property Sales
              </span>
              <div className="text-2xl font-extrabold text-indigo-700 mt-1">
                ฿{agencyProfitReportStats.salesNetProfit.toLocaleString()}
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                <span>Gross Sale Commissions ({savedDeals.length} deals):</span>
                <span className="font-bold text-slate-800">
                  ฿{agencyProfitReportStats.salesGrossRevenue.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Net Profit from Lease Contracts
              </span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                ฿{agencyProfitReportStats.leaseTotalProfit.toLocaleString()}
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                <span>Comm: ฿{agencyProfitReportStats.leaseUpfrontCommTotal.toLocaleString()}</span>
                <span className="font-bold text-emerald-700">
                  Spread/Mgmt: +฿{agencyProfitReportStats.leaseRecurringSpreadAndMgmt.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Co-Broke, Agent & Legal Deductions
              </span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">
                -฿
                {(
                  agencyProfitReportStats.salesCoBrokeCost +
                  agencyProfitReportStats.salesAgentSplits +
                  agencyProfitReportStats.salesLegalAndMktCosts
                ).toLocaleString()}
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                <span>Agent Splits: ฿{agencyProfitReportStats.salesAgentSplits.toLocaleString()}</span>
                <span>Co-Broke: ฿{agencyProfitReportStats.salesCoBrokeCost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Table 1: Property Sale & Transaction Profit Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  1. Property Sales & Transaction Profit Statement ({savedDeals.length} Deals)
                </h3>
                <p className="text-xs text-slate-500">
                  Breakdown of Sale Price, Auto ฿/sqm, Taxes, Legal Fees, Gross Commission, Co-Broke/Agent Splits, and Net Agency Profit
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('calculator')}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Calculate New Transaction
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Unit & Project</th>
                    <th className="py-3 px-4 text-right">Sale Price & ฿/Sqm</th>
                    <th className="py-3 px-4 text-right">Rent & ฿/Sqm</th>
                    <th className="py-3 px-4 text-right">Gov Taxes & Legal</th>
                    <th className="py-3 px-4 text-right">Gross Agency Rev</th>
                    <th className="py-3 px-4 text-right">Co-Broke & Agent Cut</th>
                    <th className="py-3 px-4 text-right">Net Agency Profit</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savedDeals.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-indigo-700">{d.unitCode}</div>
                        <div className="text-slate-700 font-medium">
                          {d.projectName} ({d.sizeSqm} sqm)
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-extrabold text-slate-900">
                          ฿{d.salePrice.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-indigo-600 font-semibold">
                          ฿{d.salePerSqm.toLocaleString()} / sqm
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-800">
                          ฿{d.monthlyRent.toLocaleString()}/mo
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          ฿{d.rentPerSqm.toLocaleString()} / sqm
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-semibold text-amber-800">
                          Taxes: ฿{d.totalTaxesAndGovFees.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Legal: ฿{d.totalLegalFees.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ฿{d.grossAgencyRevenue.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-rose-600 font-semibold">
                        -฿
                        {(
                          d.coBrokePayout +
                          d.internalAgentPayout +
                          d.agencyAbsorbedCosts
                        ).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          ฿{d.netAgencyProfit.toLocaleString()} ({d.profitMarginPct}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() =>
                            setSavedDeals((prev) => prev.filter((x) => x.id !== d.id))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                          title="Remove from Report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Lease Contract Profit Breakdown (Rent Spread + Commission + Management Fees) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900">
                2. Active Lease Contracts Agency Profit Breakdown ({leases.length} Contracts)
              </h3>
              <p className="text-xs text-slate-500">
                Real-time agency earnings from Upfront Commissions, Confidential Monthly Rent Differences, Management Fees, and Repair Handling
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Contract & Property</th>
                    <th className="py-3 px-4 text-right">Tenant Rent</th>
                    <th className="py-3 px-4 text-right">Landlord Rate</th>
                    <th className="py-3 px-4 text-right">Monthly Spread</th>
                    <th className="py-3 px-4 text-right">Upfront Comm.</th>
                    <th className="py-3 px-4 text-right">Mgmt Fee %</th>
                    <th className="py-3 px-4 text-right">Total Agency Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leases.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-indigo-700 mr-2">
                          {l.contract_no}
                        </span>
                        <button
                          onClick={() => onSelectUnit && onSelectUnit(l.unit_id)}
                          className="font-bold text-slate-900 hover:text-indigo-600"
                        >
                          {l.unit_code} — {l.project_name}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ฿{l.monthly_rent.toLocaleString()}/mo
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-indigo-700">
                        ฿{(l.landlord_monthly_rent ?? l.monthly_rent).toLocaleString()}/mo
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {l.has_rent_spread ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            +฿{(l.monthly_rent_spread || 0).toLocaleString()}/mo
                          </span>
                        ) : (
                          <span className="text-slate-400">฿0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                        ฿{(l.agent_commission || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        {l.management_fee_percent ?? 5}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          ฿{(l.total_agency_profit || 0).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

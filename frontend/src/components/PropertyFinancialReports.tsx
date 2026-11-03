import React, { useState, useMemo, useEffect } from 'react';
import {
  Landmark,
  Key,
  Tag,
  DollarSign,
  TrendingUp,
  Scale,
  ShieldCheck,
  UserCheck,
  Building,
  ArrowRight,
  ExternalLink,
  Printer,
  ChevronDown,
  ChevronUp,
  PieChart,
  Coins,
  Receipt,
  Sparkles,
  Sliders,
  Briefcase,
} from 'lucide-react';
import { PropertyUnit } from '../types';
import { formatSysNumber, FormattedNumberInput } from './FormattedNumberInput';
import {
  getLocalFinancialSettings,
  subscribeFinancialSettings,
  computeCustomFeesBreakdown,
  lookupProjectCamFee,
  FinancialSettings,
} from '../utils/financialSettingsStore';

interface PropertyFinancialReportsProps {
  unit: PropertyUnit;
  defaultView?: 'split' | 'sale' | 'rent';
  onOpenFullCalculator?: (unit: PropertyUnit) => void;
  className?: string;
}

export const PropertyFinancialReports: React.FC<PropertyFinancialReportsProps> = ({
  unit,
  defaultView = 'split',
  onOpenFullCalculator,
  className = '',
}) => {
  const [reportView, setReportView] = useState<'split' | 'sale' | 'rent'>(defaultView);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<FinancialSettings>(getLocalFinancialSettings);

  // Sync with Global Financial Settings Store
  useEffect(() => {
    return subscribeFinancialSettings(() => {
      setGlobalSettings(getLocalFinancialSettings());
    });
  }, []);

  // Financial Variables initialized from Unit
  const [sizeSqm, setSizeSqm] = useState<number>(unit.size_sqm || 30);
  const [salePrice, setSalePrice] = useState<number>(unit.target_sale_price || 3000000);
  const [monthlyRent, setMonthlyRent] = useState<number>(unit.target_rent_price || 15000);
  const [appraisedValue, setAppraisedValue] = useState<number>(unit.target_sale_price || 3000000);

  // Sale Settings (defaults from Global Settings)
  const [transferFeeRate, setTransferFeeRate] = useState<number>(
    globalSettings.taxes.transfer_fee_rate || 2.0
  );
  const [transferSplit, setTransferSplit] = useState<'50_50' | 'SELLER_100' | 'BUYER_100'>(
    globalSettings.taxes.default_transfer_split || '50_50'
  );
  const [taxRegime, setTaxRegime] = useState<'SBT_3_3' | 'STAMP_0_5'>('SBT_3_3');
  const [whtRate, setWhtRate] = useState<number>(globalSettings.taxes.wht_individual_rate || 2.2);
  const [saleCommissionPct, setSaleCommissionPct] = useState<number>(
    globalSettings.commissions.sale_commission_rate || 3.0
  );
  const [legalFeeTotal, setLegalFeeTotal] = useState<number>(25000);
  const [legalAllocation, setLegalAllocation] = useState<'50_50' | 'SELLER_100' | 'BUYER_100'>('50_50');

  // Rental Settings (defaults from Global Settings & Condo Directory)
  const resolvedCam = useMemo(() => {
    return lookupProjectCamFee(
      globalSettings.project_cam_directory,
      unit.project_name,
      unit.property_type,
      globalSettings.cam_fees.default_cam_per_sqm_month || 55,
      globalSettings.cam_fees.sinking_fund_per_sqm || 500
    );
  }, [
    globalSettings.project_cam_directory,
    unit.project_name,
    unit.property_type,
    globalSettings.cam_fees,
  ]);

  const [leaseMonths, setLeaseMonths] = useState<number>(12);
  const [securityDepositMonths, setSecurityDepositMonths] = useState<number>(2);
  const [advanceRentMonths, setAdvanceRentMonths] = useState<number>(1);
  const [camFeePerSqmPerMonth, setCamFeePerSqmPerMonth] = useState<number>(
    resolvedCam.camFeePerSqmMonth
  );
  const [rentalWhtPct, setRentalWhtPct] = useState<number>(
    globalSettings.taxes.rental_wht_rate || 5.0
  );

  // Auto-sync CAM fee if unit or directory changes
  useEffect(() => {
    setCamFeePerSqmPerMonth(resolvedCam.camFeePerSqmMonth);
  }, [resolvedCam.camFeePerSqmMonth]);

  // Custom Items Breakdown from Global Settings
  const customSale = useMemo(() => {
    return computeCustomFeesBreakdown(globalSettings.custom_items, {
      salePrice,
      monthlyRent,
      sizeSqm,
      dealType: 'Sale',
    });
  }, [globalSettings.custom_items, salePrice, monthlyRent, sizeSqm]);

  const customRent = useMemo(() => {
    return computeCustomFeesBreakdown(globalSettings.custom_items, {
      salePrice,
      monthlyRent,
      sizeSqm,
      dealType: 'Rental',
    });
  }, [globalSettings.custom_items, salePrice, monthlyRent, sizeSqm]);

  // Calculated Metrics
  const salePerSqm = sizeSqm > 0 ? salePrice / sizeSqm : 0;
  const rentPerSqm = sizeSqm > 0 ? monthlyRent / sizeSqm : 0;
  const grossRentalYield = salePrice > 0 ? ((monthlyRent * 12) / salePrice) * 100 : 0;
  const paybackYears = monthlyRent > 0 ? salePrice / (monthlyRent * 12) : 0;

  // Sale Calculation Breakdown (incorporates custom items)
  const saleCalc = useMemo(() => {
    // 1. Transfer Fee (2%)
    const totalTransferFee = Math.round(appraisedValue * (transferFeeRate / 100));
    const sellerTransferFee =
      transferSplit === 'SELLER_100'
        ? totalTransferFee
        : transferSplit === '50_50'
        ? Math.round(totalTransferFee * 0.5)
        : 0;
    const buyerTransferFee = totalTransferFee - sellerTransferFee;

    // 2. SBT (3.3%) or Stamp Duty (0.5%)
    const taxBase = Math.max(salePrice, appraisedValue);
    const sbtOrStampRate = taxRegime === 'SBT_3_3' ? 3.3 : 0.5;
    const totalSbtOrStamp = Math.round(taxBase * (sbtOrStampRate / 100));
    const sellerSbtOrStamp = totalSbtOrStamp;

    // 3. Withholding Tax (WHT)
    const totalWht = Math.round(taxBase * (whtRate / 100));
    const sellerWht = totalWht;

    const totalGovTaxes = totalTransferFee + totalSbtOrStamp + totalWht;
    const sellerTotalTaxes = sellerTransferFee + sellerSbtOrStamp + sellerWht;
    const buyerTotalTaxes = buyerTransferFee;

    // 4. Legal Fees
    const sellerLegal =
      legalAllocation === 'SELLER_100'
        ? legalFeeTotal
        : legalAllocation === '50_50'
        ? Math.round(legalFeeTotal * 0.5)
        : 0;
    const buyerLegal = legalFeeTotal - sellerLegal;

    // 5. Agency Commission
    const agencySaleComm = Math.round(salePrice * (saleCommissionPct / 100));
    const internalAgentCut = Math.round(agencySaleComm * 0.25);
    const agencyNetProfit = agencySaleComm - internalAgentCut;

    // 6. Bottom Line including Custom Sale Fees
    const sellerNetProceeds =
      salePrice - sellerTotalTaxes - sellerLegal - agencySaleComm - customSale.sellerTotal;
    const buyerTotalAcquisitionCost =
      salePrice + buyerTotalTaxes + buyerLegal + customSale.buyerTotal;

    return {
      totalTransferFee,
      sellerTransferFee,
      buyerTransferFee,
      sbtOrStampRate,
      totalSbtOrStamp,
      sellerSbtOrStamp,
      totalWht,
      sellerWht,
      totalGovTaxes,
      sellerTotalTaxes,
      buyerTotalTaxes,
      sellerLegal,
      buyerLegal,
      agencySaleComm,
      internalAgentCut,
      agencyNetProfit,
      sellerNetProceeds,
      buyerTotalAcquisitionCost,
      sellerNetPerSqm: sizeSqm > 0 ? Math.round(sellerNetProceeds / sizeSqm) : 0,
      buyerEffectivePerSqm: sizeSqm > 0 ? Math.round(buyerTotalAcquisitionCost / sizeSqm) : 0,
    };
  }, [
    salePrice,
    appraisedValue,
    sizeSqm,
    transferFeeRate,
    transferSplit,
    taxRegime,
    whtRate,
    saleCommissionPct,
    legalFeeTotal,
    legalAllocation,
    customSale.sellerTotal,
    customSale.buyerTotal,
  ]);

  // Rental Calculation Breakdown (incorporates CAM, PM fees, custom fees)
  const rentCalc = useMemo(() => {
    const annualGrossRent = monthlyRent * 12;
    const contractTotalRent = monthlyRent * leaseMonths;

    // Tenant Move-in Outlay (plus tenant-borne custom fees)
    const securityDeposit = monthlyRent * securityDepositMonths;
    const advanceRent = monthlyRent * advanceRentMonths;
    const tenantTotalMoveInCash = securityDeposit + advanceRent + customRent.buyerTotal;

    // Agency Rental Commission
    const agencyRentalComm = Math.round((monthlyRent * leaseMonths) / 12);
    const agentCut = Math.round(agencyRentalComm * 0.25);
    const agencyRetainedRentalProfit = agencyRentalComm - agentCut;

    // Landlord Ongoing Outflows & Net Cashflow
    const annualCamFee = Math.round(camFeePerSqmPerMonth * sizeSqm * 12);
    const annualRentalTax = Math.round(annualGrossRent * (rentalWhtPct / 100));

    // Property Management Fee
    const pmFeeAnnual = globalSettings.management_fees.use_fixed_pm_fee
      ? globalSettings.management_fees.monthly_pm_fixed_fee * 12
      : Math.round(annualGrossRent * (globalSettings.management_fees.monthly_pm_fee_pct / 100));

    const landlordFirstYearNetCashflow =
      annualGrossRent -
      agencyRentalComm -
      annualCamFee -
      annualRentalTax -
      pmFeeAnnual -
      customRent.sellerTotal;

    const landlordMonthlyNetCashflow = Math.round(landlordFirstYearNetCashflow / 12);
    const landlordOngoingMonthlyNet = Math.round(landlordFirstYearNetCashflow / 11);
    const netRentalYield =
      salePrice > 0 ? (landlordFirstYearNetCashflow / salePrice) * 100 : 0;

    return {
      annualGrossRent,
      contractTotalRent,
      securityDeposit,
      advanceRent,
      tenantTotalMoveInCash,
      agencyRentalComm,
      agencyRetainedRentalProfit,
      annualCamFee,
      annualRentalTax,
      pmFeeAnnual,
      landlordFirstYearNetCashflow,
      landlordMonthlyNetCashflow,
      landlordOngoingMonthlyNet,
      netRentalYield,
    };
  }, [
    monthlyRent,
    leaseMonths,
    securityDepositMonths,
    advanceRentMonths,
    camFeePerSqmPerMonth,
    sizeSqm,
    rentalWhtPct,
    salePrice,
    globalSettings.management_fees,
    customRent.buyerTotal,
    customRent.sellerTotal,
  ]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Bar: View Mode Switcher & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={() => setReportView('split')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              reportView === 'split'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Side-by-Side Dual Report
          </button>
          <button
            type="button"
            onClick={() => setReportView('sale')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              reportView === 'sale'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            Sale Deal Report
          </button>
          <button
            type="button"
            onClick={() => setReportView('rent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              reportView === 'rent'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            Rental & Yield Report
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 flex items-center gap-1 transition"
          >
            {showAdvancedSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAdvancedSettings ? 'Hide Adjustments' : 'Adjust Rates & Prices'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            title="Print or Export Financial Report"
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs"
          >
            <Printer className="w-4 h-4" />
          </button>

          {onOpenFullCalculator && (
            <button
              type="button"
              onClick={() => onOpenFullCalculator(unit)}
              className="px-3 py-1.5 text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1.5 transition"
            >
              <span>Full Tax Calculator</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Optional Interactive Adjustment Tray */}
      {showAdvancedSettings && (
        <div className="p-4 bg-indigo-50/40 border border-indigo-200/80 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs animate-in fade-in duration-150">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Sale Price (THB)</label>
            <FormattedNumberInput
              value={salePrice}
              onValueChange={(val) => {
                setSalePrice(val);
                setAppraisedValue(val);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-white font-extrabold text-slate-900"
            />
            <div className="flex gap-1 mt-1">
              {[1500000, 3000000, 5000000].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSalePrice(p);
                    setAppraisedValue(p);
                  }}
                  className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-indigo-700 border border-indigo-200"
                >
                  ฿{(p / 1000000).toFixed(1)}M
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Monthly Rent (THB)</label>
            <FormattedNumberInput
              value={monthlyRent}
              onValueChange={(val) => setMonthlyRent(val)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-extrabold text-slate-900"
            />
            <div className="flex gap-1 mt-1">
              {[12000, 15000, 25000].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMonthlyRent(r)}
                  className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-emerald-700 border border-emerald-200"
                >
                  ฿{(r / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Unit Size (Sqm)</label>
            <FormattedNumberInput
              value={sizeSqm}
              onValueChange={(val) => setSizeSqm(Math.max(1, val))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Sale Comm Rate (%)</label>
            <FormattedNumberInput
              value={saleCommissionPct}
              onValueChange={(val) => setSaleCommissionPct(val)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
            />
          </div>
        </div>
      )}

      {/* Main Grid: Split View OR Individual Focus View */}
      <div
        className={`grid gap-5 ${
          reportView === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* ========================================================= */}
        {/* SECTION 1: SALE DEAL REPORT */}
        {/* ========================================================= */}
        {(reportView === 'split' || reportView === 'sale') && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-2xs overflow-hidden flex flex-col">
            {/* Header Badge */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-indigo-300">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm tracking-wide">Property Sale Transaction Report</h3>
                    <p className="text-[11px] text-indigo-200">
                      {unit.unit_code} • {unit.project_name} ({sizeSqm} sqm)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                    Listing Price
                  </span>
                  <span className="text-lg font-black text-white">฿{formatSysNumber(salePrice)}</span>
                </div>
              </div>

              {/* Valuation & Auto Sqm Metrics Strip */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-indigo-700/60 text-xs">
                <div className="bg-indigo-950/60 p-2 rounded-xl border border-indigo-700/40">
                  <span className="text-[10px] text-indigo-300 font-semibold block">Auto Sale Price / Sqm</span>
                  <span className="font-extrabold text-white text-sm">
                    ฿{formatSysNumber(salePerSqm, 2)}
                    <span className="text-[10px] text-indigo-300 font-normal"> / sqm</span>
                  </span>
                </div>
                <div className="bg-indigo-950/60 p-2 rounded-xl border border-indigo-700/40">
                  <span className="text-[10px] text-indigo-300 font-semibold block">Agency Sale Comm (3%)</span>
                  <span className="font-extrabold text-indigo-200 text-sm">
                    ฿{formatSysNumber(saleCalc.agencySaleComm)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              {/* Detailed Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-600" />
                    Government Taxes & Land Dept Fees
                  </span>
                  <span className="text-xs font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    ฿{formatSysNumber(saleCalc.totalGovTaxes)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Transfer Fee (2% Land Dept):</span>
                    <span className="font-bold text-slate-800">
                      ฿{formatSysNumber(saleCalc.totalTransferFee)}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">(50/50 split: ฿{formatSysNumber(saleCalc.sellerTransferFee)} ea)</span>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Specific Business Tax (3.3%) / Stamp Duty:</span>
                    <span className="font-bold text-slate-800">฿{formatSysNumber(saleCalc.totalSbtOrStamp)}</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Withholding Tax (WHT ~2.2%):</span>
                    <span className="font-bold text-slate-800">฿{formatSysNumber(saleCalc.totalWht)}</span>
                  </div>
                </div>

                {/* Legal & Agency Share */}
                <div className="flex items-center justify-between pt-1 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Legal, Conveyancing & Brokerage
                  </span>
                  <span className="text-xs font-extrabold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                    ฿{formatSysNumber(legalFeeTotal + saleCalc.agencySaleComm)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Legal Due Diligence & Drafting:</span>
                    <span className="font-bold text-slate-800">
                      ฿{formatSysNumber(legalFeeTotal)}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">(฿{formatSysNumber(saleCalc.sellerLegal)} Seller / ฿{formatSysNumber(saleCalc.buyerLegal)} Buyer)</span>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Agency Closing Commission (3%):</span>
                    <span className="font-bold text-indigo-700">฿{formatSysNumber(saleCalc.agencySaleComm)}</span>
                  </div>
                </div>

                {/* Custom Surcharges & Fees from Settings */}
                {customSale.itemizedList.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-purple-600" />
                        Custom Surcharges & Fees ({customSale.itemizedList.length})
                      </span>
                      <span className="text-[11px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                        +฿{formatSysNumber(customSale.grossTotal)}
                      </span>
                    </div>
                    {customSale.itemizedList.map(({ item, totalAmount, sellerShare, buyerShare }) => (
                      <div key={item.id} className="flex justify-between py-1 px-2 rounded bg-purple-50/50 text-[11px]">
                        <span className="text-slate-700 font-medium">
                          {item.name} ({item.borne_by}):
                        </span>
                        <span className="font-bold text-slate-900">
                          ฿{formatSysNumber(totalAmount)}
                          {sellerShare > 0 && (
                            <span className="text-[10px] text-rose-600 font-normal ml-1">
                              (-฿{formatSysNumber(sellerShare)} Seller)
                            </span>
                          )}
                          {buyerShare > 0 && (
                            <span className="text-[10px] text-indigo-600 font-normal ml-1">
                              (+฿{formatSysNumber(buyerShare)} Buyer)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* The Bottom Line: Seller Net Proceeds vs Buyer Total Cost */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                {/* Seller Net Pocket */}
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block flex items-center gap-1">
                      <Coins className="w-3 h-3 text-emerald-600" />
                      Seller Net Proceeds (Cash In Pocket)
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Effective Net: ฿{formatSysNumber(saleCalc.sellerNetPerSqm)} / sqm
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-900">
                    ฿{formatSysNumber(saleCalc.sellerNetProceeds)}
                  </span>
                </div>

                {/* Buyer Total Outlay */}
                <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 block flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-indigo-600" />
                      Buyer Total Acquisition Cost (All-in)
                    </span>
                    <span className="text-[11px] text-indigo-700">
                      All-In Rate: ฿{formatSysNumber(saleCalc.buyerEffectivePerSqm)} / sqm
                    </span>
                  </div>
                  <span className="text-base font-black text-indigo-900">
                    ฿{formatSysNumber(saleCalc.buyerTotalAcquisitionCost)}
                  </span>
                </div>

                {/* Agency Retained Profit */}
                <div className="px-3 py-2 rounded-lg bg-slate-900 text-white flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Agency Retained Profit from Sale
                  </span>
                  <span className="font-extrabold text-amber-400">
                    ฿{formatSysNumber(saleCalc.agencyNetProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 2: RENTAL & YIELD REPORT */}
        {/* ========================================================= */}
        {(reportView === 'split' || reportView === 'rent') && (
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-2xs overflow-hidden flex flex-col">
            {/* Header Badge */}
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-950 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-emerald-300">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm tracking-wide">Property Rental & Yield Report</h3>
                    <p className="text-[11px] text-emerald-200">
                      {unit.unit_code} • {unit.project_name} ({sizeSqm} sqm)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                    Target Rent
                  </span>
                  <span className="text-lg font-black text-white">
                    ฿{formatSysNumber(monthlyRent)}
                    <span className="text-xs font-semibold text-emerald-300"> / mo</span>
                  </span>
                </div>
              </div>

              {/* Rental Yield & Payback Strip */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-emerald-700/60 text-xs">
                <div className="bg-emerald-950/60 p-2 rounded-xl border border-emerald-700/40">
                  <span className="text-[10px] text-emerald-300 font-semibold block">Auto Rent / Sqm</span>
                  <span className="font-extrabold text-white text-sm">
                    ฿{formatSysNumber(rentPerSqm, 2)}
                    <span className="text-[10px] text-emerald-300 font-normal"> / sqm</span>
                  </span>
                </div>
                <div className="bg-emerald-950/60 p-2 rounded-xl border border-emerald-700/40">
                  <span className="text-[10px] text-emerald-300 font-semibold block">Gross Yield (p.a.)</span>
                  <span className="font-extrabold text-emerald-200 text-sm">
                    {formatSysNumber(grossRentalYield, 2, 2)}%
                  </span>
                </div>
                <div className="bg-emerald-950/60 p-2 rounded-xl border border-emerald-700/40">
                  <span className="text-[10px] text-emerald-300 font-semibold block">Payback Period</span>
                  <span className="font-extrabold text-amber-200 text-sm">
                    {formatSysNumber(paybackYears, 1)} yrs
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              {/* Detailed Breakdown */}
              <div className="space-y-3">
                {/* Tenant Cashflow */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                    Tenant Move-In Cashflow Package
                  </span>
                  <span className="text-xs font-extrabold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                    Total: ฿{formatSysNumber(rentCalc.tenantTotalMoveInCash)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Security Deposit (2 months refundable):</span>
                    <span className="font-bold text-slate-800">฿{formatSysNumber(rentCalc.securityDeposit)}</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50 items-center">
                    <div>
                      <span>Advance Rent (1st Month):</span>
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Paid at Lease Signing
                      </span>
                    </div>
                    <span className="font-bold text-slate-800">฿{formatSysNumber(rentCalc.advanceRent)}</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>1-Year Contract Gross Value:</span>
                    <span className="font-bold text-slate-800">฿{formatSysNumber(rentCalc.annualGrossRent)}</span>
                  </div>
                </div>

                {/* Landlord Annual Deductions */}
                <div className="flex items-center justify-between pt-1 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    Landlord Annual Deductions & Fees
                  </span>
                  <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">
                    ฿{formatSysNumber(rentCalc.agencyRentalComm + rentCalc.annualCamFee + rentCalc.annualRentalTax)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50 items-center">
                    <div>
                      <span>Agency Broker Commission (1st Mo):</span>
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        100% Retained from Month 1
                      </span>
                    </div>
                    <span className="font-bold text-emerald-700">฿{formatSysNumber(rentCalc.agencyRentalComm)}</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50 items-center">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>Est. Juristic CAM Fee (~฿{camFeePerSqmPerMonth}/sqm/mo):</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        {resolvedCam.matchedProfile ? `${resolvedCam.matchedProfile.projectName} (${resolvedCam.matchedProfile.propertyType})` : resolvedCam.description}
                      </span>
                    </div>
                    <span className="font-bold text-slate-800">฿{formatSysNumber(rentCalc.annualCamFee)}</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Rental Tax / Withholding ({rentalWhtPct}%):</span>
                    <span className="font-bold text-slate-800">฿{formatSysNumber(rentCalc.annualRentalTax)}</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                    <span>Property Management Fee ({globalSettings.management_fees.use_fixed_pm_fee ? 'Flat' : `${globalSettings.management_fees.monthly_pm_fee_pct}%`}):</span>
                    <span className="font-bold text-purple-700">฿{formatSysNumber(rentCalc.pmFeeAnnual)} / yr</span>
                  </div>
                </div>

                {/* Custom Rental Surcharges & Fees from Settings */}
                {customRent.itemizedList.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-teal-600" />
                        Custom Lease Surcharges ({customRent.itemizedList.length})
                      </span>
                      <span className="text-[11px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                        +฿{formatSysNumber(customRent.grossTotal)}
                      </span>
                    </div>
                    {customRent.itemizedList.map(({ item, totalAmount, sellerShare, buyerShare }) => (
                      <div key={item.id} className="flex justify-between py-1 px-2 rounded bg-teal-50/50 text-[11px]">
                        <span className="text-slate-700 font-medium">
                          {item.name} ({item.borne_by}):
                        </span>
                        <span className="font-bold text-slate-900">
                          ฿{formatSysNumber(totalAmount)}
                          {sellerShare > 0 && (
                            <span className="text-[10px] text-rose-600 font-normal ml-1">
                              (-฿{formatSysNumber(sellerShare)} LL)
                            </span>
                          )}
                          {buyerShare > 0 && (
                            <span className="text-[10px] text-teal-700 font-normal ml-1">
                              (+฿{formatSysNumber(buyerShare)} Tenant)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* The Bottom Line: Landlord Net Annual Cashflow & Yield */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                {/* Landlord Net Annual */}
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                      Landlord Net Annual Income (After Costs)
                    </span>
                    <span className="text-[11px] text-emerald-700 block">
                      Month 1: ฿0 (Advance covers Commission) • Mos 2-12 (11 Mos): ฿{formatSysNumber(rentCalc.landlordOngoingMonthlyNet)} / mo
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-900 block">
                      ฿{formatSysNumber(rentCalc.landlordFirstYearNetCashflow)}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">
                      Net Yield: {formatSysNumber(rentCalc.netRentalYield, 2, 2)}% p.a.
                    </span>
                  </div>
                </div>

                {/* Tenant Move-in Card */}
                <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 block flex items-center gap-1">
                      <Key className="w-3 h-3 text-teal-600" />
                      Tenant Move-In Cash Required
                    </span>
                    <span className="text-[11px] text-teal-700">2 mo deposit + 1 mo advance rent</span>
                  </div>
                  <span className="text-base font-black text-teal-900">
                    ฿{formatSysNumber(rentCalc.tenantTotalMoveInCash)}
                  </span>
                </div>

                {/* Agency Retained Profit */}
                <div className="px-3 py-2 rounded-lg bg-slate-900 text-white flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Agency Retained Profit from Lease
                  </span>
                  <span className="font-extrabold text-emerald-400">
                    ฿{formatSysNumber(rentCalc.agencyRetainedRentalProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

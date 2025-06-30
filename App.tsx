

import React, { useState, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Trash2, ChevronDown, ChevronUp, Banknote, TrendingUp, Landmark, ShieldAlert, BadgePercent, Home } from 'lucide-react';

// --- TYPE DEFINITIONS ---
interface DateSelection {
  month: number;
  year: number;
}

interface RentalPeriod {
  id: string;
  monthlyAmount: number;
  startDate: DateSelection;
  endDate: DateSelection;
}

interface OffsetAccount {
  id: string;
  initialAmount: number;
  startDate: DateSelection;
  endDate: DateSelection;
  useForRepayments: boolean;
}

interface PropertyExpense {
  id: string;
  description: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annually';
  startDate: DateSelection;
}

interface SaleEvent {
    saleDate: DateSelection;
    sellingCosts: number; // percentage
    manualSalePrice?: number;
}

interface Property {
  id: string;
  name: string;
  purchasePrice: number;
  purchaseDate: DateSelection;
  loanRatio: number;
  interestRate: number;
  loanTerm: number; // in years
  annualGrowth: number;
  rentals: RentalPeriod[];
  offsets: OffsetAccount[];
  expenses: PropertyExpense[];
  sale?: SaleEvent;
}

interface MonthlyData {
  month: number;
  date: string;
  salary: number;
  rentalIncome: number;
  generalExpenses: number;
  cashOnHand: number;
  totalCash: number;
  totalDebt: number;
  netPosition: number;
  totalOffsetBalance: number;
  propertyDetails: {
    [key: string]: {
      principalPaid: number;
      interestPaid: number;
      loanBalance: number;
      offsetBalance: number;
      propertyValue: number;
    };
  };
}

interface SummaryData {
  finalNetPosition: number;
  finalTotalEquity: number;
  finalTotalCash: number;
  peakDebt: number;
  totalInterestPaid: number;
  propertiesSold: number;
}

// --- HELPER COMPONENTS & FUNCTIONS (Defined outside App to prevent re-creation on re-render) ---

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0';
    return `$${Math.round(value).toLocaleString()}`;
};

const calculateFutureValue = (property: Property, targetDate: DateSelection): number => {
    const { purchasePrice, purchaseDate, annualGrowth } = property;
    const purchaseMonthAbsolute = purchaseDate.year * 12 + purchaseDate.month;
    const targetMonthAbsolute = targetDate.year * 12 + targetDate.month;

    if (targetMonthAbsolute < purchaseMonthAbsolute) {
        return purchasePrice;
    }

    const yearsElapsed = Math.floor((targetMonthAbsolute - purchaseMonthAbsolute) / 12);
    let futureValue = purchasePrice;
    for (let i = 0; i < yearsElapsed; i++) {
        futureValue *= (1 + annualGrowth / 100);
    }
    return Math.round(futureValue);
};

// Formatted Number Input
interface FormattedNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}
const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({ value, onChange, placeholder }) => {
  const [displayValue, setDisplayValue] = useState(value ? value.toLocaleString() : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');

    if (rawValue === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const numericValue = Number(rawValue);
    if (!isNaN(numericValue)) {
      setDisplayValue(numericValue.toLocaleString());
      onChange(numericValue);
    }
  };

  const handleBlur = () => {
    // Only format on blur if there is a value, otherwise show placeholder
    if (value) {
      setDisplayValue(value.toLocaleString());
    }
  };

  React.useEffect(() => {
    const currentNumericDisplay = Number(displayValue.replace(/,/g, ''));
    if (value !== currentNumericDisplay) {
      setDisplayValue(value ? value.toLocaleString() : '');
    }
  }, [value, displayValue]);

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
    />
  );
};


// Date Selector
interface DateSelectorProps {
  value: DateSelection;
  onChange: (value: DateSelection) => void;
  startYear?: number;
}
const DateSelector: React.FC<DateSelectorProps> = ({ value, onChange, startYear = new Date().getFullYear() }) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = Array.from({ length: 50 }, (_, i) => startYear + i);

  return (
    <div className="flex space-x-2">
      <select
        value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        className="flex-1 bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
      >
        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        className="flex-1 bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
};

// Summary Metrics Panel
const SummaryMetrics: React.FC<{ summary: SummaryData }> = ({ summary }) => {
    const metrics = [
        { label: "Final Net Position", value: formatCurrency(summary.finalNetPosition), icon: <TrendingUp size={24} className="text-cyan-400" /> },
        { label: "Final Property Equity", value: formatCurrency(summary.finalTotalEquity), icon: <Home size={24} className="text-cyan-400" /> },
        { label: "Final Total Cash", value: formatCurrency(summary.finalTotalCash), icon: <Banknote size={24} className="text-cyan-400" /> },
        { label: "Peak Debt", value: formatCurrency(summary.peakDebt), icon: <ShieldAlert size={24} className="text-red-400" /> },
        { label: "Total Interest Paid", value: formatCurrency(summary.totalInterestPaid), icon: <BadgePercent size={24} className="text-orange-400" /> },
        { label: "Properties Sold", value: summary.propertiesSold, icon: <Landmark size={24} className="text-cyan-400" /> },
    ];

    return (
        <div className="bg-slate-800 p-4 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-cyan-400">Forecast Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {metrics.map(metric => (
                    <div key={metric.label} className="bg-slate-900/50 p-3 rounded-lg flex items-center space-x-4">
                        <div className="flex-shrink-0">
                            {metric.icon}
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">{metric.label}</p>
                            <p className="text-xl font-bold text-white">{metric.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Sale Difference Display Component
const SaleDifferenceDisplay = React.memo(({ property }: { property: Property }) => {
    if (!property.sale?.manualSalePrice || property.sale.manualSalePrice <= 0) {
        return null;
    }

    const estimatedValue = calculateFutureValue(property, property.sale.saleDate);
    const difference = property.sale.manualSalePrice - estimatedValue;
    const isProfit = difference >= 0;
    const colorClass = isProfit ? 'text-green-400' : 'text-red-400';
    const bgColor = isProfit ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)';

    return (
        <div className="md:col-span-2 text-sm text-center py-1 rounded-md" style={{ backgroundColor: bgColor }}>
            <span>Difference from estimate: </span>
            <span className={`font-bold ${colorClass}`}>
                {isProfit ? '+' : ''}{formatCurrency(difference)}
            </span>
        </div>
    );
});


// Financial Data Table
interface FinancialDataTableProps {
  data: MonthlyData[];
  properties: Property[];
}
const FinancialDataTable: React.FC<FinancialDataTableProps> = ({ data, properties }) => {
    const formatCurrencyLocal = (value: number) => {
        return `$${Math.round(value).toLocaleString()}`;
    };

    return (
        <div className="bg-slate-800 p-4 rounded-lg shadow-lg mt-8">
            <h3 className="text-xl font-bold mb-4 text-cyan-400">Detailed Financial Data</h3>
            <div className="overflow-x-auto h-[600px] relative">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-300 uppercase sticky top-0 bg-slate-800">
                        <tr>
                            <th scope="col" className="px-4 py-3">Month #</th>
                            <th scope="col" className="px-4 py-3">Date</th>
                            <th scope="col" className="px-4 py-3">Salary</th>
                            <th scope="col" className="px-4 py-3">Rental Income</th>
                            <th scope="col" className="px-4 py-3">General Exp.</th>
                            {properties.map(p => (
                                <React.Fragment key={p.id}>
                                    <th scope="col" className="px-4 py-3 bg-slate-700">{p.name} Principal</th>
                                    <th scope="col" className="px-4 py-3 bg-slate-700">{p.name} Interest</th>
                                    <th scope="col" className="px-4 py-3 bg-slate-700">{p.name} Loan Bal.</th>
                                    <th scope="col" className="px-4 py-3 bg-slate-700">{p.name} Offset Bal.</th>
                                </React.Fragment>
                            ))}
                            <th scope="col" className="px-4 py-3">Cash On Hand</th>
                            <th scope="col" className="px-4 py-3">Total Cash</th>
                            <th scope="col" className="px-4 py-3">Total Debt</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, index) => (
                            <tr key={index} className="border-b border-slate-700 hover:bg-slate-700">
                                <td className="px-4 py-2">{row.month}</td>
                                <td className="px-4 py-2">{row.date}</td>
                                <td className="px-4 py-2">{formatCurrencyLocal(row.salary)}</td>
                                <td className="px-4 py-2">{formatCurrencyLocal(row.rentalIncome)}</td>
                                <td className="px-4 py-2">{formatCurrencyLocal(row.generalExpenses)}</td>
                                {properties.map(p => (
                                    <React.Fragment key={p.id}>
                                        <td className="px-4 py-2">{formatCurrencyLocal(row.propertyDetails[p.id]?.principalPaid ?? 0)}</td>
                                        <td className="px-4 py-2">{formatCurrencyLocal(row.propertyDetails[p.id]?.interestPaid ?? 0)}</td>
                                        <td className="px-4 py-2">{formatCurrencyLocal(row.propertyDetails[p.id]?.loanBalance ?? 0)}</td>
                                        <td className="px-4 py-2">{formatCurrencyLocal(row.propertyDetails[p.id]?.offsetBalance ?? 0)}</td>
                                    </React.Fragment>
                                ))}
                                <td className="px-4 py-2 font-semibold">{formatCurrencyLocal(row.cashOnHand)}</td>
                                <td className="px-4 py-2 font-semibold text-cyan-400">{formatCurrencyLocal(row.totalCash)}</td>
                                <td className="px-4 py-2 font-semibold text-red-400">{formatCurrencyLocal(row.totalDebt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---
export default function App() {
  const currentYear = new Date().getFullYear();
  
  // --- STATE MANAGEMENT ---
  const [annualSalary, setAnnualSalary] = useState(80000);
  const [initialCash, setInitialCash] = useState(50000);
  const [generalMonthlyExpenses, setGeneralMonthlyExpenses] = useState(2000);
  const [projectionLength, setProjectionLength] = useState(10); // in years
  const [properties, setProperties] = useState<Property[]>([]);

  // --- HANDLER FUNCTIONS for state updates (maintaining immutability) ---

  const addProperty = () => {
    const newProperty: Property = {
      id: `prop_${Date.now()}`,
      name: `Property ${properties.length + 1}`,
      purchasePrice: 500000,
      purchaseDate: { month: 0, year: currentYear },
      loanRatio: 80,
      interestRate: 6.5,
      loanTerm: 30,
      annualGrowth: 4,
      rentals: [],
      offsets: [],
      expenses: [],
    };
    setProperties([...properties, newProperty]);
  };

  const removeProperty = (id: string) => {
    setProperties(properties.filter(p => p.id !== id));
  };

  const updateProperty = useCallback(<K extends keyof Property>(id: string, key: K, value: Property[K]) => {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
  }, []);

  const updateNestedArray = useCallback(<
    TKey extends 'rentals' | 'offsets' | 'expenses',
    TItem extends Property[TKey][number],
    TItemKey extends keyof TItem
  >(
    propId: string,
    arrayKey: TKey,
    itemId: string,
    itemKey: TItemKey,
    value: TItem[TItemKey]
  ) => {
    setProperties(prev =>
      prev.map(p => {
        if (p.id === propId) {
          const newArray = (p[arrayKey] as TItem[]).map(item =>
            item.id === itemId ? { ...item, [itemKey]: value } : item
          );
          return { ...p, [arrayKey]: newArray };
        }
        return p;
      })
    );
  }, []);
  
  const addNestedItem = useCallback((propId: string, arrayKey: 'rentals' | 'offsets' | 'expenses') => {
    setProperties(prev => prev.map(p => {
        if (p.id === propId) {
            const id = `${arrayKey.slice(0, -1)}_${Date.now()}`;
            if (arrayKey === 'rentals') {
                const newItem: RentalPeriod = { id, monthlyAmount: 2000, startDate: { month: 0, year: currentYear }, endDate: { month: 11, year: currentYear + 5 } };
                return { ...p, rentals: [...p.rentals, newItem] };
            } else if (arrayKey === 'offsets') {
                const newItem: OffsetAccount = { id, initialAmount: 10000, startDate: { month: 0, year: currentYear }, endDate: { month: 11, year: currentYear + 30 }, useForRepayments: true };
                return { ...p, offsets: [...p.offsets, newItem] };
            } else { // expenses
                const newItem: PropertyExpense = { id, description: 'Rates', amount: 500, frequency: 'quarterly', startDate: { month: 0, year: currentYear } };
                return { ...p, expenses: [...p.expenses, newItem] };
            }
        }
        return p;
    }));
  }, [currentYear]);

  const removeNestedItem = useCallback((propId: string, arrayKey: keyof Property, itemId: string) => {
    setProperties(prev => prev.map(p => {
        if (p.id === propId) {
            const newArray = (p[arrayKey] as {id:string}[]).filter(item => item.id !== itemId);
            return { ...p, [arrayKey]: newArray };
        }
        return p;
    }));
  }, []);
  
  const addSale = useCallback((propId: string) => {
    setProperties(prev => prev.map(p => {
        if (p.id === propId) {
            return {
                ...p,
                sale: {
                    saleDate: { month: 11, year: currentYear + projectionLength - 1 },
                    sellingCosts: 3,
                    manualSalePrice: undefined,
                }
            };
        }
        return p;
    }));
  }, [currentYear, projectionLength]);

  const removeSale = useCallback((propId: string) => {
      setProperties(prev => prev.map(p => {
          if (p.id === propId) {
              const { sale, ...rest } = p;
              return rest;
          }
          return p;
      }));
  }, []);

  const updateSale = useCallback(<K extends keyof SaleEvent>(propId: string, key: K, value: SaleEvent[K]) => {
      setProperties(prev => prev.map(p => {
          if (p.id === propId && p.sale) {
              return {
                  ...p,
                  sale: { ...p.sale, [key]: value }
              };
          }
          return p;
      }));
  }, []);


  // --- CORE CALCULATION LOGIC ---
  const simulationResults = useMemo<{ monthlyData: MonthlyData[], summary: SummaryData }>(() => {
    const monthlyData: MonthlyData[] = [];
    let cashOnHand = initialCash;
    const totalMonths = projectionLength * 12;
    const startMonth = new Date().getMonth();
    const startYear = new Date().getFullYear();

    const propStates: { [key: string]: { loanBalance: number; propertyValue: number; offsetBalances: { [key: string]: number }; isSold: boolean; } } = {};

    properties.forEach(p => {
        propStates[p.id] = {
            loanBalance: p.purchasePrice * (p.loanRatio / 100),
            propertyValue: p.purchasePrice,
            offsetBalances: {},
            isSold: false
        };
    });

    for (let i = 0; i < totalMonths; i++) {
        const currentMonthAbsolute = startMonth + i;
        const currentYear = startYear + Math.floor(currentMonthAbsolute / 12);
        const currentMonth = currentMonthAbsolute % 12;
        
        let monthCashIn = annualSalary / 12;
        let monthCashOut = generalMonthlyExpenses;
        let monthRentalIncome = 0;
        
        const monthPropertyDetails: MonthlyData['propertyDetails'] = {};

        properties.forEach(p => {
            const pState = propStates[p.id];
            
            if (pState.isSold) {
                 monthPropertyDetails[p.id] = { principalPaid: 0, interestPaid: 0, loanBalance: 0, offsetBalance: 0, propertyValue: 0 };
                 return;
            }

            monthPropertyDetails[p.id] = { principalPaid: 0, interestPaid: 0, loanBalance: pState.loanBalance, offsetBalance: 0, propertyValue: pState.propertyValue };

            const purchaseMonthAbsolute = p.purchaseDate.year * 12 + p.purchaseDate.month;
            const currentMonthAbsoluteSim = currentYear * 12 + currentMonth;
            
            if (currentMonthAbsoluteSim < purchaseMonthAbsolute) {
                return; // Property not yet purchased
            }

            // --- Handle one-off purchase event ---
            if (currentMonthAbsoluteSim === purchaseMonthAbsolute) {
                const deposit = p.purchasePrice * (1 - p.loanRatio / 100);
                cashOnHand -= deposit;
            }

            // --- Annual Growth ---
            if ((currentMonthAbsoluteSim - purchaseMonthAbsolute) > 0 && (currentMonthAbsoluteSim - purchaseMonthAbsolute) % 12 === 0) {
                pState.propertyValue *= (1 + p.annualGrowth / 100);
            }
            monthPropertyDetails[p.id].propertyValue = pState.propertyValue;

            // --- Handle Property Sale ---
            if (p.sale && currentMonthAbsoluteSim === (p.sale.saleDate.year * 12 + p.sale.saleDate.month)) {
                const estimatedValue = pState.propertyValue;
                const grossProceeds = p.sale.manualSalePrice && p.sale.manualSalePrice > 0 ? p.sale.manualSalePrice : estimatedValue;
                const costs = grossProceeds * (p.sale.sellingCosts / 100);
                const loanPayoff = pState.loanBalance;
                const returnedOffsetCash = Object.values(pState.offsetBalances).reduce((a, b) => a + b, 0);

                const finalCashToHand = grossProceeds - costs - loanPayoff + returnedOffsetCash;
                cashOnHand += finalCashToHand;

                pState.isSold = true;
                pState.loanBalance = 0;
                pState.propertyValue = 0;
                pState.offsetBalances = {};
                
                monthPropertyDetails[p.id] = { principalPaid: 0, interestPaid: 0, loanBalance: 0, offsetBalance: 0, propertyValue: 0 };
                return; // Sold this month, no further processing for this property
            }

            // --- Handle Offsets ---
            p.offsets.forEach(o => {
                const startOff = o.startDate.year * 12 + o.startDate.month;
                const endOff = o.endDate.year * 12 + o.endDate.month;

                if (currentMonthAbsoluteSim === startOff) {
                    cashOnHand -= o.initialAmount;
                    pState.offsetBalances[o.id] = o.initialAmount;
                }
                if (currentMonthAbsoluteSim === endOff && pState.offsetBalances[o.id]) {
                    cashOnHand += pState.offsetBalances[o.id];
                    pState.offsetBalances[o.id] = 0;
                }
            });

            // --- Handle Rentals ---
            p.rentals.forEach(r => {
                const startRent = r.startDate.year * 12 + r.startDate.month;
                const endRent = r.endDate.year * 12 + r.endDate.month;
                if (currentMonthAbsoluteSim >= startRent && currentMonthAbsoluteSim <= endRent) {
                    monthCashIn += r.monthlyAmount;
                    monthRentalIncome += r.monthlyAmount;
                }
            });

            // --- Handle Property Expenses ---
            p.expenses.forEach(e => {
                const startExp = e.startDate.year * 12 + e.startDate.month;
                if (currentMonthAbsoluteSim >= startExp) {
                    let shouldPay = false;
                    if (e.frequency === 'monthly') shouldPay = true;
                    if (e.frequency === 'quarterly' && (currentMonthAbsoluteSim - startExp) % 3 === 0) shouldPay = true;
                    if (e.frequency === 'annually' && (currentMonthAbsoluteSim - startExp) % 12 === 0) shouldPay = true;
                    if (shouldPay) monthCashOut += e.amount;
                }
            });

            // --- Loan Calculation ---
            if (pState.loanBalance > 0) {
                const monthlyInterestRate = p.interestRate / 100 / 12;
                const totalPayments = p.loanTerm * 12;
                const loanAmount = p.purchasePrice * (p.loanRatio / 100);

                const monthlyPayment = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, totalPayments)) / (Math.pow(1 + monthlyInterestRate, totalPayments) - 1);

                const activeRepaymentOffset = p.offsets.find(o => {
                    const startOff = o.startDate.year * 12 + o.startDate.month;
                    const endOff = o.endDate.year * 12 + o.endDate.month;
                    return o.useForRepayments && currentMonthAbsoluteSim >= startOff && currentMonthAbsoluteSim <= endOff && pState.offsetBalances[o.id] > 0;
                });
                
                const totalOffsetForLoan = Object.values(pState.offsetBalances).reduce((a, b) => a + b, 0);
                const interestableBalance = pState.loanBalance - totalOffsetForLoan;
                const interestPaid = Math.max(0, interestableBalance * monthlyInterestRate);
                const principalPaid = monthlyPayment - interestPaid;
                
                if(activeRepaymentOffset) {
                    const offsetId = activeRepaymentOffset.id;
                    const paymentFromOffset = Math.min(pState.offsetBalances[offsetId], monthlyPayment);
                    pState.offsetBalances[offsetId] -= paymentFromOffset;
                    monthCashOut += (monthlyPayment - paymentFromOffset); // Remainder from cash
                } else {
                    monthCashOut += monthlyPayment;
                }

                pState.loanBalance -= principalPaid;
                if (pState.loanBalance < 0) pState.loanBalance = 0;

                monthPropertyDetails[p.id].principalPaid = principalPaid;
                monthPropertyDetails[p.id].interestPaid = interestPaid;
                monthPropertyDetails[p.id].loanBalance = pState.loanBalance;
            }
             monthPropertyDetails[p.id].offsetBalance = Object.values(pState.offsetBalances).reduce((a, b) => a + b, 0);
        });

        cashOnHand += monthCashIn - monthCashOut;

        const totalDebt = Object.values(propStates).reduce((sum, p) => sum + p.loanBalance, 0);
        const totalAssets = Object.values(propStates).reduce((sum, p) => sum + p.propertyValue, 0);
        const totalOffsetBalance = Object.values(propStates).reduce((sum, p) => sum + Object.values(p.offsetBalances).reduce((a,b) => a+b, 0), 0);
        const totalCash = cashOnHand + totalOffsetBalance;

        monthlyData.push({
            month: i + 1,
            date: `${(currentMonth + 1).toString().padStart(2,'0')}/${currentYear}`,
            salary: annualSalary / 12,
            rentalIncome: monthRentalIncome,
            generalExpenses: generalMonthlyExpenses,
            cashOnHand: Math.round(cashOnHand),
            totalCash: Math.round(totalCash),
            totalDebt: Math.round(totalDebt),
            netPosition: Math.round(totalAssets + totalCash - totalDebt),
            totalOffsetBalance: Math.round(totalOffsetBalance),
            propertyDetails: monthPropertyDetails
        });
    }

    // --- Calculate Summary Metrics ---
    const finalMonth = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null;

    const peakDebt = monthlyData.length > 0 ? Math.max(...monthlyData.map(m => m.totalDebt)) : 0;

    const totalInterestPaid = monthlyData.reduce((total, monthData) => 
        total + Object.values(monthData.propertyDetails).reduce((monthTotal, propDetail) => monthTotal + propDetail.interestPaid, 0)
    , 0);

    const finalAssets = finalMonth ? Object.values(finalMonth.propertyDetails).reduce((sum, p) => sum + p.propertyValue, 0) : 0;

    const summary: SummaryData = {
        finalNetPosition: finalMonth?.netPosition ?? initialCash,
        finalTotalEquity: finalAssets - (finalMonth?.totalDebt ?? 0),
        finalTotalCash: finalMonth?.totalCash ?? initialCash,
        peakDebt: peakDebt,
        totalInterestPaid: totalInterestPaid,
        propertiesSold: Object.values(propStates).filter(p => p.isSold).length
    };

    return { monthlyData, summary };
  }, [annualSalary, initialCash, generalMonthlyExpenses, projectionLength, properties]);

  const { monthlyData, summary } = simulationResults;
  
  const formatCurrencyAxis = (value: number) => `$${(value / 1000).toFixed(0)}k`;
  const formatCurrencyTooltip = (value: number) => `$${value.toLocaleString()}`;

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-cyan-400">Real Estate Investment Forecaster</h1>
        <p className="text-slate-400 mt-2">Model your financial journey to wealth through property.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-1 bg-slate-800 p-6 rounded-lg shadow-lg space-y-6 h-fit">
          <h2 className="text-2xl font-bold border-b border-slate-600 pb-2">Financial Inputs</h2>
          
          {/* Global Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Annual Salary ($)</label>
              <FormattedNumberInput value={annualSalary} onChange={setAnnualSalary} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Initial Cash ($)</label>
              <FormattedNumberInput value={initialCash} onChange={setInitialCash} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">General Monthly Expenses ($)</label>
              <FormattedNumberInput value={generalMonthlyExpenses} onChange={setGeneralMonthlyExpenses} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Projection Length (Years)</label>
              <input type="number" value={projectionLength} onChange={e => setProjectionLength(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-400 focus:outline-none" />
            </div>
          </div>

          <div className="border-t border-slate-600 pt-6 space-y-4">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Properties</h2>
                <button onClick={addProperty} className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    <Plus size={18} />
                    <span>Add Property</span>
                </button>
            </div>
            {properties.map(p => (
              <div key={p.id} className="bg-slate-900 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <input type="text" value={p.name} onChange={e => updateProperty(p.id, 'name', e.target.value)} className="text-lg font-bold bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-full" />
                  <button onClick={() => removeProperty(p.id)} className="text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Purchase Price</label>
                    <FormattedNumberInput value={p.purchasePrice} onChange={v => updateProperty(p.id, 'purchasePrice', v)} />
                  </div>
                   <div>
                    <label className="text-xs text-slate-400">Purchase Date</label>
                    <DateSelector value={p.purchaseDate} onChange={v => updateProperty(p.id, 'purchaseDate', v)} />
                  </div>
                   <div>
                    <label className="text-xs text-slate-400">Loan Ratio (%)</label>
                    <input type="number" value={p.loanRatio} onChange={e => updateProperty(p.id, 'loanRatio', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-md p-2" />
                  </div>
                   <div>
                    <label className="text-xs text-slate-400">Interest Rate (%)</label>
                    <input type="number" step="0.1" value={p.interestRate} onChange={e => updateProperty(p.id, 'interestRate', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-md p-2" />
                  </div>
                   <div>
                    <label className="text-xs text-slate-400">Loan Term (Yrs)</label>
                    <input type="number" value={p.loanTerm} onChange={e => updateProperty(p.id, 'loanTerm', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-md p-2" />
                  </div>
                   <div>
                    <label className="text-xs text-slate-400">Annual Growth (%)</label>
                    <input type="number" value={p.annualGrowth} onChange={e => updateProperty(p.id, 'annualGrowth', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded-md p-2" />
                  </div>
                </div>
                 {/* Collapsible Sections */}
                <details className="pt-2">
                  <summary className="cursor-pointer text-cyan-400 font-semibold list-none flex justify-between items-center">Rental Income <ChevronDown className="inline open:hidden" /><ChevronUp className="inline hidden open:inline" /></summary>
                  <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-600">
                    {p.rentals.map((r, idx) => (
                      <div key={r.id} className="bg-slate-800 p-2 rounded space-y-2">
                        <div className="flex justify-between items-center"><span className="text-sm font-semibold">Rental Period {idx+1}</span><button onClick={()=>removeNestedItem(p.id, 'rentals', r.id)} className="text-red-400 hover:text-red-500"><Trash2 size={16} /></button></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-xs text-slate-400">Monthly Amt</label><FormattedNumberInput value={r.monthlyAmount} onChange={v => updateNestedArray(p.id, 'rentals', r.id, 'monthlyAmount', v)} /></div>
                          <div><label className="text-xs text-slate-400">Start Date</label><DateSelector value={r.startDate} onChange={v => updateNestedArray(p.id, 'rentals', r.id, 'startDate', v)} /></div>
                          <div><label className="text-xs text-slate-400">End Date</label><DateSelector value={r.endDate} onChange={v => updateNestedArray(p.id, 'rentals', r.id, 'endDate', v)} /></div>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>addNestedItem(p.id, 'rentals')} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"><Plus size={14} /><span>Add Rental</span></button>
                  </div>
                </details>
                 <details className="pt-2">
                  <summary className="cursor-pointer text-cyan-400 font-semibold list-none flex justify-between items-center">Offset Account <ChevronDown className="inline open:hidden" /><ChevronUp className="inline hidden open:inline" /></summary>
                   <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-600">
                    {p.offsets.map((o, idx) => (
                      <div key={o.id} className="bg-slate-800 p-2 rounded space-y-2">
                        <div className="flex justify-between items-center"><span className="text-sm font-semibold">Offset {idx+1}</span><button onClick={()=>removeNestedItem(p.id, 'offsets', o.id)} className="text-red-400 hover:text-red-500"><Trash2 size={16} /></button></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-xs text-slate-400">Initial Amt</label><FormattedNumberInput value={o.initialAmount} onChange={v => updateNestedArray(p.id, 'offsets', o.id, 'initialAmount', v)} /></div>
                          <div><label className="text-xs text-slate-400">Start Date</label><DateSelector value={o.startDate} onChange={v => updateNestedArray(p.id, 'offsets', o.id, 'startDate', v)} /></div>
                          <div><label className="text-xs text-slate-400">End Date</label><DateSelector value={o.endDate} onChange={v => updateNestedArray(p.id, 'offsets', o.id, 'endDate', v)} /></div>
                          <div className="col-span-2 flex items-center space-x-2 pt-1">
                              <input type="checkbox" id={`repay-${o.id}`} checked={o.useForRepayments} onChange={e => updateNestedArray(p.id, 'offsets', o.id, 'useForRepayments', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                              <label htmlFor={`repay-${o.id}`} className="text-xs text-slate-400">Use for repayments</label>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>addNestedItem(p.id, 'offsets')} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"><Plus size={14} /><span>Add Offset</span></button>
                  </div>
                </details>
                 <details className="pt-2">
                  <summary className="cursor-pointer text-cyan-400 font-semibold list-none flex justify-between items-center">Expenses <ChevronDown className="inline open:hidden" /><ChevronUp className="inline hidden open:inline" /></summary>
                   <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-600">
                     {p.expenses.map((e, idx) => (
                      <div key={e.id} className="bg-slate-800 p-2 rounded space-y-2">
                        <div className="flex justify-between items-center"><span className="text-sm font-semibold">Expense {idx+1}</span><button onClick={()=>removeNestedItem(p.id, 'expenses', e.id)} className="text-red-400 hover:text-red-500"><Trash2 size={16} /></button></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2"><label className="text-xs text-slate-400">Description</label><input type="text" value={e.description} onChange={el => updateNestedArray(p.id, 'expenses', e.id, 'description', el.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-1" /></div>
                          <div><label className="text-xs text-slate-400">Amount</label><FormattedNumberInput value={e.amount} onChange={v => updateNestedArray(p.id, 'expenses', e.id, 'amount', v)} /></div>
                          <div><label className="text-xs text-slate-400">Frequency</label><select value={e.frequency} onChange={el => updateNestedArray(p.id, 'expenses', e.id, 'frequency', el.target.value as PropertyExpense['frequency'])} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select></div>
                          <div className="col-span-2"><label className="text-xs text-slate-400">Start Date</label><DateSelector value={e.startDate} onChange={v => updateNestedArray(p.id, 'expenses', e.id, 'startDate', v)} /></div>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>addNestedItem(p.id, 'expenses')} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"><Plus size={14} /><span>Add Expense</span></button>
                  </div>
                </details>
                <details className="pt-2">
                    <summary className="cursor-pointer text-cyan-400 font-semibold list-none flex justify-between items-center">
                        Property Sale
                        <ChevronDown className="inline open:hidden" /><ChevronUp className="inline hidden open:inline" />
                    </summary>
                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-600">
                        {!p.sale && (
                            <button onClick={() => addSale(p.id)} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center space-x-1">
                                <Plus size={14} /><span>Add Sale Forecast</span>
                            </button>
                        )}
                        {p.sale && (
                            <div className="bg-slate-800 p-2 rounded space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold">Sale Details</span>
                                    <button onClick={() => removeSale(p.id)} className="text-red-400 hover:text-red-500">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                     <div>
                                        <label className="text-xs text-slate-400">Sale Date</label>
                                        <DateSelector value={p.sale.saleDate} onChange={v => updateSale(p.id, 'saleDate', v)} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400">Selling Costs (%)</label>
                                        <input
                                            type="number" step="0.1" value={p.sale.sellingCosts}
                                            onChange={e => updateSale(p.id, 'sellingCosts', Number(e.target.value))}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                                        />
                                    </div>
                                    <div className="md:col-span-2 bg-slate-900/50 p-2 rounded-md">
                                        <label className="text-xs text-slate-400">Est. Value at Sale Date</label>
                                        <p className="font-semibold text-lg text-slate-300">
                                            {formatCurrency(calculateFutureValue(p, p.sale.saleDate))}
                                        </p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs text-slate-400">Manual Sale Price (Overrides Est. Value)</label>
                                        <FormattedNumberInput
                                            value={p.sale.manualSalePrice || 0}
                                            onChange={v => updateSale(p.id, 'manualSalePrice', v)}
                                            placeholder="Leave as 0 to use estimate"
                                        />
                                    </div>
                                    <SaleDifferenceDisplay property={p} />
                                </div>
                            </div>
                        )}
                    </div>
                </details>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Visualizations */}
        <div className="lg:col-span-2 space-y-8">
            <SummaryMetrics summary={summary} />

            <div className="bg-slate-800 p-4 rounded-lg shadow-lg">
                 <h3 className="text-xl font-bold mb-4 text-cyan-400">Net Position Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={formatCurrencyAxis}/>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={formatCurrencyTooltip}/>
                        <Legend />
                        <Area type="monotone" dataKey="netPosition" name="Net Position" stroke="#22d3ee" fillOpacity={0.4} fill="#22d3ee" />
                        <Area type="monotone" dataKey="totalDebt" name="Total Debt" stroke="#f87171" fill="transparent" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
             <div className="bg-slate-800 p-4 rounded-lg shadow-lg">
                 <h3 className="text-xl font-bold mb-4 text-cyan-400">Total Cash Position</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={formatCurrencyAxis}/>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={formatCurrencyTooltip}/>
                        <Legend />
                        <Area type="monotone" dataKey="cashOnHand" name="Cash On Hand" stackId="1" stroke="#4ade80" fill="#4ade80" fillOpacity={0.4} />
                        <Area type="monotone" dataKey="totalOffsetBalance" name="Total Offset Balance" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.4} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            {monthlyData.length > 0 && <FinancialDataTable data={monthlyData} properties={properties} />}
        </div>
      </div>
    </div>
  );
}
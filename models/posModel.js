const prisma = require("../config/prismaClient");
const PaginationHelper = require("../utils/paginationHelper");

// Helper function to get Sri Lankan time (UTC+5:30)
const getSriLankanTime = () => {
    const now = new Date();
    return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
};

class POS {
    // Redundant getAllVariations removed. handled by product/stock models.


    // Redundant getPOSProducts and searchProducts removed.


    // Search product by barcode (checks both stock and product_variations barcodes)
    static async searchByBarcode(barcode) {
        const stocks = await prisma.stock.findMany({
            where: {
                OR: [
                    { barcode: barcode },
                    { product_variations: { barcode: barcode } },
                    { product_variations: { product: { product_code: { contains: barcode } } } }
                ],
                qty: { gt: 0 },
                product_variations: {
                    product_status_id: 1
                }
            },
            include: {
                product_variations: {
                    include: {
                        product: {
                            include: {
                                unit_id_product_unit_idTounit_id: true,
                            }
                        }
                    }
                },
                batch: true
            },
            orderBy: {
                mfd: 'asc'
            },
            take: 10
        });

        return stocks.map(s => {
            const pv = s.product_variations;
            const p = pv.product;
            
            return {
                stockID: s.id,
                productName: p.product_name,
                barcode: s.barcode,
                unit: p.unit_id_product_unit_idTounit_id?.name,
                unit_conversion: null,
                price: s.rsp,
                wholesalePrice: s.wsp ?? 0,
                productCode: p.product_code,
                currentStock: s.qty,
                batchName: s.batch.batch_name,
                expiry: s.exp ? s.exp.toISOString().split('T')[0] : null,
                color: pv.color,
                size: pv.size,
                storage_capacity: pv.storage_capacity
            };
        });
    }
    // Create Invoice with Transaction
    static async createInvoice(data) {
        const {
            customer_id,
            user_id,
            discount,
            total_amount,
            sub_total,
            items,
            payment_details,
            cash_session_id
        } = data;

        // Calculate total paid to verify balance logic
        const totalPaid = payment_details.reduce((sum, p) => sum + p.amount, 0);
        // If total_amount > totalPaid, the remainder is credit (balance > 0)
        // If total_amount < totalPaid, the remainder is change (balance < 0), logic handles exact/overpayment via cash normally
        const balance = total_amount - totalPaid;

        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Create Invoice
                // Need to get invoice type id, assuming 1 (Sales)
                // Need to get cash_session_id if not passed? Controller should pass it.
            
            const invoice = await tx.invoice.create({
                data: {
                    invoice_number: `INV-${Date.now()}`,
                    customer_id: customer_id || null,
                    sub_total: sub_total,
                    discount: discount || 0,
                    extra_discount: 0,
                    total: total_amount,
                    // Store Sri Lankan Time (UTC+5.30) logic:
                    // We add 5.5 hours to the current UTC time so that the DB stores the Local Time value
                    created_at: new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000)),
                    cash_sessions_id: cash_session_id,
                    invoice_type_id: 1, // Assuming 1 is 'Sales'
                }
            });

            // 2. Create Invoice Items and Update Stock
            const createdInvoiceItems = [];
            const stockCostMap = new Map(); // Track cost_price for profit calculation
            
            for (const item of items) {
                // Fetch stock with cost_price for profit calculation
                const stock = await tx.stock.findUnique({
                    where: { id: item.stock_id }
                });
                
                if (stock) {
                    stockCostMap.set(item.stock_id, stock.cost_price || 0);
                }
                
                const invoiceItem = await tx.invoice_items.create({
                    data: {
                        invoice_id: invoice.id,
                        stock_id: item.stock_id,
                        current_price: item.price,
                        discount_percentage: item.discount || 0,
                        discount_amount: item.discountAmount || 0,
                        qty: item.quantity
                    }
                });
                
                createdInvoiceItems.push({
                    ...invoiceItem,
                    cost_price: stock?.cost_price || 0,
                    unit_name: item.unit_name || '', // Will be populated from frontend
                    product_name: item.product_name || '' // Will be populated from frontend
                });

                // Decrement Stock
                await tx.stock.update({
                    where: { id: item.stock_id },
                    data: {
                        qty: { decrement: item.quantity }
                    }
                });
            }

            // 3. Create Invoice Payments
            const createdPayments = [];
            console.log('💰 Processing Payments:', JSON.stringify(payment_details));
            for (const payment of payment_details) {
                console.log(`  - Processing payment: ${payment.methodId} = ${payment.amount}`);
                if (payment.amount > 0) {
                    // Logic:
                    // Frontend 'methodId' can be 'cash', 'card', 'credit'.
                    // 'credit' method input implies amount to be put on credit balance OR paid via stored credit?
                    // Based on previous logic design: "Credit" in frontend helps calculation but shouldn't be recorded as "Paid" 
                    // in invoice_payments table if it means "Debt".
                    // However, if "Credit" means "Pay using existing customer credit", then it IS a payment type.
                    // But the requested feature "add amount based on how they paid ... and add balance to user" 
                    // implies the "Balance" is what's left.
                    // If user enters 500 in Credit input, it likely means "I am paying 500 via Credit (Debt)".
                    // Thus, we should NOT record it as a "Payment" that reduces the balance-due calculation 
                    // IF we want `total_amount - realPaid` to result in the debt amount.
                    
                    // Lets strictly only record 'cash' and 'card' as actual payments received.
                    // 'credit' input is effectively ignored for "received money" but might be useful for strict invoice records if we had a "Credit" payment type.
                    // Current DB `payment_types` has: Cash, Card, Cheque, Online. NO "Credit".
                    
                    if (payment.methodId !== 'credit') {
                        const normalizedMethod = payment.methodId.charAt(0).toUpperCase() + payment.methodId.slice(1);
                        console.log(`    Normalized method: ${normalizedMethod}`);
                        
                        let type = await tx.payment_types.findFirst({
                            where: { payment_types: normalizedMethod }
                        });

                        console.log(`    Found payment type:`, type);

                        if (type) {
                            const paymentRecord = await tx.invoice_payments.create({
                                data: {
                                    invoice_id: invoice.id,
                                    payment_types_id: type.id,
                                    amount: payment.amount,
                                    payment_date: new Date()
                                }
                            });
                            createdPayments.push({
                                method: normalizedMethod,
                                amount: payment.amount,
                                payment_types_id: type.id
                            });
                            console.log(`    ✅ Payment saved:`, paymentRecord);
                        } else {
                            console.log(`    ❌ Payment type not found for: ${normalizedMethod}`);
                        }
                    } else {
                        console.log(`    ⏭️  Skipping 'credit' payment`);
                    }
                }
            }
            
            // Update Cash Session Totals
            if (cash_session_id) {
                let cashIncrement = 0;
                let cardIncrement = 0;
                let bankIncrement = 0;
                
                // Sum payments
                for (const payment of payment_details) {
                     if (payment.methodId === 'cash') cashIncrement += payment.amount;
                     else if (payment.methodId === 'card') cardIncrement += payment.amount;
                     else if (payment.methodId === 'bank' || payment.methodId === 'cheque' || payment.methodId === 'online') bankIncrement += payment.amount;
                }

                // Calculate change given (only if guest, otherwise kept as credit)
                const realPaidAmount = payment_details
                    .filter(p => p.methodId !== 'credit') // Kept for legacy compatibility
                    .reduce((sum, p) => sum + p.amount, 0);
                
                // If overpaid and NO customer (Guest), change is given back
                if (!customer_id && realPaidAmount > total_amount) {
                    const changeGiven = realPaidAmount - total_amount;
                    // Deduct change from cash increment (assuming change comes from cash)
                    cashIncrement -= changeGiven;
                    // If cash became negative (unlikely unless change > cash paid), clamp or handle?
                    // Usually change <= cash paid.
                }

                console.log(`  Update Session ${cash_session_id}: Cash +${cashIncrement}, Card +${cardIncrement}, Bank +${bankIncrement}`);
                
                await tx.cash_sessions.update({
                    where: { id: cash_session_id },
                    data: {
                        cash_total: { increment: cashIncrement },
                        card_total: { increment: cardIncrement },
                        bank_total: { increment: bankIncrement }
                    }
                });
            }
            
            // Recalculate balance for Credit Book logic
            // Balance = Total - (Real Payments)
            const realPaid = payment_details
                .filter(p => p.methodId !== 'credit')
                .reduce((sum, p) => sum + p.amount, 0);
            
            const finalBalance = total_amount - realPaid;

            console.log('💳 Credit Balance Calculation:');
            console.log(`  Total Amount: ${total_amount}`);
            console.log(`  Real Paid: ${realPaid}`);
            console.log(`  Final Balance (Debt): ${finalBalance}`);

            // 4. Handle Credit / Balance
            // If finalBalance > 0: Customer owes money (Credit Sale)
            // If finalBalance < 0: Customer overpaid (Deposit/Store Credit)
            // Using epsilon 0.01 to avoid floating point issues
            if (finalBalance > 0.01 && customer_id) {
                console.log(`  📝 Adding to credit book: ${finalBalance}`);

                // Add to credit book
                await tx.creadit_book.create({
                    data: {
                        invoice_id: invoice.id,
                        balance: finalBalance,
                        status_id: 1, 
                        created_at: getSriLankanTime()
                    }
                });

                console.log(`  ✅ Credit book entry created`);
            }

            // 5. Fetch Customer Details (if exists) and Build Comprehensive Response
            let customer = null;
            if (customer_id) {
                customer = await tx.customer.findUnique({
                    where: { id: customer_id }
                });
            }

            // Calculate Profit for Invoice
            const profit = createdInvoiceItems.reduce((sum, item) => {
                const cost = item.cost_price || 0;
                const price = item.current_price || 0;
                const qty = item.qty || 0;
                return sum + ((price - cost) * qty);
            }, 0) - (discount || 0);

            // Calculate Outstanding Balance
            const invoiceBalance = finalBalance;

            // Build comprehensive response
            const responseData = {
                id: invoice.id,
                invoiceNo: invoice.invoice_number,
                date: invoice.created_at.toISOString().replace('T', ' ').split('.')[0],
                customer: customer ? customer.name : 'Guest',
                customerId: customer ? customer.id : null,
                customerContact: customer ? customer.contact : '',
                total: invoice.total,
                subTotal: invoice.sub_total,
                discount: invoice.discount,
                grossAmount: invoice.total + (invoice.discount || 0),
                profit: profit,
                creditBalance: invoiceBalance,
                refundedAmount: invoice.refunded_amount || 0,
                items: createdInvoiceItems.map(item => {
                    const discountPercentage = item.discount_percentage || 0;
                    const discountAmount = item.discount_amount || 0;
                    
                    // Calculate discount per item
                    const itemDiscount = discountPercentage > 0 
                        ? (item.current_price * discountPercentage) / 100
                        : discountAmount;
                    
                    return {
                        id: item.stock_id,
                        name: item.product_name,
                        price: item.current_price,
                        costPrice: item.cost_price,
                        quantity: item.qty,
                        category: item.unit_name,
                        isBulk: item.unit_name ? item.unit_name.toLowerCase().includes('kg') || item.unit_name.toLowerCase().includes('bag') || item.unit_name.toLowerCase().includes('liter') || item.unit_name.toLowerCase().includes('meter') : false,
                        returnedQuantity: 0,
                        returnQuantity: 0,
                        item_discount: itemDiscount,
                        discount_percentage: discountPercentage,
                        discount_amount: discountAmount
                    };
                }),
                payments: createdPayments
            };

            return responseData;
        }, {
            timeout: 30000 // Extended timeout to 30s for complex invoice creation with credit book entries
        });
        } catch (error) {
            console.error('ERROR in POS.createInvoice:', error);
            throw error;
        }
    }

    // Convert Bulk Stock to Loose Stock
    static async convertBulkToLoose(data) {
        const { bulkStockId, looseVariationId, deductQty, addQty } = data;

        return await prisma.$transaction(async (tx) => {
            // 1. Verify Bulk Stock
            const bulkStock = await tx.stock.findUnique({
                where: { id: parseInt(bulkStockId) }
            });

            if (!bulkStock) {
                throw new Error('Bulk stock item not found');
            }

            if (bulkStock.qty < deductQty) {
                throw new Error(`Insufficient bulk stock. Available: ${bulkStock.qty}, Requested: ${deductQty}`);
            }

            // 2. Find or Create Destination (Loose) Stock
            // We look for a record with the same variation AND the same batch as the source
            let looseStock = await tx.stock.findFirst({
                where: {
                    product_variations_id: parseInt(looseVariationId),
                    batch_id: bulkStock.batch_id
                }
            });

            if (!looseStock) {
                // If not found for this batch, get latest prices from ANY existing stock for this variation
                const latestLooseStock = await tx.stock.findFirst({
                    where: { product_variations_id: parseInt(looseVariationId) },
                    orderBy: { id: 'desc' }
                });

                if (!latestLooseStock) {
                    throw new Error('Destination item has no price history. Please add at least one stock record (GRN) for this product first.');
                }

                const variation = await tx.product_variations.findUnique({
                    where: { id: parseInt(looseVariationId) }
                });

                // Create new stock entry inheriting batch/exp from source but prices from destination history
                looseStock = await tx.stock.create({
                    data: {
                        product_variations_id: parseInt(looseVariationId),
                        barcode: variation.barcode || `L-${Date.now()}`,
                        batch_id: bulkStock.batch_id,
                        mfd: bulkStock.mfd,
                        exp: bulkStock.exp,
                        cost_price: latestLooseStock.cost_price,
                        mrp: latestLooseStock.mrp,
                        rsp: latestLooseStock.rsp,
                        wsp: latestLooseStock.wsp,
                        qty: 0
                    }
                });
            }

            // 3. Perform Updates
            const updatedBulk = await tx.stock.update({
                where: { id: parseInt(bulkStockId) },
                data: { qty: { decrement: parseFloat(deductQty) } }
            });

            const updatedLoose = await tx.stock.update({
                where: { id: looseStock.id },
                data: { qty: { increment: parseFloat(addQty) } }
            });

            return {
                success: true,
                bulkStock: updatedBulk,
                looseStock: updatedLoose
            };
        }, {
            timeout: 15000 // Extended timeout to 15s for stock conversion operations
        });
    }

    // Get invoice by invoice number
    static async getInvoiceByNo(invoiceNo) {
        const invoice = await prisma.invoice.findFirst({
            where: {
                invoice_number: invoiceNo
            },
            include: {
                invoice_items: {
                    include: {
                        stock: {
                            include: {
                                product_variations: {
                                    include: {
                                        product: {
                                            include: {
                                                unit_id_product_unit_idTounit_id: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                customer: true,
                invoice_payments: {
                    include: {
                        payment_types: true
                    }
                },
                creadit_book: true
            }
        });

        if (!invoice) return null;

        // Calculate total paid from all payment types
        const totalPaid = invoice.invoice_payments.reduce((sum, p) => sum + p.amount, 0);
        // Calculate total return amount from item level including item discounts
        const totalReturnAmount = invoice.invoice_items.reduce((sum, item) => {
            const returnedQty = item.returned_qty || 0;
            
            if (returnedQty > 0) {
                const discountPercentage = item.discount_percentage || 0;
                const discountAmount = item.discount_amount || 0;
                const price = item.current_price || 0;

                // Calculate discount per single item
                const itemDiscount = discountPercentage > 0 
                    ? (price * discountPercentage) / 100
                    : discountAmount;

                // Return cost = (Price after discount * returned qty)
                const itemReturnCost = (price - itemDiscount) * returnedQty;
                return sum + itemReturnCost;
            }
            
            return sum;
        }, 0);

        // Net Invoice Total = Original Total - Total Return Amount
        const netInvoiceTotal = Math.max(0, invoice.total - totalReturnAmount);

        // Outstanding credit balance = Net Invoice Total - Total Paid
        const invoiceBalance = Math.max(0, netInvoiceTotal - totalPaid);
        // --------------------------------------------------------

        // Calculate Profit for this specific invoice (excluding refunded items)
        const profit = invoice.invoice_items.reduce((sum, item) => {
            const cost = item.stock.cost_price || 0;
            const price = item.current_price || 0;
            const qty = item.qty || 0;
            const returnedQty = item.returned_qty || 0;
            const effectiveQty = qty - returnedQty;
            return sum + ((price - cost) * effectiveQty);
        }, 0) - (invoice.discount || 0);

        return {
            id: invoice.id,
            invoiceNo: invoice.invoice_number,
            date: invoice.created_at.toISOString().replace('T', ' ').split('.')[0],
            customer: invoice.customer ? invoice.customer.name : 'Guest', 
            customerId: invoice.customer ? invoice.customer.id : null,
            customerContact: invoice.customer ? invoice.customer.contact : '',
            total: invoice.total,
            subTotal: invoice.sub_total,
            discount: invoice.discount,
            grossAmount: invoice.total + (invoice.discount || 0),
            profit: profit,
            creditBalance: invoiceBalance, 
            refundedAmount: totalReturnAmount, 
            items: invoice.invoice_items.map(item => {
                const unitName = item.stock.product_variations.product.unit_id_product_unit_idTounit_id?.name || '';
                const discountPercentage = item.discount_percentage || 0;
                const discountAmount = item.discount_amount || 0;
                const returnedQty = item.returned_qty || 0;
                
                const itemDiscount = discountPercentage > 0 
                    ? (item.current_price * discountPercentage) / 100
                    : discountAmount;
                
                return {
                    id: item.stock_id,
                    name: item.stock.product_variations.product.product_name,
                    price: item.current_price,
                    costPrice: item.stock.cost_price, 
                    quantity: item.qty,
                    category: unitName,
                    isBulk: unitName.toLowerCase().includes('kg') || unitName.toLowerCase().includes('bag') || unitName.toLowerCase().includes('liter') || unitName.toLowerCase().includes('meter'),
                    returnedQuantity: returnedQty,
                    returnQuantity: 0,
                    item_discount: itemDiscount
                };
            }),
            payments: invoice.invoice_payments.map(p => ({
                method: p.payment_types.payment_types,
                amount: p.amount
            }))
        };
    }

    // Process return
    static async processReturn(data) {
        const { invoiceNo, items, user_id } = data;
        console.log("invoice data: ", data);
        // 1. Validate invoice
        const invoice = await prisma.invoice.findFirst({
            where: { invoice_number: invoiceNo },
            include: {
                invoice_payments: true,
                invoice_items: true,
                creadit_book: true // Include credit book to update debt status
            }
        });

        if (!invoice) throw new Error("Invoice not found");

        // --- Calculate Financials ---
        
        // A. Total actually paid by customer (Cash, Card, Bank)
        const totalPaid = invoice.invoice_payments.reduce((sum, p) => sum + p.amount, 0);

        // B. Calculate Value of Returns using returnValue from request (already has discount deducted)
        let currentReturnValue = 0;
        const invoiceItemsMap = new Map();
        invoice.invoice_items.forEach(i => invoiceItemsMap.set(i.stock_id, i));

        for (const item of items) {
             // Use the returnValue sent from frontend (already has discount deducted)
             // If returnValue is not provided, fall back to calculation
             if (item.returnValue !== undefined && item.returnValue > 0) {
                 currentReturnValue += item.returnValue;
             } else {
                 const dbItem = invoiceItemsMap.get(item.id);
                 if (dbItem) {
                     currentReturnValue += (dbItem.current_price * item.returnQuantity);
                 }
             }
        }

        // Previous Return Value
        const previousReturnsValue = invoice.invoice_items.reduce((sum, item) => {
            return sum + (item.current_price * (item.returned_qty || 0));
        }, 0);
        
        const totalReturnValue = previousReturnsValue + currentReturnValue;

        // C. New Effective Invoice Total
        const newInvoiceTotal = Math.max(0, invoice.total - totalReturnValue);

        // D. Determine Financial Position
        // Debt = What they SHOULD pay (NewTotal) - What they DID pay (TotalPaid)
        // If Positive: They still owe money.
        // If Negative: They overpaid (Surplus/Refundable).
        const debt = newInvoiceTotal - totalPaid;

        console.log(`🔄 Re-evaluating Invoice ${invoiceNo}`);
        console.log(`   Original Total: ${invoice.total}`);
        console.log(`   Total Value Returned: ${totalReturnValue} (Prev: ${previousReturnsValue}, Curr: ${currentReturnValue})`);
        console.log(`   New Invoice Total: ${newInvoiceTotal}`);
        console.log(`   Total Paid: ${totalPaid}`);
        console.log(`   => Net Debt Position: ${debt}`);

        // E. Calculate Cash Refund (If Surplus)
        let cashRefundAmount = 0;
        if (debt < 0) {
            // Negative debt means Surplus (User owns this money)
            const surplus = Math.abs(debt);
            const alreadyRefunded = invoice.refunded_amount || 0;
            
            // We owe them 'surplus', but we may have already paid some back.
            const dueRefund = Math.max(0, surplus - alreadyRefunded);
            
            // We can only refund what is "Due".
            // Also, we implicitly cap by the current return value? 
            // The logic "Balance - Original + Return" covers the net change.
            // If dueRefund is positive, that's exactly what we need to give back NOW to balance the books.
            cashRefundAmount = dueRefund;
        }

        return await prisma.$transaction(async (tx) => {
            const userIdToUse = parseInt(user_id || 1);
            let activeSession = null;

            // Pre-fetch active session if needed for refund or logging
            if (cashRefundAmount > 0 || true) { // Always fetch for logging anyway at the end
                activeSession = await tx.cash_sessions.findFirst({
                    where: {
                        user_id: userIdToUse,
                        cash_status_id: 1 // Active
                    },
                    orderBy: { id: 'desc' }
                });
            }

             // 1. Update Credit Book (If Debt Changed)
             // If there was a credit book entry, we must update it.
             // Even if there wasn't, if debt > 0 we technically should have one, but we'll focus on updating existing ones.
             if (invoice.creadit_book && invoice.creadit_book.length > 0) {
                 const effectiveBalance = Math.max(0, debt);
                 console.log(`   📝 Updating Credit Book Balance to: ${effectiveBalance}`);
                 
                 // Update all entries for this invoice? usually just one active.
                 // Let's update all to be safe or just the last one.
                 // Assuming single active credit record per invoice usually.
                 for (const cb of invoice.creadit_book) {
                     await tx.creadit_book.update({
                         where: { id: cb.id },
                         data: { 
                             balance: effectiveBalance,
                             // If balance is 0, arguably status could change to 'Paid' (e.g. 2), but let's keep it simple.
                         }
                     });
                 }
             }

             // 2. Handle Cash Refund
             if (cashRefundAmount > 0) {
                 console.log(`   💰 Processing Cash Refund: ${cashRefundAmount}`);
                 
                 // Update Invoice Refunded Amount
                 await tx.invoice.update({
                     where: { id: invoice.id },
                     data: { refunded_amount: { increment: cashRefundAmount } }
                 });

                 if (activeSession) {
                     await tx.money_exchange.create({
                         data: {
                             cash_sessions_id: activeSession.id,
                             exchange_type_id1: 2, // Cash Out
                             amount: cashRefundAmount,
                             reason: `Refund for Invoice ${invoiceNo}`,
                             datetime: getSriLankanTime()
                         }
                     });
                 } else {
                     console.warn("   ⚠️ No active cash session found.");
                 }
             }

            // 3. Update Stock & Items
            for (const item of items) {
                if (item.returnQuantity > 0) {
                    // Update Stock
                    await tx.stock.update({
                        where: { id: item.id },
                        data: { qty: { increment: item.returnQuantity } }
                    });

                    // Search for the invoice item in our pre-fetched data
                    const dbInvoiceItem = invoice.invoice_items.find(ii => ii.stock_id === item.id);
                    
                    if (dbInvoiceItem) {
                         await tx.invoice_items.update({
                            where: { id: dbInvoiceItem.id },
                            data: { returned_qty: { increment: item.returnQuantity } }
                        });
                    } else {
                        console.warn(`   ⚠️ Item ID ${item.id} not found in Invoice Items.`);
                    }
                }
             }
             
             // 4. Log in return_goods with the actual return value from request
             if (activeSession) {
                 await tx.return_goods.create({
                     data: {
                         invoice_id: invoice.id,
                         cash_sessions_id: activeSession.id,
                         balance: currentReturnValue
                     }
                 });
             }
             
             // Calculate old debt (before this return)
             const oldDebt = invoice.creadit_book?.reduce((sum, cb) => sum + cb.balance, 0) || 0;
             const debtReduction = Math.max(0, oldDebt - Math.max(0, debt));
             
             return { 
                 success: true, 
                 refundedCash: cashRefundAmount, 
                 newDebt: Math.max(0, debt),
                 oldDebt: oldDebt,
                 debtReduction: debtReduction,
                 returnValue: currentReturnValue
             };
           }, {
               timeout: 30000 // Extended timeout to 30s to handle complex return logic and prevent expiration
           });
     }

    // Get all invoices with filters and pagination
    static async getAllInvoices(filters, limit, offset) {
        const { invoiceNumber, cashierName, fromDate, toDate, customerId } = filters;
        
        // Build where clause
        const where = {};
        
        if (invoiceNumber) {
            const isNumeric = /^\d+$/.test(invoiceNumber);
            const isPaddedId = invoiceNumber.startsWith('#') && /^\d+$/.test(invoiceNumber.substring(1));
            
            if (isNumeric || isPaddedId) {
                const numericId = parseInt(isNumeric ? invoiceNumber : invoiceNumber.substring(1));
                where.OR = [
                    { id: numericId },
                    { invoice_number: { contains: invoiceNumber } }
                ];
            } else {
                where.invoice_number = {
                    contains: invoiceNumber
                };
            }
        }

        if (customerId) {
            where.customer_id = parseInt(customerId);
        }

        if (cashierName) {
            where.cash_sessions = {
                user: {
                    name: {
                        contains: cashierName
                    }
                }
            };
        }
        
        if (fromDate && toDate) {
            where.created_at = {
                gte: new Date(fromDate),
                lte: new Date(toDate + 'T23:59:59.999Z')
            };
        } else if (fromDate) {
            where.created_at = {
                gte: new Date(fromDate)
            };
        } else if (toDate) {
            where.created_at = {
                lte: new Date(toDate + 'T23:59:59.999Z')
            };
        }

        // Get total count
        const total = await prisma.invoice.count({ where });

        // Get invoices with relations
        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                customer: true,
                invoice_payments: {
                    include: {
                        payment_types: true
                    }
                },
                invoice_items: {
                    include: {
                        stock: true
                    }
                }
            },
            orderBy: {
                created_at: filters.order || 'desc'
            },
            take: limit,
            skip: offset
        });

        // Manually fetch cashier info for each invoice
        const formattedInvoices = await Promise.all(invoices.map(async (invoice) => {
            let cashierName = 'Unknown';
            
            // Fetch cash session and user info
            if (invoice.cash_sessions_id) {
                const cashSession = await prisma.cash_sessions.findUnique({
                    where: { id: invoice.cash_sessions_id },
                    include: {
                        user: true
                    }
                });
                
                if (cashSession && cashSession.user) {
                    cashierName = cashSession.user.name; // fixed typo assignment
                }
            }

            const grossAmount = invoice.total + (invoice.discount || 0);
            
            // Calculate total paid from all payment types
            const totalPaid = invoice.invoice_payments.reduce((sum, p) => sum + p.amount, 0);
            
            // Calculate individual payment type totals for reference
            const cashPay = invoice.invoice_payments
                .filter(p => p.payment_types.payment_types === 'Cash')
                .reduce((sum, p) => sum + p.amount, 0);
            const cardPay = invoice.invoice_payments
                .filter(p => p.payment_types.payment_types === 'Card')
                .reduce((sum, p) => sum + p.amount, 0);

            // Calculate total return amount from item level including item discounts
            const totalReturnAmount = invoice.invoice_items.reduce((sum, item) => {
                const returnedQty = item.returned_qty || 0;
                
                if (returnedQty > 0) {
                    const discountPercentage = item.discount_percentage || 0;
                    const discountAmount = item.discount_amount || 0;
                    const price = item.current_price || 0;

                    // Calculate discount per single item
                    const itemDiscount = discountPercentage > 0 
                        ? (price * discountPercentage) / 100
                        : discountAmount;

                    // Return cost for the returned quantity (Price after discount * returned qty)
                    const itemReturnCost = (price - itemDiscount) * returnedQty;
                    return sum + itemReturnCost;
                }
                
                return sum;
            }, 0);

            // Net Invoice Total = Original Total - Total Return Amount
            const netInvoiceTotal = Math.max(0, invoice.total - totalReturnAmount);
            
            // Final Balance = Net Invoice Total - Total Paid
            const balance = Math.max(0, netInvoiceTotal - totalPaid);
            // ---------------------------------------------------

            // Calculate Profit (excluding refunded items)
            const profit = invoice.invoice_items.reduce((sum, item) => {
                const cost = item.stock.cost_price || 0;
                const price = item.current_price || 0;
                const qty = item.qty || 0;
                const returnedQty = item.returned_qty || 0;
                const effectiveQty = qty - returnedQty;
                return sum + ((price - cost) * effectiveQty);
            }, 0) - (invoice.discount || 0);

            return {
                id: invoice.id,
                invoiceID: invoice.invoice_number,
                grossAmount: grossAmount.toFixed(2),
                discount: (invoice.discount || 0).toFixed(2),
                netAmount: invoice.total.toFixed(2),
                profit: profit.toFixed(2),
                cashPay: cashPay.toFixed(2),
                cardPay: cardPay.toFixed(2),
                balance: balance.toFixed(2), 
                issuedDate: invoice.created_at.toISOString().replace('T', ' ').split('.')[0],
                cashier: cashierName,
                customerName: invoice.customer?.name || 'Guest',
                itemCount: invoice.invoice_items.length,
                refundedAmount: totalReturnAmount.toFixed(2),
                paymentMethods: invoice.invoice_payments.map(p => p.payment_types.payment_types).join(', ')
            };
        }));

        return {
            invoices: formattedInvoices,
            total
        };
    }

    // Get invoice statistics
    static async getInvoiceStats(filters) {
        const { fromDate, toDate, cashierName } = filters;
        
        // Build where clause for filtering
        const where = {};

        if (cashierName) {
            where.cash_sessions = {
                user: {
                    name: {
                        contains: cashierName
                    }
                }
            };
        }
        
        if (fromDate && toDate) {
            where.created_at = {
                gte: new Date(fromDate),
                lte: new Date(toDate + 'T23:59:59.999Z')
            };
        } else if (fromDate) {
            where.created_at = {
                gte: new Date(fromDate)
            };
        } else if (toDate) {
            where.created_at = {
                lte: new Date(toDate + 'T23:59:59.999Z')
            };
        }

        // Get aggregated data
        const invoiceCount = await prisma.invoice.count({ where });
        
        const totalsResult = await prisma.invoice.aggregate({
            where,
            _sum: {
                total: true,
                refunded_amount: true
            }
        });

        const totalSales = totalsResult._sum.total || 0;
        const totalRefunded = totalsResult._sum.refunded_amount || 0;
        const netSales = totalSales - totalRefunded;

        // Calculate date range
        let dateRange = '0 Days';
        if (fromDate && toDate) {
            const start = new Date(fromDate);
            const end = new Date(toDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            dateRange = `${diffDays} Day${diffDays !== 1 ? 's' : ''}`;
        }

        // Calculate total profit
        const invoicesWithItems = await prisma.invoice.findMany({
            where,
            include: {
                invoice_items: {
                    include: {
                        stock: true
                    }
                }
            }
        });

        const totalProfit = invoicesWithItems.reduce((totalSum, invoice) => {
            const invoiceProfit = invoice.invoice_items.reduce((itemSum, item) => {
                const cost = item.stock.cost_price || 0;
                const price = item.current_price || 0;
                const qty = item.qty || 0;
                const returnedQty = item.returned_qty || 0;
                const effectiveQty = qty - returnedQty;
                return itemSum + ((price - cost) * effectiveQty);
            }, 0);
            return totalSum + (invoiceProfit - (invoice.discount || 0));
        }, 0);

        return {
            totalSales: netSales,
            invoiceCount,
            totalProfit: totalProfit,
            dateRange,
            totalRefunded
        };
    }

    // Process payment for customer invoice (settle credit balance)
    static async processInvoicePayment(data) {
        const { invoice_number, payment_amount, payment_type_id, user_id } = data;

        return await prisma.$transaction(async (tx) => {
            // 1. Get the invoice
            const invoice = await tx.invoice.findFirst({
                where: { invoice_number: invoice_number },
                include: {
                    creadit_book: true
                }
            });

            if (!invoice) {
                throw new Error("Invoice not found.");
            }

            // 2. Get active credit book entry
            // Find entries with balance > 0
            const activeCredit = invoice.creadit_book.find(cb => cb.balance > 0);
            
            if (!activeCredit) {
                throw new Error("This invoice does not have an outstanding credit balance.");
            }

            if (payment_amount > activeCredit.balance) {
                throw new Error(`Payment amount (LKR ${payment_amount}) exceeds the outstanding balance (LKR ${activeCredit.balance}).`);
            }

            // 3. Create Invoice Payment record
            const paymentRecord = await tx.invoice_payments.create({
                data: {
                    invoice_id: invoice.id,
                    payment_types_id: parseInt(payment_type_id),
                    amount: parseFloat(payment_amount),
                    payment_date: getSriLankanTime()
                }
            });

            // 3.5 Record in credit_payment_history
            await tx.credit_payment_history.create({
                data: {
                    creadit_book_id: activeCredit.id,
                    amount: parseFloat(payment_amount),
                    payment_date: getSriLankanTime()
                }
            });

            // 4. Update Credit Book Balance
            const newBalance = activeCredit.balance - payment_amount;
            
            await tx.creadit_book.update({
                where: { id: activeCredit.id },
                data: {
                    balance: newBalance,
                    // If balance is 0, we could change status, but let's keep it simple as balance=0 is enough
                }
            });

            // 5. Update Cash Session if user_id is provided and there's an active session
            if (user_id) {
                const activeSession = await tx.cash_sessions.findFirst({
                    where: {
                        user_id: parseInt(user_id),
                        cash_status_id: 1 // Active
                    },
                    orderBy: { id: 'desc' }
                });

                if (activeSession) {
                    // Get payment type name to know which total to update
                    const paymentType = await tx.payment_types.findUnique({
                        where: { id: parseInt(payment_type_id) }
                    });

                    let updateData = {};
                    if (paymentType) {
                        const typeName = paymentType.payment_types.toLowerCase();
                        if (typeName === 'cash') {
                            updateData = { cash_total: { increment: parseFloat(payment_amount) } };
                        } else if (typeName === 'card') {
                            updateData = { card_total: { increment: parseFloat(payment_amount) } };
                        } else if (typeName.includes('bank') || typeName === 'cheque' || typeName === 'online') {
                            // Map bank, cheque, and online payments to bank_total
                            updateData = { bank_total: { increment: parseFloat(payment_amount) } };
                        }

                        if (Object.keys(updateData).length > 0) {
                            await tx.cash_sessions.update({
                                where: { id: activeSession.id },
                                data: updateData
                            });
                        }
                    }
                }
            }

            return {
                success: true,
                payment: paymentRecord,
                remainingBalance: newBalance
            };
        }, {
            timeout: 15000 // Extended timeout to 15s for credit payment processing
        });
    }

    // Process credit payment for customer (across multiple invoices)
    static async processCreditPayment(data) {
        const { customer_id, payment_amount, payment_type_id, user_id } = data;

        // Pre-fetch payment type details outside transaction
        const paymentType = await prisma.payment_types.findUnique({
            where: { id: parseInt(payment_type_id) }
        });

        if (!paymentType) {
            throw new Error("Invalid payment type.");
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Validate customer
            const customer = await tx.customer.findUnique({
                where: { id: parseInt(customer_id) }
            });

            if (!customer) {
                throw new Error("Customer not found.");
            }

            // 2. Get all credit book entries with balance > 0, ordered by creation date (oldest first)
            const creditEntries = await tx.creadit_book.findMany({
                where: {
                    invoice: {
                        customer_id: parseInt(customer_id)
                    },
                    balance: { gt: 0 }
                },
                include: {
                    invoice: true
                },
                orderBy: {
                    created_at: 'asc' // Pay oldest debts first (FIFO)
                }
            });

            if (creditEntries.length === 0) {
                throw new Error("This customer does not have any outstanding credit balance.");
            }

            // Calculate total debt
            const totalDebt = creditEntries.reduce((sum, entry) => sum + entry.balance, 0);

            if (payment_amount > totalDebt) {
                throw new Error(`Payment amount (Rs. ${payment_amount}) exceeds the total outstanding balance (Rs. ${totalDebt}).`);
            }

            if (payment_amount <= 0) {
                throw new Error("Payment amount must be greater than zero.");
            }

            // 3. Distribute payment across credit entries
            let remainingPayment = parseFloat(payment_amount);
            const paymentsApplied = [];
            const creditHistoryRecords = [];

            for (const creditEntry of creditEntries) {
                if (remainingPayment <= 0) break;

                const amountToApply = Math.min(remainingPayment, creditEntry.balance);
                const newBalance = creditEntry.balance - amountToApply;

                // Create invoice payment record
                const paymentRecord = await tx.invoice_payments.create({
                    data: {
                        invoice_id: creditEntry.invoice.id,
                        payment_types_id: parseInt(payment_type_id),
                        amount: amountToApply,
                        payment_date: getSriLankanTime()
                    }
                });

                // Update credit book balance
                await tx.creadit_book.update({
                    where: { id: creditEntry.id },
                    data: {
                        balance: newBalance
                    }
                });

                // Record in credit_payment_history
                await tx.credit_payment_history.create({
                    data: {
                        creadit_book_id: creditEntry.id,
                        amount: amountToApply,
                        payment_date: getSriLankanTime()
                    }
                });

                paymentsApplied.push({
                    invoiceNumber: creditEntry.invoice.invoice_number,
                    amountPaid: amountToApply,
                    previousBalance: creditEntry.balance,
                    newBalance: newBalance
                });

                remainingPayment -= amountToApply;
            }

            // 4. Update Cash Session if user_id is provided
            if (user_id) {
                const activeSession = await tx.cash_sessions.findFirst({
                    where: {
                        user_id: parseInt(user_id),
                        cash_status_id: 1 // Active
                    },
                    orderBy: { id: 'desc' }
                });

                if (activeSession) {
                    // Use pre-fetched payment type to determine which total to update
                    let updateData = {};
                    const typeName = paymentType.payment_types.toLowerCase();
                    
                    if (typeName === 'cash') {
                        updateData = { cash_total: { increment: parseFloat(payment_amount) } };
                    } else if (typeName === 'card') {
                        updateData = { card_total: { increment: parseFloat(payment_amount) } };
                    } else if (typeName.includes('bank') || typeName === 'cheque' || typeName === 'online') {
                        // Map bank, cheque, and online payments to bank_total
                        updateData = { bank_total: { increment: parseFloat(payment_amount) } };
                    }

                    if (Object.keys(updateData).length > 0) {
                        await tx.cash_sessions.update({
                            where: { id: activeSession.id },
                            data: updateData
                        });
                    }
                }
            }

            // Calculate new total balance
            const newTotalBalance = totalDebt - payment_amount;

            return {
                success: true,
                totalPaid: payment_amount,
                previousTotalBalance: totalDebt,
                newTotalBalance: newTotalBalance,
                paymentsApplied: paymentsApplied,
                invoicesPaid: paymentsApplied.length
            };
        }, {
            timeout: 20000 // Extended timeout to 20s for multi-invoice credit payment processing
        });
    }

    // Get return history
    static async getReturnHistory(filters, limit, offset) {
        const { invoiceNumber, fromDate, toDate } = filters;
        
        const where = {};
        if (invoiceNumber) {
            where.invoice = {
                invoice_number: { contains: invoiceNumber }
            };
        }
        
        if (fromDate || toDate) {
            const dateFilter = {};
            if (fromDate) dateFilter.gte = new Date(fromDate);
            if (toDate) dateFilter.lte = new Date(toDate);
            
            where.cash_sessions = {
                opening_date_time: dateFilter
            };
        }

        const [returns, totalRecords] = await Promise.all([
            prisma.return_goods.findMany({
                where,
                include: {
                    cash_sessions: true,
                    invoice: {
                        include: {
                            customer: true,
                            cash_sessions: {
                                include: {
                                    user: true
                                }
                            }
                        }
                    }
                },
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.return_goods.count({ where })
        ]);

        return { returns, totalRecords };
    }

    // Get credit payment history for a customer (grouped by invoice)
    static async getCreditPaymentHistory(customerId, page = 1, limit = 10) {
        if (!customerId) {
            const emptyPagination = PaginationHelper.getPaginationMetadata(page, limit, 0);
            return { 
                history: [], 
                pagination: {
                    ...emptyPagination,
                    hasMore: false
                }
            };
        }

        // Get all invoices with credit history for this customer
        const invoicesWithPayments = await prisma.invoice.findMany({
            where: {
                customer_id: parseInt(customerId),
                creadit_book: {
                    some: {
                        credit_payment_history: {
                            some: {}
                        }
                    }
                }
            },
            include: {
                creadit_book: {
                    include: {
                        credit_payment_history: {
                            orderBy: {
                                payment_date: 'desc'
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Group payments by invoice
        const groupedHistory = invoicesWithPayments.map(invoice => {
            // Get current balance from credit_book (should be one record per invoice)
            const currentBalance = invoice.creadit_book[0]?.balance || 0;
            
            // Get all payments for this invoice
            const payments = invoice.creadit_book.flatMap(cb => 
                cb.credit_payment_history.map(payment => ({
                    id: payment.id,
                    amount: payment.amount,
                    date: payment.payment_date,
                    paymentType: 'Credit Payment' // Can be enhanced if payment type is stored
                }))
            );

            return {
                invoiceNumber: invoice.invoice_number,
                invoiceId: invoice.id,
                currentBalance: currentBalance,
                totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
                paymentCount: payments.length,
                payments: payments
            };
        });

        // Apply pagination to grouped data
        const offset = PaginationHelper.getSkip(page, limit);
        const paginatedHistory = groupedHistory.slice(offset, offset + limit);
        const totalRecords = groupedHistory.length;

        const paginationMetadata = PaginationHelper.getPaginationMetadata(page, limit, totalRecords);

        return {
            history: paginatedHistory,
            pagination: {
                ...paginationMetadata,
                hasMore: paginationMetadata.hasNextPage
            }
        };
    }
}

module.exports = POS;